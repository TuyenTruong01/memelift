const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

const NETWORK_CONFIG = {
  arcTestnet: {
    usdc: process.env.ARC_TESTNET_USDC_ADDRESS,
    protocolTreasury: process.env.ARC_TESTNET_PROTOCOL_TREASURY_ADDRESS,
    chainId: 5042002
  },
  arcMainnet: {
    usdc: process.env.ARC_MAINNET_USDC_ADDRESS,
    protocolTreasury: process.env.ARC_MAINNET_PROTOCOL_TREASURY_ADDRESS,
    chainId: 5042
  }
};

async function main() {
  const { ethers, network } = hre;
  const [deployer] = await ethers.getSigners();
  const chain = await ethers.provider.getNetwork();

  const config = NETWORK_CONFIG[network.name];
  if (!config || !config.usdc || !config.protocolTreasury) {
    throw new Error(`Missing USDC or protocol treasury configuration for ${network.name}`);
  }
  if (chain.chainId !== BigInt(config.chainId)) throw new Error(`Unexpected chain ID: ${chain.chainId}`);
  const usdcAddress = config.usdc;
  const virtualUsdcText = process.env.VIRTUAL_USDC || "1000";
  const virtualUsdcReserve = ethers.parseUnits(virtualUsdcText, 6);

  console.log(`Network: ${network.name} (${chain.chainId})`);
  console.log(`Deployer: ${deployer.address}`);
  console.log(`USDC: ${usdcAddress}`);
  console.log(`Protocol treasury: ${config.protocolTreasury}`);
  console.log(`Virtual reserve: ${virtualUsdcText} USDC`);

  const Factory = await ethers.getContractFactory("MemeFactory");
  const factory = await Factory.deploy(usdcAddress, virtualUsdcReserve, config.protocolTreasury);
  await factory.waitForDeployment();

  const factoryAddress = await factory.getAddress();
  const deploymentTransaction = factory.deploymentTransaction();
  if (!deploymentTransaction) throw new Error("Deployment transaction is unavailable");
  const receipt = await deploymentTransaction.wait();
  if (!receipt) throw new Error("Deployment receipt is unavailable");
  console.log(`MemeFactory: ${factoryAddress}`);
  console.log(`Deployment transaction: ${deploymentTransaction.hash}`);
  console.log(`Block: ${receipt.blockNumber}`);

  const output = {
    deployedAt: new Date().toISOString(),
    network: network.name,
    version: "V2",
    chainId: chain.chainId.toString(),
    deployer: deployer.address,
    usdc: usdcAddress,
    protocolTreasury: config.protocolTreasury,
    virtualUsdc: virtualUsdcText,
    factory: factoryAddress,
    deploymentTransaction: deploymentTransaction.hash,
    blockNumber: receipt.blockNumber
  };

  const dir = path.join(__dirname, "..", "deployments");
  fs.mkdirSync(dir, { recursive: true });
  const filename = path.join(dir, `${network.name}.json`);
  fs.writeFileSync(filename, JSON.stringify(output, null, 2) + "\n");
  console.log(`Saved: ${filename}`);
  console.log("\nFrontend env:");
  const frontendVariable = network.name === "arcTestnet"
    ? "NEXT_PUBLIC_TESTNET_FACTORY_ADDRESS"
    : "NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS";
  console.log(`${frontendVariable}=${factoryAddress}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
