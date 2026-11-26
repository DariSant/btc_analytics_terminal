"""Pure-Python Deribit BTC options quant engine (Black-76 Gamma, GEX, Walls, Max Pain)."""

import math
import re
import time
from collections import defaultdict
from datetime import UTC, datetime
from functools import lru_cache
from typing import Any

from app.schemas import ExpirySummary, OptionsSurfaceSummary, StrikeMetrics

INV_SQRT_2PI = 1.0 / math.sqrt(2.0 * math.pi)
MIN_T_YEARS = 1.0 / 525_960.0  # 1-minute floor preventing expiry singularities
SECONDS_PER_YEAR = 365.25 * 86_400.0
DERIBIT_OPT_RE = re.compile(r"^BTC-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-(C|P)$")


@lru_cache(maxsize=256)
def _parse_deribit_expiry(date_str: str) -> tuple[str, int] | None:
    try:
        dt = datetime.strptime(date_str, "%d%b%y").replace(
            hour=8,
            minute=0,
            second=0,
            tzinfo=UTC,
        )
    except ValueError:
        return None
    return dt.strftime("%Y-%m-%d"), int(dt.timestamp())


def parse_deribit_instrument(name: str) -> tuple[str, int, float, str] | None:
    """Parse BTC-DDMMMYY-STRIKE-C|P into (iso_date, expiry_ts_sec, strike, opt_type)."""
    match = DERIBIT_OPT_RE.match(name)
    if not match:
        return None
    date_str, strike_str, opt_type = match.groups()
    expiry = _parse_deribit_expiry(date_str)
    if expiry is None:
        return None
    iso_date, expiry_ts_sec = expiry
    return iso_date, expiry_ts_sec, float(strike_str), opt_type


def black76_gamma(
    underlying_f: float,
    strike_k: float,
    mark_iv_pct: float | None,
    t_seconds: float,
) -> float:
    """Compute exact Black-76 Gamma (r=0) with 1m T floor and 5% sigma floor."""
    if underlying_f <= 0.0 or strike_k <= 0.0:
        return 0.0
    t_years = max(t_seconds / SECONDS_PER_YEAR, MIN_T_YEARS)
    sigma = max((mark_iv_pct or 0.0) / 100.0, 0.05)
    vol_sqrt_t = sigma * math.sqrt(t_years)
    d1 = (math.log(underlying_f / strike_k) + 0.5 * sigma * sigma * t_years) / vol_sqrt_t
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
    """Compute net dealer dollar GEX per 1% move (+Call GEX / -Put GEX)."""
    return (call_oi_btc * call_gamma - put_oi_btc * put_gamma) * (underlying_f**2) * 0.01


def compute_max_pain(
    call_oi_by_strike: dict[float, float],
    put_oi_by_strike: dict[float, float],
) -> float:
    """Find active strike minimizing aggregate intrinsic option payout in O(K log K)."""
    strikes = sorted(set(call_oi_by_strike.keys()) | set(put_oi_by_strike.keys()))
    if not strikes:
        return 0.0

    # Sweep from lowest strike upward using cumulative call OI & remaining put OI.
    call_oi_below = 0.0
    call_weighted_below = 0.0
    put_oi_above = sum(put_oi_by_strike.get(k, 0.0) for k in strikes)
    put_weighted_above = sum(put_oi_by_strike.get(k, 0.0) * k for k in strikes)

    best_strike = strikes[0]
    min_payout = float("inf")
    for s in strikes:
        p_oi = put_oi_by_strike.get(s, 0.0)
        put_oi_above -= p_oi
        put_weighted_above -= p_oi * s

        payout = (s * call_oi_below - call_weighted_below) + (
            put_weighted_above - s * put_oi_above
        )
        if payout < min_payout:
            min_payout = payout
            best_strike = s

        c_oi = call_oi_by_strike.get(s, 0.0)
        call_oi_below += c_oi
        call_weighted_below += c_oi * s

    return best_strike


