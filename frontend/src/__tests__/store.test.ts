import { beforeEach, describe, expect, it, vi } from "vitest";
import type {
  CandleBar,
  OptionsSurfaceSummary,
  WhalePrint,
} from "../types/terminal";
import {
  MAX_CLIENT_BARS,
  MAX_CLIENT_OVERLAYS,
  useTerminalStore,
} from "../store/useTerminalStore";
import { TerminalSyncController } from "../services/apiClient";
import { THEME_STORAGE_KEY } from "../utils/themeTokens";

function makeCandle(time: number, close: number): CandleBar {
  return {
    time,
    open: close - 10,
    high: close + 20,
    low: close - 20,
    close,
    volume_btc: 10,
    quote_usd: close * 10,
    taker_buy_usd: close * 5,
    is_closed: false,
  };
}

function makeSummary(expiry: string, maxPain: number): OptionsSurfaceSummary {
  return {
    expiry_key: expiry,
    underlying_price: 94000,
    call_wall: 100000,
    call_wall_oi: 4000,
    put_wall: 90000,
    put_wall_oi: 3500,
    max_pain: maxPain,
    put_call_ratio: 0.85,
    net_gex_usd: 15_000_000,
    top_gex_strikes: [],
  };
}

describe("useTerminalStore & TerminalSyncController", () => {
  beforeEach(() => {
    const backing = new Map<string, string>();
    const memoryStorage: Storage = {
      get length() {
        return backing.size;
      },
      clear: () => backing.clear(),
      getItem: (key: string) => backing.get(key) ?? null,
      key: (index: number) => Array.from(backing.keys())[index] ?? null,
      removeItem: (key: string) => {
        backing.delete(key);
      },
      setItem: (key: string, value: string) => {
        backing.set(key, value);
      },
    };
    Object.defineProperty(window, "localStorage", {
      value: memoryStorage,
      configurable: true,
      writable: true,
    });
    vi.stubGlobal("localStorage", memoryStorage);
    useTerminalStore.setState({
      theme: "oled-dark",
      timeframe: "5m",
      drawerOpen: true,
      layers: {
        volume: true,
        vrvp: true,
        whales: true,
        liquidations: true,
        optionsWalls: true,
        maxPain: true,
      },
      selectedExpiry: "ALL",
      minWhaleUsd: 250000,
      wsStatus: "disconnected",
      candles: [],
      klinesRevision: 0,
      lastKlineTick: null,
      whales: [],
      realizedLiquidations: [],
      predictedLiqBands: [],
      optionsSummary: null,
      surfacesByExpiry: {},
      availableExpiries: [],
      telemetry: null,
    });
  });

  it("persists theme selection to localStorage and documentElement", () => {
    useTerminalStore.getState().setTheme("midnight-navy");
    expect(useTerminalStore.getState().theme).toBe("midnight-navy");
    expect(document.documentElement.getAttribute("data-theme")).toBe("midnight-navy");
    expect(window.localStorage.getItem(THEME_STORAGE_KEY)).toBe("midnight-navy");
  });

  it("updates live klines in-place or appends within 1,500-bar cap and ignores mismatched intervals", () => {
    const store = useTerminalStore.getState();
    const initial = Array.from({ length: MAX_CLIENT_BARS }, (_, i) =>
      makeCandle(1700000000 + i * 300, 90000 + i),
    );
    store.applyKlinesSnapshot("5m", initial, []);
    expect(useTerminalStore.getState().candles).toHaveLength(MAX_CLIENT_BARS);

    // Update current open bar in-place
    const lastTime = initial[initial.length - 1]!.time;
    store.applyLiveKline("5m", { ...makeCandle(lastTime, 99999), is_closed: true });
    expect(useTerminalStore.getState().candles).toHaveLength(MAX_CLIENT_BARS);
    expect(useTerminalStore.getState().candles.at(-1)?.close).toBe(99999);

    // Append new bar -> caps at 1,500
    store.applyLiveKline("5m", makeCandle(lastTime + 300, 100500));
    expect(useTerminalStore.getState().candles).toHaveLength(MAX_CLIENT_BARS);
    expect(useTerminalStore.getState().candles.at(-1)?.time).toBe(lastTime + 300);

    // Stale interval frame ignored
    store.applyLiveKline("15m", makeCandle(lastTime + 900, 111111));
    expect(useTerminalStore.getState().candles.at(-1)?.close).toBe(100500);
  });

  it("caps whales at 1,500 and switches optionsSummary immediately on expiry change", () => {
    const store = useTerminalStore.getState();
    const batch: WhalePrint[] = Array.from({ length: MAX_CLIENT_OVERLAYS + 25 }, (_, i) => ({
      ts_ms: 1700000000000 + i,
      venue: "binance",
      side: "buy",
      price: 94000,
      size_btc: 2,
      notional_usd: 188000,
    }));
    store.applyOverlaysHistory(batch, []);
    expect(useTerminalStore.getState().whales).toHaveLength(MAX_CLIENT_OVERLAYS);

    store.applyOptionsUpdate(
      [
        { expiry_key: "ALL", expiry_ts_ms: null, total_oi_btc: 5000, oi_share_pct: 100 },
        { expiry_key: "28NOV26", expiry_ts_ms: 1795852800000, total_oi_btc: 1200, oi_share_pct: 24 },
      ],
      {
        ALL: makeSummary("ALL", 92000),
        "28NOV26": makeSummary("28NOV26", 95000),
      },
    );
    expect(useTerminalStore.getState().optionsSummary?.max_pain).toBe(92000);

    store.setSelectedExpiry("28NOV26");
    expect(useTerminalStore.getState().optionsSummary?.max_pain).toBe(95000);
  });

  it("discards stale timeframe responses when switching intervals rapidly", async () => {
    const fetchMock = vi.fn((input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("interval=15m")) {
        return new Promise<Response>((resolve, reject) => {
          init?.signal?.addEventListener("abort", () => {
            reject(new DOMException("Aborted", "AbortError"));
          });
          setTimeout(() => {
            resolve(
              new Response(
                JSON.stringify({
                  interval: "15m",
                  candles: [makeCandle(1700000900, 91111)],
                  predicted_liquidations: [],
                }),
                { status: 200 },
              ),
            );
          }, 40);
        });
      }
      return Promise.resolve(
        new Response(
          JSON.stringify({
            interval: "1h",
            candles: [makeCandle(1700003600, 94444)],
            predicted_liquidations: [],
          }),
          { status: 200 },
        ),
      );
    });

    vi.stubGlobal("fetch", fetchMock);
    const sync = new TerminalSyncController();
    useTerminalStore.getState().setTimeframe("15m");
    const first = sync.syncTimeframe("15m");
    useTerminalStore.getState().setTimeframe("1h");
    const second = sync.syncTimeframe("1h");

    await Promise.all([first, second]);
    expect(useTerminalStore.getState().candles[0]?.close).toBe(94444);
    sync.dispose();
    vi.unstubAllGlobals();
  });
});
