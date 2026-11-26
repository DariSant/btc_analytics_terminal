export type TimeframeLiteral = "1m" | "5m" | "15m" | "1h" | "4h" | "1d";
export type VenueLiteral = "binance" | "bybit";
export type TradeSideLiteral = "buy" | "sell";
export type LiquidationSideLiteral = "long_liq" | "short_liq";
export type LeverageTierLiteral = 10 | 25 | 50 | 100;

export type ThemeId =
  | "oled-dark"
  | "midnight-navy"
  | "warm-off-white"
  | "pure-white";

export type WhaleThresholdUsd = 100000 | 250000 | 500000 | 1000000;

export type WsConnectionStatus =
  | "connecting"
  | "connected"
  | "reconnecting"
  | "disconnected";

export interface LayerVisibilityState {
  volume: boolean;
  vrvp: boolean;
  whales: boolean;
  liquidations: boolean;
  optionsWalls: boolean;
  maxPain: boolean;
}

export interface CandleBar {
  /** Candle open timestamp in integer UTC seconds (LWC UTCTimestamp). */
  time: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume_btc: number;
  quote_usd: number;
  taker_buy_usd: number;
  is_closed: boolean;
}

export interface WhalePrint {
  /** Event timestamp in integer UTC milliseconds. */
  ts_ms: number;
  venue: VenueLiteral;
  side: TradeSideLiteral;
  price: number;
  size_btc: number;
  notional_usd: number;
}

export interface RealizedLiquidation {
  /** Event timestamp in integer UTC milliseconds. */
  ts_ms: number;
  venue: VenueLiteral;
  side: LiquidationSideLiteral;
  price: number;
  size_btc: number;
  notional_usd: number;
}

export interface LiquidationBand {
  /** Origin pivot candle open timestamp in integer UTC seconds. */
  anchor_time: number;
  price: number;
  side: LiquidationSideLiteral;
  leverage: LeverageTierLiteral;
  intensity: number;
}

export interface StrikeMetrics {
  strike: number;
  call_oi: number;
  put_oi: number;
  net_gex_usd: number;
}

export interface ExpirySummary {
  expiry_key: string;
  expiry_ts_ms: number | null;
  total_oi_btc: number;
  oi_share_pct: number;
}

export interface OptionsSurfaceSummary {
  expiry_key: string;
  underlying_price: number;
  call_wall: number;
  call_wall_oi: number;
  put_wall: number;
  put_wall_oi: number;
  max_pain: number;
  put_call_ratio: number;
  net_gex_usd: number;
  top_gex_strikes: StrikeMetrics[];
}

export interface HeaderTelemetry {
  mark_price: number;
  index_price: number;
  change_24h_pct: number;
  funding_rate: number;
  next_funding_ms: number;
  open_interest_usd: number;
  oi_change_24h_pct: number;
  session_cvd_usd: number;
}

export interface HealthResponse {
  status: "ok" | "degraded";
  uptime_sec: number;
  binance_ws: boolean;
  bybit_ws: boolean;
  deribit_last_sync_ms: number | null;
  sqlite_ok: boolean;
}

export interface KlinesResponse {
  interval: TimeframeLiteral;
  candles: CandleBar[];
  predicted_liquidations: LiquidationBand[];
}

export interface OverlaysHistoryResponse {
  whales: WhalePrint[];
  liquidations: RealizedLiquidation[];
}

export interface OptionsResponse {
  selected_expiry: string;
  available_expiries: ExpirySummary[];
  summary: OptionsSurfaceSummary;
}

export interface WsClientCommand {
  type: "set_timeframe";
  interval: TimeframeLiteral;
}

export interface WsKlineEvent {
  type: "kline";
  interval: TimeframeLiteral;
  candle: CandleBar;
}

export interface WsWhaleEvent {
  type: "whale";
  data: WhalePrint;
}

export interface WsLiquidationEvent {
  type: "liquidation";
  data: RealizedLiquidation;
}

export interface WsLiqBandsEvent {
  type: "liq_bands";
  interval: TimeframeLiteral;
  bands: LiquidationBand[];
}

export interface WsTelemetryEvent {
  type: "telemetry";
  data: HeaderTelemetry;
}

export interface WsOptionsUpdateEvent {
  type: "options_update";
  available_expiries: ExpirySummary[];
  surfaces_by_expiry: Record<string, OptionsSurfaceSummary>;
}

export type WsServerEvent =
  | WsKlineEvent
  | WsWhaleEvent
  | WsLiquidationEvent
  | WsLiqBandsEvent
  | WsTelemetryEvent
  | WsOptionsUpdateEvent;
