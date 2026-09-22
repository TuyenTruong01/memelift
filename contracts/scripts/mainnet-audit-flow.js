const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers } = hre;
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 5_042n) throw new Error(`Unexpected chain ID: ${network.chainId}`);

  const flowPath = path.join(__dirname, "..", "deployments", "arcMainnet-flow.json");
  const flow = JSON.parse(fs.readFileSync(flowPath, "utf8"));
  const launch = await ethers.getContractAt("MemeLaunch", flow.launch);
  const token = await ethers.getContractAt("MemeToken", flow.token);
  const usdc = await ethers.getContractAt("IERC20", await launch.usdc());
  const createReceipt = await ethers.provider.getTransactionReceipt(flow.transactions.create);
  if (!createReceipt) throw new Error("Create receipt not found");

  const treasury = flow.protocolTreasury;
  const [buyEvents, sellEvents, protocolClaimEvents] = await Promise.all([
    launch.queryFilter(launch.filters.Bought(treasury), createReceipt.blockNumber, "latest"),
    launch.queryFilter(launch.filters.Sold(treasury), createReceipt.blockNumber, "latest"),
    launch.queryFilter(launch.filters.ProtocolFeesClaimed(treasury), createReceipt.blockNumber, "latest"),
  ]);
  const buyEvent = buyEvents.at(-1);
  const sellEvent = sellEvents.at(-1);
  const protocolClaimEvent = protocolClaimEvents.at(-1);

  const [realReserve, creatorFees, protocolFees, contractBalance, treasuryTokenBalance, spotPrice] = await Promise.all([
    launch.realUsdcReserve(),
    launch.creatorFeesAccrued(),
    launch.protocolFeesAccrued(),
    usdc.balanceOf(flow.launch),
    token.balanceOf(treasury),
    launch.spotPriceE18(),
  ]);
  const expectedBalance = realReserve + creatorFees + protocolFees;
  const output = {
    ...flow,
    auditedAt: new Date().toISOString(),
    transactions: {
      ...flow.transactions,
      buy: buyEvent?.transactionHash || null,
      sell: sellEvent?.transactionHash || null,
      protocolClaim: protocolClaimEvent?.transactionHash || null,
    },
    trade: {
      buyer: treasury,
      tokenReceivedFromBuy: buyEvent?.args.tokenOut?.toString() || null,
      tokenSold: sellEvent?.args.tokenIn?.toString() || null,
      treasuryTokenBalance: treasuryTokenBalance.toString(),
      protocolFeesClaimed: protocolClaimEvent?.args.amount?.toString() || "0",
    },
    accounting: {
      realUsdcReserve: realReserve.toString(),
      creatorFeesAccrued: creatorFees.toString(),
      protocolFeesAccrued: protocolFees.toString(),
      contractUsdcBalance: contractBalance.toString(),
      expectedBalance: expectedBalance.toString(),
      spotPriceE18: spotPrice.toString(),
      invariantHolds: contractBalance === expectedBalance,
    },
  };
  fs.writeFileSync(flowPath, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
  if (!buyEvent || !sellEvent) throw new Error("Treasury buy and sell events are not both present yet");
  if (!output.accounting.invariantHolds) throw new Error("USDC accounting invariant failed");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
