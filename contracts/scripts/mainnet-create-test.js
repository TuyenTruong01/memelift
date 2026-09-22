const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers } = hre;
  const [creator] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== 5_042n) throw new Error(`Unexpected chain ID: ${network.chainId}`);

  const deploymentPath = path.join(__dirname, "..", "deployments", "arcMainnet.json");
  const outputPath = path.join(__dirname, "..", "deployments", "arcMainnet-flow.json");
  if (fs.existsSync(outputPath)) throw new Error("Mainnet test flow already exists; refusing to create a second test token");

  const deployment = JSON.parse(fs.readFileSync(deploymentPath, "utf8"));
  const factory = await ethers.getContractAt("MemeFactory", deployment.factory, creator);
  if (await factory.launchCount() !== 0n) throw new Error("Factory already has a launch; refusing to create another automatically");

  const transaction = await factory.createLaunch(
    "MemeLift Mainnet Test",
    "MLTEST",
    ethers.parseUnits("1000000000", 18),
    ""
  );
  const receipt = await transaction.wait();
  if (!receipt || receipt.status !== 1) throw new Error(`Create transaction failed: ${transaction.hash}`);
  const parsed = receipt.logs
    .map((log) => { try { return factory.interface.parseLog(log); } catch { return null; } })
    .find((log) => log?.name === "LaunchCreated");
  if (!parsed) throw new Error("LaunchCreated event not found");

  const output = {
    runAt: new Date().toISOString(),
    chainId: network.chainId.toString(),
    factory: deployment.factory,
    creator: creator.address,
    protocolTreasury: await factory.protocolTreasury(),
    launch: parsed.args.launch,
    token: parsed.args.token,
    transactions: { create: transaction.hash, buy: null, sell: null },
  };
  fs.writeFileSync(outputPath, JSON.stringify(output, null, 2) + "\n");
  console.log(JSON.stringify(output, null, 2));
  console.log(`Saved: ${outputPath}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
