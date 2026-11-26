"""Schema contract tests enforcing wire parity, bounds, and strict rejection."""

import pytest
from pydantic import ValidationError

from app.schemas import (
    WS_SERVER_EVENT_ADAPTER,
    CandleBar,
    ExpirySummary,
    HeaderTelemetry,
    HealthResponse,
    KlinesResponse,
    LiquidationBand,
    OptionsResponse,
    OptionsSurfaceSummary,
    OverlaysHistoryResponse,
    RealizedLiquidation,
    StrikeMetrics,
    WhalePrint,
    WsClientCommand,
    WsKlineEvent,
    WsLiqBandsEvent,
    WsLiquidationEvent,
    WsOptionsUpdateEvent,
    WsTelemetryEvent,
    WsWhaleEvent,
)


def test_candle_bar_roundtrip_and_second_bounds() -> None:
    candle = CandleBar(
        time=1_763_938_800,
        open=94_210.5,
        high=94_250.0,
        low=94_190.0,
        close=94_240.0,
        volume_btc=42.1,
        quote_usd=3_967_500.0,
        taker_buy_usd=2_150_000.0,
        is_closed=False,
    )
    decoded = CandleBar.model_validate_json(candle.model_dump_json())
    assert decoded == candle

    # Millisecond timestamps must fail UTC-second bounds check.
    with pytest.raises(ValidationError):
        CandleBar(
            time=1_763_938_800_000,
            open=94_210.5,
            high=94_250.0,
            low=94_190.0,
            close=94_240.0,
            volume_btc=42.1,
            quote_usd=3_967_500.0,
            taker_buy_usd=2_150_000.0,
        )

    # Negative timestamps must fail.
    with pytest.raises(ValidationError):
        CandleBar(
            time=-1,
            open=94_210.5,
            high=94_250.0,
            low=94_190.0,
            close=94_240.0,
            volume_btc=42.1,
            quote_usd=3_967_500.0,
            taker_buy_usd=2_150_000.0,
        )


def test_whale_and_liquidation_ms_bounds_and_sides() -> None:
    whale = WhalePrint(
        ts_ms=1_763_938_812_450,
        venue="binance",
        side="buy",
        price=94_242.1,
        size_btc=3.45,
        notional_usd=325_135.25,
    )
    assert WhalePrint.model_validate_json(whale.model_dump_json()) == whale

    liq = RealizedLiquidation(
        ts_ms=1_763_938_813_100,
        venue="bybit",
        side="short_liq",
        price=94_255.0,
        size_btc=1.2,
        notional_usd=113_106.0,
    )
    assert RealizedLiquidation.model_validate_json(liq.model_dump_json()) == liq

    # Seconds passed into ts_ms must fail millisecond bounds check.
    with pytest.raises(ValidationError):
        WhalePrint(
            ts_ms=1_763_938_812,
            venue="binance",
            side="buy",
            price=94_242.1,
            size_btc=3.45,
            notional_usd=325_135.25,
        )

    # Invalid side literals must fail.
    with pytest.raises(ValidationError):
        WhalePrint.model_validate(
            {
                "ts_ms": 1_763_938_812_450,
                "venue": "binance",
                "side": "long_liq",
                "price": 94_242.1,
                "size_btc": 3.45,
                "notional_usd": 325_135.25,
            }
        )

    with pytest.raises(ValidationError):
        RealizedLiquidation.model_validate(
            {
                "ts_ms": 1_763_938_813_100,
                "venue": "bybit",
                "side": "buy",
                "price": 94_255.0,
                "size_btc": 1.2,
                "notional_usd": 113_106.0,
            }
        )


def test_extra_fields_forbidden_and_invalid_interval_rejected() -> None:
    with pytest.raises(ValidationError):
        WsClientCommand.model_validate({"type": "set_timeframe", "interval": "3m"})

    with pytest.raises(ValidationError):
        WsClientCommand.model_validate(
            {"type": "set_timeframe", "interval": "5m", "unexpected": True}
        )

    cmd = WsClientCommand(type="set_timeframe", interval="15m")
    assert WsClientCommand.model_validate_json(cmd.model_dump_json()) == cmd


