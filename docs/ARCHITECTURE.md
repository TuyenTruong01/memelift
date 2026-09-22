# Architecture

```text
Browser / EVM wallet
        |
     wagmi + viem
        |
     Arc Mainnet
        |
   MemeFactory
        |
   +----+-----------------------+
   |                            |
MemeLaunch #1               MemeLaunch #N
   |                            |
MemeToken #1                MemeToken #N
   |
Arc USDC predeploy <---- buy/sell ----> users
```

## Creation

```text
User -> MemeFactory.createLaunch(...)
     -> new MemeLaunch(...)
     -> MemeLaunch constructor creates MemeToken
     -> MemeToken mints 100% supply to MemeLaunch
     -> Factory records launch and emits LaunchCreated
```

## Buy

```text
User approves Arc USDC to MemeLaunch
User calls buy(usdcIn, minTokenOut, recipient, deadline)
MemeLaunch quotes x*y=k against virtual+real USDC
USDC moves user -> MemeLaunch
Internal real USDC reserve increases
Internal token reserve decreases
Meme token moves MemeLaunch -> recipient
```

## Sell

```text
User approves MemeToken to MemeLaunch
User calls sell(tokenIn, minUsdcOut, recipient, deadline)
MemeLaunch calculates curve quote
Quote must be <= internally tracked real USDC reserve
Meme token moves user -> MemeLaunch
Internal token reserve increases
Internal real USDC reserve decreases
USDC moves MemeLaunch -> recipient
```
