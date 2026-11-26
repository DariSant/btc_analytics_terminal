"""Unit tests and 800-instrument benchmark for Black-76 options and liquidation engines."""

import math
import time
from datetime import UTC, datetime

from app.engine.liquidations import (
    compute_predictive_liquidation_bands,
    filter_unmitigated_bands,
)
from app.engine.options_quant import (
    black76_gamma,
    compute_max_pain,
    compute_options_surfaces,
    net_dollar_gex_1pct,
    parse_deribit_instrument,
)
from app.schemas import CandleBar


def test_deribit_instrument_parser_and_combo_skip() -> None:
    parsed = parse_deribit_instrument("BTC-27DEC26-100000-C")
    assert parsed is not None
    iso_date, ts_sec, strike, opt_type = parsed
    assert iso_date == "2026-12-27"
    assert ts_sec == int(datetime(2026, 12, 27, 8, 0, 0, tzinfo=UTC).timestamp())
    assert strike == 100_000.0
    assert opt_type == "C"

    assert parse_deribit_instrument("BTC-27DEC26-95000-100000-C") is None
    assert parse_deribit_instrument("BTC-PERPETUAL") is None


def test_black76_gamma_accuracy_clamping_and_gex_polarity() -> None:
    f = 95_000.0
    k = 95_000.0
    sigma = 0.60
    t_years = 30.0 / 365.25
    t_seconds = t_years * 365.25 * 86_400.0

    gamma = black76_gamma(f, k, 60.0, t_seconds)
    # Closed-form reference: phi(0.5*sigma*sqrt(T)) / (F * sigma * sqrt(T))
    vol_sqrt_t = sigma * math.sqrt(t_years)
    d1 = 0.5 * vol_sqrt_t
    ref_gamma = (math.exp(-0.5 * d1 * d1) / math.sqrt(2.0 * math.pi)) / (f * vol_sqrt_t)
    assert abs(gamma - ref_gamma) < 1e-6

    # Near-expiry & zero-IV clamping must never crash or divide by zero
    clamped = black76_gamma(95_000.0, 95_000.0, 0.0, -50.0)
    assert clamped > 0.0 and math.isfinite(clamped)

    # +Call GEX vs -Put GEX polarity
    call_gex = net_dollar_gex_1pct(500.0, gamma, 0.0, 0.0, f)
    put_gex = net_dollar_gex_1pct(0.0, 0.0, 500.0, gamma, f)
    assert call_gex > 0.0
    assert put_gex < 0.0
    assert abs(call_gex + put_gex) < 1e-6


def test_max_pain_and_options_surface_computation() -> None:
    # Strikes 90k, 95k, 100k -> 95k minimizes total intrinsic payout
    # At 90k: put payout = 500*(95k-90k) + 200*(100k-90k) = 4.5M
    # At 95k: call payout = 400*(95k-90k) = 2.0M; put payout = 200*(100k-95k) = 1.0M -> 3.0M
    # At 100k: call payout = 400*(100k-90k) + 300*(100k-95k) = 5.5M
    max_pain = compute_max_pain(
        {90_000.0: 400.0, 95_000.0: 300.0, 100_000.0: 100.0},
        {90_000.0: 100.0, 95_000.0: 500.0, 100_000.0: 200.0},
    )
    assert max_pain == 95_000.0

    now_sec = datetime(2026, 11, 26, 12, 0, tzinfo=UTC).timestamp()
    book = [
        {
            "instrument_name": "BTC-27NOV26-100000-C",
            "open_interest": 800.0,
            "mark_iv": 55.0,
            "underlying_price": 95_000.0,
        },
        {
            "instrument_name": "BTC-27NOV26-90000-P",
            "open_interest": 600.0,
            "mark_iv": 58.0,
            "underlying_price": 95_000.0,
        },
        {
            "instrument_name": "BTC-27NOV26-95000-C",
            "open_interest": 300.0,
            "mark_iv": 52.0,
            "underlying_price": 95_000.0,
        },
        {
            "instrument_name": "BTC-27NOV26-95000-P",
            "open_interest": 300.0,
            "mark_iv": 52.0,
            "underlying_price": 95_000.0,
        },
        # Expired & combo contracts ignored
        {
            "instrument_name": "BTC-25NOV26-95000-C",
            "open_interest": 9999.0,
            "mark_iv": 50.0,
            "underlying_price": 95_000.0,
        },
        {
            "instrument_name": "BTC-27NOV26-90000-100000-C",
            "open_interest": 9999.0,
            "mark_iv": 50.0,
            "underlying_price": 95_000.0,
        },
    ]
    expiries, surfaces = compute_options_surfaces(book, now_sec=now_sec)
    assert [e.expiry_key for e in expiries] == ["ALL", "2026-11-27"]
    assert surfaces["ALL"].call_wall == 100_000.0
    assert surfaces["ALL"].put_wall == 90_000.0
    assert surfaces["2026-11-27"].call_wall_oi == 800.0
    assert surfaces["2026-11-27"].put_wall_oi == 600.0


