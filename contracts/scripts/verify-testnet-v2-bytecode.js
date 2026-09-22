const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const { ethers } = hre;
  if (hre.network.name !== "arcTestnet") throw new Error("Run this comparison on arcTestnet");

  const deployment = JSON.parse(fs.readFileSync(path.join(__dirname, "..", "deployments", "arcTestnet.json"), "utf8"));
  if (deployment.version !== "V2") throw new Error("Recorded testnet deployment is not V2");

  const transaction = await ethers.provider.getTransaction(deployment.deploymentTransaction);
  if (!transaction) throw new Error("Testnet V2 deployment transaction was not found");

  const Factory = await ethers.getContractFactory("MemeFactory");
  const expected = await Factory.getDeployTransaction(
    deployment.usdc,
    ethers.parseUnits(deployment.virtualUsdc, 6),
    deployment.protocolTreasury
  );
  const identical = transaction.data.toLowerCase() === expected.data.toLowerCase();
  console.log(`Testnet V2 creation bytecode matches current compiled source: ${identical}`);
  if (!identical) throw new Error("Current compiled contracts differ from the testnet V2 deployment");
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
