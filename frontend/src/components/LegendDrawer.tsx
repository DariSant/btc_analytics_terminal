import { X } from "lucide-react";
import type { ReactNode } from "react";
import { useTerminalStore } from "../store/useTerminalStore";

interface LegendEntryProps {
  glyph: ReactNode;
  title: string;
  tag?: string;
  description: string;
}

function LegendEntry({ glyph, title, tag, description }: LegendEntryProps) {
  return (
    <div
      className="flex items-start gap-2.5 py-2"
      style={{ borderTop: "1px solid var(--border-hairline)" }}
    >
      <div className="w-6 h-5 shrink-0 flex items-center justify-center mt-0.5">
        {glyph}
      </div>
      <div className="flex flex-col gap-0.5 min-w-0">
        <div className="flex items-baseline justify-between gap-1.5">
          <span
            className="text-[11px] font-medium"
            style={{ color: "var(--text-primary)" }}
          >
            {title}
          </span>
          {tag && (
            <span
              className="font-mono-tabular text-[9px] shrink-0"
              style={{ color: "var(--text-muted)" }}
            >
              {tag}
            </span>
          )}
        </div>
        <p
          className="text-[11px] leading-[1.35] m-0"
          style={{ color: "var(--text-muted)" }}
        >
          {description}
        </p>
      </div>
    </div>
  );
}