def test_rest_and_ws_discriminated_union_roundtrips() -> None:
    candle = CandleBar(
        time=1_763_938_800,
        open=94_210.5,
        high=94_250.0,
        low=94_190.0,
        close=94_240.0,
        volume_btc=42.1,
        quote_usd=3_967_500.0,
        taker_buy_usd=2_150_000.0,
        is_closed=True,
    )
    band = LiquidationBand(
        anchor_time=1_763_938_500,
        price=92_850.0,
        side="long_liq",
        leverage=50,
        intensity=0.84,
    )
    whale = WhalePrint(
        ts_ms=1_763_938_812_450,
        venue="binance",
        side="sell",
        price=94_242.1,
        size_btc=2.0,
        notional_usd=188_484.2,
    )
    liq = RealizedLiquidation(
        ts_ms=1_763_938_813_100,
        venue="bybit",
        side="long_liq",
        price=94_100.0,
        size_btc=1.5,
        notional_usd=141_150.0,
    )
    expiry = ExpirySummary(
        expiry_key="2026-12-27",
        expiry_ts_ms=1_798_358_400_000,
        total_oi_btc=12_500.0,
        oi_share_pct=34.5,
    )
    surface = OptionsSurfaceSummary(
        expiry_key="ALL",
        underlying_price=94_240.0,
        call_wall=100_000.0,
        call_wall_oi=4_120.0,
        put_wall=90_000.0,
        put_wall_oi=3_850.0,
        max_pain=92_000.0,
        put_call_ratio=0.72,
        net_gex_usd=14_250_000.0,
        top_gex_strikes=[
            StrikeMetrics(
                strike=100_000.0,
                call_oi=4_120.0,
                put_oi=540.0,
                net_gex_usd=8_120_000.0,
            )
        ],
    )
    telemetry = HeaderTelemetry(
        mark_price=94_240.5,
        index_price=94_218.0,
        change_24h_pct=2.41,
        funding_rate=0.000102,
        next_funding_ms=1_763_942_400_000,
        open_interest_usd=19_450_200_000.0,
        oi_change_24h_pct=4.15,
        session_cvd_usd=148_200_000.0,
    )

    health = HealthResponse(
        status="ok",
        uptime_sec=12.4,
        binance_ws=True,
        bybit_ws=True,
        deribit_last_sync_ms=1_763_938_800_000,
        sqlite_ok=True,
    )
    assert HealthResponse.model_validate_json(health.model_dump_json()) == health

    klines_resp = KlinesResponse(
        interval="5m",
        candles=[candle],
        predicted_liquidations=[band],
    )
    assert KlinesResponse.model_validate_json(klines_resp.model_dump_json()) == klines_resp

    overlays_resp = OverlaysHistoryResponse(whales=[whale], liquidations=[liq])
    assert OverlaysHistoryResponse.model_validate_json(overlays_resp.model_dump_json()) == (
        overlays_resp
    )

    options_resp = OptionsResponse(
        selected_expiry="ALL",
        available_expiries=[expiry],
        summary=surface,
    )
    assert OptionsResponse.model_validate_json(options_resp.model_dump_json()) == options_resp

    events = [
        WsKlineEvent(type="kline", interval="5m", candle=candle),
        WsWhaleEvent(type="whale", data=whale),
        WsLiquidationEvent(type="liquidation", data=liq),
        WsLiqBandsEvent(type="liq_bands", interval="5m", bands=[band]),
        WsTelemetryEvent(type="telemetry", data=telemetry),
        WsOptionsUpdateEvent(
            type="options_update",
            available_expiries=[expiry],
            surfaces_by_expiry={"ALL": surface},
        ),
    ]
    for ev in events:
        parsed = WS_SERVER_EVENT_ADAPTER.validate_json(ev.model_dump_json())
        assert parsed == ev
