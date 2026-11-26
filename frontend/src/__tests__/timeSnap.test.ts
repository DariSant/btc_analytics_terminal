import { describe, expect, it } from "vitest";
import { INTERVAL_SECONDS, snapTimestampToBar } from "../utils/timeSnap";
import type { TimeframeLiteral } from "../types/terminal";

describe("snapTimestampToBar", () => {
  const cases: Array<{
    interval: TimeframeLiteral;
    tsMs: number;
    expectedSec: number;
  }> = [
    {
      // 2026-11-24T00:01:45.900Z -> 2026-11-24T00:01:00Z
      interval: "1m",
      tsMs: Date.UTC(2026, 10, 24, 0, 1, 45, 900),
      expectedSec: Date.UTC(2026, 10, 24, 0, 1, 0) / 1000,
    },
    {
      // 2026-11-24T00:09:59.999Z -> 2026-11-24T00:05:00Z
      interval: "5m",
      tsMs: Date.UTC(2026, 10, 24, 0, 9, 59, 999),
      expectedSec: Date.UTC(2026, 10, 24, 0, 5, 0) / 1000,
    },
    {
      // 2026-11-24T00:29:12.100Z -> 2026-11-24T00:15:00Z
      interval: "15m",
      tsMs: Date.UTC(2026, 10, 24, 0, 29, 12, 100),
      expectedSec: Date.UTC(2026, 10, 24, 0, 15, 0) / 1000,
    },
    {
      // 2026-11-24T03:59:59.000Z -> 2026-11-24T03:00:00Z
      interval: "1h",
      tsMs: Date.UTC(2026, 10, 24, 3, 59, 59, 0),
      expectedSec: Date.UTC(2026, 10, 24, 3, 0, 0) / 1000,
    },
    {
      // 2026-11-24T07:45:10.000Z -> 2026-11-24T04:00:00Z
      interval: "4h",
      tsMs: Date.UTC(2026, 10, 24, 7, 45, 10, 0),
      expectedSec: Date.UTC(2026, 10, 24, 4, 0, 0) / 1000,
    },
    {
      // 2026-11-24T23:59:59.999Z -> 2026-11-24T00:00:00Z
      interval: "1d",
      tsMs: Date.UTC(2026, 10, 24, 23, 59, 59, 999),
      expectedSec: Date.UTC(2026, 10, 24, 0, 0, 0) / 1000,
    },
  ];

  it.each(cases)(
    "aligns $interval timestamps to exact UTC bar open seconds",
    ({ interval, tsMs, expectedSec }) => {
      const snapped = snapTimestampToBar(tsMs, interval);
      expect(snapped).toBe(expectedSec);
      expect(snapped % INTERVAL_SECONDS[interval]).toBe(0);
    },
  );

  it("handles exact bar boundary timestamps without shifting backward", () => {
    const exact5m = Date.UTC(2026, 10, 24, 12, 15, 0, 0);
    expect(snapTimestampToBar(exact5m, "5m")).toBe(exact5m / 1000);
  });
});
