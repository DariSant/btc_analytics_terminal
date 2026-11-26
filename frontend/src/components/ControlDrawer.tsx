import { useTerminalStore } from "../store/useTerminalStore";
import type {
  LayerVisibilityState,
  WhaleThresholdUsd,
} from "../types/terminal";
import {
  formatBtcSize,
  formatCompactUsd,
  formatStrike,
} from "../utils/formatters";

interface ControlDrawerProps {
  onSelectExpiry: (expiry: string) => void;
}

const OVERLAY_ITEMS: ReadonlyArray<{
  key: keyof LayerVisibilityState;
  label: string;
}> = [
  { key: "volume", label: "Volume" },
  { key: "vrvp", label: "VRVP (POC / VA)" },
  { key: "whales", label: "Whale Order Flow" },
  { key: "liquidations", label: "Liquidation Levels" },
  { key: "optionsWalls", label: "Put / Call Walls" },
  { key: "maxPain", label: "Max Pain" },
];

const WHALE_PILLS: ReadonlyArray<{
  value: WhaleThresholdUsd;
  label: string;
}> = [
  { value: 100000, label: "$100k" },
  { value: 250000, label: "$250k" },
  { value: 500000, label: "$500k" },
  { value: 1000000, label: "$1M" },
];

export function ControlDrawer({ onSelectExpiry }: ControlDrawerProps) {
  const drawerOpen = useTerminalStore((s) => s.drawerOpen);
  const layers = useTerminalStore((s) => s.layers);
  const minWhaleUsd = useTerminalStore((s) => s.minWhaleUsd);
  const selectedExpiry = useTerminalStore((s) => s.selectedExpiry);
  const availableExpiries = useTerminalStore((s) => s.availableExpiries);
  const optionsSummary = useTerminalStore((s) => s.optionsSummary);

  const toggleLayer = useTerminalStore((s) => s.toggleLayer);
  const setMinWhaleUsd = useTerminalStore((s) => s.setMinWhaleUsd);

  const netGex = optionsSummary?.net_gex_usd ?? null;
  const gexIsPositive = netGex !== null && netGex >= 0;
  const gexColor =
    netGex === null
      ? "var(--text-muted)"
      : gexIsPositive
        ? "var(--accent-bull)"
        : "var(--accent-bear)";
  const gexRegimeLabel =
    netGex === null
      ? "--"
      : gexIsPositive
        ? "+GEX Stabilizer"
        : "-GEX Accelerator";

  const expiryRows = availableExpiries.filter((e) => e.expiry_key !== "ALL");
  const allExpiryMeta = availableExpiries.find((e) => e.expiry_key === "ALL");

  return (
    <aside
      aria-label="Terminal Controls"
      className={
        drawerOpen
          ? "terminal-drawer terminal-scroll flex flex-col justify-between select-none"
          : "terminal-drawer--closed"
      }
      style={drawerOpen ? { width: "260px" } : { width: "0px" }}
    >
      <div className="flex flex-col">
        {/* Section 1: Chart Overlays */}
        <section className="hairline-b p-3">
          <h2
            className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-2"
            style={{ color: "var(--text-muted)" }}
          >
            Chart Overlays
          </h2>
          <div className="flex flex-col">
            {OVERLAY_ITEMS.map((item) => {
              const enabled = layers[item.key];
              return (
                <button
                  key={item.key}
                  type="button"
                  role="switch"
                  aria-checked={enabled}
                  onClick={() => toggleLayer(item.key)}
                  className="flex items-center justify-between py-1.5 text-left cursor-pointer"
                  style={{
                    borderTop: "1px solid var(--border-hairline)",
                    color: enabled ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  <span className="text-[12px]">{item.label}</span>
                  <span
                    className="hairline-border flex items-center w-7 h-3.5 p-[1px] rounded-[2px]"
                    style={{
                      backgroundColor: "var(--bg-canvas)",
                      justifyContent: enabled ? "flex-end" : "flex-start",
                    }}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-[1px]"
                      style={{
                        backgroundColor: enabled
                          ? "var(--accent-bull)"
                          : "var(--text-muted)",
                      }}
                    />
                  </span>
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 2: Whale Filter */}
        <section className="hairline-b p-3">
          <div className="flex items-center justify-between mb-2">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: "var(--text-muted)" }}
            >
              Whale Filter
            </h2>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              MIN NOTIONAL
            </span>
          </div>
          <div
            className="hairline-border grid grid-cols-4 rounded-[2px] overflow-hidden"
            role="group"
            aria-label="Whale Minimum USD"
          >
            {WHALE_PILLS.map((pill, idx) => {
              const active = minWhaleUsd === pill.value;
              return (
                <button
                  key={pill.value}
                  type="button"
                  onClick={() => setMinWhaleUsd(pill.value)}
                  className="font-mono-tabular py-1 text-[11px] text-center cursor-pointer"
                  style={{
                    backgroundColor: active ? "var(--bg-canvas)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                    fontWeight: active ? 600 : 400,
                    borderRight:
                      idx < WHALE_PILLS.length - 1
                        ? "1px solid var(--border-hairline)"
                        : "none",
                  }}
                >
                  {pill.label}
                </button>
              );
            })}
          </div>
        </section>

        {/* Section 3: Options Expiry & Strike Readout */}
        <section className="p-3 flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.04em]"
              style={{ color: "var(--text-muted)" }}
            >
              Options Expiry
            </h2>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              DERIBIT BTC
            </span>
          </div>

          <div className="hairline-border terminal-scroll flex flex-col max-h-40 overflow-y-auto rounded-[2px]">
            <button
              type="button"
              onClick={() => onSelectExpiry("ALL")}
              className="flex items-center justify-between px-2 py-1.5 text-left cursor-pointer"
              style={{
                backgroundColor:
                  selectedExpiry === "ALL" ? "var(--bg-canvas)" : "transparent",
                color:
                  selectedExpiry === "ALL"
                    ? "var(--text-primary)"
                    : "var(--text-muted)",
              }}
            >
              <span className="text-[11px] font-medium">All Expiries</span>
              <span className="font-mono-tabular text-[10px]">
                {allExpiryMeta
                  ? `${allExpiryMeta.oi_share_pct.toFixed(0)}%`
                  : "100%"}
              </span>
            </button>

            {expiryRows.map((exp) => {
              const active = selectedExpiry === exp.expiry_key;
              return (
                <button
                  key={exp.expiry_key}
                  type="button"
                  onClick={() => onSelectExpiry(exp.expiry_key)}
                  className="flex items-center justify-between px-2 py-1 text-left cursor-pointer"
                  style={{
                    borderTop: "1px solid var(--border-hairline)",
                    backgroundColor: active ? "var(--bg-canvas)" : "transparent",
                    color: active ? "var(--text-primary)" : "var(--text-muted)",
                  }}
                >
                  <span className="font-mono-tabular text-[11px]">
                    {exp.expiry_key}
                  </span>
                  <span className="font-mono-tabular text-[10px]">
                    {exp.oi_share_pct.toFixed(1)}%
                  </span>
                </button>
              );
            })}
          </div>

          {/* Compact 4-Row Strike Telemetry Readout */}
          <div className="hairline-border rounded-[2px] px-2.5 py-2 flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Call Wall
              </span>
              <span
                className="font-mono-tabular text-[11px] font-medium"
                style={{ color: "var(--accent-bear)" }}
              >
                {formatStrike(optionsSummary?.call_wall)}
                {optionsSummary && optionsSummary.call_wall_oi > 0
                  ? ` · ${formatBtcSize(optionsSummary.call_wall_oi)}`
                  : ""}
              </span>
            </div>

            <div
              className="flex items-center justify-between pt-1"
              style={{ borderTop: "1px solid var(--border-hairline)" }}
            >
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Put Wall
              </span>
              <span
                className="font-mono-tabular text-[11px] font-medium"
                style={{ color: "var(--accent-bull)" }}
              >
                {formatStrike(optionsSummary?.put_wall)}
                {optionsSummary && optionsSummary.put_wall_oi > 0
                  ? ` · ${formatBtcSize(optionsSummary.put_wall_oi)}`
                  : ""}
              </span>
            </div>

            <div
              className="flex items-center justify-between pt-1"
              style={{ borderTop: "1px solid var(--border-hairline)" }}
            >
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Max Pain
              </span>
              <span
                className="font-mono-tabular text-[11px] font-medium"
                style={{ color: "var(--text-primary)" }}
              >
                {formatStrike(optionsSummary?.max_pain)}
              </span>
            </div>

            <div
              className="flex items-center justify-between pt-1"
              style={{ borderTop: "1px solid var(--border-hairline)" }}
            >
              <span className="text-[11px]" style={{ color: "var(--text-muted)" }}>
                Net GEX
              </span>
              <div className="flex flex-col items-end">
                <span
                  className="font-mono-tabular text-[11px] font-medium"
                  style={{ color: gexColor }}
                >
                  {formatCompactUsd(netGex, { signed: true })}
                </span>
                <span
                  className="font-mono-tabular text-[9px] tracking-[0.03em]"
                  style={{ color: gexColor }}
                >
                  {gexRegimeLabel}
                </span>
              </div>
            </div>
          </div>
        </section>
      </div>

      {/* Institutional Attribution Footer */}
      <footer
        className="hairline-t px-3 py-2 text-[10px] flex flex-col gap-0.5"
        style={{ color: "var(--text-muted)" }}
      >
        <span>BINANCE · BYBIT · DERIBIT (READ-ONLY)</span>
        <a
          href="https://www.tradingview.com/lightweight-charts/"
          target="_blank"
          rel="noreferrer"
          className="underline"
          style={{ color: "var(--text-muted)" }}
        >
          TradingView Lightweight Charts
        </a>
      </footer>
    </aside>
  );
}
