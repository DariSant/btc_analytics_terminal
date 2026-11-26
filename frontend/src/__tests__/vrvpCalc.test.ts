import { describe, expect, it } from "vitest";
import type { CandleBar } from "../types/terminal";
import { computeVrvp } from "../utils/vrvpCalc";

function makeBar(
  time: number,
  low: number,
  high: number,
  quoteUsd: number,
  takerBuyUsd: number,
): CandleBar {
  return {
    time,
    open: low,
    high,
    low,
    close: high,
    volume_btc: quoteUsd / ((low + high) * 0.5),
    quote_usd: quoteUsd,
    taker_buy_usd: takerBuyUsd,
    is_closed: true,
  };
}

describe("computeVrvp", () => {
  it("returns null for empty or zero-volume input", () => {
    expect(computeVrvp([])).toBeNull();
    expect(computeVrvp([makeBar(1000, 90000, 90500, 0, 0)])).toBeNull();
  });

  it("conserves total buy + sell quote volume and builds a 70% Value Area", () => {
    const candles: CandleBar[] = [
      makeBar(300, 90000, 91000, 2_000_000, 1_100_000),
      makeBar(600, 91000, 92000, 8_000_000, 5_200_000),
      makeBar(900, 91200, 91800, 12_000_000, 6_000_000),
      makeBar(1200, 92000, 94000, 3_000_000, 900_000),
      makeBar(1500, 91500, 91500, 1_500_000, 750_000),
    ];

    const profile = computeVrvp(candles, 80);
    expect(profile).not.toBeNull();
    if (!profile) return;

    expect(profile.bins).toHaveLength(80);

    const expectedTotalQuote = candles.reduce((acc, c) => acc + c.quote_usd, 0);
    const expectedTotalBuy = candles.reduce((acc, c) => acc + c.taker_buy_usd, 0);
    const expectedTotalSell = candles.reduce(
      (acc, c) => acc + Math.max(0, c.quote_usd - c.taker_buy_usd),
      0,
    );

    const actualBuy = profile.bins.reduce((acc, b) => acc + b.buyUsd, 0);
    const actualSell = profile.bins.reduce((acc, b) => acc + b.sellUsd, 0);
    const actualTotal = profile.bins.reduce((acc, b) => acc + b.totalUsd, 0);

    expect(Math.abs(actualBuy - expectedTotalBuy)).toBeLessThan(1e-6);
    expect(Math.abs(actualSell - expectedTotalSell)).toBeLessThan(1e-6);
    expect(Math.abs(actualTotal - expectedTotalQuote)).toBeLessThan(1e-6);
    expect(Math.abs(profile.totalVisibleUsd - expectedTotalQuote)).toBeLessThan(1e-6);

    expect(profile.valPrice).toBeLessThanOrEqual(profile.pocPrice);
    expect(profile.pocPrice).toBeLessThanOrEqual(profile.vahPrice);

    const vaVolume = profile.bins
      .filter((b) => b.inValueArea)
      .reduce((acc, b) => acc + b.totalUsd, 0);
    expect(vaVolume / profile.totalVisibleUsd).toBeGreaterThanOrEqual(0.7 - 1e-9);
  });

  it("handles flat single-price candles cleanly without NaN", () => {
    const profile = computeVrvp([makeBar(300, 95000, 95000, 500_000, 300_000)], 80);
    expect(profile).not.toBeNull();
    if (!profile) return;
    expect(Number.isFinite(profile.pocPrice)).toBe(true);
    expect(Number.isFinite(profile.vahPrice)).toBe(true);
    expect(Number.isFinite(profile.valPrice)).toBe(true);
    expect(Math.abs(profile.totalVisibleUsd - 500_000)).toBeLessThan(1e-6);
  });
});
