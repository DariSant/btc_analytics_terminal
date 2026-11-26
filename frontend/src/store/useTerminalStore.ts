import { create } from "zustand";
import type {
  CandleBar,
  ExpirySummary,
  HeaderTelemetry,
  LayerVisibilityState,
  LiquidationBand,
  OptionsResponse,
  OptionsSurfaceSummary,
  RealizedLiquidation,
  ThemeId,
  TimeframeLiteral,
  WhalePrint,
  WhaleThresholdUsd,
  WsConnectionStatus,
} from "../types/terminal";
import { applyTheme, getStoredTheme } from "../utils/themeTokens";

export const MAX_CLIENT_BARS = 1500;
export const MAX_CLIENT_OVERLAYS = 1500;

export interface TerminalStoreState {
  theme: ThemeId;
  timeframe: TimeframeLiteral;
  drawerOpen: boolean;
  legendOpen: boolean;
  layers: LayerVisibilityState;
  selectedExpiry: string;
  minWhaleUsd: WhaleThresholdUsd;
  wsStatus: WsConnectionStatus;

  candles: CandleBar[];
  klinesRevision: number;
  lastKlineTick: { interval: TimeframeLiteral; candle: CandleBar } | null;
  whales: WhalePrint[];
  realizedLiquidations: RealizedLiquidation[];
  predictedLiqBands: LiquidationBand[];
  optionsSummary: OptionsSurfaceSummary | null;
  surfacesByExpiry: Record<string, OptionsSurfaceSummary>;
  availableExpiries: ExpirySummary[];
  telemetry: HeaderTelemetry | null;

  setTheme: (theme: ThemeId) => void;
  setTimeframe: (timeframe: TimeframeLiteral) => void;
  toggleDrawer: () => void;
  setDrawerOpen: (open: boolean) => void;
  toggleLegend: () => void;
  setLegendOpen: (open: boolean) => void;
  toggleLayer: (layer: keyof LayerVisibilityState) => void;
  setSelectedExpiry: (expiry: string) => void;
  setMinWhaleUsd: (threshold: WhaleThresholdUsd) => void;
  setWsStatus: (status: WsConnectionStatus) => void;

  applyKlinesSnapshot: (
    interval: TimeframeLiteral,
    candles: CandleBar[],
    bands: LiquidationBand[],
  ) => void;
  applyLiveKline: (interval: TimeframeLiteral, candle: CandleBar) => void;
  appendWhale: (whale: WhalePrint) => void;
  appendRealizedLiquidation: (liq: RealizedLiquidation) => void;
  applyOverlaysHistory: (
    whales: WhalePrint[],
    liquidations: RealizedLiquidation[],
  ) => void;
  setPredictedLiqBands: (
    interval: TimeframeLiteral,
    bands: LiquidationBand[],
  ) => void;
  setTelemetry: (telemetry: HeaderTelemetry) => void;
  applyOptionsResponse: (res: OptionsResponse) => void;
  applyOptionsUpdate: (
    availableExpiries: ExpirySummary[],
    surfacesByExpiry: Record<string, OptionsSurfaceSummary>,
  ) => void;
}

function capTail<T>(items: T[], limit: number): T[] {
  if (items.length <= limit) {
    return items;
  }
  return items.slice(items.length - limit);
}

const initialTheme = getStoredTheme();
applyTheme(initialTheme);

export const useTerminalStore = create<TerminalStoreState>((set, get) => ({
  theme: initialTheme,
  timeframe: "5m",
  drawerOpen: true,
  legendOpen: false,
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

  setTheme: (theme) => {
    applyTheme(theme);
    set({ theme });
  },

  setTimeframe: (timeframe) => {
    set({ timeframe });
  },

  toggleDrawer: () => {
    set((state) => ({ drawerOpen: !state.drawerOpen }));
  },

  setDrawerOpen: (open) => {
    set({ drawerOpen: open });
  },

  toggleLegend: () => {
    set((state) => ({ legendOpen: !state.legendOpen }));
  },

  setLegendOpen: (open) => {
    set({ legendOpen: open });
  },

  toggleLayer: (layer) => {
    set((state) => ({
      layers: {
        ...state.layers,
        [layer]: !state.layers[layer],
      },
    }));
  },

  setSelectedExpiry: (expiry) => {
    set((state) => {
      const nextSummary =
        state.surfacesByExpiry[expiry] ??
        state.surfacesByExpiry["ALL"] ??
        state.optionsSummary;
      return {
        selectedExpiry: expiry,
        optionsSummary: nextSummary,
      };
    });
  },

  setMinWhaleUsd: (minWhaleUsd) => {
    set({ minWhaleUsd });
  },

  setWsStatus: (wsStatus) => {
    set({ wsStatus });
  },

  applyKlinesSnapshot: (interval, candles, bands) => {
    if (interval !== get().timeframe) {
      return;
    }
    set((state) => ({
      candles: capTail(candles, MAX_CLIENT_BARS),
      predictedLiqBands: bands,
      klinesRevision: state.klinesRevision + 1,
      lastKlineTick: null,
    }));
  },

  applyLiveKline: (interval, candle) => {
    if (interval !== get().timeframe) {
      return;
    }
    set((state) => {
      const prev = state.candles;
      const last = prev[prev.length - 1];
      let nextCandles: CandleBar[];
      if (!last) {
        nextCandles = [candle];
      } else if (candle.time === last.time) {
        nextCandles = [...prev.slice(0, -1), candle];
      } else if (candle.time > last.time) {
        nextCandles = capTail([...prev, candle], MAX_CLIENT_BARS);
      } else {
        // Out-of-order older candle tick: ignore to preserve monotonic series time.
        return {};
      }
      return {
        candles: nextCandles,
        lastKlineTick: { interval, candle },
      };
    });
  },

  appendWhale: (whale) => {
    set((state) => ({
      whales: capTail([...state.whales, whale], MAX_CLIENT_OVERLAYS),
    }));
  },

  appendRealizedLiquidation: (liq) => {
    set((state) => ({
      realizedLiquidations: capTail(
        [...state.realizedLiquidations, liq],
        MAX_CLIENT_OVERLAYS,
      ),
    }));
  },

  applyOverlaysHistory: (whales, liquidations) => {
    set({
      whales: capTail(whales, MAX_CLIENT_OVERLAYS),
      realizedLiquidations: capTail(liquidations, MAX_CLIENT_OVERLAYS),
    });
  },

  setPredictedLiqBands: (interval, bands) => {
    if (interval !== get().timeframe) {
      return;
    }
    set({ predictedLiqBands: bands });
  },

  setTelemetry: (telemetry) => {
    set({ telemetry });
  },

  applyOptionsResponse: (res) => {
    set((state) => ({
      selectedExpiry: res.selected_expiry,
      availableExpiries: res.available_expiries,
      optionsSummary: res.summary,
      surfacesByExpiry: {
        ...state.surfacesByExpiry,
        [res.selected_expiry]: res.summary,
      },
    }));
  },

  applyOptionsUpdate: (availableExpiries, surfacesByExpiry) => {
    set((state) => {
      const resolvedExpiry =
        state.selectedExpiry in surfacesByExpiry
          ? state.selectedExpiry
          : "ALL";
      const nextSummary =
        surfacesByExpiry[resolvedExpiry] ??
        surfacesByExpiry["ALL"] ??
        state.optionsSummary;
      return {
        selectedExpiry: resolvedExpiry,
        availableExpiries,
        surfacesByExpiry,
        optionsSummary: nextSummary,
      };
    });
  },
}));
