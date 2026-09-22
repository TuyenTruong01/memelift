import { arc, arcTestnet } from "viem/chains";

export const ARC_USDC = "0x3600000000000000000000000000000000000000" as const;

export const arcMainnet = arc;
export { arcTestnet };

export const arcNetwork = process.env.NEXT_PUBLIC_ARC_NETWORK === "testnet" ? arcTestnet : arcMainnet;

export const ARC_EXPLORER = arcNetwork.blockExplorers.default.url;
