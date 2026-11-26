import { useEffect, useState } from "react";
import { BookOpen, PanelRightClose, PanelRightOpen } from "lucide-react";
import { useTerminalStore } from "../store/useTerminalStore";
import type { TimeframeLiteral, WsConnectionStatus } from "../types/terminal";
import { THEMES } from "../utils/themeTokens";
import { TIMEFRAMES } from "../utils/timeSnap";
import {
  formatCompactUsd,
  formatCountdown,
  formatFundingRate,
  formatPct,
  formatPrice,
  formatRatio,
  formatStrike,
} from "../utils/formatters";

interface TopTelemetryBarProps {
  onSelectTimeframe: (interval: TimeframeLiteral) => void;
}

function statusDotColor(status: WsConnectionStatus): string {
  switch (status) {
    case "connected":
      return "var(--accent-bull)";
    case "connecting":
    case "reconnecting":
      return "var(--accent-neutral)";
    case "disconnected":
      return "var(--accent-bear)";
  }
}

function statusLabel(status: WsConnectionStatus): string {
  switch (status) {
    case "connected":
      return "LIVE";
    case "connecting":
      return "SYNC";
    case "reconnecting":
      return "RETRY";
    case "disconnected":
      return "OFF";
  }
}

export function TopTelemetryBar({ onSelectTimeframe }: TopTelemetryBarProps) {
  const telemetry = useTerminalStore((s) => s.telemetry);
  const optionsSummary = useTerminalStore((s) => s.optionsSummary);
  const timeframe = useTerminalStore((s) => s.timeframe);
  const theme = useTerminalStore((s) => s.theme);
  const drawerOpen = useTerminalStore((s) => s.drawerOpen);
  const legendOpen = useTerminalStore((s) => s.legendOpen);
  const wsStatus = useTerminalStore((s) => s.wsStatus);
  const setTheme = useTerminalStore((s) => s.setTheme);
  const toggleDrawer = useTerminalStore((s) => s.toggleDrawer);
  const toggleLegend = useTerminalStore((s) => s.toggleLegend);

  const [nowMs, setNowMs] = useState<number>(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const changePct = telemetry?.change_24h_pct ?? null;
  const changeColor =
    changePct === null
      ? "var(--text-muted)"
      : changePct >= 0
        ? "var(--accent-bull)"
        : "var(--accent-bear)";

  const fundingRate = telemetry?.funding_rate ?? null;
  const fundingColor =
    fundingRate === null
      ? "var(--text-muted)"
      : fundingRate >= 0
        ? "var(--accent-bull)"
        : "var(--accent-bear)";

  const oiDelta = telemetry?.oi_change_24h_pct ?? null;
  const oiDeltaColor =
    oiDelta === null
      ? "var(--text-muted)"
      : oiDelta >= 0
        ? "var(--accent-bull)"
        : "var(--accent-bear)";

  const sessionCvd = telemetry?.session_cvd_usd ?? null;
  const cvdColor =
    sessionCvd === null
      ? "var(--text-muted)"
      : sessionCvd >= 0
        ? "var(--accent-bull)"
        : "var(--accent-bear)";

  return (
    <header
      className="terminal-topbar flex items-center justify-between px-3 select-none"
      style={{ height: "40px" }}
    >
      {/* Left Cluster: Connection Dot, BTCUSDT Badge, Mark Price + 24h % */}
      <div className="flex items-center gap-2.5 shrink-0">
        <div
          className="flex items-center gap-1.5"
          title={`WebSocket: ${wsStatus}`}
        >
          <span
            aria-label={`Stream ${wsStatus}`}
            style={{
              width: "6px",
              height: "6px",
              borderRadius: "50%",
              backgroundColor: statusDotColor(wsStatus),
              display: "inline-block",
              flexShrink: 0,
            }}
          />
          <span
            className="font-mono-tabular text-[10px] tracking-[0.04em]"
            style={{ color: "var(--text-muted)" }}
          >
            {statusLabel(wsStatus)}
          </span>
        </div>

        <span
          className="hairline-border px-1.5 py-0.5 text-[11px] font-semibold tracking-[0.04em] rounded-[2px]"
          style={{
            color: "var(--text-primary)",
            backgroundColor: "var(--bg-canvas)",
          }}
        >
          BTCUSDT
        </span>

        <div className="flex items-baseline gap-1.5">
          <span
            className="font-mono-tabular text-[13px] font-semibold"
            style={{ color: "var(--text-primary)" }}
          >
            {formatPrice(telemetry?.mark_price)}
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: changeColor }}
          >
            {formatPct(changePct, true)}
          </span>
        </div>
      </div>

      {/* Center Cluster: Compact Telemetry Strip with 1px Vertical Dividers */}
      <div className="hidden lg:flex items-center gap-3 min-w-0">
        <span className="hairline-divider-v" />

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className="text-[10px] uppercase tracking-[0.04em]"
            style={{ color: "var(--text-muted)" }}
          >
            FUNDING
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: fundingColor }}
          >
            {formatFundingRate(fundingRate)}
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: "var(--text-muted)" }}
          >
            {formatCountdown(telemetry?.next_funding_ms, nowMs)}
          </span>
        </div>

        <span className="hairline-divider-v" />

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className="text-[10px] uppercase tracking-[0.04em]"
            style={{ color: "var(--text-muted)" }}
          >
            OI
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: "var(--text-primary)" }}
          >
            {formatCompactUsd(telemetry?.open_interest_usd)}
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: oiDeltaColor }}
          >
            {formatPct(oiDelta, true)}
          </span>
        </div>

        <span className="hairline-divider-v" />

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className="text-[10px] uppercase tracking-[0.04em]"
            style={{ color: "var(--text-muted)" }}
          >
            SESSION CVD
          </span>
          <span
            className="font-mono-tabular text-[11px] font-medium"
            style={{ color: cvdColor }}
          >
            {formatCompactUsd(sessionCvd, { signed: true })}
          </span>
        </div>

        <span className="hairline-divider-v" />

        <div className="flex items-baseline gap-1.5 whitespace-nowrap">
          <span
            className="text-[10px] uppercase tracking-[0.04em]"
            style={{ color: "var(--text-muted)" }}
          >
            P/C
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: "var(--text-primary)" }}
          >
            {formatRatio(optionsSummary?.put_call_ratio)}
          </span>
          <span
            className="text-[10px] uppercase tracking-[0.04em] ml-1"
            style={{ color: "var(--text-muted)" }}
          >
            MAX PAIN
          </span>
          <span
            className="font-mono-tabular text-[11px]"
            style={{ color: "var(--text-primary)" }}
          >
            {formatStrike(optionsSummary?.max_pain)}
          </span>
        </div>
      </div>

      {/* Right Cluster: Timeframe Pills, 4-Theme Switcher, Drawer Toggle */}
      <div className="flex items-center gap-2 shrink-0">
        <div
          className="hairline-border flex items-center rounded-[2px] overflow-hidden"
          role="group"
          aria-label="Timeframe"
        >
          {TIMEFRAMES.map((tf) => {
            const active = tf === timeframe;
            return (
              <button
                key={tf}
                type="button"
                onClick={() => onSelectTimeframe(tf)}
                className="font-mono-tabular px-2 py-0.5 text-[11px] cursor-pointer transition-none"
                style={{
                  backgroundColor: active ? "var(--bg-canvas)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: active ? 600 : 400,
                  borderRight:
                    tf !== "1d" ? "1px solid var(--border-hairline)" : "none",
                }}
              >
                {tf}
              </button>
            );
          })}
        </div>

        <div
          className="hairline-border flex items-center rounded-[2px] overflow-hidden"
          role="group"
          aria-label="Theme"
        >
          {THEMES.map((item, idx) => {
            const active = item.id === theme;
            return (
              <button
                key={item.id}
                type="button"
                title={item.label}
                onClick={() => setTheme(item.id)}
                className="font-mono-tabular px-1.5 py-0.5 text-[10px] tracking-[0.03em] cursor-pointer transition-none"
                style={{
                  backgroundColor: active ? "var(--bg-canvas)" : "transparent",
                  color: active ? "var(--text-primary)" : "var(--text-muted)",
                  fontWeight: active ? 600 : 400,
                  borderRight:
                    idx < THEMES.length - 1
                      ? "1px solid var(--border-hairline)"
                      : "none",
                }}
              >
                {item.shortLabel}
              </button>
            );
          })}
        </div>

        <button
          type="button"
          onClick={toggleDrawer}
          aria-label={drawerOpen ? "Collapse control drawer" : "Expand control drawer"}
          aria-expanded={drawerOpen}
          title={drawerOpen ? "Hide Control Drawer" : "Show Control Drawer"}
          className="hairline-border flex items-center justify-center w-7 h-6 rounded-[2px] cursor-pointer"
          style={{
            backgroundColor: drawerOpen ? "var(--bg-canvas)" : "transparent",
            color: "var(--text-primary)",
          }}
        >
          {drawerOpen ? <PanelRightClose size={14} /> : <PanelRightOpen size={14} />}
        </button>

        <button
          type="button"
          onClick={toggleLegend}
          aria-label={legendOpen ? "Collapse legend pane" : "Expand legend pane"}
          aria-expanded={legendOpen}
          title={legendOpen ? "Hide Chart Legend" : "Show Chart Legend"}
          className="hairline-border flex items-center justify-center w-7 h-6 rounded-[2px] cursor-pointer"
          style={{
            backgroundColor: legendOpen ? "var(--bg-canvas)" : "transparent",
            color: legendOpen ? "var(--accent-bull)" : "var(--text-primary)",
          }}
        >
          <BookOpen size={14} />
        </button>
      </div>
    </header>
  );
}
