"use client";

import { useCallback, useEffect, useMemo, useState, type CSSProperties } from "react";
import { useParams } from "next/navigation";
import {
  erc20Abi,
  formatUnits,
  isAddress,
  parseUnits,
  type Address,
  type Hex,
} from "viem";
import {
  useAccount,
  usePublicClient,
  useSwitchChain,
  useWriteContract,
} from "wagmi";
import { ARC_EXPLORER, ARC_USDC, arcNetwork } from "@/lib/arc";
import { launchAbi } from "@/lib/abis";
import { compactNumber, ipfsToHttp, shortAddress } from "@/lib/format";

interface MarketData {
  token: Address;
  creator: Address;
  protocolTreasury: Address;
  creatorFeesAccrued: bigint;
  protocolFeesAccrued: bigint;
  metadataURI: string;
  name: string;
  symbol: string;
  totalSupply: bigint;
  tokenReserve: bigint;
  realUsdcReserve: bigint;
  curveUsdcReserve: bigint;
  circulatingSupply: bigint;
  spotPriceE18: bigint;
  marketCapE18: bigint;
  progressBps: bigint;
  tokenBalance: bigint;
  usdcBalance: bigint;
}

type TradeMode = "buy" | "sell";

interface TradeQuote {
  userOutput: bigint;
  grossUsdcValue: bigint;
  creatorFee: bigint;
  protocolFee: bigint;
}