def test_800_instrument_options_benchmark_under_25ms() -> None:
    now_sec = datetime(2026, 11, 26, 12, 0, tzinfo=UTC).timestamp()
    expiries_str = [
        "27NOV26",
        "04DEC26",
        "11DEC26",
        "25DEC26",
        "29JAN27",
        "26FEB27",
        "26MAR27",
        "25JUN27",
    ]
    book: list[dict[str, object]] = []
    for exp in expiries_str:
        for idx in range(50):
            strike = 60_000 + idx * 1_500
            for opt in ("C", "P"):
                book.append(
                    {
                        "instrument_name": f"BTC-{exp}-{strike}-{opt}",
                        "open_interest": 120.0 + (idx % 10) * 25.0,
                        "mark_iv": 52.0 + (idx % 7),
                        "underlying_price": 95_000.0,
                    }
                )
    assert len(book) == 800
    t0 = time.perf_counter()
    expiries, surfaces = compute_options_surfaces(book, now_sec=now_sec)
    elapsed_ms = (time.perf_counter() - t0) * 1000.0
    assert "ALL" in surfaces and len(expiries) == 9
    assert elapsed_ms < 25.0, f"800-instrument quant pass took {elapsed_ms:.2f}ms"


def test_predictive_liquidation_projection_and_sweep_mitigation() -> None:
    # Build 40 bars with a sharp high-volume swing low at index 25 (low = 90_000.0)
    # Followed at index 33 by a wick down to 88_500.0 that sweeps 100x (89_460) and 50x (88_560)
    # while leaving 25x (86_760) and 10x (81_360) untouched.
    candles: list[CandleBar] = []
    base_time = 1_763_900_000
    for i in range(40):
        low = 93_000.0
        high = 94_000.0
        quote_usd = 1_000_000.0
        if i == 25:
            low = 90_000.0
            high = 93_500.0
            quote_usd = 3_000_000.0  # >= 1.2 * SMA20
        elif i == 33:
            low = 88_500.0
            high = 93_400.0
            quote_usd = 900_000.0  # low volume so not a new pivot
        candles.append(
            CandleBar(
                time=base_time + i * 300,
                open=93_300.0,
                high=high,
                low=low,
                close=93_500.0,
                volume_btc=10.0,
                quote_usd=quote_usd,
                taker_buy_usd=quote_usd * 0.5,
                is_closed=True,
            )
        )

    bands = compute_predictive_liquidation_bands(candles, oi_delta_pct=0.05, current_price=93_500.0)
    long_bands = [b for b in bands if b.side == "long_liq"]
    leverages = {b.leverage for b in long_bands}
    assert 100 not in leverages
    assert 50 not in leverages
    assert {10, 25}.issubset(leverages)

    # Real-time tick mitigation sweeping 25x (86_760) leaves 10x (81_360) intact
    after_tick = filter_unmitigated_bands(long_bands, tick_low=86_700.0, tick_high=93_500.0)
    assert {b.leverage for b in after_tick} == {10}
