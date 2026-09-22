import { formatUnits } from "viem";

const ipfsGateway = (process.env.NEXT_PUBLIC_IPFS_GATEWAY?.trim() || "https://gateway.pinata.cloud/ipfs").replace(/\/+$/, "");

export function shortAddress(value: string) {
  if (value.length < 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

export function compactNumber(value: bigint, decimals: number, maxFraction = 4) {
  const text = formatUnits(value, decimals);
  const n = Number(text);
  if (!Number.isFinite(n)) return text;
  if (Math.abs(n) >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(n) >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (Math.abs(n) >= 1_000) return `${(n / 1_000).toFixed(2)}K`;
  if (n === 0) return "0";
  if (Math.abs(n) < 0.000001) return n.toExponential(3);
  return n.toLocaleString(undefined, { maximumFractionDigits: maxFraction });
}

export function ipfsToHttp(uri: string) {
  if (!uri) return "";
  if (uri.startsWith("ipfs://")) {
    return `${ipfsGateway}/${uri.slice("ipfs://".length)}`;
  }
  if (uri.startsWith("https://") || uri.startsWith("http://")) return uri;
  return "";
}
