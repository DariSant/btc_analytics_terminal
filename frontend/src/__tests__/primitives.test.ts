import { describe, expect, it } from "vitest";
import {
  MAX_PEAK_PROJECTIONS,
  computeProjectionLengthPx,
  computeThermalDensityRows,
  selectTopPeakBands,
} from "../primitives/LiquidationPrimitive";
import { computeWhaleRadius } from "../primitives/WhaleBubblesPrimitive";
import type { LiquidationBand } from "../types/terminal";

describe("Chart Primitive Quant & Geometry Helpers", () => {
  it("clamps whale bubble radius in [4, 28] with area-proportional sqrt scaling", () => {
    expect(computeWhaleRadius(100_000)).toBe(4);
    expect(computeWhaleRadius(50_000)).toBe(4);
    expect(computeWhaleRadius(5_000_000)).toBe(28);
    expect(computeWhaleRadius(25_000_000)).toBe(28);

    const mid = computeWhaleRadius(1_325_000);
    expect(mid).toBeCloseTo(16, 4);
  });

  it("scales liquidation projection length monotonically with intensity", () => {
    const lowLen = computeProjectionLengthPx(0.2, 1000);
    const midLen = computeProjectionLengthPx(0.55, 1000);
    const maxLen = computeProjectionLengthPx(1.0, 1000);

    expect(lowLen).toBeGreaterThan(100);
    expect(midLen).toBeGreaterThan(lowLen);
    expect(maxLen).toBeGreaterThan(midLen);
    expect(maxLen).toBe(720);
  });

  it("selects only the top 4 peak pockets sorted by intensity", () => {
    const bands: LiquidationBand[] = [0.2, 0.95, 0.55, 0.85, 0.4, 0.72].map(
      (intensity, idx) => ({
        anchor_time: 1_763_938_800 + idx * 300,
        price: 90_000 + idx * 500,
        side: idx % 2 === 0 ? "long_liq" : "short_liq",
        leverage: 50,
        intensity,
      }),
    );
    const mapped = bands.map((band, idx) => ({ y: 100 + idx * 40, band }));

    const peaks = selectTopPeakBands(mapped, MAX_PEAK_PROJECTIONS);
    expect(peaks).toHaveLength(4);
    expect(peaks.map((p) => p.band.intensity)).toEqual([0.95, 0.85, 0.72, 0.55]);
  });

  it("renders continuous thermal density rows across vertical strip around mapped bands", () => {
    const rows = computeThermalDensityRows(
      [
        {
          y: 120,
          band: {
            anchor_time: 1_763_938_800,
            price: 91_000,
            side: "long_liq",
            leverage: 25,
            intensity: 0.9,
          },
        },
        {
          y: 40,
          band: {
            anchor_time: 1_763_938_800,
            price: 95_000,
            side: "short_liq",
            leverage: 50,
            intensity: 0.6,
          },
        },
      ],
      200,
    );

    expect(rows.length).toBeGreaterThan(20);
    const shortRow = rows.find((r) => r.y === 40);
    const longRow = rows.find((r) => r.y === 120);
    expect(shortRow?.side).toBe("short_liq");
    expect(longRow?.side).toBe("long_liq");
    expect((longRow?.density ?? 0)).toBeGreaterThan(shortRow?.density ?? 0);
  });
});