export default function TokenPage() {
  const params = useParams<{ address: string }>();
  const launchAddress = params.address as Address;
  const validAddress = isAddress(launchAddress);
  const publicClient = usePublicClient();
  const { address: account, isConnected, chainId } = useAccount();
  const { switchChainAsync } = useSwitchChain();
  const { writeContractAsync } = useWriteContract();

  const [data, setData] = useState<MarketData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [mode, setMode] = useState<TradeMode>("buy");
  const [amount, setAmount] = useState("");
  const [tradePercent, setTradePercent] = useState(0);
  const [quote, setQuote] = useState<TradeQuote | null>(null);
  const [busy, setBusy] = useState(false);
  const [txHash, setTxHash] = useState<Hex | "">("");

  const refresh = useCallback(async () => {
    if (!publicClient || !validAddress) return;
    setError("");
    try {
      const [token, creator, protocolTreasury, creatorFeesAccrued, protocolFeesAccrued, metadataURI, totalSupply, marketState] = await Promise.all([
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "token" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "creator" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "protocolTreasury" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "creatorFeesAccrued" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "protocolFeesAccrued" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "metadataURI" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "totalSupply" }),
        publicClient.readContract({ address: launchAddress, abi: launchAbi, functionName: "marketState" }),
      ]);

      const tokenAddress = token as Address;
      const [name, symbol, tokenBalance, usdcBalance] = await Promise.all([
        publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "name" }),
        publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "symbol" }),
        account
          ? publicClient.readContract({ address: tokenAddress, abi: erc20Abi, functionName: "balanceOf", args: [account] })
          : Promise.resolve(0n),
        account
          ? publicClient.readContract({ address: ARC_USDC, abi: erc20Abi, functionName: "balanceOf", args: [account] })
          : Promise.resolve(0n),
      ]);

      const state = marketState as readonly [bigint, bigint, bigint, bigint, bigint, bigint, bigint];
      setData({
        token: tokenAddress,
        creator: creator as Address,
        protocolTreasury: protocolTreasury as Address,
        creatorFeesAccrued: creatorFeesAccrued as bigint,
        protocolFeesAccrued: protocolFeesAccrued as bigint,
        metadataURI: metadataURI as string,
        name: name as string,
        symbol: symbol as string,
        totalSupply: totalSupply as bigint,
        tokenReserve: state[0],
        realUsdcReserve: state[1],
        curveUsdcReserve: state[2],
        circulatingSupply: state[3],
        spotPriceE18: state[4],
        marketCapE18: state[5],
        progressBps: state[6],
        tokenBalance: tokenBalance as bigint,
        usdcBalance: usdcBalance as bigint,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not read this launch.");
    } finally {
      setLoading(false);
    }
  }, [publicClient, validAddress, launchAddress, account]);

  useEffect(() => {
    refresh();
    const timer = window.setInterval(refresh, 12_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!publicClient || !validAddress || !amount) {
      setQuote(null);
      return;
    }

    const timer = window.setTimeout(async () => {
      try {
        const raw = parseUnits(amount, mode === "buy" ? 6 : 18);
        if (raw <= 0n) return setQuote(null);
        const value = await publicClient.readContract({
          address: launchAddress,
          abi: launchAbi,
          functionName: mode === "buy" ? "getBuyQuote" : "getSellQuote",
          args: [raw],
        });
        const [first, second, creatorFee, protocolFee] = value as readonly [bigint, bigint, bigint, bigint];
        setQuote({
          userOutput: first,
          grossUsdcValue: mode === "buy" ? raw : second,
          creatorFee,
          protocolFee,
        });
      } catch {
        setQuote(null);
      }
    }, 250);

    return () => window.clearTimeout(timer);
  }, [publicClient, validAddress, launchAddress, amount, mode, data?.realUsdcReserve]);

  const image = useMemo(() => ipfsToHttp(data?.metadataURI || ""), [data?.metadataURI]);

  function selectPercentage(percent: number) {
    if (!data) return;
    const balance = mode === "buy" ? data.usdcBalance : data.tokenBalance;
    const decimals = mode === "buy" ? 6 : 18;
    const rawAmount = (balance * BigInt(percent)) / 100n;
    setTradePercent(percent);
    setAmount(rawAmount > 0n ? formatUnits(rawAmount, decimals) : "");
  }

  function handleAmountChange(value: string) {
    setAmount(value);
    if (!data || !value) {
      setTradePercent(0);
      return;
    }

    try {
      const balance = mode === "buy" ? data.usdcBalance : data.tokenBalance;
      const rawAmount = parseUnits(value, mode === "buy" ? 6 : 18);
      const percent = balance > 0n ? Number((rawAmount * 100n) / balance) : 0;
      setTradePercent(Math.max(0, Math.min(100, percent)));
    } catch {
      setTradePercent(0);
    }
  }

  async function executeTrade() {
    if (!publicClient || !data || !account || !isConnected) {
      return setError("Connect a wallet first.");
    }
    if (!amount) return setError("Enter an amount.");

    setBusy(true);
    setError("");
    setTxHash("");

    try {
      if (chainId !== arcNetwork.id) await switchChainAsync({ chainId: arcNetwork.id });

      const isBuy = mode === "buy";
      const rawAmount = parseUnits(amount, isBuy ? 6 : 18);
      if (rawAmount <= 0n) throw new Error("Amount must be greater than zero.");

      const freshQuoteResult = (await publicClient.readContract({
        address: launchAddress,
        abi: launchAbi,
        functionName: isBuy ? "getBuyQuote" : "getSellQuote",
        args: [rawAmount],
      })) as readonly [bigint, bigint, bigint, bigint];
      const freshQuote = {
        userOutput: freshQuoteResult[0],
        grossUsdcValue: isBuy ? rawAmount : freshQuoteResult[1],
        creatorFee: freshQuoteResult[2],
        protocolFee: freshQuoteResult[3],
      };
      if (freshQuote.userOutput <= 0n) throw new Error("Trade is too small or cannot be quoted.");

      if (!isBuy && freshQuote.grossUsdcValue > data.realUsdcReserve) {
        throw new Error("The curve does not have enough real USDC reserve for this sell.");
      }

      const spendToken = isBuy ? (ARC_USDC as Address) : data.token;
      const allowance = (await publicClient.readContract({
        address: spendToken,
        abi: erc20Abi,
        functionName: "allowance",
        args: [account, launchAddress],
      })) as bigint;

      if (allowance < rawAmount) {
        const approveHash = await writeContractAsync({
          address: spendToken,
          abi: erc20Abi,
          functionName: "approve",
          args: [launchAddress, rawAmount],
          chainId: arcNetwork.id,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveHash });
      }

      // 1% slippage tolerance. Contract also has a 10-minute deadline.
      const minOut = (freshQuote.userOutput * 99n) / 100n;
      const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);

      const hash = isBuy
        ? await writeContractAsync({
            address: launchAddress,
            abi: launchAbi,
            functionName: "buy",
            args: [rawAmount, minOut, account, deadline],
            chainId: arcNetwork.id,
          })
        : await writeContractAsync({
            address: launchAddress,
            abi: launchAbi,
            functionName: "sell",
            args: [rawAmount, minOut, account, deadline],
            chainId: arcNetwork.id,
          });

      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      setAmount("");
      setTradePercent(0);
      setQuote(null);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Trade failed.");
    } finally {
      setBusy(false);
    }
  }

  async function claimFees(kind: "creator" | "protocol") {
    if (!publicClient || !account || !isConnected) return setError("Connect the authorized wallet first.");
    setBusy(true);
    setError("");
    setTxHash("");
    try {
      if (chainId !== arcNetwork.id) await switchChainAsync({ chainId: arcNetwork.id });
      const hash = await writeContractAsync({
        address: launchAddress,
        abi: launchAbi,
        functionName: kind === "creator" ? "claimCreatorFees" : "claimProtocolFees",
        chainId: arcNetwork.id,
      });
      setTxHash(hash);
      await publicClient.waitForTransactionReceipt({ hash });
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Fee claim failed.");
    } finally {
      setBusy(false);
    }
  }

  if (!validAddress) return <div className="notice error">Invalid launch address.</div>;
  if (loading && !data) return <div className="skeleton" />;
  if (!data) return <div className="notice error">{error || "Launch not found."}</div>;

  const fee = quote ? quote.creatorFee + quote.protocolFee : 0n;
  const quoteText = quote
    ? mode === "buy"
      ? `${compactNumber(quote.userOutput, 18, 6)} ${data.symbol}`
      : `${compactNumber(quote.userOutput, 6, 6)} USDC`
    : "—";

  return (
    <div className="token-page">
      <section className="token-panel">
        <div className="token-header">
          {image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img className="token-avatar" src={image} alt="" />
          ) : (
            <div className="token-avatar">{data.symbol.slice(0, 2)}</div>
          )}
          <div>
            <h1>{data.name}</h1>
            <div className="token-meta">
              <span>${data.symbol}</span>
              <a className="address-link" href={`${ARC_EXPLORER}/address/${data.token}`} target="_blank" rel="noreferrer">
                Token {shortAddress(data.token)}
              </a>
              <a className="address-link" href={`${ARC_EXPLORER}/address/${launchAddress}`} target="_blank" rel="noreferrer">
                Curve {shortAddress(launchAddress)}
              </a>
            </div>
          </div>
        </div>

        {error && <div className="notice error">{error}</div>}
        {txHash && (
          <div className="notice">
            Transaction confirmed/submitted. <a className="address-link" href={`${ARC_EXPLORER}/tx/${txHash}`} target="_blank" rel="noreferrer">View transaction</a>
          </div>
        )}

        <div className="metric-grid">
          <div className="metric"><label>Spot price</label><strong>${Number(formatUnits(data.spotPriceE18, 18)).toFixed(9)}</strong></div>
          <div className="metric"><label>Implied market cap</label><strong>${compactNumber(data.marketCapE18, 18, 2)}</strong></div>
          <div className="metric"><label>Real USDC reserve</label><strong>{Number(formatUnits(data.realUsdcReserve, 6)).toLocaleString("en-US", { minimumFractionDigits: 3, maximumFractionDigits: 3 })} USDC</strong></div>
          <div className="metric"><label>Circulating</label><strong>{compactNumber(data.circulatingSupply, 18, 2)}</strong></div>
          <div className="metric"><label>Fixed supply</label><strong>{compactNumber(data.totalSupply, 18, 2)}</strong></div>
          <div className="metric"><label>Creator</label><strong>{shortAddress(data.creator)}</strong></div>
          <div className="metric"><label>Trading fee</label><strong>1.25%</strong></div>
          <div className="metric">
            <label>Fee split</label>
            <div className="fee-split-lines">
              <div><span>Creator fee</span><strong>0.30%</strong></div>
              <div><span>MemeLift fee</span><strong>0.95%</strong></div>
            </div>
          </div>
          <div className="metric"><label>Creator fees accrued</label><strong>{compactNumber(data.creatorFeesAccrued, 6, 6)} USDC</strong></div>
          <div className="metric"><label>Protocol fees accrued</label><strong>{compactNumber(data.protocolFeesAccrued, 6, 6)} USDC</strong></div>
        </div>

        {((account?.toLowerCase() === data.creator.toLowerCase() && data.creatorFeesAccrued > 0n) ||
          (account?.toLowerCase() === data.protocolTreasury.toLowerCase() && data.protocolFeesAccrued > 0n)) && (
          <div className="fee-claim-actions">
            {account?.toLowerCase() === data.creator.toLowerCase() && data.creatorFeesAccrued > 0n && (
              <button className="button" disabled={busy} onClick={() => claimFees("creator")}>Claim creator fees</button>
            )}
            {account?.toLowerCase() === data.protocolTreasury.toLowerCase() && data.protocolFeesAccrued > 0n && (
              <button className="button" disabled={busy} onClick={() => claimFees("protocol")}>Claim MemeLift fees</button>
            )}
          </div>
        )}

        <div style={{ marginTop: 22 }}>
          <div className="quote">
            <span>Curve progress</span>
            <span>{(Number(data.progressBps) / 100).toFixed(2)}%</span>
          </div>
          <div className="progress">
            <div style={{ width: `${Math.min(100, Number(data.progressBps) / 100)}%` }} />
          </div>
        </div>

        <p className="small" style={{ marginTop: 24 }}>
          The virtual reserve is used only for pricing. Sell payouts are limited to USDC actually deposited by buyers.
          Direct token/USDC transfers to the curve are intentionally excluded from internal pricing reserves.
        </p>
      </section>

      <aside className="token-panel trade-panel">
        <div className="trade-tabs">
          <button className={mode === "buy" ? "active" : ""} onClick={() => { setMode("buy"); setAmount(""); setTradePercent(0); setQuote(null); }}>Buy</button>
          <button className={mode === "sell" ? "active" : ""} onClick={() => { setMode("sell"); setAmount(""); setTradePercent(0); setQuote(null); }}>Sell</button>
        </div>

        <div className="trade-input">
          <label>
            <span>{mode === "buy" ? "You pay" : "You sell"}</span>
            <button onClick={() => selectPercentage(100)} style={{ border: 0, background: "none", color: "inherit", padding: 0 }}>
              Balance {compactNumber(mode === "buy" ? data.usdcBalance : data.tokenBalance, mode === "buy" ? 6 : 18, 4)}
            </button>
          </label>
          <div className="row">
            <input inputMode="decimal" value={amount} onChange={(e) => handleAmountChange(e.target.value)} placeholder="0.0" />
            <strong>{mode === "buy" ? "USDC" : data.symbol}</strong>
          </div>
        </div>

        <div className="trade-percentage">
          <div className="trade-percent-buttons">
            {[10, 25, 75, 100].map((percent) => (
              <button
                type="button"
                className={tradePercent === percent ? "active" : ""}
                key={percent}
                onClick={() => selectPercentage(percent)}
              >
                {percent}%
              </button>
            ))}
          </div>
          <div className="trade-slider-row">
            <input
              aria-label={`${mode === "buy" ? "Buy" : "Sell"} percentage`}
              type="range"
              min="0"
              max="100"
              step="1"
              value={tradePercent}
              onChange={(event) => selectPercentage(Number(event.target.value))}
              style={{ "--trade-percent": `${tradePercent}%` } as CSSProperties}
            />
            <strong>{tradePercent}%</strong>
          </div>
        </div>

        {mode === "sell" && (
          <div className="quote"><span>Gross value</span><strong>{quote ? `${compactNumber(quote.grossUsdcValue, 6, 6)} USDC` : "—"}</strong></div>
        )}
        <div className="quote"><span>Fee (1.25%)</span><strong>{quote ? `${compactNumber(fee, 6, 6)} USDC` : "—"}</strong></div>
        <div className="quote">
          <span>{mode === "buy" ? "Estimated receive" : "You receive"}</span>
          <strong>{quoteText}</strong>
        </div>

        <button className="button button-primary" disabled={busy || !isConnected || !amount || !quote || quote.userOutput === 0n} onClick={executeTrade}>
          {busy ? "Confirming…" : !isConnected ? "Connect wallet" : mode === "buy" ? `Buy ${data.symbol}` : `Sell ${data.symbol}`}
        </button>
        <p className="small">Creator 0.30% · MemeLift 0.95% · 1% slippage tolerance · 10 minute deadline</p>
      </aside>
    </div>
  );
}
