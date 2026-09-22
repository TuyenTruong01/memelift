# Arc Testnet deployment record — MemeLift V2

- Network: Arc Testnet
- Chain ID: `5042002`
- RPC: `https://rpc.testnet.arc.io`
- USDC ERC-20 (6 decimals): `0x3600000000000000000000000000000000000000`
- Explorer: `https://explorer.testnet.arc.io`
- Protocol treasury: `0x5C73D6297A7447D3412a1B1f9b5B3d9746DfBD81`
- Factory V2 address: `0xe5b25f468c3006b6Aff1a3a2fB405Dfda6d31f84`
- Deployment transaction: `0x5b1a79a228219dd9710b9a065c919fbdb1afda4bc1122e8f68ec7792a53ea32b`
- Block: `63274825`
- Date deployed: `2026-09-21T16:03:07.717Z`
- Git commit: unavailable (this workspace has no `.git` metadata)

Explorer: [Factory V2](https://explorer.testnet.arc.io/address/0xe5b25f468c3006b6Aff1a3a2fB405Dfda6d31f84) · [deployment transaction](https://explorer.testnet.arc.io/tx/0x5b1a79a228219dd9710b9a065c919fbdb1afda4bc1122e8f68ec7792a53ea32b)

## V2 test flow

- Launch: `0x323567144b75b88c41F33924D59015061273d28C`
- Token: `0x539A08F55174A164f9dB11994D1269ac4fCEA1b7`
- Create: `0x963364ef37c9c4d187112e4e9ba849ab0f724bbc729ab150e57cdb622520c776`
- Buy 5 USDC: `0x8be3685ba78c78803177f3858bf63ae1f9d86313753324386997e93ffd0eeb75`
- Sell half: `0xe87d526a2cc59e87ddb914b0551f53ee7f9a7a1f0af6611f2ff4c0654d117a44`
- Creator claim: `0x5d11d714e3f0c2dafd0abda10208440d46fd5e909dd5ff2ef492421ad8a4fb7c`
- Protocol claim: pending treasury-wallet signature

Before claims (USDC base units): reserve `2462671`, creator fees `22424`, protocol fees `71010`, contract balance `2556105`. The accounting invariant holds exactly.

After creator claim: reserve `2462671`, creator fees `0`, protocol fees `71010`, contract balance `2533681`. The accounting invariant still holds exactly.

## Historical V1 (deprecated)

- Factory: `0xCF0c68A29e6f17Ca14BFE009a9D925cD72F611d1`
- Transaction: `0x3b44ae2386ad5f198db64908ed63911e60e189d6bc6ced4cfa9a47c5f136b835`
- Block: `63113281`