export function LegendDrawer() {
  const legendOpen = useTerminalStore((s) => s.legendOpen);
  const setLegendOpen = useTerminalStore((s) => s.setLegendOpen);

  return (
    <aside
      aria-label="Chart Legend and Field Guide"
      aria-hidden={!legendOpen}
      className={
        legendOpen
          ? "terminal-drawer terminal-scroll flex flex-col justify-between select-none"
          : "terminal-drawer--closed"
      }
      style={legendOpen ? { width: "260px" } : { width: "0px" }}
    >
      <div className="flex flex-col">
        {/* Pane Header */}
        <div className="hairline-b px-3 py-2.5 flex items-center justify-between">
          <div className="flex flex-col">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.04em] m-0"
              style={{ color: "var(--text-primary)" }}
            >
              Chart Legend
            </h2>
            <span
              className="font-mono-tabular text-[9px] tracking-[0.03em]"
              style={{ color: "var(--text-muted)" }}
            >
              MARKS · HEATMAP · DERIVATIVES
            </span>
          </div>
          <button
            type="button"
            onClick={() => setLegendOpen(false)}
            aria-label="Close legend pane"
            className="hairline-border flex items-center justify-center w-6 h-5 rounded-[2px] cursor-pointer"
            style={{
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-muted)",
            }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Section 1: Candle Marks (Round vs. Squared Diamond) */}
        <section className="hairline-b px-3 pt-2.5 pb-1">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Order Flow vs. Liquidations
          </h3>

          <LegendEntry
            title="Round Circles — Whale Trades"
            tag="$100k+"
            description="Voluntary aggressive taker sweeps (100ms burst VWAP). Circle area scales with USD size. Teal = taker buy; Red = taker sell. Hover for exact print."
            glyph={
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <circle
                  cx="7"
                  cy="10"
                  r="5.5"
                  fill="var(--accent-bull)"
                  fillOpacity="0.28"
                  stroke="var(--accent-bull)"
                  strokeWidth="1.2"
                />
                <circle
                  cx="14.5"
                  cy="10"
                  r="4"
                  fill="var(--accent-bear)"
                  fillOpacity="0.28"
                  stroke="var(--accent-bear)"
                  strokeWidth="1.2"
                  strokeDasharray="2 1.5"
                />
              </svg>
            }
          />

          <LegendEntry
            title="Venue Ring: Solid vs. Dashed"
            tag="B / Y"
            description="Solid ring (B) = Binance Futures; dashed ring (Y) = Bybit V5. Venue glyphs appear inside bubbles >= 14px."
            glyph={
              <span
                className="font-mono-tabular text-[10px] font-semibold"
                style={{ color: "var(--text-primary)" }}
              >
                B · Y
              </span>
            }
          />

          <LegendEntry
            title="Diamond + X — Forced Liqs"
            tag="$25k+"
            description="Hollow rotated-square markers show verified exchange liquidations (not voluntary trades). Red = longs wiped; Teal = shorts squeezed."
            glyph={
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden="true">
                <polygon
                  points="6,4 11,10 6,16 1,10"
                  fill="none"
                  stroke="var(--accent-bear)"
                  strokeWidth="1.25"
                />
                <line x1="4" y1="8" x2="8" y2="12" stroke="var(--accent-bear)" strokeWidth="1.1" />
                <line x1="8" y1="8" x2="4" y2="12" stroke="var(--accent-bear)" strokeWidth="1.1" />
                <polygon
                  points="15,5 19,10 15,15 11,10"
                  fill="none"
                  stroke="var(--accent-bull)"
                  strokeWidth="1.25"
                />
                <line x1="13.5" y1="8.5" x2="16.5" y2="11.5" stroke="var(--accent-bull)" strokeWidth="1.1" />
                <line x1="16.5" y1="8.5" x2="13.5" y2="11.5" stroke="var(--accent-bull)" strokeWidth="1.1" />
              </svg>
            }
          />
        </section>

        {/* Section 2: Left-Margin Liquidation Heatmap */}
        <section className="hairline-b px-3 pt-2.5 pb-1">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Liquidation Heatmap
          </h3>

          <LegendEntry
            title="Left Thermal Bar"
            tag="16px"
            description="Continuous liquidation density across every price level (10x–100x OI-weighted swings). Auto-clears once price sweeps a level."
            glyph={
              <svg width="16" height="18" viewBox="0 0 16 18" aria-hidden="true">
                <rect x="4" y="1" width="8" height="5" fill="var(--accent-bull)" fillOpacity="0.85" />
                <rect x="4" y="6" width="8" height="4" fill="var(--accent-bull)" fillOpacity="0.25" />
                <rect x="4" y="10" width="8" height="3" fill="var(--accent-bear)" fillOpacity="0.3" />
                <rect x="4" y="13" width="8" height="4" fill="var(--accent-bear)" fillOpacity="0.9" />
              </svg>
            }
          />

          <LegendEntry
            title="Peak Heat Plumes"
            tag="TOP 4"
            description="Top 3–4 heaviest pockets project rightward from the left bar. Stronger opacity and longer reach indicate larger estimated liquidation pools."
            glyph={
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <rect x="1" y="2" width="18" height="4" fill="var(--accent-bear)" fillOpacity="0.7" />
                <rect x="1" y="8" width="10" height="3" fill="var(--accent-bull)" fillOpacity="0.45" />
              </svg>
            }
          />
        </section>

        {/* Section 3: Volume & Profile */}
        <section className="hairline-b px-3 pt-2.5 pb-1">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Volume Profile (VRVP)
          </h3>

          <LegendEntry
            title="80-Bin Visible Profile"
            tag="70% VA"
            description="Right-docked horizontal buy/sell volume across visible bars. Higher-contrast bars mark the 70% Value Area between VAH and VAL."
            glyph={
              <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
                <rect x="11" y="2" width="8" height="3" fill="var(--accent-bull)" fillOpacity="0.4" />
                <rect x="4" y="6" width="15" height="4" fill="var(--accent-bear)" fillOpacity="0.65" />
                <rect x="9" y="11" width="10" height="3" fill="var(--accent-bull)" fillOpacity="0.4" />
              </svg>
            }
          />

          <LegendEntry
            title="POC / VAH / VAL Rays"
            tag="LINES"
            description="Solid primary line = Point of Control (highest-volume price). Dashed neutral lines = Value Area High & Low."
            glyph={
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <line x1="1" y1="3" x2="19" y2="3" stroke="var(--accent-neutral)" strokeWidth="1" strokeDasharray="3 2" />
                <line x1="1" y1="7" x2="19" y2="7" stroke="var(--text-primary)" strokeWidth="1.4" />
                <line x1="1" y1="11" x2="19" y2="11" stroke="var(--accent-neutral)" strokeWidth="1" strokeDasharray="3 2" />
              </svg>
            }
          />
        </section>

        {/* Section 4: Deribit Options */}
        <section className="hairline-b px-3 pt-2.5 pb-1">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Options & Gamma (Deribit)
          </h3>

          <LegendEntry
            title="Call Wall & Put Wall"
            tag="OI"
            description="Solid red ray = largest Call OI strike (overhead resistance). Solid teal ray = largest Put OI strike (downside support)."
            glyph={
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <line x1="1" y1="4" x2="19" y2="4" stroke="var(--accent-bear)" strokeWidth="1.4" />
                <line x1="1" y1="10" x2="19" y2="10" stroke="var(--accent-bull)" strokeWidth="1.4" />
              </svg>
            }
          />

          <LegendEntry
            title="GEX Bars & Max Pain"
            tag="GEX"
            description="Short left-edge bars show top-5 Net Gamma strikes (+GEX dampens volatility; -GEX amplifies moves). Dotted line = Max Pain strike."
            glyph={
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <rect x="1" y="2" width="10" height="2.5" fill="var(--accent-bull)" />
                <rect x="1" y="6" width="14" height="2.5" fill="var(--accent-bear)" />
                <line x1="1" y1="12" x2="19" y2="12" stroke="var(--accent-neutral)" strokeWidth="1.2" strokeDasharray="2 2" />
              </svg>
            }
          />
        </section>

        {/* Section 5: Header Telemetry */}
        <section className="px-3 pt-2.5 pb-3">
          <h3
            className="text-[11px] font-semibold uppercase tracking-[0.04em] mb-1.5"
            style={{ color: "var(--text-muted)" }}
          >
            Header Telemetry
          </h3>
          <LegendEntry
            title="Session CVD & OI"
            tag="00:00 UTC"
            description="Session CVD resets daily at 00:00 UTC and tracks net aggressive taker buy vs. sell USD flow. OI sums Binance + Bybit USD open interest."
            glyph={
              <span
                className="font-mono-tabular text-[10px] font-semibold"
                style={{ color: "var(--accent-bull)" }}
              >
                CVD
              </span>
            }
          />
        </section>
      </div>
    </aside>
  );
}
