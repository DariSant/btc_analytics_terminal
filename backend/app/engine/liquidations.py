"""Pure-Python predictive liquidation cluster engine with strict sweep mitigation."""

import math
from dataclasses import dataclass

from app.schemas import CandleBar, LeverageTierLiteral, LiquidationBand, LiquidationSideLiteral

LEVERAGE_TIERS: tuple[LeverageTierLiteral, ...] = (10, 25, 50, 100)
MAINTENANCE_MARGIN = 0.004
CLUSTER_PROXIMITY_PCT = 0.0015
MAX_BANDS_PER_SIDE = 12


@dataclass
class _CandidateBand:
    anchor_time: int
    price: float
    side: LiquidationSideLiteral
    leverage: LeverageTierLiteral
    raw_intensity: float


def filter_unmitigated_bands(
    bands: list[LiquidationBand],
    tick_low: float,
    tick_high: float,
) -> list[LiquidationBand]:
    """Delete any band immediately if a live tick or candle range sweeps its price."""
    return [
        b
        for b in bands
        if (b.side == "long_liq" and tick_low > b.price)
        or (b.side == "short_liq" and tick_high < b.price)
    ]


def _cluster_side_bands(candidates: list[_CandidateBand]) -> list[_CandidateBand]:
    if not candidates:
        return []
    ordered = sorted(candidates, key=lambda c: c.price)
    clusters: list[list[_CandidateBand]] = [[ordered[0]]]
    for item in ordered[1:]:
        anchor_price = clusters[-1][0].price
        if abs(item.price - anchor_price) / anchor_price <= CLUSTER_PROXIMITY_PCT:
            clusters[-1].append(item)
        else:
            clusters.append([item])

    merged: list[_CandidateBand] = []
    for group in clusters:
        total_weight = sum(g.raw_intensity for g in group)
        if total_weight <= 0.0:
            continue
        weighted_price = sum(g.price * g.raw_intensity for g in group) / total_weight
        dominant = max(group, key=lambda g: g.raw_intensity)
        merged.append(
            _CandidateBand(
                anchor_time=dominant.anchor_time,
                price=round(weighted_price, 2),
                side=dominant.side,
                leverage=dominant.leverage,
                raw_intensity=total_weight,
            )
        )
    return merged


def compute_predictive_liquidation_bands(
    candles: list[CandleBar],
    oi_delta_pct: float = 0.0,
    current_price: float | None = None,
) -> list[LiquidationBand]:
    """Project OI-weighted 5-bar fractal swing leverage bands and remove swept pools."""
    n = len(candles)
    if n < 26:
        return []

    w_oi = max(1.0, 1.0 + max(0.0, oi_delta_pct) * 10.0)
    surviving_long: list[_CandidateBand] = []
    surviving_short: list[_CandidateBand] = []

    # Prefix sum for O(1) 20-bar quote-volume SMA lookup
    vol_prefix: list[float] = [0.0] * (n + 1)
    for idx, bar in enumerate(candles):
        vol_prefix[idx + 1] = vol_prefix[idx] + bar.quote_usd

    ref_price = current_price if current_price is not None else candles[-1].close

    for i in range(20, n - 5):
        bar = candles[i]
        sma20 = (vol_prefix[i + 1] - vol_prefix[i - 19]) / 20.0
        if sma20 <= 0.0 or bar.quote_usd < 1.2 * sma20:
            continue

        window = candles[i - 5 : i + 6]
        is_swing_low = bar.low == min(w.low for w in window)
        is_swing_high = bar.high == max(w.high for w in window)
        if not is_swing_low and not is_swing_high:
            continue

        subsequent = candles[i + 1 :]
        if is_swing_low:
            for lev in LEVERAGE_TIERS:
                liq_price = bar.low * (1.0 - (1.0 / lev) + MAINTENANCE_MARGIN)
                if liq_price >= ref_price:
                    continue
                if any(later.low <= liq_price for later in subsequent):
                    continue
                surviving_long.append(
                    _CandidateBand(
                        anchor_time=bar.time,
                        price=liq_price,
                        side="long_liq",
                        leverage=lev,
                        raw_intensity=bar.quote_usd * w_oi * math.log(lev),
                    )
                )

        if is_swing_high:
            for lev in LEVERAGE_TIERS:
                liq_price = bar.high * (1.0 + (1.0 / lev) - MAINTENANCE_MARGIN)
                if liq_price <= ref_price:
                    continue
                if any(later.high >= liq_price for later in subsequent):
                    continue
                surviving_short.append(
                    _CandidateBand(
                        anchor_time=bar.time,
                        price=liq_price,
                        side="short_liq",
                        leverage=lev,
                        raw_intensity=bar.quote_usd * w_oi * math.log(lev),
                    )
                )

    clustered_long = _cluster_side_bands(surviving_long)
    clustered_short = _cluster_side_bands(surviving_short)

    clustered_long.sort(key=lambda b: b.raw_intensity, reverse=True)
    clustered_short.sort(key=lambda b: b.raw_intensity, reverse=True)

    selected = clustered_long[:MAX_BANDS_PER_SIDE] + clustered_short[:MAX_BANDS_PER_SIDE]
    if not selected:
        return []

    max_intensity = max(b.raw_intensity for b in selected)
    if max_intensity <= 0.0:
        return []

    return [
        LiquidationBand(
            anchor_time=b.anchor_time,
            price=b.price,
            side=b.side,
            leverage=b.leverage,
            intensity=round(min(1.0, max(0.0, b.raw_intensity / max_intensity)), 4),
        )
        for b in selected
    ]
