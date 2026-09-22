const hre = require("hardhat");

async function main() {
  const { ethers } = hre;
  const isMainnet = hre.network.name === "arcMainnet";
  const prefix = isMainnet ? "ARC_MAINNET" : "ARC_TESTNET";
  const expectedChainId = isMainnet ? 5_042n : 5_042_002n;
  const treasury = process.env[`${prefix}_PROTOCOL_TREASURY_ADDRESS`];
  if (!ethers.isAddress(treasury)) throw new Error(`Invalid ${prefix}_PROTOCOL_TREASURY_ADDRESS`);
  if (treasury === ethers.ZeroAddress) throw new Error("Protocol treasury cannot be the zero address");

  const [deployer] = await ethers.getSigners();
  const network = await ethers.provider.getNetwork();
  if (network.chainId !== expectedChainId) throw new Error(`Unexpected chain ID: ${network.chainId}`);

  const usdcAddress = process.env[`${prefix}_USDC_ADDRESS`];
  if (!ethers.isAddress(usdcAddress)) throw new Error(`Invalid ${prefix}_USDC_ADDRESS`);
  const usdc = await ethers.getContractAt("IERC20", usdcAddress);

  console.log(`Chain ID: ${network.chainId}`);
  console.log(`Treasury: ${ethers.getAddress(treasury)}`);
  console.log("Treasury non-zero: true");
  console.log(`Deployer: ${deployer.address}`);
  console.log(`Treasury is deployer: ${ethers.getAddress(treasury) === deployer.address}`);
  console.log(`Deployer native balance: ${ethers.formatEther(await ethers.provider.getBalance(deployer.address))}`);
  console.log(`Deployer test USDC balance: ${ethers.formatUnits(await usdc.balanceOf(deployer.address), 6)}`);
  console.log(`Treasury native balance: ${ethers.formatEther(await ethers.provider.getBalance(treasury))}`);
  console.log(`Treasury USDC balance: ${ethers.formatUnits(await usdc.balanceOf(treasury), 6)}`);
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
