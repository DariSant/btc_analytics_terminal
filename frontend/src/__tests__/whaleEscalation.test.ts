import { describe, expect, it } from "vitest";
import type { WhalePrint } from "../types/terminal";
import {
  TF_FIXED_WHALE_MIN_USD,
  applyVisibleBubbleBudget,
  clusterWhaleBubbles,
  computeBubbleZoomPolicy,
  computeScaledWhaleRadius,
  computeVisibleBubbleBudget,
  getFixedWhaleMinUsd,
  getOverlayHistoryWindowMs,
} from "../utils/whaleEscalation";

function makePrint(
  tsMs: number,
  price: number,
  notional: number,
  side: "buy" | "sell" = "buy",
  venue: "binance" | "bybit" = "binance",
): WhalePrint {
  return {
    ts_ms: tsMs,
    venue,
    side,
    price,
    size_btc: notional / price,
    notional_usd: notional,
  };
}

describe("Fixed TF Whale Escalation, Clustering & Visible-Candle Budgeting", () => {
  it("enforces fixed per-timeframe floors starting at $250k on 1m up to $10M on 1d", () => {
    expect(TF_FIXED_WHALE_MIN_USD["1m"]).toBe(250_000);
    expect(getFixedWhaleMinUsd("1m")).toBe(250_000);
    expect(getFixedWhaleMinUsd("5m")).toBe(500_000);
    expect(getFixedWhaleMinUsd("15m")).toBe(1_000_000);
    expect(getFixedWhaleMinUsd("1h")).toBe(2_000_000);
    expect(getFixedWhaleMinUsd("4h")).toBe(5_000_000);
    expect(getFixedWhaleMinUsd("1d")).toBe(10_000_000);
  });

  it("extends overlay history fetch windows for higher timeframes", () => {
    expect(getOverlayHistoryWindowMs("1m")).toBeLessThan(
      getOverlayHistoryWindowMs("15m"),
    );
    expect(getOverlayHistoryWindowMs("15m")).toBeLessThan(
      getOverlayHistoryWindowMs("1h"),
    );
    expect(getOverlayHistoryWindowMs("1h")).toBeLessThan(
      getOverlayHistoryWindowMs("4h"),
    );
  });

  it("budgets visible bubbles dynamically by visible candle count and keeps top notionals", () => {
    expect(computeVisibleBubbleBudget(30)).toBe(6);
    expect(computeVisibleBubbleBudget(120)).toBe(20);
    expect(computeVisibleBubbleBudget(500)).toBe(36);

    const items = [1, 5, 3, 9, 2, 8, 4, 7].map((n) => ({
      notional_usd: n * 1_000_000,
    }));
    const kept = applyVisibleBubbleBudget(items, 3);
    expect(kept.map((x) => x.notional_usd)).toEqual([
      7_000_000,
      8_000_000,
      9_000_000,
    ]);
  });

  it("scales radius relative to timeframe floor and respects zoom-out auto-hide", () => {
    expect(computeScaledWhaleRadius(2_000_000, 2_000_000, 28)).toBe(4);
    expect(computeScaledWhaleRadius(40_000_000, 2_000_000, 28)).toBe(28);
    expect(computeScaledWhaleRadius(40_000_000, 2_000_000, 14)).toBe(14);

    expect(computeBubbleZoomPolicy(2.8)).toEqual({
      visible: false,
      alphaScale: 0,
      maxRadiusPx: 0,
    });
    const fade = computeBubbleZoomPolicy(5.0);
    expect(fade.visible).toBe(true);
    expect(fade.maxRadiusPx).toBeLessThan(28);
  });

  it("filters out <$500k on 5m and clusters same-bar same-side sweeps within 0.25% price", () => {
    const barOpenMs = 1_763_938_800_000;
    const w1 = makePrint(barOpenMs + 10_000, 95_000, 600_000, "buy", "binance");
    const w2 = makePrint(barOpenMs + 50_000, 95_100, 900_000, "buy", "bybit");
    const wFar = makePrint(barOpenMs + 90_000, 96_500, 700_000, "buy", "binance");
    const wBelowFloor = makePrint(barOpenMs + 95_000, 95_050, 350_000, "buy", "binance");

    const clusters = clusterWhaleBubbles([w1, w2, wFar, wBelowFloor], "5m");
    expect(clusters).toHaveLength(2);
    const merged = clusters.find((c) => c.clusterCount === 2);
    expect(merged?.notional_usd).toBe(1_500_000);
    expect(merged?.venue).toBe("mixed");
  });
});
