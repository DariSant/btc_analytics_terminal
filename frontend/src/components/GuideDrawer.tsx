import { X } from "lucide-react";
import { useTerminalStore } from "../store/useTerminalStore";

export function GuideDrawer() {
  const legendOpen = useTerminalStore((s) => s.legendOpen);
  const guideOpen = useTerminalStore((s) => s.guideOpen);
  const setGuideOpen = useTerminalStore((s) => s.setGuideOpen);

  const isOpen = legendOpen && guideOpen;

  return (
    <aside
      aria-label="Full Terminal Field Guide"
      aria-hidden={!isOpen}
      className={
        isOpen
          ? "terminal-guide terminal-scroll flex flex-col select-text"
          : "terminal-drawer--closed"
      }
      style={
        isOpen
          ? { width: "min(760px, 56vw)" }
          : { width: "0px" }
      }
    >
      {/* Guide Header */}
      <div
        className="hairline-b px-5 py-3 flex items-center justify-between sticky top-0 z-10"
        style={{ backgroundColor: "var(--bg-surface)" }}
      >
        <div className="flex flex-col gap-0.5">
          <span
            className="font-mono-tabular text-[10px] uppercase tracking-[0.06em]"
            style={{ color: "var(--accent-bull)" }}
          >
            ANALYTICS TERMINAL · FIELD GUIDE &amp; PLAYBOOK
          </span>
          <h2
            className="text-[14px] font-semibold m-0"
            style={{ color: "var(--text-primary)" }}
          >
            How Each Market-Structure Layer Works &amp; Trading Implications
          </h2>
        </div>
        <button
          type="button"
          onClick={() => setGuideOpen(false)}
          aria-label="Close full guide pane"
          className="hairline-border px-2 py-1 rounded-[2px] flex items-center gap-1.5 text-[11px] cursor-pointer"
          style={{
            backgroundColor: "var(--bg-canvas)",
            color: "var(--text-primary)",
          }}
        >
          <span>CLOSE</span>
          <X size={12} />
        </button>
      </div>

      {/* Guide Body */}
      <div className="p-5 flex flex-col gap-6">
        {/* 1. Whale Order Flow */}
        <section id="guide-section-orderflow" className="hairline-b pb-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-[13px] font-semibold uppercase tracking-[0.04em] m-0"
              style={{ color: "var(--text-primary)" }}
            >
              1. Whale Order Flow (Real 100ms Sweeps &amp; Fixed Escalation)
            </h3>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              ROUND CIRCLES · BINANCE (B) / BYBIT (Y)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div
              className="md:col-span-5 hairline-border p-3 rounded-[2px]"
              style={{ backgroundColor: "var(--bg-canvas)" }}
            >
              <svg width="100%" viewBox="0 0 260 110" aria-label="Whale Sweep Diagram">
                <line x1="10" y1="88" x2="250" y2="88" stroke="var(--border-hairline)" strokeWidth="1" />
                <rect x="42" y="42" width="10" height="36" fill="var(--accent-bull)" fillOpacity="0.6" />
                <line x1="47" y1="30" x2="47" y2="84" stroke="var(--accent-bull)" strokeWidth="1.2" />
                <rect x="115" y="28" width="10" height="34" fill="var(--accent-bear)" fillOpacity="0.6" />
                <line x1="120" y1="20" x2="120" y2="76" stroke="var(--accent-bear)" strokeWidth="1.2" />
                <rect x="195" y="34" width="10" height="40" fill="var(--accent-bull)" fillOpacity="0.6" />
                <circle cx="47" cy="48" r="14" fill="var(--accent-bull)" fillOpacity="0.28" stroke="var(--accent-bull)" strokeWidth="1.2" />
                <text x="47" y="51" textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontFamily="JetBrains Mono, monospace">B</text>
                <circle cx="120" cy="40" r="18" fill="var(--accent-bear)" fillOpacity="0.28" stroke="var(--accent-bear)" strokeWidth="1.2" strokeDasharray="3 2" />
                <text x="120" y="43" textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontFamily="JetBrains Mono, monospace">Y</text>
                <circle cx="200" cy="46" r="16" fill="var(--accent-bull)" fillOpacity="0.28" stroke="var(--accent-bull)" strokeWidth="1.2" strokeDasharray="4 2" />
                <text x="200" y="49" textAnchor="middle" fill="var(--text-primary)" fontSize="9" fontFamily="JetBrains Mono, monospace">B+Y</text>
                <text x="47" y="102" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">BINANCE SOLID</text>
                <text x="120" y="102" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">BYBIT DASHED</text>
                <text x="200" y="102" textAnchor="middle" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">CLUSTER (xN)</text>
              </svg>
            </div>

            <div className="md:col-span-7 flex flex-col gap-2 text-[12px] leading-[1.45]">
              <p className="m-0" style={{ color: "var(--text-primary)" }}>
                <strong>Mechanism:</strong> Consecutive same-side market fills within a{" "}
                <span className="font-mono-tabular">100ms</span> window per venue are merged into a single VWAP sweep. Nearby prints on the same candle (<span className="font-mono-tabular">0.25%</span>) cluster (<span className="font-mono-tabular">xN</span>), and visible bubbles are budgeted proportionally to visible candle count (auto-hiding below <span className="font-mono-tabular">3.5px/bar</span>).
              </p>
              <div
                className="hairline-border p-2 rounded-[2px] font-mono-tabular text-[11px] flex flex-wrap gap-x-3 gap-y-1"
                style={{ backgroundColor: "var(--bg-canvas)", color: "var(--text-muted)" }}
              >
                <span>1m: $250k+</span>
                <span>5m: $500k+</span>
                <span>15m: $1M+</span>
                <span>1h: $2M+</span>
                <span>4h: $5M+</span>
                <span>1d: $10M+</span>
              </div>
              <p className="m-0" style={{ color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--accent-bull)" }}>Implications:</strong> Large buy bubbles that fail to push price higher signal passive limit <em>absorption</em> (potential reversal). Sweeps breaking through a level with follow-through confirm institutional initiative.
              </p>
            </div>
          </div>
        </section>

        {/* 2. Liquidations & Left Thermal Bar */}
        <section id="guide-section-liquidations" className="hairline-b pb-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-[13px] font-semibold uppercase tracking-[0.04em] m-0"
              style={{ color: "var(--text-primary)" }}
            >
              2. Forced Liquidations &amp; Left-Edge Thermal Heatmap
            </h3>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              DIAMOND + X · 16px LEFT THERMAL BAR
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div
              className="md:col-span-5 hairline-border p-3 rounded-[2px]"
              style={{ backgroundColor: "var(--bg-canvas)" }}
            >
              <svg width="100%" viewBox="0 0 260 110" aria-label="Liquidation Heatmap Diagram">
                <rect x="4" y="6" width="16" height="98" fill="var(--bg-surface)" stroke="var(--border-hairline)" />
                <rect x="5" y="16" width="14" height="12" fill="var(--accent-bull)" fillOpacity="0.8" />
                <rect x="5" y="72" width="14" height="16" fill="var(--accent-bear)" fillOpacity="0.9" />
                <rect x="20" y="18" width="90" height="7" fill="var(--accent-bull)" fillOpacity="0.32" />
                <rect x="20" y="75" width="165" height="10" fill="var(--accent-bear)" fillOpacity="0.45" />
                <polygon points="150,24 157,31 150,38 143,31" fill="none" stroke="var(--accent-bull)" strokeWidth="1.4" />
                <line x1="147" y1="28" x2="153" y2="34" stroke="var(--accent-bull)" strokeWidth="1.1" />
                <line x1="153" y1="28" x2="147" y2="34" stroke="var(--accent-bull)" strokeWidth="1.1" />
                <polygon points="205,73 212,80 205,87 198,80" fill="none" stroke="var(--accent-bear)" strokeWidth="1.4" />
                <line x1="202" y1="77" x2="208" y2="83" stroke="var(--accent-bear)" strokeWidth="1.1" />
                <line x1="208" y1="77" x2="202" y2="83" stroke="var(--accent-bear)" strokeWidth="1.1" />
                <text x="120" y="24" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">SHORT LIQ POOL</text>
                <text x="190" y="96" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">LONG LIQ POOL + DIAMOND</text>
              </svg>
            </div>

            <div className="md:col-span-7 flex flex-col gap-2 text-[12px] leading-[1.45]">
              <p className="m-0" style={{ color: "var(--text-primary)" }}>
                <strong>Mechanism:</strong> Hollow diamonds (<span className="font-mono-tabular">$25k+</span>) mark actual forced liquidations—unlike round whale bubbles, these are involuntary margin closures. The left <span className="font-mono-tabular">16px</span> thermal bar maps continuous <span className="font-mono-tabular">10x–100x</span> OI-weighted swing pools; only the top <span className="font-mono-tabular">3–4</span> heaviest pockets project rightward (longer &amp; stronger = larger pool) and erase automatically once price sweeps them.
              </p>
              <p className="m-0" style={{ color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--accent-bear)" }}>Implications:</strong> Unmitigated plumes act as magnetic liquidity targets. Clusters of diamond markers at a wick tip often signal forced cascade exhaustion and sharp mean-reversion bounces.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Volume Profile (VRVP) */}
        <section id="guide-section-vrvp" className="hairline-b pb-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-[13px] font-semibold uppercase tracking-[0.04em] m-0"
              style={{ color: "var(--text-primary)" }}
            >
              3. Visible Range Volume Profile (80-Bin VRVP)
            </h3>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              POC · VAH / VAL (70% VALUE AREA)
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div
              className="md:col-span-5 hairline-border p-3 rounded-[2px]"
              style={{ backgroundColor: "var(--bg-canvas)" }}
            >
              <svg width="100%" viewBox="0 0 260 100" aria-label="VRVP Diagram">
                <line x1="12" y1="24" x2="248" y2="24" stroke="var(--accent-neutral)" strokeWidth="1" strokeDasharray="4 3" />
                <line x1="12" y1="52" x2="248" y2="52" stroke="var(--text-primary)" strokeWidth="1.3" />
                <line x1="12" y1="80" x2="248" y2="80" stroke="var(--accent-neutral)" strokeWidth="1" strokeDasharray="4 3" />
                <rect x="210" y="14" width="38" height="7" fill="var(--accent-bull)" fillOpacity="0.22" />
                <rect x="178" y="30" width="70" height="8" fill="var(--accent-bear)" fillOpacity="0.45" />
                <rect x="150" y="47" width="98" height="10" fill="var(--accent-bull)" fillOpacity="0.55" />
                <rect x="184" y="65" width="64" height="8" fill="var(--accent-bear)" fillOpacity="0.45" />
                <text x="16" y="20" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">VAH</text>
                <text x="16" y="48" fill="var(--text-primary)" fontSize="8" fontFamily="JetBrains Mono, monospace">POC</text>
                <text x="16" y="76" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">VAL</text>
              </svg>
            </div>

            <div className="md:col-span-7 flex flex-col gap-2 text-[12px] leading-[1.45]">
              <p className="m-0" style={{ color: "var(--text-primary)" }}>
                <strong>Mechanism:</strong> Slices the visible chart range into <span className="font-mono-tabular">80</span> price bins and distributes aggressive buy vs. sell quote volume across each candle&apos;s high-low span. Higher-contrast bars mark the <span className="font-mono-tabular">70%</span> Value Area (<span className="font-mono-tabular">VAL</span> to <span className="font-mono-tabular">VAH</span>) around the Point of Control (<span className="font-mono-tabular">POC</span>).
              </p>
              <p className="m-0" style={{ color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--accent-bull)" }}>Implications:</strong> Price tends to rotate between <span className="font-mono-tabular">VAH</span> and <span className="font-mono-tabular">VAL</span> toward the <span className="font-mono-tabular">POC</span> magnet during balance, while thin low-volume nodes outside the Value Area allow rapid directional expansion.
              </p>
            </div>
          </div>
        </section>

        {/* 4. Deribit Options */}
        <section id="guide-section-options" className="hairline-b pb-5 flex flex-col gap-3">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-[13px] font-semibold uppercase tracking-[0.04em] m-0"
              style={{ color: "var(--text-primary)" }}
            >
              4. Deribit Options (Walls, Net Dollar GEX &amp; Max Pain)
            </h3>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              BLACK-76 GAMMA · 60S SYNC
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-start">
            <div
              className="md:col-span-5 hairline-border p-3 rounded-[2px]"
              style={{ backgroundColor: "var(--bg-canvas)" }}
            >
              <svg width="100%" viewBox="0 0 260 100" aria-label="Options Walls Diagram">
                <line x1="12" y1="22" x2="248" y2="22" stroke="var(--accent-bear)" strokeWidth="1.4" />
                <line x1="12" y1="52" x2="248" y2="52" stroke="var(--accent-neutral)" strokeWidth="1.2" strokeDasharray="2 3" />
                <line x1="12" y1="82" x2="248" y2="82" stroke="var(--accent-bull)" strokeWidth="1.4" />
                <rect x="12" y="20" width="28" height="4" fill="var(--accent-bull)" />
                <rect x="12" y="50" width="18" height="4" fill="var(--accent-bear)" />
                <rect x="12" y="80" width="24" height="4" fill="var(--accent-bull)" />
                <text x="160" y="18" fill="var(--accent-bear)" fontSize="8" fontFamily="JetBrains Mono, monospace">CALL WALL (+GEX)</text>
                <text x="172" y="48" fill="var(--text-muted)" fontSize="8" fontFamily="JetBrains Mono, monospace">MAX PAIN</text>
                <text x="164" y="78" fill="var(--accent-bull)" fontSize="8" fontFamily="JetBrains Mono, monospace">PUT WALL (-GEX)</text>
              </svg>
            </div>

            <div className="md:col-span-7 flex flex-col gap-2 text-[12px] leading-[1.45]">
              <p className="m-0" style={{ color: "var(--text-primary)" }}>
                <strong>Mechanism:</strong> Derived every <span className="font-mono-tabular">60s</span> from live Deribit BTC option open interest and implied volatility via Black-76 Gamma. Filterable by single expiry (<span className="font-mono-tabular">08:00 UTC</span> settlement) or aggregated across all expiries.
              </p>
              <p className="m-0" style={{ color: "var(--text-muted)" }}>
                <strong style={{ color: "var(--accent-bull)" }}>Implications:</strong> Positive Net GEX (<span className="font-mono-tabular">+GEX Stabilizer</span>) means dealers hedge against moves (pinning near Call/Put Walls &amp; Max Pain). Negative Net GEX (<span className="font-mono-tabular">-GEX Accelerator</span>) forces dealers to hedge <em>with</em> momentum, amplifying breakouts.
              </p>
            </div>
          </div>
        </section>

        {/* 5. Header Telemetry */}
        <section id="guide-section-telemetry" className="flex flex-col gap-2">
          <div className="flex items-baseline justify-between gap-3">
            <h3
              className="text-[13px] font-semibold uppercase tracking-[0.04em] m-0"
              style={{ color: "var(--text-primary)" }}
            >
              5. Header Telemetry (Session CVD, OI &amp; Funding)
            </h3>
            <span
              className="font-mono-tabular text-[10px]"
              style={{ color: "var(--text-muted)" }}
            >
              1HZ REAL-TIME STRIP
            </span>
          </div>
          <p className="m-0 text-[12px] leading-[1.45]" style={{ color: "var(--text-primary)" }}>
            <strong>Session CVD</strong> tracks net aggressive taker buy minus sell USD since <span className="font-mono-tabular">00:00 UTC</span> (backfilled on startup). <strong>OI</strong> sums Binance + Bybit USD perpetual Open Interest. <strong>Funding</strong> displays the live perp rate and settlement countdown—rising price with falling CVD or extreme funding alongside rising OI warns of crowded, squeeze-prone positioning.
          </p>
        </section>
      </div>
    </aside>
  );
}
