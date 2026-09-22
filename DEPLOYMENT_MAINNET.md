# Arc Mainnet deployment record — MemeLift V2

- Network: Arc Mainnet
- Chain ID: `5042`
- RPC: `https://rpc.mainnet.arc.io`
- USDC ERC-20 (6 decimals): `0x3600000000000000000000000000000000000000`
- Explorer: `https://explorer.arc.io`
- Protocol treasury: `0x8e23Ca66E4E4d68c6C52Ed651d8487320B3d57d2`
- Factory address: `0xa32AB0188823d25972F27f7c4D9254ae626a0AB7`
- Deployment transaction: `0xd03acf45e6e14e0ee086b299626b3d017660411a4118e83860440f926ae0e7f8`
- Block: `22037742`
- Date deployed: `2026-09-21T16:45:18.282Z`
- Git commit: unavailable (this workspace has no `.git` metadata)

Explorer: [Factory](https://explorer.arc.io/address/0xa32AB0188823d25972F27f7c4D9254ae626a0AB7) · [deployment transaction](https://explorer.arc.io/tx/0xd03acf45e6e14e0ee086b299626b3d017660411a4118e83860440f926ae0e7f8)

## Compiled runtime bytecode sizes

- MemeFactory: `11004 bytes`
- MemeLaunch: `5035 bytes`
- MemeToken: `1769 bytes`

## Mainnet validation flow

- Launch: `0xE93596a1d61624eCD5b71581B3b1704026448aa3`
- Token: `0x53A3042F602a1383934DCd77854d8becA8a7Aceb`
- Create: `0x53de19f36d5153fcb4fe34a095c6926550e789546d240112f9c83b07deac719e`
- Buy 0.5 USDC: `0x61717273fc28372fbeb8dbcb2e6825f50a9df40928162ec4a0bea479819e8c0f`
- Sell 250,000 MLTEST: `0xed3fea7e43dceac89d7b50b6995fb068a38ac131451ab25e3bc58819aa70d630`
- Protocol fee claim: `0x7d30c2a2c07a3a3936e46b3a7f233b3d9d48c9658c8ce7093c6f7cc887e30f32`

Accounting after the validation flow, in USDC base units:

- Real reserve: `243566`
- Creator fees accrued: `2250`
- Protocol fees accrued: `0` (treasury claimed `7126`)
- Contract USDC balance: `245816`
- Expected balance: `245816`
- Spot price E18: `1000487190965`
- Invariant: passed