def _build_surface_summary(
    expiry_key: str,
    underlying_price: float,
    call_oi_map: dict[float, float],
    put_oi_map: dict[float, float],
    gex_map: dict[float, float],
) -> OptionsSurfaceSummary:
    strikes = sorted(set(call_oi_map.keys()) | set(put_oi_map.keys()))
    call_wall = 0.0
    call_wall_oi = 0.0
    put_wall = 0.0
    put_wall_oi = 0.0
    total_call_oi = 0.0
    total_put_oi = 0.0
    total_net_gex = 0.0
    strike_metrics: list[StrikeMetrics] = []

    for k in strikes:
        c_oi = call_oi_map.get(k, 0.0)
        p_oi = put_oi_map.get(k, 0.0)
        net_gex = gex_map.get(k, 0.0)
        total_call_oi += c_oi
        total_put_oi += p_oi
        total_net_gex += net_gex
        if c_oi > call_wall_oi:
            call_wall_oi = c_oi
            call_wall = k
        if p_oi > put_wall_oi:
            put_wall_oi = p_oi
            put_wall = k
        strike_metrics.append(
            StrikeMetrics(
                strike=k,
                call_oi=round(c_oi, 4),
                put_oi=round(p_oi, 4),
                net_gex_usd=round(net_gex, 2),
            )
        )

    strike_metrics.sort(key=lambda m: abs(m.net_gex_usd), reverse=True)
    pcr = round(total_put_oi / total_call_oi, 4) if total_call_oi > 0.0 else 0.0
    max_pain = compute_max_pain(call_oi_map, put_oi_map)
    return OptionsSurfaceSummary(
        expiry_key=expiry_key,
        underlying_price=round(underlying_price, 2),
        call_wall=call_wall,
        call_wall_oi=round(call_wall_oi, 4),
        put_wall=put_wall,
        put_wall_oi=round(put_wall_oi, 4),
        max_pain=max_pain,
        put_call_ratio=pcr,
        net_gex_usd=round(total_net_gex, 2),
        top_gex_strikes=strike_metrics[:12],
    )


def compute_options_surfaces(
    book_items: list[dict[str, Any]],
    now_sec: float | None = None,
) -> tuple[list[ExpirySummary], dict[str, OptionsSurfaceSummary]]:
    """Compute ALL + per-expiry Deribit option surfaces from get_book_summary_by_currency."""
    ref_now = now_sec if now_sec is not None else time.time()

    all_calls: dict[float, float] = defaultdict(float)
    all_puts: dict[float, float] = defaultdict(float)
    all_gex: dict[float, float] = defaultdict(float)

    exp_calls: dict[str, dict[float, float]] = defaultdict(lambda: defaultdict(float))
    exp_puts: dict[str, dict[float, float]] = defaultdict(lambda: defaultdict(float))
    exp_gex: dict[str, dict[float, float]] = defaultdict(lambda: defaultdict(float))
    exp_ts_map: dict[str, int] = {}
    exp_oi_totals: dict[str, float] = defaultdict(float)
    exp_underlying: dict[str, float] = {}

    underlying_samples: list[float] = []

    for item in book_items:
        raw_name = item.get("instrument_name")
        if not isinstance(raw_name, str):
            continue
        parsed = parse_deribit_instrument(raw_name)
        if parsed is None:
            continue
        iso_date, expiry_ts_sec, strike, opt_type = parsed
        if expiry_ts_sec <= ref_now:
            continue

        oi = float(item.get("open_interest") or 0.0)
        if oi <= 0.0:
            continue
        underlying = float(item.get("underlying_price") or 0.0)
        if underlying <= 0.0:
            continue

        raw_iv = item.get("mark_iv")
        mark_iv = float(raw_iv) if raw_iv is not None else None
        gamma = black76_gamma(underlying, strike, mark_iv, expiry_ts_sec - ref_now)

        underlying_samples.append(underlying)
        exp_ts_map[iso_date] = expiry_ts_sec
        exp_oi_totals[iso_date] += oi
        exp_underlying[iso_date] = underlying

        if opt_type == "C":
            gex = net_dollar_gex_1pct(oi, gamma, 0.0, 0.0, underlying)
            all_calls[strike] += oi
            exp_calls[iso_date][strike] += oi
        else:
            gex = net_dollar_gex_1pct(0.0, 0.0, oi, gamma, underlying)
            all_puts[strike] += oi
            exp_puts[iso_date][strike] += oi

        all_gex[strike] += gex
        exp_gex[iso_date][strike] += gex

    if not exp_ts_map:
        return [], {}

    spot_ref = sum(underlying_samples) / len(underlying_samples)
    total_oi_all = sum(exp_oi_totals.values())

    surfaces_by_expiry: dict[str, OptionsSurfaceSummary] = {
        "ALL": _build_surface_summary("ALL", spot_ref, all_calls, all_puts, all_gex)
    }

    sorted_expiries = sorted(exp_ts_map.items(), key=lambda pair: pair[1])
    available_expiries: list[ExpirySummary] = [
        ExpirySummary(
            expiry_key="ALL",
            expiry_ts_ms=None,
            total_oi_btc=round(total_oi_all, 4),
            oi_share_pct=100.0,
        )
    ]

    for iso_date, exp_ts_sec in sorted_expiries:
        exp_oi = exp_oi_totals[iso_date]
        share = (exp_oi / total_oi_all * 100.0) if total_oi_all > 0.0 else 0.0
        available_expiries.append(
            ExpirySummary(
                expiry_key=iso_date,
                expiry_ts_ms=exp_ts_sec * 1000,
                total_oi_btc=round(exp_oi, 4),
                oi_share_pct=round(share, 2),
            )
        )
        surfaces_by_expiry[iso_date] = _build_surface_summary(
            iso_date,
            exp_underlying[iso_date],
            exp_calls[iso_date],
            exp_puts[iso_date],
            exp_gex[iso_date],
        )

    return available_expiries, surfaces_by_expiry
