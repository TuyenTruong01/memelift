require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const accounts = process.env.DEPLOYER_PRIVATE_KEY
  ? [process.env.DEPLOYER_PRIVATE_KEY]
  : [];

/** @type import('hardhat/config').HardhatUserConfig */
module.exports = {
  solidity: {
    version: "0.8.24",
    settings: {
      optimizer: { enabled: true, runs: 300 },
      viaIR: true
    }
  },
  networks: {
    arcMainnet: {
      url: process.env.ARC_MAINNET_RPC || "https://rpc.mainnet.arc.io",
      chainId: 5042,
      accounts
    },
    arcTestnet: {
      url: process.env.ARC_TESTNET_RPC || "https://rpc.testnet.arc.io",
      chainId: 5042002,
      accounts
    }
  },
  mocha: { timeout: 60000 }
};
