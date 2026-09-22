import { isAddress, type Address } from "viem";
import { arcNetwork } from "./arc";

const rawFactory = (arcNetwork.id === 5042002
  ? process.env.NEXT_PUBLIC_TESTNET_FACTORY_ADDRESS
  : process.env.NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS)?.trim() || "";

export const FACTORY_ADDRESS = rawFactory as Address;
export const FACTORY_CONFIGURED = isAddress(rawFactory);
