# Mainnet checklist

## Before deploy

- [ ] `npm install`
- [ ] `npm run test:contracts`
- [ ] `npm run compile:contracts`
- [ ] Test full UI flow on Arc Testnet
- [ ] Confirm deployer private key is NOT committed
- [ ] Fund deployer only with a small mainnet USDC balance
- [ ] Confirm RPC returns chain ID 5042
- [ ] Confirm USDC address is `0x3600000000000000000000000000000000000000`

## Deploy

- [ ] Run `npm --workspace contracts run deploy:mainnet`
- [ ] Save the printed factory address
- [ ] Check factory code/transaction in Arc Explorer
- [ ] Set `NEXT_PUBLIC_FACTORY_ADDRESS` in frontend hosting

## Smoke test

- [ ] Create one launch
- [ ] Creator token balance = 0
- [ ] Launch token balance = total supply before first buy
- [ ] Wallet B buys a tiny amount with USDC
- [ ] Wallet B receives meme tokens
- [ ] Real USDC reserve increases exactly by buy input
- [ ] Wallet B sells a small amount
- [ ] Wallet B receives USDC
- [ ] Real USDC reserve decreases by sell output
- [ ] Reload UI and confirm state is reconstructed entirely from chain data

## Grant submission

- [ ] Public live URL
- [ ] Public repo
- [ ] Short Arc-use description
- [ ] Public builder profile
- [ ] At least 2–3 Arc mainnet transaction links ready for reviewers
