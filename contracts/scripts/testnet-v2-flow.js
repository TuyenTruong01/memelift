const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function sendAndWait(transactionPromise) {
  const transaction = await transactionPromise;
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Transaction failed: ${transaction.hash}`);
  return { transaction, receipt };
}

async function accounting(usdc, launch) {
  const [realReserve, creatorFees, protocolFees, balance] = await Promise.all([
    launch.realUsdcReserve(),
    launch.creatorFeesAccrued(),
    launch.protocolFeesAccrued(),
    usdc.balanceOf(await launch.getAddress()),
  ]);
  return {
    realReserve,
    creatorFees,
    protocolFees,
    balance,
    expectedBalance: realReserve + creatorFees + protocolFees,
    invariantHolds: balance === realReserve + creatorFees + protocolFees,
  };
}

async function main() {
  const { ethers } = hre;
  const [signer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 5_042_002n) throw new Error(`Unexpected chain ID: ${network.chainId}`);

  const deploymentPath = path.join(__dirname, "..", "deployments", "arcTestnet.json");
  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  if (deployment.version !== "V2") throw new Error("Latest Arc Testnet deployment is not marked V2");

  const factory = await ethers.getContractAt("MemeFactory", deployment.factory, signer);
  const treasury = await factory.protocolTreasury();
  const usdc = await ethers.getContractAt("IERC20", await factory.usdc(), signer);
  const supply = ethers.parseUnits("1000000000", 18);
  const deadline = () => BigInt(Math.floor(Date.now() / 1000) + 3600);

  const created = await sendAndWait(factory.createLaunch("MemeLift V2 Test", "MLV2", supply, ""));
  const parsed = created.receipt.logs
    .map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } })
    .find((log) => log?.name === "LaunchCreated");
  if (!parsed) throw new Error("LaunchCreated event not found");

  const launchAddress = parsed.args.launch;
  const tokenAddress = parsed.args.token;
  const launch = await ethers.getContractAt("MemeLaunch", launchAddress, signer);
  const token = await ethers.getContractAt("MemeToken", tokenAddress, signer);

  const grossBuy = ethers.parseUnits("5", 6);
  const buyQuote = await launch.getBuyQuote(grossBuy);
  const approvedUsdc = await sendAndWait(usdc.approve(launchAddress, grossBuy));
  const bought = await sendAndWait(launch.buy(grossBuy, buyQuote.tokenOut, signer.address, deadline()));

  const tokenIn = buyQuote.tokenOut / 2n;
  const sellQuote = await launch.getSellQuote(tokenIn);
  const approvedToken = await sendAndWait(token.approve(launchAddress, tokenIn));
  const sold = await sendAndWait(launch.sell(tokenIn, sellQuote.netUsdcOut, signer.address, deadline()));

  const beforeClaims = await accounting(usdc, launch);
  if (!beforeClaims.invariantHolds) throw new Error("USDC accounting invariant failed before claims");

  const creatorClaimed = await sendAndWait(launch.claimCreatorFees());
  const afterCreatorClaim = await accounting(usdc, launch);
  if (!afterCreatorClaim.invariantHolds || afterCreatorClaim.creatorFees !== 0n) {
    throw new Error("Creator claim accounting failed");
  }

  let protocolClaim = null;
  let afterProtocolClaim = null;
  if (treasury.toLowerCase() === signer.address.toLowerCase()) {
    protocolClaim = await sendAndWait(launch.claimProtocolFees());
    afterProtocolClaim = await accounting(usdc, launch);
    if (!afterProtocolClaim.invariantHolds || afterProtocolClaim.protocolFees !== 0n) {
      throw new Error("Protocol claim accounting failed");
    }
  }

  const formatAccounting = (state) => state && ({
    realUsdcReserve: state.realReserve.toString(),
    creatorFeesAccrued: state.creatorFees.toString(),
    protocolFeesAccrued: state.protocolFees.toString(),
    contractUsdcBalance: state.balance.toString(),
    expectedBalance: state.expectedBalance.toString(),
    invariantHolds: state.invariantHolds,
  });
  const output = {
    runAt: new Date().toISOString(),
    chainId: network.chainId.toString(),
    factory: deployment.factory,
    creator: signer.address,
    protocolTreasury: treasury,
    launch: launchAddress,
    token: tokenAddress,
    grossBuyUsdc: grossBuy.toString(),
    tokenBought: buyQuote.tokenOut.toString(),
    tokenSold: tokenIn.toString(),
    transactions: {
      create: created.transaction.hash,
      approveUsdc: approvedUsdc.transaction.hash,
      buy: bought.transaction.hash,
      approveToken: approvedToken.transaction.hash,
      sell: sold.transaction.hash,
      creatorClaim: creatorClaimed.transaction.hash,
      protocolClaim: protocolClaim?.transaction.hash || null,
    },
    beforeClaims: formatAccounting(beforeClaims),
    afterCreatorClaim: formatAccounting(afterCreatorClaim),
    afterProtocolClaim: formatAccounting(afterProtocolClaim),
    protocolClaimRequiresTreasuryWallet: protocolClaim === null,
  };

  const outputPath = path.join(__dirname, "..", "deployments", "arcTestnet-v2-flow.json");
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
  console.log(`Saved: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
