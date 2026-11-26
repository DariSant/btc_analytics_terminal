import { useEffect, useRef, useState } from "react";
import {
  CandlestickSeries,
  ColorType,
  CrosshairMode,
  HistogramSeries,
  createChart,
  type CandlestickData,
  type HistogramData,
  type IChartApi,
  type ISeriesApi,
  type MouseEventParams,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import {
  LiquidationPrimitive,
  THERMAL_STRIP_WIDTH_PX,
} from "../primitives/LiquidationPrimitive";
import { OptionsWallsPrimitive } from "../primitives/OptionsWallsPrimitive";
import { VRVPPrimitive } from "../primitives/VRVPPrimitive";
import { WhaleBubblesPrimitive } from "../primitives/WhaleBubblesPrimitive";
import { useTerminalStore } from "../store/useTerminalStore";
import type { CandleBar } from "../types/terminal";
import { withAlpha } from "../utils/colorAlpha";
import {
  formatBtcSize,
  formatCompactUsd,
  formatPrice,
  formatUtcTime,
} from "../utils/formatters";
import { readThemeTokens, type ThemePalette } from "../utils/themeTokens";
import type { ClusteredWhaleBubble } from "../utils/whaleEscalation";

function toCandlestickPoint(bar: CandleBar): CandlestickData<UTCTimestamp> {
  return {
    time: bar.time as UTCTimestamp,
    open: bar.open,
    high: bar.high,
    low: bar.low,
    close: bar.close,
  };
}

function toVolumePoint(
  bar: CandleBar,
  palette: ThemePalette,
): HistogramData<UTCTimestamp> {
  const isBull = bar.close >= bar.open;
  return {
    time: bar.time as UTCTimestamp,
    value: bar.quote_usd,
    color: withAlpha(isBull ? palette.bull : palette.bear, 0.35),
  };
}

function sanitizeAscendingBars(candles: readonly CandleBar[]): CandleBar[] {
  if (candles.length <= 1) {
    return [...candles];
  }
  const sorted = [...candles].sort((a, b) => a.time - b.time);
  const deduped: CandleBar[] = [];
  for (const bar of sorted) {
    const prev = deduped[deduped.length - 1];
    if (prev && prev.time === bar.time) {
      deduped[deduped.length - 1] = bar;
    } else {
      deduped.push(bar);
    }
  }
  return deduped;
}

export function UnifiedChart() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [hoveredWhale, setHoveredWhale] =
    useState<ClusteredWhaleBubble | null>(null);
  const [whaleZoomHidden, setWhaleZoomHidden] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    let palette = readThemeTokens();
    const initialState = useTerminalStore.getState();

    const chart: IChartApi = createChart(container, {
      width: Math.max(container.clientWidth, 1),
      height: Math.max(container.clientHeight, 1),
      layout: {
        background: { type: ColorType.Solid, color: palette.bgCanvas },
        textColor: palette.textMuted,
        fontFamily: "'JetBrains Mono', monospace",
        fontSize: 11,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: palette.gridLine },
        horzLines: { color: palette.gridLine },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
      },
      rightPriceScale: {
        borderColor: palette.borderHairline,
        scaleMargins: { top: 0.08, bottom: 0.2 },
      },
      timeScale: {
        borderColor: palette.borderHairline,
        timeVisible: true,
        secondsVisible: false,
      },
    });

    const candleSeries: ISeriesApi<"Candlestick"> = chart.addSeries(
      CandlestickSeries,
      {
        upColor: palette.bull,
        downColor: palette.bear,
        borderUpColor: palette.bull,
        borderDownColor: palette.bear,
        wickUpColor: palette.bull,
        wickDownColor: palette.bear,
      },
    );

    const volumeSeries: ISeriesApi<"Histogram"> = chart.addSeries(
      HistogramSeries,
      {
        priceFormat: { type: "volume" },
        priceScaleId: "volume",
        visible: initialState.layers.volume,
      },
    );

    chart.priceScale("volume").applyOptions({
      scaleMargins: { top: 0.82, bottom: 0.0 },
    });

    const leftReserveOptions = initialState.layers.liquidations
      ? THERMAL_STRIP_WIDTH_PX + 2
      : 0;

    const vrvpPrimitive = new VRVPPrimitive({
      candles: initialState.candles,
      visible: initialState.layers.vrvp,
      rightReservePx: 0,
      palette,
    });
    const liquidationPrimitive = new LiquidationPrimitive({
      predictedBands: initialState.predictedLiqBands,
      realizedLiquidations: initialState.realizedLiquidations,
      timeframe: initialState.timeframe,
      visible: initialState.layers.liquidations,
      palette,
    });
    const whalePrimitive = new WhaleBubblesPrimitive({
      whales: initialState.whales,
      timeframe: initialState.timeframe,
      candleCount: initialState.candles.length,
      visible: initialState.layers.whales,
      palette,
      onZoomHiddenChange: (hidden) => {
        setWhaleZoomHidden(hidden);
        if (hidden) {
          setHoveredWhale(null);
        }
      },
    });
    const optionsWallsPrimitive = new OptionsWallsPrimitive({
      summary: initialState.optionsSummary,
      showWalls: initialState.layers.optionsWalls,
      showMaxPain: initialState.layers.maxPain,
      leftReservePx: leftReserveOptions,
      rightReservePx: 6,
      palette,
    });

    candleSeries.attachPrimitive(vrvpPrimitive);
    candleSeries.attachPrimitive(liquidationPrimitive);
    candleSeries.attachPrimitive(whalePrimitive);
    candleSeries.attachPrimitive(optionsWallsPrimitive);

    const applyFullSeriesData = (
      candles: readonly CandleBar[],
      activePalette: ThemePalette,
    ) => {
      const cleanBars = sanitizeAscendingBars(candles);
      candleSeries.setData(cleanBars.map(toCandlestickPoint));
      volumeSeries.setData(
        cleanBars.map((bar) => toVolumePoint(bar, activePalette)),
      );
      vrvpPrimitive.updateState({ candles: cleanBars });
      whalePrimitive.updateState({ candleCount: cleanBars.length });
    };

    if (initialState.candles.length > 0) {
      applyFullSeriesData(initialState.candles, palette);
    }

    let lastHoveredRef: ClusteredWhaleBubble | null = null;
    const handleCrosshairMove = (param: MouseEventParams<Time>) => {
      const hit =
        param.point !== undefined
          ? whalePrimitive.findBubbleAtPoint(param.point.x, param.point.y)
          : null;
      if (hit !== lastHoveredRef) {
        lastHoveredRef = hit;
        setHoveredWhale(hit);
      }
    };
    chart.subscribeCrosshairMove(handleCrosshairMove);

    const unsubscribe = useTerminalStore.subscribe((state, prevState) => {
      if (state.theme !== prevState.theme) {
        palette = readThemeTokens();
        chart.applyOptions({
          layout: {
            background: { type: ColorType.Solid, color: palette.bgCanvas },
            textColor: palette.textMuted,
          },
          grid: {
            vertLines: { color: palette.gridLine },
            horzLines: { color: palette.gridLine },
          },
          rightPriceScale: {
            borderColor: palette.borderHairline,
          },
          timeScale: {
            borderColor: palette.borderHairline,
          },
        });
        candleSeries.applyOptions({
          upColor: palette.bull,
          downColor: palette.bear,
          borderUpColor: palette.bull,
          borderDownColor: palette.bear,
          wickUpColor: palette.bull,
          wickDownColor: palette.bear,
        });
        if (
          state.candles.length > 0 &&
          state.klinesRevision === prevState.klinesRevision
        ) {
          volumeSeries.setData(
            sanitizeAscendingBars(state.candles).map((bar) =>
              toVolumePoint(bar, palette),
            ),
          );
        }
        vrvpPrimitive.updateState({ palette });
        liquidationPrimitive.updateState({ palette });
        whalePrimitive.updateState({ palette });
        optionsWallsPrimitive.updateState({ palette });
      }

      if (state.layers !== prevState.layers) {
        volumeSeries.applyOptions({ visible: state.layers.volume });
        const nextLeftOptionsReserve = state.layers.liquidations
          ? THERMAL_STRIP_WIDTH_PX + 2
          : 0;

        vrvpPrimitive.updateState({
          visible: state.layers.vrvp,
          rightReservePx: 0,
        });
        liquidationPrimitive.updateState({
          visible: state.layers.liquidations,
        });
        whalePrimitive.updateState({
          visible: state.layers.whales,
        });
        if (!state.layers.whales && lastHoveredRef !== null) {
          lastHoveredRef = null;
          setHoveredWhale(null);
        }
        optionsWallsPrimitive.updateState({
          showWalls: state.layers.optionsWalls,
          showMaxPain: state.layers.maxPain,
          leftReservePx: nextLeftOptionsReserve,
          rightReservePx: 6,
        });
      }

      if (
        state.whales !== prevState.whales ||
        state.timeframe !== prevState.timeframe
      ) {
        whalePrimitive.updateState({
          whales: state.whales,
          timeframe: state.timeframe,
        });
      }

      if (
        state.predictedLiqBands !== prevState.predictedLiqBands ||
        state.realizedLiquidations !== prevState.realizedLiquidations ||
        state.timeframe !== prevState.timeframe
      ) {
        liquidationPrimitive.updateState({
          predictedBands: state.predictedLiqBands,
          realizedLiquidations: state.realizedLiquidations,
          timeframe: state.timeframe,
        });
      }

      if (state.optionsSummary !== prevState.optionsSummary) {
        optionsWallsPrimitive.updateState({ summary: state.optionsSummary });
      }

      if (state.klinesRevision !== prevState.klinesRevision) {
        applyFullSeriesData(state.candles, palette);
        return;
      }

      if (
        state.lastKlineTick &&
        state.lastKlineTick !== prevState.lastKlineTick &&
        state.lastKlineTick.interval === state.timeframe
      ) {
        const tick = state.lastKlineTick.candle;
        candleSeries.update(toCandlestickPoint(tick));
        volumeSeries.update(toVolumePoint(tick, palette));
        vrvpPrimitive.updateState({ candles: state.candles });
        whalePrimitive.updateState({ candleCount: state.candles.length });
      }
    });

    let resizeObserver: ResizeObserver | null = null;
    if (typeof ResizeObserver !== "undefined") {
      resizeObserver = new ResizeObserver((entries) => {
        const entry = entries[0];
        if (!entry) {
          return;
        }
        const width = Math.floor(entry.contentRect.width);
        const height = Math.floor(entry.contentRect.height);
        if (width > 0 && height > 0) {
          chart.resize(width, height);
        }
      });
      resizeObserver.observe(container);
    }

    return () => {
      resizeObserver?.disconnect();
      chart.unsubscribeCrosshairMove(handleCrosshairMove);
      unsubscribe();
      candleSeries.detachPrimitive(vrvpPrimitive);
      candleSeries.detachPrimitive(liquidationPrimitive);
      candleSeries.detachPrimitive(whalePrimitive);
      candleSeries.detachPrimitive(optionsWallsPrimitive);
      chart.remove();
    };
  }, []);

  return (
    <div className="w-full h-full relative">
      <div
        ref={containerRef}
        className="w-full h-full"
        aria-label="BTCUSDT Unified Market Chart"
      />
      {hoveredWhale ? (
        <div
          role="status"
          aria-label="Hovered Whale Print"
          className="hairline-border font-mono-tabular absolute top-2 left-6 z-10 px-2.5 py-1 rounded-[2px] flex items-center gap-2.5 text-[11px] pointer-events-none"
          style={{
            backgroundColor: "var(--bg-surface)",
            color: "var(--text-primary)",
          }}
        >
          <span
            className="uppercase font-semibold"
            style={{
              color:
                hoveredWhale.side === "buy"
                  ? "var(--accent-bull)"
                  : "var(--accent-bear)",
            }}
          >
            {hoveredWhale.venue === "mixed"
              ? "BINANCE+BYBIT"
              : hoveredWhale.venue}{" "}
            {hoveredWhale.side}
          </span>
          <span>{formatCompactUsd(hoveredWhale.notional_usd)}</span>
          {hoveredWhale.clusterCount > 1 && (
            <span style={{ color: "var(--text-primary)" }}>
              x{hoveredWhale.clusterCount}
            </span>
          )}
          <span style={{ color: "var(--text-muted)" }}>
            {formatBtcSize(hoveredWhale.size_btc)} @{" "}
            {formatPrice(hoveredWhale.price)}
          </span>
          <span style={{ color: "var(--text-muted)" }}>
            {formatUtcTime(hoveredWhale.ts_ms)}
          </span>
        </div>
      ) : (
        whaleZoomHidden && (
          <div
            role="status"
            aria-label="Whale Bubbles Zoom Notice"
            className="hairline-border font-mono-tabular absolute top-2 left-6 z-10 px-2 py-0.5 rounded-[2px] text-[10px] pointer-events-none"
            style={{
              backgroundColor: "var(--bg-surface)",
              color: "var(--text-muted)",
            }}
          >
            WHALES AUTO-HIDDEN · ZOOM IN
          </div>
        )
      )}
    </div>
  );
}
