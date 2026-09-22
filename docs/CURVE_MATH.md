# Bonding-curve math

ArcMeme uses a constant-product curve with a virtual USDC side.

Let:

- `x` = internally tracked meme-token reserve (18 decimals)
- `r` = internally tracked real USDC reserve (6 decimals)
- `v` = immutable virtual USDC reserve (6 decimals)
- `y = v + r`

No virtual tokens are used. At creation, `x = totalSupply`, `r = 0`, and `y = v`.

## Buy exact USDC

For `u` units of USDC input:

```text
tokenOut = floor(x * u / (y + u))
```

After execution:

```text
x' = x - tokenOut
r' = r + u
y' = v + r'
```

The floor rounding favors the reserve rather than the trader.

## Sell exact tokens

For `t` token units input:

```text
usdcOut = floor(y * t / (x + t))
```

The transaction additionally requires:

```text
usdcOut <= r
```

So the virtual reserve can influence price but can never be withdrawn as if it were real collateral.

After execution:

```text
x' = x + t
r' = r - usdcOut
```

## Initial market cap

The marginal price is approximately:

```text
price = y / x
```

At launch:

```text
y = v
x = totalSupply
```

Therefore:

```text
initial FDV = price * totalSupply = v
```

With the default `v = 1,000 USDC`, each token starts near a $1,000 implied fully diluted market cap even when the creator chooses a different fixed token supply.

## Rounding

Both quote functions use OpenZeppelin `Math.mulDiv`, and integer division rounds down. An immediate buy -> sell round trip therefore cannot create value from rounding; at worst the trader loses the smallest representable USDC unit in cases where division is not exact.
