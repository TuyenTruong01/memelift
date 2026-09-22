"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { erc20Abi, type Address } from "viem";
import { usePublicClient } from "wagmi";
import { factoryAbi, launchAbi } from "@/lib/abis";
import { FACTORY_ADDRESS, FACTORY_CONFIGURED } from "@/lib/contracts";
import { ARC_EXPLORER, arcNetwork } from "@/lib/arc";
import { compactNumber, ipfsToHttp, shortAddress } from "@/lib/format";

interface LaunchCardData {
  launch: Address;
  token: Address;
  creator: Address;
  metadataURI: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  realUsdcReserve: bigint;
  marketCapE18: bigint;
  progressBps: bigint;
}

export default function Home() {
  const router = useRouter();
  const publicClient = usePublicClient();
  const [items, setItems] = useState<LaunchCardData[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [sort, setSort] = useState<"newest" | "marketCap">("newest");
  const [copiedToken, setCopiedToken] = useState<Address | "">("");

  const visibleItems = useMemo(() => {
    const query = search.trim().toLowerCase();
    const filtered = query
      ? items.filter((item) => [item.name, item.symbol, item.token, item.creator].some((value) => value.toLowerCase().includes(query)))
      : items;

    return [...filtered].sort((a, b) => {
      if (sort === "marketCap") return a.marketCapE18 === b.marketCapE18 ? 0 : a.marketCapE18 > b.marketCapE18 ? -1 : 1;
      return 0;
    });
  }, [items, search, sort]);

  async function copyTokenAddress(event: React.MouseEvent<HTMLButtonElement>, token: Address) {
    event.preventDefault();
    event.stopPropagation();

    try {
      await navigator.clipboard.writeText(token);
      setCopiedToken(token);
      window.setTimeout(() => setCopiedToken((current) => current === token ? "" : current), 1_500);
    } catch {
      setError("Could not copy the token contract address.");
    }
  }

  // Warm the creation route after the landing page becomes interactive. This avoids
  // making navigation feel slow on its first visit, especially in `next dev`.
  useEffect(() => {
    const prefetch = () => router.prefetch("/create");
    const idleCallback = window.requestIdleCallback?.(prefetch);
    if (idleCallback !== undefined) return () => window.cancelIdleCallback?.(idleCallback);

    const timeout = window.setTimeout(prefetch, 250);
    return () => window.clearTimeout(timeout);
  }, [router]);

  useEffect(() => {
    const client = publicClient;
    const factoryAddress = FACTORY_ADDRESS;
    if (!client || !FACTORY_CONFIGURED || !factoryAddress) return;

    let cancelled = false;

    async function load() {
      if (!client || !factoryAddress) return;
      setLoading(true);
      setError("");
      try {
        console.log("Arc network:", arcNetwork.name);
        console.log("Chain ID:", client.chain?.id);
        console.log("Factory:", factoryAddress);

        const code = await client.getBytecode({ address: factoryAddress });
        if (!code || code === "0x") {
          throw new Error("Factory not deployed on selected network");
        }

        const count = (await client.readContract({
          address: factoryAddress,
          abi: factoryAbi,
          functionName: "launchCount",
        })) as bigint;

        const total = Number(count);
        const start = Math.max(0, total - 24);
        const indices = Array.from({ length: total - start }, (_, i) => total - 1 - i);

        const launches = await Promise.all(
          indices.map((index) =>
            client.readContract({
              address: factoryAddress,
              abi: factoryAbi,
              functionName: "launches",
              args: [BigInt(index)],
            })
          )
        );

        const cards = await Promise.all(
          launches.map(async (launch) => {
            const launchAddress = launch as Address;
            const [token, creator, metadataURI, totalSupply, marketState] = await Promise.all([
              client.readContract({ address: launchAddress, abi: launchAbi, functionName: "token" }),
              client.readContract({ address: launchAddress, abi: launchAbi, functionName: "creator" }),
              client.readContract({ address: launchAddress, abi: launchAbi, functionName: "metadataURI" }),
              client.readContract({ address: launchAddress, abi: launchAbi, functionName: "totalSupply" }),
              client.readContract({ address: launchAddress, abi: launchAbi, functionName: "marketState" }),
            ]);

            const tokenAddress = token as Address;
            const [name, symbol] = await Promise.all([
              client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "name" }),
              client.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
            ]);

            const state = marketState as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];

            return {
              launch: launchAddress,
              token: tokenAddress,
              creator: creator as Address,
              metadataURI: metadataURI as string,
              name: name as string,
              symbol: symbol as string,
              totalSupply: totalSupply as bigint,
              realUsdcReserve: state[1],
              marketCapE18: state[5],
              progressBps: state[6],
            } satisfies LaunchCardData;
          })
        );

        if (!cancelled) setItems(cards);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load launches.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    const timer = window.setInterval(load, 15_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [publicClient]);

  return (
    <>
      <section className="hero">
        <div>
          <div className="eyebrow">Built natively for Arc + USDC</div>
          <h1>Launch a meme market without an initial LP.</h1>
          <p>
            Fixed supply. No owner mint. No presale allocation. Every token starts inside a
            transparent USDC bonding curve on Arc.
          </p>
          <div className="hero-actions">
            <Link href="/create" className="button button-primary">Create a launch</Link>
            <a className="button" href={ARC_EXPLORER} target="_blank" rel="noreferrer">
              Arc Explorer
            </a>
          </div>
        </div>
        <div className="hero-note">
          <span className="small">Initial implied market cap</span>
          <strong>$1,000</strong>
          <div className="hero-curve" aria-hidden="true">
            <svg viewBox="0 0 260 72" role="presentation">
              <path d="M8 62 C68 61 113 54 151 35 C179 21 206 10 252 8" />
              <path className="curve-area" d="M8 62 C68 61 113 54 151 35 C179 21 206 10 252 8 L252 68 L8 68 Z" />
            </svg>
          </div>
          <div className="hero-reserve"><span>Virtual reserve</span><b>1,000 USDC</b></div>
          <p>Real USDC only enters when someone buys.</p>
        </div>
      </section>

      {!FACTORY_CONFIGURED && (
        <div className="notice error">
          Factory address is not configured. Deploy MemeFactory, then set NEXT_PUBLIC_FACTORY_ADDRESS.
        </div>
      )}

      <div className="section-head">
        <div>
          <div className="eyebrow">Live contracts</div>
          <h2>Latest launches</h2>
        </div>
        <span className="small">Auto-refreshes every 15s</span>
      </div>

      <div className="launch-toolbar">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search token or contract..."
          aria-label="Search launches"
        />
        <select value={sort} onChange={(event) => setSort(event.target.value as "newest" | "marketCap")} aria-label="Sort launches">
          <option value="newest">Newest</option>
          <option value="marketCap">Market Cap</option>
        </select>
      </div>

      {error && <div className="notice error">{error}</div>}

      {loading && items.length === 0 ? (
        <div className="grid">
          <div className="skeleton" /><div className="skeleton" /><div className="skeleton" />
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="empty">
          {items.length === 0 ? "No launches yet. Be the first one to create a fixed-supply meme on Arc." : "No launches match your search."}
        </div>
      ) : (
        <div className="grid">
          {visibleItems.map((item) => {
            const image = ipfsToHttp(item.metadataURI);
            const progress = Math.min(100, Number(item.progressBps) / 100);
            return (
              <Link key={item.launch} href={`/token/${item.launch}`} className="card">
                <div className="token-title">
                  {image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img className="token-avatar" src={image} alt="" />
                  ) : (
                    <div className="token-avatar">{item.symbol.slice(0, 2)}</div>
                  )}
                  <div className="token-summary">
                    <h3 className="token-card-name">
                      <span className="token-name" title={item.name}>{item.name}</span>
                      <span className="token-symbol">– {item.symbol}</span>
                    </h3>
                    <div className="token-contract">
                      <span>Contract: {shortAddress(item.token)}</span>
                      <button
                        type="button"
                        className="copy-address"
                        onClick={(event) => copyTokenAddress(event, item.token)}
                        aria-label={`Copy ${item.name} token contract address`}
                      >
                        {copiedToken === item.token ? "Copied" : "⧉"}
                      </button>
                    </div>
                  </div>
                </div>
                <div className="stats">
                  <div className="stat">
                    <label>Market cap</label>
                    <strong>${compactNumber(item.marketCapE18, 18, 2)}</strong>
                  </div>
                  <div className="stat">
                    <label>USDC reserve</label>
                    <strong>{compactNumber(item.realUsdcReserve, 6, 2)} USDC</strong>
                  </div>
                  <div className="stat">
                    <label>Supply</label>
                    <strong>{compactNumber(item.totalSupply, 18, 2)}</strong>
                  </div>
                  <div className="stat">
                    <label>Creator</label>
                    <strong>{shortAddress(item.creator)}</strong>
                  </div>
                </div>
                <div className="curve-progress-head"><span>Bonding curve</span><strong>{progress.toFixed(1)}%</strong></div>
                <div className="progress progress-strong" title={`${progress}% sold`}>
                  <div style={{ width: `${progress}%` }} />
                </div>
                <div className="card-footer"><span>Fixed supply</span><span className="trade-cta">Trade <span aria-hidden="true">→</span></span></div>
              </Link>
            );
          })}
        </div>
      )}
    </>
  );
}
