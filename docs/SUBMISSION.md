# Arc Microgrants submission draft

## Project name
ArcMeme

## One-liner
Permissionless fixed-supply meme-token markets priced and settled in USDC on Arc, without requiring an initial liquidity pool.

## Short description
ArcMeme is a small experimental fair-launch primitive deployed on Arc. Any EVM wallet can create a fixed-supply ERC-20. The complete supply is minted directly into an ownerless bonding-curve contract, and the creator receives no token allocation. Users can immediately buy and sell the token against USDC through a virtual-reserve constant-product curve, without an initial DEX LP or market maker.

The prototype is deliberately minimal: no backend, database, referral system, social layer, charting, or admin controls. The purpose is to demonstrate a working USDC-native onchain market primitive on Arc.

## What Arc is used for

- Smart-contract deployment and execution on Arc mainnet.
- Arc USDC ERC-20 as the buy/sell settlement asset.
- USDC as the network gas asset.
- Arc Explorer for public verification of contract creation and trades.

## Demo flow

1. Connect an EVM wallet.
2. Create a meme launch.
3. Confirm that the creator received zero tokens and the fixed supply sits in the curve.
4. Connect another wallet.
5. Buy the token with USDC.
6. Sell part of the token back to the curve.
7. Inspect all transactions on Arc Explorer.

## Repository checklist before submitting

- [ ] Contracts compile.
- [ ] All Hardhat tests pass.
- [ ] Factory deployed to Arc mainnet.
- [ ] At least one real launch created.
- [ ] Small mainnet buy tested from a second wallet.
- [ ] Small mainnet sell tested.
- [ ] Frontend deployed publicly.
- [ ] Factory address committed to deployment metadata (not private keys).
- [ ] README updated with live frontend URL and deployed factory address.
- [ ] Public GitHub profile/repo ready.
