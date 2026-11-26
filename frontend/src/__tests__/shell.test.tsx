import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { ControlDrawer } from "../components/ControlDrawer";
import { TopTelemetryBar } from "../components/TopTelemetryBar";
import { useTerminalStore } from "../store/useTerminalStore";

describe("Phase 3 Institutional Shell", () => {
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
      wsStatus: "connected",
      telemetry: {
        mark_price: 94240.5,
        index_price: 94218.0,
        change_24h_pct: 2.41,
        funding_rate: 0.000102,
        next_funding_ms: Date.now() + 3_600_000,
        open_interest_usd: 19_450_200_000,
        oi_change_24h_pct: 4.15,
        session_cvd_usd: 148_200_000,
      },
      optionsSummary: {
        expiry_key: "ALL",
        underlying_price: 94240.5,
        call_wall: 100000,
        call_wall_oi: 4120,
        put_wall: 90000,
        put_wall_oi: 3850,
        max_pain: 92000,
        put_call_ratio: 0.78,
        net_gex_usd: 12_500_000,
        top_gex_strikes: [],
      },
      availableExpiries: [
        { expiry_key: "ALL", expiry_ts_ms: null, total_oi_btc: 10000, oi_share_pct: 100 },
        { expiry_key: "28NOV26", expiry_ts_ms: 1795852800000, total_oi_btc: 2400, oi_share_pct: 24 },
      ],
    });
  });

  afterEach(() => {
    cleanup();
    vi.unstubAllGlobals();
  });

  it("renders 40px header with live telemetry, switches themes, and invokes timeframe callback", () => {
    const onSelectTimeframe = vi.fn();
    render(<TopTelemetryBar onSelectTimeframe={onSelectTimeframe} />);

    const header = screen.getByRole("banner");
    expect(header.style.height).toBe("40px");
    expect(screen.getByText("$94,240.50")).toBeTruthy();
    expect(screen.getByText("+$148.20M")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "15m" }));
    expect(onSelectTimeframe).toHaveBeenCalledWith("15m");

    fireEvent.click(screen.getByRole("button", { name: "WARM" }));
    expect(document.documentElement.getAttribute("data-theme")).toBe("warm-off-white");
  });

  it("renders 260px collapsible drawer, toggles layers/whale filter, and collapses cleanly", () => {
    const onSelectExpiry = vi.fn();
    render(
      <>
        <TopTelemetryBar onSelectTimeframe={vi.fn()} />
        <ControlDrawer onSelectExpiry={onSelectExpiry} />
      </>,
    );

    const drawer = screen.getByLabelText("Terminal Controls");
    expect(drawer.style.width).toBe("260px");
    expect(screen.getByText("+GEX Stabilizer")).toBeTruthy();

    fireEvent.click(screen.getByRole("switch", { name: /VRVP/i }));
    expect(useTerminalStore.getState().layers.vrvp).toBe(false);

    fireEvent.click(screen.getByRole("button", { name: "$1M" }));
    expect(useTerminalStore.getState().minWhaleUsd).toBe(1000000);

    fireEvent.click(screen.getByRole("button", { name: /28NOV26/i }));
    expect(onSelectExpiry).toHaveBeenCalledWith("28NOV26");

    fireEvent.click(screen.getByRole("button", { name: /Collapse control drawer/i }));
    expect(drawer.style.width).toBe("0px");
  });
});
