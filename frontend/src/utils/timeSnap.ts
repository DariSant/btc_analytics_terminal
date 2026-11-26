import type { UTCTimestamp } from "lightweight-charts";
import type { TimeframeLiteral } from "../types/terminal";

export const INTERVAL_SECONDS: Record<TimeframeLiteral, number> = {
  "1m": 60,
  "5m": 300,
  "15m": 900,
  "1h": 3600,
  "4h": 14400,
  "1d": 86400,
};

export const TIMEFRAMES: readonly TimeframeLiteral[] = [
  "1m",
  "5m",
  "15m",
  "1h",
  "4h",
  "1d",
] as const;

export function barSecondsForInterval(interval: TimeframeLiteral): number {
  return INTERVAL_SECONDS[interval];
}

/**
 * Snap an arbitrary millisecond epoch timestamp to the opening UTC seconds
 * of its containing candle bar so Lightweight Charts primitives align cleanly.
 */
export function snapTimestampToBar(
  tsMs: number,
  interval: TimeframeLiteral,
): UTCTimestamp {
  const stepSec = INTERVAL_SECONDS[interval];
  const tsSec = Math.floor(tsMs / 1000);
  const snapped = Math.floor(tsSec / stepSec) * stepSec;
  return snapped as UTCTimestamp;
}
