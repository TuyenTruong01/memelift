# Security Notes

ArcMeme is experimental, unaudited software designed for a small technical demo.

## Deliberate safety choices

1. **No privileged owner** — no address can mint, pause, change pricing, drain reserves, or upgrade a launch.
2. **Fixed token supply** — each MemeToken mints once in its constructor and exposes no mint function.
3. **Creator gets no allocation** — the complete supply is minted to MemeLaunch.
4. **SafeERC20** — USDC/token transfers use OpenZeppelin SafeERC20.
5. **ReentrancyGuard** — buy/sell entry points are guarded.
6. **Slippage + deadline** — users choose minimum output and transactions expire.
7. **Internal reserve accounting** — direct accidental transfers do not manipulate curve pricing.
8. **Real-reserve check** — virtual USDC is never treated as spendable collateral.
9. **Input bounds** — name, symbol, metadata URI, and token supply are bounded by the factory.

## Known limitations

- No professional smart-contract audit has been performed.
- No formal verification has been performed.
- There is no oracle; all pricing comes from the bonding-curve state.
- Directly transferred excess tokens/USDC are intentionally not part of internal reserves and can become stranded.
- There is no DEX migration or liquidity graduation path.
- There is no protocol fee or fee treasury.
- There is no emergency pause. This is intentional to keep the primitive ownerless, but it removes an operational safety valve.
- Frontend quote data may become stale between quote and execution; minimum-output checks mitigate this but do not eliminate normal market movement.
- The prototype does not provide MEV/private-orderflow protection; public transactions may be observed or reordered according to network behavior.
- Wallet and RPC behavior must be tested specifically on Arc mainnet because Arc uses USDC for native gas and exposes USDC as an ERC-20 predeploy.

## Before any real-value use

- Run all local tests.
- Add invariant/fuzz tests.
- Deploy and exercise the full flow on Arc Testnet.
- Use a fresh deployment wallet.
- Start mainnet smoke testing with very small USDC amounts.
- Verify deployed bytecode/source on the Arc explorer if verification support is available.
- Commission an independent audit before presenting the system as production-safe.
