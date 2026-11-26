---
name: derivatives-quant-formulas
description: Pure-Python reference mathematics and edge-case guards for Black-76 options Gamma, Net Dollar GEX, Call/Put Walls, Max Pain, OI-weighted predictive liquidation clusters with price-sweep mitigation, and 80-bin VRVP Value Area. Use when implementing backend quant engines or client VRVP math.
---

# Derivatives & Market-Structure Quantitative Reference Skill

## 1. Pure-Python Black-76 Gamma & Net Dollar GEX (`options_quant.py`)

Deribit's `/public/get_book_summary_by_currency` reports `open_interest` (in **BTC**, since 1 Deribit BTC option contract = 1 BTC), `mark_iv` (in percent, e.g., `58.4` $\rightarrow \sigma = 0.584$), and `underlying_price` ($F$). It omits Greeks.

Compute exact Black-76 Gamma ($r = 0$) using only Python's standard `math` module (zero `scipy`/`numpy`). Always floor time-to-expiry $T$ at 1 minute ($\frac{1}{525960}$ years) and implied volatility $\sigma$ at $0.05$ ($5\%$) to prevent singularity crashes at `08:00 UTC` expiry:

$$
d_1 = \frac{\ln(F / K) + 0.5 \sigma^2 T}{\sigma \sqrt{T}}, \quad \phi(d_1) = \frac{1}{\sqrt{2\pi}} e^{-0.5 d_1^2}, \quad \Gamma = \frac{\phi(d_1)}{F \sigma \sqrt{T}}
$$

$$
\text{GEX}_{\text{USD}}(K) = \left(\text{OI}_{\text{call}}(K) \cdot \Gamma_{\text{call}}(K) - \text{OI}_{\text{put}}(K) \cdot \Gamma_{\text{put}}(K)\right) \times F^2 \times 0.01
$$

```python
import math

INV_SQRT_2PI = 1.0 / math.sqrt(2.0 * math.pi)
MIN_T_YEARS = 1.0 / 525960.0  # 1 minute floor
SECONDS_PER_YEAR = 365.25 * 86400.0

def black76_gamma(underlying_f: float, strike_k: float, mark_iv_pct: float | None, t_seconds: float) -> float:
    if underlying_f <= 0.0 or strike_k <= 0.0:
        return 0.0
    t_years = max(t_seconds / SECONDS_PER_YEAR, MIN_T_YEARS)
    sigma = max((mark_iv_pct or 0.0) / 100.0, 0.05)
    vol_sqrt_t = sigma * math.sqrt(t_years)
    d1 = (math.log(underlying_f / strike_k) + 0.5 * sigma * sigma * t_years) / vol_sqrt_t
    # Guard extreme OTM underflow
    if abs(d1) > 12.0:
        return 0.0
    pdf_d1 = INV_SQRT_2PI * math.exp(-0.5 * d1 * d1)
    return pdf_d1 / (underlying_f * vol_sqrt_t)

def net_dollar_gex_1pct(
    call_oi_btc: float,
    call_gamma: float,
    put_oi_btc: float,
    put_gamma: float,
    underlying_f: float,
) -> float:
    """Institutional dealer sign convention: +Call GEX (stabilizer), -Put GEX (accelerator)."""
    return (call_oi_btc * call_gamma - put_oi_btc * put_gamma) * (underlying_f ** 2) * 0.01
```

---

## 2. Exact Max Pain Strike Calculation

Max Pain is the active strike $S \in \mathcal{K}$ minimizing total intrinsic USD payout across all open Calls and Puts:

$$
S_{\text{maxPain}} = \arg\min_{S \in \mathcal{K}} \sum_{K \in \mathcal{K}} \left( \text{OI}_{\text{call}}(K) \cdot \max(0, S - K) + \text{OI}_{\text{put}}(K) \cdot \max(0, K - S) \right)
$$

