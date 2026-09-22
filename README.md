# MemeLift V2 — USDC Fair Launches on Arc

MemeLift is a permissionless fixed-supply meme-token launch platform running on **Arc Mainnet**.

A creator chooses a name, symbol, fixed supply, and optional image. The complete token supply is minted directly into a bonding-curve contract, with **zero token allocation for the creator**. Buyers and sellers trade against the curve using Arc USDC, without an initial DEX liquidity pool or external market maker.

## Live app

Vercel URL: **Coming soon**

## Mainnet deployment

| Parameter | Value |
|---|---|
| Network | Arc Mainnet |
| Chain ID | `5042` |
| RPC | `https://rpc.mainnet.arc.io` |
| Explorer | `https://explorer.arc.io` |
| USDC ERC-20 | `0x3600000000000000000000000000000000000000` |
| USDC ERC-20 decimals | `6` |
| MemeLift Factory V2 | `0xa32AB0188823d25972F27f7c4D9254ae626a0AB7` |

[View MemeLift Factory V2 on Arc Explorer](https://explorer.arc.io/address/0xa32AB0188823d25972F27f7c4D9254ae626a0AB7)

The deployed V2 flow has been smoke-tested on Arc Mainnet with real transactions covering:

- Create a fixed-supply meme token.
- Buy with a small amount of USDC.
- Sell part of the purchased tokens.
- Creator and protocol fee accounting.
- Authorized fee claiming.
- Contract USDC accounting invariants.

See [`DEPLOYMENT_MAINNET.md`](DEPLOYMENT_MAINNET.md) for deployment and smoke-test transaction records.

## What is included

- `MemeToken.sol` — fixed-supply ERC-20 with no owner, mint, tax, blacklist, pause, or upgrade function.
- `MemeLaunch.sol` — constant-product USDC bonding curve, trading fees, reserve accounting, quotes, slippage protection, deadlines, and fee claims.
- `MemeFactory.sol` — permissionless launch factory with an immutable protocol treasury.
- Hardhat deployment and on-chain verification scripts for Arc.
- Contract tests covering fixed supply, buy/sell fees, rounding, claims, authorization, round trips, multiple traders, and USDC accounting invariants.
- Next.js frontend using wagmi and viem.
- Injected EVM-wallet support, with optional WalletConnect support.
- Pinata/IPFS image upload through a server-side Next.js route.
- No application database or centralized token index.

## Trading fees

MemeLift V2 applies the same total fee to buys and sells:

| Recipient | Fee |
|---|---:|
| Creator | `0.30%` |
| MemeLift protocol | `0.95%` |
| Total | `1.25%` |

Fees use integer basis-point accounting:

```text
BPS = 10,000
CREATOR_FEE_BPS = 30
PROTOCOL_FEE_BPS = 95
TOTAL_FEE_BPS = 125
```

On a buy, token output is calculated from the USDC remaining after fees:

```text
gross USDC paid
- creator fee
- protocol fee
= net USDC added to the real reserve and used as curve input
```

On a sell, the curve first calculates the gross USDC output. The real reserve decreases by that gross amount; fees are then accrued separately, and the seller receives the net amount.

Creator and protocol fees never become part of `realUsdcReserve`. Each launch tracks them independently through `creatorFeesAccrued` and `protocolFeesAccrued`.

## Curve design

Each launch uses a constant-product curve with real token inventory and a virtual USDC reserve:

```text
x = internal token reserve
y = virtual USDC reserve + real USDC reserve

BUY after fees:
tokenOut = x * netUsdcIn / (y + netUsdcIn)

SELL before fees:
grossUsdcOut = y * tokenIn / (x + tokenIn)
```

The default virtual reserve is `1,000 USDC`. Because the complete fixed supply begins inside the curve, the initial implied fully diluted market cap is approximately **$1,000**, independent of the selected token supply.

The virtual reserve is pricing liquidity, not real collateral. Sell execution is limited by the internally tracked real USDC reserve.

The curve does not price from raw ERC-20 balances. Accidental direct transfers to a launch contract do not manipulate its internal reserves or price.

## Fair-launch properties

- 100% of the fixed supply starts inside the launch contract.
- Creator allocation is 0%.
- No token minting after deployment.
- No presale allocation.
- No upgrade proxy.
- No owner mint, token tax, blacklist, or pause function.
- Buy and sell both enforce minimum-output slippage protection and deadlines.
- Creator fees can only be claimed by that launch's immutable creator.
- Protocol fees can only be claimed by the immutable protocol treasury.

## Install and verify

Requirements:

- Node.js 20 or newer
- npm

Install dependencies from the repository root:

```bash
npm install
```

Compile and run the complete contract test suite:

```bash
npm run compile:contracts
npm run test:contracts
```

Build the production frontend:

```bash
npm run build
```

Run the frontend locally:

```bash
npm run dev
```

Open `http://localhost:3000`.

## Public frontend configuration

The production frontend uses:

```text
NEXT_PUBLIC_ARC_NETWORK=mainnet
NEXT_PUBLIC_MAINNET_FACTORY_ADDRESS=0xa32AB0188823d25972F27f7c4D9254ae626a0AB7
NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID=your_walletconnect_project_id
```

Only public browser configuration belongs in `NEXT_PUBLIC_*` variables. Server credentials are configured separately in the hosting platform and are never exposed to browser code or committed to the repository.

## Image uploads

Token images can be uploaded from the Create form. The browser sends the selected PNG, JPG, or WebP file to a server-side Next.js route, which uploads it to Pinata/IPFS and returns a persistent `ipfs://` URI.

- Maximum file size: approximately 2 MB.
- The upload credential remains server-side.
- The final launch stores the persistent IPFS URI, not a local blob URL.
- Token pages resolve the IPFS URI through an HTTP gateway for display.

There is no application database. Launch and market state come directly from Arc contracts.

## What is intentionally not included

- DEX graduation or automatic LP creation.
- LP locking.
- Referral system.
- Social feed, comments, or fake activity metrics.
- Centralized token indexer or database.
- Arbitrary third-party token markets.
- Upgrade or emergency-admin controls.

## Security status

**Unaudited. Experimental software. Use at your own risk.**

The contracts have automated tests and a successful small-value Arc Mainnet smoke test, but this is not a substitute for an independent security audit. Do not use funds you cannot afford to lose.

See [`docs/SECURITY.md`](docs/SECURITY.md) before interacting with mainnet contracts.

## License

MIT
