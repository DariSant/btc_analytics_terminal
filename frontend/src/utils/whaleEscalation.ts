import type { UTCTimestamp } from "lightweight-charts";
import type { TimeframeLiteral, TradeSideLiteral, WhalePrint } from "../types/terminal";
import { snapTimestampToBar } from "./timeSnap";

const DAY_MS = 86_400_000;

export const TF_FIXED_WHALE_MIN_USD: Record<TimeframeLiteral, number> = {
  "1m": 250_000,
  "5m": 500_000,
  "15m": 1_000_000,
  "1h": 2_000_000,
  "4h": 5_000_000,
  "1d": 10_000_000,
};

export const TF_HISTORY_WINDOW_MS: Record<TimeframeLiteral, number> = {
  "1m": DAY_MS,
  "5m": 2 * DAY_MS,
  "15m": 7 * DAY_MS,
  "1h": 14 * DAY_MS,
  "4h": 60 * DAY_MS,
  "1d": 60 * DAY_MS,
};

export const WHALE_ZOOM_HIDE_PX_PER_BAR = 3.5;
export const WHALE_ZOOM_FULL_PX_PER_BAR = 7.5;
const CLUSTER_PRICE_TOLERANCE = 0.0025;

export type ClusteredVenue = "binance" | "bybit" | "mixed";

export interface ClusteredWhaleBubble {
  barTime: UTCTimestamp;
  ts_ms: number;
  venue: ClusteredVenue;
  side: TradeSideLiteral;
  price: number;
  size_btc: number;
  notional_usd: number;
  clusterCount: number;
}

export interface BubbleZoomPolicy {
  visible: boolean;
  alphaScale: number;
  maxRadiusPx: number;
}

export function getFixedWhaleMinUsd(interval: TimeframeLiteral): number {
  return TF_FIXED_WHALE_MIN_USD[interval];
}

export function getOverlayHistoryWindowMs(interval: TimeframeLiteral): number {
  return TF_HISTORY_WINDOW_MS[interval];
}

export function computeBubbleZoomPolicy(pxPerBar: number): BubbleZoomPolicy {
  if (!Number.isFinite(pxPerBar) || pxPerBar < WHALE_ZOOM_HIDE_PX_PER_BAR) {
    return { visible: false, alphaScale: 0, maxRadiusPx: 0 };
  }
  if (pxPerBar >= WHALE_ZOOM_FULL_PX_PER_BAR) {
    return { visible: true, alphaScale: 1, maxRadiusPx: 28 };
  }
  const t =
    (pxPerBar - WHALE_ZOOM_HIDE_PX_PER_BAR) /
    (WHALE_ZOOM_FULL_PX_PER_BAR - WHALE_ZOOM_HIDE_PX_PER_BAR);
  return {
    visible: true,
    alphaScale: 0.35 + t * 0.65,
    maxRadiusPx: Math.min(28, Math.max(7, Math.round(pxPerBar * 2.2))),
  };
}

/**
 * Compute maximum bubbles allowed in the current viewport from visible candle count
 * (~1 bubble per 6 visible candles, bounded to [6, 36]) to prevent dense crowding.
 */
export function computeVisibleBubbleBudget(visibleBars: number): number {
  if (!Number.isFinite(visibleBars) || visibleBars <= 0) {
    return 0;
  }
  return Math.max(6, Math.min(36, Math.floor(visibleBars / 6)));
}

/**
 * Scale bubble radius relative to the active timeframe's fixed floor so higher-TF
 * prints differentiate cleanly up to 20x the TF threshold before capping.
 */
export function computeScaledWhaleRadius(
  notionalUsd: number,
  tfMinUsd: number,
  maxRadiusPx: number = 28,
): number {
  const floor = Math.max(250_000, tfMinUsd);
  const span = floor * 19;
  const scaled = 4 + 24 * Math.sqrt(Math.max(0, notionalUsd - floor) / span);
  return Math.min(maxRadiusPx, Math.max(4, scaled));
}

/**
 * Retain only the top-N largest notional bubbles within the visible budget,
 * returned ascending by notional_usd so larger sweeps render on top.
 */
export function applyVisibleBubbleBudget<T extends { notional_usd: number }>(
  items: readonly T[],
  budget: number,
): T[] {
  if (budget <= 0 || items.length === 0) {
    return [];
  }
  if (items.length <= budget) {
    return [...items].sort((a, b) => a.notional_usd - b.notional_usd);
  }
  return [...items]
    .sort((a, b) => b.notional_usd - a.notional_usd)
    .slice(0, budget)
    .sort((a, b) => a.notional_usd - b.notional_usd);
}

/**
 * Filter real 100ms WS whale prints by the fixed timeframe floor and merge same-bar,
 * same-side prints within 0.25% price proximity to prevent vertical stacking.
 */
export function clusterWhaleBubbles(
  whales: readonly WhalePrint[],
  interval: TimeframeLiteral,
): ClusteredWhaleBubble[] {
  const fixedMinUsd = getFixedWhaleMinUsd(interval);
  const buckets = new Map<string, WhalePrint[]>();

  for (let i = 0; i < whales.length; i += 1) {
    const w = whales[i]!;
    if (w.notional_usd < fixedMinUsd) {
      continue;
    }
    const barTime = snapTimestampToBar(w.ts_ms, interval);
    const key = `${barTime}:${w.side}`;
    const list = buckets.get(key);
    if (list) {
      list.push(w);
    } else {
      buckets.set(key, [w]);
    }
  }

  const clustered: ClusteredWhaleBubble[] = [];

  for (const group of buckets.values()) {
    group.sort((a, b) => a.price - b.price);
    let anchor = group[0]!;
    let sumNotional = anchor.notional_usd;
    let sumWeightedPrice = anchor.price * anchor.notional_usd;
    let sumSizeBtc = anchor.size_btc;
    let latestTsMs = anchor.ts_ms;
    let count = 1;
    let hasBinance = anchor.venue === "binance";
    let hasBybit = anchor.venue === "bybit";

    const flushCluster = () => {
      const venue: ClusteredVenue =
        hasBinance && hasBybit ? "mixed" : hasBinance ? "binance" : "bybit";
      clustered.push({
        barTime: snapTimestampToBar(latestTsMs, interval),
        ts_ms: latestTsMs,
        venue,
        side: anchor.side,
        price: sumNotional > 0 ? sumWeightedPrice / sumNotional : anchor.price,
        size_btc: sumSizeBtc,
        notional_usd: sumNotional,
        clusterCount: count,
      });
    };

    for (let i = 1; i < group.length; i += 1) {
      const next = group[i]!;
      const relDiff =
        anchor.price > 0 ? Math.abs(next.price - anchor.price) / anchor.price : 1;
      if (relDiff <= CLUSTER_PRICE_TOLERANCE) {
        sumNotional += next.notional_usd;
        sumWeightedPrice += next.price * next.notional_usd;
        sumSizeBtc += next.size_btc;
        if (next.ts_ms > latestTsMs) {
          latestTsMs = next.ts_ms;
        }
        count += 1;
        if (next.venue === "binance") hasBinance = true;
        if (next.venue === "bybit") hasBybit = true;
      } else {
        flushCluster();
        anchor = next;
        sumNotional = next.notional_usd;
        sumWeightedPrice = next.price * next.notional_usd;
        sumSizeBtc = next.size_btc;
        latestTsMs = next.ts_ms;
        count = 1;
        hasBinance = next.venue === "binance";
        hasBybit = next.venue === "bybit";
      }
    }
    flushCluster();
  }

  clustered.sort((a, b) => a.notional_usd - b.notional_usd);
  return clustered;
}