```python
def compute_max_pain(call_oi_by_strike: dict[float, float], put_oi_by_strike: dict[float, float]) -> float:
    strikes = sorted(set(call_oi_by_strike.keys()) | set(put_oi_by_strike.keys()))
    if not strikes:
        return 0.0
    best_strike = strikes[0]
    min_payout = float("inf")
    for candidate_s in strikes:
        payout = 0.0
        for k in strikes:
            if candidate_s > k:
                payout += call_oi_by_strike.get(k, 0.0) * (candidate_s - k)
            elif candidate_s < k:
                payout += put_oi_by_strike.get(k, 0.0) * (k - candidate_s)
        if payout < min_payout:
            min_payout = payout
            best_strike = candidate_s
    return best_strike
```

---

## 3. Predictive Liquidation Bands & Mandatory Sweep Mitigation (`liquidations.py`)

### Projection & Auto-Mitigation Algorithm

1. **5-Bar Fractal Swing Detection:** For bar index $i \in [20, N - 6]$:
   * Compute 20-bar quote-volume mean $\bar{V}_{20} = \frac{1}{20} \sum_{m=i-19}^{i} V_m$. Require $V_i \ge 1.2 \times \bar{V}_{20}$.
   * **Swing Low:** `candles[i].low == min(candles[j].low for j in range(i - 5, i + 6))`.
   * **Swing High:** `candles[i].high == max(candles[j].high for j in range(i - 5, i + 6))`.
2. **Isolated Leverage Projection ($m = 0.004$):** For $L \in (10, 25, 50, 100)$:
   * Long liquidation price from swing low: $P_{\text{liq, long}}(L) = P_{\text{low}, i} \times (1 - \frac{1}{L} + 0.004)$.
   * Short liquidation price from swing high: $P_{\text{liq, short}}(L) = P_{\text{high}, i} \times (1 + \frac{1}{L} - 0.004)$.
3. **Mandatory Forward Sweep Mitigation (Critical Anti-Clutter Rule):**
   * Scan every subsequent bar $j \in [i + 1, N - 1]$:
     * Discard a candidate `"long_liq"` band immediately if **any** `candles[j].low <= band_price`.
     * Discard a candidate `"short_liq"` band immediately if **any** `candles[j].high >= band_price`.
   * Also expose a pure real-time helper invoked on every live trade/mark tick:
     ```python
     def filter_unmitigated_bands(
         bands: list[LiquidationBand], tick_low: float, tick_high: float
     ) -> list[LiquidationBand]:
         return [
             b for b in bands
             if (b.side == "long_liq" and tick_low > b.price)
             or (b.side == "short_liq" and tick_high < b.price)
         ]
     ```
4. **Proximity Clustering ($0.15\%$ Width):** Sort surviving bands by price per side; merge adjacent bands when $\frac{|P_a - P_b|}{P_a} \le 0.0015$ using intensity-weighted average price, normalize intensities to $[0.0, 1.0]$, and retain top 12 `"long_liq"` bands below price and top 12 `"short_liq"` bands above price.

---

## 4. Client-Side 80-Bin VRVP & Greedy $70\%$ Value Area (`vrvpCalc.ts`)

When expanding outward from the Point of Control bin `pocIdx` to capture $70\%$ of total visible quote volume, always guard array bounds (`lowIdx === 0` and `highIdx === numBins - 1`) so expansion never stalls or reads `undefined`:

```ts
let lowIdx = pocIdx;
let highIdx = pocIdx;
let accumulated = bins[pocIdx]!.totalUsd;
const targetUsd = totalVisibleUsd * 0.70;

while (accumulated < targetUsd && (lowIdx > 0 || highIdx < numBins - 1)) {
  const downVol = lowIdx > 0 ? bins[lowIdx - 1]!.totalUsd : -1;
  const upVol = highIdx < numBins - 1 ? bins[highIdx + 1]!.totalUsd : -1;

  if (upVol >= downVol && highIdx < numBins - 1) {
    highIdx += 1;
    accumulated += bins[highIdx]!.totalUsd;
  } else if (lowIdx > 0) {
    lowIdx -= 1;
    accumulated += bins[lowIdx]!.totalUsd;
  }
}

const valPrice = minPrice + lowIdx * binSize;
const vahPrice = minPrice + (highIdx + 1) * binSize;
```