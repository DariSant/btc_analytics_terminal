---
name: lwc-v5-primitives
description: TradingView Lightweight Charts v5.3+ series initialization, custom ISeriesPrimitive Canvas 2D overlays, Retina/HiDPI media coordinate space rendering, and candle timestamp floor-snapping. Use whenever building or updating UnifiedChart.tsx or chart primitives.
---

# Lightweight Charts v5.3+ & Custom Canvas Primitives Skill

## 1. Mandatory v5 Series API (Zero v4 Deprecated Calls)

Lightweight Charts v5 removed v4 series factory methods. Calling v4 methods throws a runtime `TypeError` and fails the repository audit.

| Legacy v4 Call (FORBIDDEN) | v5.3+ Replacement (REQUIRED) |
| --- | --- |
| `chart.addCandlestickSeries(opts)` | `chart.addSeries(CandlestickSeries, opts)` |
| `chart.addHistogramSeries(opts)` | `chart.addSeries(HistogramSeries, opts)` |
| `chart.addLineSeries(opts)` | `chart.addSeries(LineSeries, opts)` |
| `series.setMarkers([...])` | Custom `ISeriesPrimitive<Time>` attached via `series.attachPrimitive(p)` |

### Canonical Unified Chart + Bottom 18% Volume Initialization

Create the chart instance **once** inside a mount `useEffect` and clean up via `chart.remove()`. Never recreate the chart when state ticks arrive.

```ts
import {
  createChart,
  CandlestickSeries,
  HistogramSeries,
  CrosshairMode,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  type HistogramData,
  type UTCTimestamp,
} from 'lightweight-charts';

export function mountUnifiedChart(container: HTMLElement, palette: {
  bgCanvas: string;
  textMuted: string;
  borderHairline: string;
  gridLine: string;
  bull: string;
  bear: string;
}) {
  const chart: IChartApi = createChart(container, {
    width: container.clientWidth,
    height: container.clientHeight,
    layout: {
      background: { type: ColorType.Solid, color: palette.bgCanvas },
      textColor: palette.textMuted,
      fontFamily: "'JetBrains Mono', monospace",
      fontSize: 11,
      attributionLogo: false, // Keep Apache-2.0 attribution link in ControlDrawer footer
    },
    grid: {
      vertLines: { color: palette.gridLine },
      horzLines: { color: palette.gridLine },
    },
    crosshair: { mode: CrosshairMode.Normal },
    rightPriceScale: {
      borderColor: palette.borderHairline,
      scaleMargins: { top: 0.08, bottom: 0.20 }, // Leaves bottom 18% clear for volume
    },
    timeScale: {
      borderColor: palette.borderHairline,
      timeVisible: true,
      secondsVisible: false,
    },
  });

  const candleSeries: ISeriesApi<'Candlestick'> = chart.addSeries(CandlestickSeries, {
    upColor: palette.bull,
    downColor: palette.bear,
    borderUpColor: palette.bull,
    borderDownColor: palette.bear,
    wickUpColor: palette.bull,
    wickDownColor: palette.bear,
  });

  const volumeSeries: ISeriesApi<'Histogram'> = chart.addSeries(HistogramSeries, {
    priceFormat: { type: 'volume' },
    priceScaleId: 'volume',
  });

  chart.priceScale('volume').applyOptions({
    scaleMargins: { top: 0.82, bottom: 0.0 },
  });

  return { chart, candleSeries, volumeSeries };
}
```

### Data Update Discipline (`60 FPS` Preservation)

* Call `candleSeries.setData(bars)` and `volumeSeries.setData(volBars)` **only** on initial load or when `timeframe` changes. Always ensure `bars` are strictly sorted ascending by `time` with zero duplicate timestamps.
* Call `candleSeries.update(bar)` and `volumeSeries.update(volBar)` for live `/ws/btc` `"kline"` frames.

---

## 2. Custom `ISeriesPrimitive<Time>` Boilerplate & Retina Coordinate Space

Do **not** import `'fancy-canvas'` directly in `package.json`; extract the render target type directly from `IPrimitivePaneRenderer['draw']` provided by `'lightweight-charts'`.

### CRITICAL HiDPI / Retina Rule

`chart.timeScale().timeToCoordinate(t)` and `series.priceToCoordinate(price)` return **CSS media pixels**, not device bitmap pixels. Always render inside `target.useMediaCoordinateSpace(({ context, mediaSize }) => { ... })` so `lightweight-charts` scales Retina device pixel ratios automatically:

```ts
import type {
  IChartApi,
  ISeriesApi,
  ISeriesPrimitive,
  SeriesAttachedParameter,
  IPrimitivePaneView,
  IPrimitivePaneRenderer,
  PrimitivePaneViewZOrder,
  Time,
  UTCTimestamp,
} from 'lightweight-charts';

type RenderTarget = Parameters<IPrimitivePaneRenderer['draw']>[0];

class OverlayRenderer implements IPrimitivePaneRenderer {
  constructor(private readonly renderFn: (ctx: CanvasRenderingContext2D, width: number, height: number) => void) {}

  draw(target: RenderTarget): void {
    target.useMediaCoordinateSpace(({ context, mediaSize }) => {
      this.renderFn(context, mediaSize.width, mediaSize.height);
    });
  }
}

export abstract class BaseOverlayPrimitive implements ISeriesPrimitive<Time> {
  protected chart: IChartApi | null = null;
  protected series: ISeriesApi<'Candlestick'> | null = null;
  protected requestUpdateCallback: (() => void) | null = null;
  private readonly paneView: IPrimitivePaneView;

  constructor(zOrder: PrimitivePaneViewZOrder = 'normal') {
    const renderer = new OverlayRenderer((ctx, w, h) => this.drawOverlay(ctx, w, h));
    this.paneView = {
      zOrder: () => zOrder,
      renderer: () => renderer,
    };
  }

  attached(param: SeriesAttachedParameter<Time>): void {
    this.chart = param.chart as IChartApi;
    this.series = param.series as ISeriesApi<'Candlestick'>;
    this.requestUpdateCallback = param.requestUpdate;
  }

  detached(): void {
    this.chart = null;
    this.series = null;
    this.requestUpdateCallback = null;
  }

  paneViews(): readonly IPrimitivePaneView[] {
    return [this.paneView];
  }

  public triggerUpdate(): void {
    this.requestUpdateCallback?.();
  }

  protected abstract drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number
  ): void;
}
```

### Crisp `1px` Hairline Alignment & Z-Order Layering

* **Crisp Horizontal Lines:** When drawing `1px` rays (`POC`, `VAH`, `VAL`, `Call Wall`, `Put Wall`, `Max Pain`), align Y to `const crispY = Math.floor(rawY) + 0.5;` with `ctx.lineWidth = 1;` so lines never blur across two physical rows.
* **Recommended `zOrder`:**
  * `'bottom'` for `VRVPPrimitive` and predictive bands in `LiquidationPrimitive` so candlesticks remain legible on top.
  * `'top'` for `WhaleBubblesPrimitive` and `OptionsWallsPrimitive` right-axis strike tags.

---

## 3. Mandatory Timestamp Snapping (`snapTimestampToBar`)

`timeScale().timeToCoordinate(t)` returns `null` whenever `t` does not match the exact open timestamp of a loaded candle bar. Because whale trades and liquidations arrive at millisecond resolution (e.g., `12:03:41.450`), you MUST floor every event's timestamp to the active interval's bar open in **integer UTC seconds** before looking up X coordinates:

```ts
import type { UTCTimestamp } from 'lightweight-charts';
import type { TimeframeLiteral } from '../types/terminal';

const INTERVAL_SECONDS: Record<TimeframeLiteral, number> = {
  '1m': 60,
  '5m': 300,
  '15m': 900,
  '1h': 3600,
  '4h': 14400,
  '1d': 86400,
};

export function snapTimestampToBar(tsMs: number, interval: TimeframeLiteral): UTCTimestamp {
  const sec = Math.floor(tsMs / 1000);
  const step = INTERVAL_SECONDS[interval];
  return (Math.floor(sec / step) * step) as UTCTimestamp;
}
```

Always guard coordinate lookups inside `drawOverlay`:

```ts
const barTime = snapTimestampToBar(event.ts_ms, this.activeInterval);
const x = this.chart.timeScale().timeToCoordinate(barTime);
const y = this.series.priceToCoordinate(event.price);
if (x === null || y === null) continue;
```

---

## 4. Slicing Visible Candles for Client-Side VRVP

To compute 80-bin VRVP at `60 FPS` on pan/zoom without scanning off-screen bars:

```ts
const logicalRange = chart.timeScale().getVisibleLogicalRange();
if (!logicalRange || candles.length === 0) return;

const startIdx = Math.max(0, Math.floor(logicalRange.from));
const endIdx = Math.min(candles.length - 1, Math.ceil(logicalRange.to));
if (startIdx > endIdx) return;

const visibleCandles = candles.slice(startIdx, endIdx + 1);
```