const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("MemeLift fee accounting", function () {
  const U = 1_000_000n;
  const VIRTUAL_USDC = 1_000n * U;
  const SUPPLY = ethers.parseUnits("1000000000", 18);
  const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 3600);

  async function fixture() {
    const [treasury, creator, buyer, other, third] = await ethers.getSigners();
    const usdc = await (await ethers.getContractFactory("MockUSDC")).deploy();
    const factory = await (await ethers.getContractFactory("MemeFactory")).deploy(await usdc.getAddress(), VIRTUAL_USDC, treasury.address);
    await factory.connect(creator).createLaunch("Arc Cat", "ACAT", SUPPLY, "ipfs://example");
    const launch = await ethers.getContractAt("MemeLaunch", await factory.launches(0));
    const token = await ethers.getContractAt("MemeToken", await launch.token());
    for (const trader of [buyer, other, third]) await usdc.mint(trader.address, 10_000n * U);
    return { treasury, creator, buyer, other, third, usdc, factory, launch, token };
  }

  async function buy(usdc, launch, trader, amount) {
    const [tokenOut] = await launch.getBuyQuote(amount);
    await usdc.connect(trader).approve(await launch.getAddress(), amount);
    await launch.connect(trader).buy(amount, tokenOut, trader.address, deadline());
    return tokenOut;
  }

  async function accountingInvariant(usdc, launch) {
    expect(await usdc.balanceOf(await launch.getAddress())).to.equal(
      (await launch.realUsdcReserve()) + (await launch.creatorFeesAccrued()) + (await launch.protocolFeesAccrued())
    );
  }

  it("creates fixed supply with no creator allocation or mint surface", async function () {
    const { treasury, creator, factory, launch, token } = await fixture();
    expect(await factory.launchCount()).to.equal(1n);
    expect(await factory.protocolTreasury()).to.equal(treasury.address);
    expect(await launch.creator()).to.equal(creator.address);
    expect(await launch.protocolTreasury()).to.equal(treasury.address);
    expect(await token.totalSupply()).to.equal(SUPPLY);
    expect(await token.balanceOf(await launch.getAddress())).to.equal(SUPPLY);
    expect(await token.balanceOf(creator.address)).to.equal(0n);
    expect(token.interface.fragments.some((f) => f.type === "function" && f.name === "mint")).to.equal(false);
  });

  it("uses the configured basis point constants", async function () {
    const { launch } = await fixture();
    expect(await launch.BPS()).to.equal(10_000n);
    expect(await launch.CREATOR_FEE_BPS()).to.equal(30n);
    expect(await launch.PROTOCOL_FEE_BPS()).to.equal(95n);
    expect(await launch.TOTAL_FEE_BPS()).to.equal(125n);
  });

  it("starts near a $1,000 implied market cap", async function () {
    const { launch } = await fixture();
    expect(await launch.spotPriceE18()).to.equal(1_000_000_000_000n);
    expect(await launch.marketCapE18()).to.equal(ethers.parseUnits("1000", 18));
  });

  it("splits a 100 USDC buy into curve input, creator fees, and protocol fees", async function () {
    const { buyer, usdc, launch, token } = await fixture();
    const gross = 100n * U;
    const [tokenOut, net, creatorFee, protocolFee] = await launch.getBuyQuote(gross);
    expect(creatorFee).to.equal(300_000n);
    expect(protocolFee).to.equal(950_000n);
    expect(net).to.equal(98_750_000n);
    expect(tokenOut).to.equal(await launch.quoteBuy(gross));
    await usdc.connect(buyer).approve(await launch.getAddress(), gross);
    await expect(launch.connect(buyer).buy(gross, tokenOut, buyer.address, deadline())).to.emit(launch, "FeesAccrued").withArgs(creatorFee, protocolFee);
    expect(await token.balanceOf(buyer.address)).to.equal(tokenOut);
    expect(await launch.realUsdcReserve()).to.equal(net);
    expect(await launch.creatorFeesAccrued()).to.equal(creatorFee);
    expect(await launch.protocolFeesAccrued()).to.equal(protocolFee);
    await accountingInvariant(usdc, launch);
  });

  it("charges sell fees from gross curve output and removes gross output from reserve", async function () {
    const { buyer, usdc, launch, token } = await fixture();
    const bought = await buy(usdc, launch, buyer, 100n * U);
    const beforeReserve = await launch.realUsdcReserve();
    const tokenIn = bought / 2n;
    const [netOut, grossOut, creatorFee, protocolFee] = await launch.getSellQuote(tokenIn);
    expect(netOut).to.equal(await launch.quoteSell(tokenIn));
    expect(grossOut).to.equal(netOut + creatorFee + protocolFee);
    const beforeBalance = await usdc.balanceOf(buyer.address);
    await token.connect(buyer).approve(await launch.getAddress(), tokenIn);
    await launch.connect(buyer).sell(tokenIn, netOut, buyer.address, deadline());
    expect(await usdc.balanceOf(buyer.address)).to.equal(beforeBalance + netOut);
    expect(await launch.realUsdcReserve()).to.equal(beforeReserve - grossOut);
    expect(await launch.creatorFeesAccrued()).to.equal(300_000n + creatorFee);
    expect(await launch.protocolFeesAccrued()).to.equal(950_000n + protocolFee);
    await accountingInvariant(usdc, launch);
  });

  it("rounds fees down independently for 1 USDC, 0.5 USDC, and tiny USDC units", async function () {
    const { launch } = await fixture();
    const one = await launch.getBuyQuote(U);
    expect(one[1]).to.equal(987_500n); expect(one[2]).to.equal(3_000n); expect(one[3]).to.equal(9_500n);
    const half = await launch.getBuyQuote(500_000n);
    expect(half[1]).to.equal(493_750n); expect(half[2]).to.equal(1_500n); expect(half[3]).to.equal(4_750n);
    const tiny = await launch.getBuyQuote(1n);
    expect(tiny[1]).to.equal(1n); expect(tiny[2]).to.equal(0n); expect(tiny[3]).to.equal(0n); expect(tiny[0]).to.be.gt(0n);
  });

  it("executes 1 USDC, 0.5 USDC, and one-smallest-unit buys using the quoted fee math", async function () {
    const { buyer, usdc, launch } = await fixture();
    let expectedReserve = 0n;
    let expectedCreatorFees = 0n;
    let expectedProtocolFees = 0n;
    for (const gross of [U, 500_000n, 1n]) {
      const [, net, creatorFee, protocolFee] = await launch.getBuyQuote(gross);
      await buy(usdc, launch, buyer, gross);
      expectedReserve += net;
      expectedCreatorFees += creatorFee;
      expectedProtocolFees += protocolFee;
      expect(await launch.realUsdcReserve()).to.equal(expectedReserve);
      expect(await launch.creatorFeesAccrued()).to.equal(expectedCreatorFees);
      expect(await launch.protocolFeesAccrued()).to.equal(expectedProtocolFees);
      await accountingInvariant(usdc, launch);
    }
  });

  it("only lets the creator claim creator fees and rejects a double claim", async function () {
    const { creator, buyer, other, usdc, launch } = await fixture();
    await buy(usdc, launch, buyer, 100n * U);
    const accrued = await launch.creatorFeesAccrued();
    await expect(launch.connect(other).claimCreatorFees()).to.be.revertedWithCustomError(launch, "Unauthorized");
    const before = await usdc.balanceOf(creator.address);
    await expect(launch.connect(creator).claimCreatorFees()).to.emit(launch, "CreatorFeesClaimed").withArgs(creator.address, accrued);
    expect(await usdc.balanceOf(creator.address)).to.equal(before + accrued);
    expect(await launch.creatorFeesAccrued()).to.equal(0n);
    await expect(launch.connect(creator).claimCreatorFees()).to.be.revertedWithCustomError(launch, "NoFeesAccrued");
    await accountingInvariant(usdc, launch);
  });

  it("only lets the configured treasury claim protocol fees and rejects a double claim", async function () {
    const { treasury, buyer, other, usdc, launch } = await fixture();
    await buy(usdc, launch, buyer, 100n * U);
    const accrued = await launch.protocolFeesAccrued();
    await expect(launch.connect(other).claimProtocolFees()).to.be.revertedWithCustomError(launch, "Unauthorized");
    const before = await usdc.balanceOf(treasury.address);
    await expect(launch.connect(treasury).claimProtocolFees()).to.emit(launch, "ProtocolFeesClaimed").withArgs(treasury.address, accrued);
    expect(await usdc.balanceOf(treasury.address)).to.equal(before + accrued);
    expect(await launch.protocolFeesAccrued()).to.equal(0n);
    await expect(launch.connect(treasury).claimProtocolFees()).to.be.revertedWithCustomError(launch, "NoFeesAccrued");
    await accountingInvariant(usdc, launch);
  });

  it("keeps a fee-paying round trip unprofitable", async function () {
    const { buyer, usdc, launch, token } = await fixture();
    const start = await usdc.balanceOf(buyer.address);
    const bought = await buy(usdc, launch, buyer, 250n * U);
    await token.connect(buyer).approve(await launch.getAddress(), bought);
    await launch.connect(buyer).sell(bought, 0, buyer.address, deadline());
    expect(await usdc.balanceOf(buyer.address)).to.be.lt(start);
    await accountingInvariant(usdc, launch);
  });

  it("enforces slippage, deadlines, invalid recipients, and excludes direct USDC from pricing", async function () {
    const { buyer, other, usdc, launch, token } = await fixture();
    const gross = 10n * U;
    const quote = await launch.quoteBuy(gross);
    await usdc.connect(buyer).approve(await launch.getAddress(), gross);
    await expect(launch.connect(buyer).buy(gross, quote + 1n, buyer.address, deadline())).to.be.revertedWithCustomError(launch, "SlippageExceeded");
    await launch.connect(buyer).buy(gross, 0, buyer.address, deadline());
    await token.connect(buyer).approve(await launch.getAddress(), quote);
    const sell = await launch.quoteSell(quote);
    await expect(launch.connect(buyer).sell(quote, sell + 1n, buyer.address, deadline())).to.be.revertedWithCustomError(launch, "SlippageExceeded");
    await expect(launch.connect(buyer).sell(quote, 0, buyer.address, 0)).to.be.revertedWithCustomError(launch, "DeadlineExpired");
    await expect(launch.connect(buyer).buy(gross, 0, ethers.ZeroAddress, deadline())).to.be.revertedWithCustomError(launch, "ZeroAddress");
    const before = await launch.quoteBuy(gross);
    await usdc.connect(other).transfer(await launch.getAddress(), 50n * U);
    expect(await launch.quoteBuy(gross)).to.equal(before);
    expect(await launch.realUsdcReserve()).to.equal(9_875_000n);
  });

  it("maintains supply and total USDC accounting across multiple traders", async function () {
    const { buyer, other, third, usdc, launch, token } = await fixture();
    const boughtA = await buy(usdc, launch, buyer, 20n * U); await accountingInvariant(usdc, launch);
    await buy(usdc, launch, other, 30n * U); await accountingInvariant(usdc, launch);
    await buy(usdc, launch, third, 40n * U); await accountingInvariant(usdc, launch);
    const sellA = boughtA * 30n / 100n;
    await token.connect(buyer).approve(await launch.getAddress(), sellA);
    await launch.connect(buyer).sell(sellA, 0, buyer.address, deadline()); await accountingInvariant(usdc, launch);
    const thirdBalance = await token.balanceOf(third.address);
    await token.connect(third).approve(await launch.getAddress(), thirdBalance / 2n);
    await launch.connect(third).sell(thirdBalance / 2n, 0, third.address, deadline()); await accountingInvariant(usdc, launch);
    expect(await launch.circulatingSupply()).to.equal(SUPPLY - await launch.tokenReserve());
    expect(await token.balanceOf(await launch.getAddress())).to.equal(await launch.tokenReserve());
  });

  it("registers independent launches and validates factory input", async function () {
    const { creator, factory } = await fixture();
    await factory.connect(creator).createLaunch("Arc Dog", "ADOG", SUPPLY, "");
    expect(await factory.launchCount()).to.equal(2n);
    expect(await factory.launches(0)).not.equal(await factory.launches(1));
    await expect(factory.connect(creator).createLaunch("", "X", SUPPLY, "")).to.be.revertedWithCustomError(factory, "InvalidName");
    await expect(factory.connect(creator).createLaunch("X", "", SUPPLY, "")).to.be.revertedWithCustomError(factory, "InvalidSymbol");
  });
});
