import { useState, type ReactNode } from "react";
import { ArrowRight, X } from "lucide-react";
import { useTerminalStore } from "../store/useTerminalStore";

export type GuideSectionId =
  | "orderflow"
  | "liquidations"
  | "vrvp"
  | "options"
  | "telemetry";

interface LegendEntryProps {
  glyph: ReactNode;
  title: string;
  tag?: string;
  description: string;
}

function LegendEntry({ glyph, title, tag, description }: LegendEntryProps) {
  return (
    <div
      className="flex items-start gap-2 py-2"
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

interface AccordionSectionProps {
  id: GuideSectionId;
  title: string;
  railMode: boolean;
  expanded: boolean;
  onToggle: (id: GuideSectionId) => void;
  onOpenGuide: (id: GuideSectionId) => void;
  children: ReactNode;
}

function AccordionSection({
  id,
  title,
  railMode,
  expanded,
  onToggle,
  onOpenGuide,
  children,
}: AccordionSectionProps) {
  return (
    <section className="hairline-b">
      <button
        type="button"
        aria-expanded={expanded}
        onClick={() => (railMode ? onOpenGuide(id) : onToggle(id))}
        className="w-full px-3 py-2 flex items-center justify-between gap-2 text-left cursor-pointer"
        style={{
          backgroundColor: expanded && !railMode ? "var(--bg-canvas)" : "transparent",
          color: "var(--text-primary)",
        }}
      >
        <span className="flex items-center gap-1.5 min-w-0">
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            aria-hidden="true"
            className="shrink-0"
          >
            {expanded && !railMode ? (
              <polygon points="1,2 7,2 4,6.5" fill="var(--accent-bull)" />
            ) : (
              <polygon points="2,1 6.5,4 2,7" fill="var(--text-muted)" />
            )}
          </svg>
          <span className="text-[11px] font-semibold uppercase tracking-[0.04em] truncate">
            {title}
          </span>
        </span>
      </button>

      {expanded && !railMode && (
        <div className="px-3 pb-2">
          {children}
          <button
            type="button"
            onClick={() => onOpenGuide(id)}
            className="mt-1 mb-1 w-full hairline-border px-2 py-1 rounded-[2px] flex items-center justify-between text-[10px] font-medium cursor-pointer"
            style={{
              backgroundColor: "var(--bg-canvas)",
              color: "var(--accent-bull)",
            }}
          >
            <span>READ PLAYBOOK</span>
            <ArrowRight size={11} />
          </button>
        </div>
      )}
    </section>
  );
}

const INITIAL_EXPANDED: Record<GuideSectionId, boolean> = {
  orderflow: false,
  liquidations: false,
  vrvp: false,
  options: false,
  telemetry: false,
};

export function LegendDrawer() {
  const legendOpen = useTerminalStore((s) => s.legendOpen);
  const guideOpen = useTerminalStore((s) => s.guideOpen);
  const setLegendOpen = useTerminalStore((s) => s.setLegendOpen);
  const setGuideOpen = useTerminalStore((s) => s.setGuideOpen);

  const [expanded, setExpanded] =
    useState<Record<GuideSectionId, boolean>>(INITIAL_EXPANDED);

  const toggleSection = (id: GuideSectionId) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const openGuideSection = (id: GuideSectionId) => {
    setGuideOpen(true);
    if (typeof document !== "undefined") {
      requestAnimationFrame(() => {
        const el = document.getElementById(`guide-section-${id}`);
        el?.scrollIntoView({ behavior: "auto", block: "start" });
      });
    }
  };

  const widthPx = !legendOpen ? 0 : guideOpen ? 160 : 260;

  return (
    <aside
      aria-label="Chart Legend and Field Guide"
      aria-hidden={!legendOpen}
      className={
        legendOpen
          ? "terminal-drawer terminal-scroll flex flex-col justify-between select-none"
          : "terminal-drawer--closed"
      }
      style={{ width: `${widthPx}px` }}
    >
      <div className="flex flex-col">
        {/* Pane Header */}
        <div className="hairline-b px-3 py-2.5 flex items-center justify-between gap-1.5">
          <div className="flex flex-col min-w-0">
            <h2
              className="text-[11px] font-semibold uppercase tracking-[0.04em] m-0 truncate"
              style={{ color: "var(--text-primary)" }}
            >
              {guideOpen ? "Legend" : "Chart Legend"}
            </h2>
            {!guideOpen && (
              <span
                className="font-mono-tabular text-[9px] tracking-[0.03em]"
                style={{ color: "var(--text-muted)" }}
              >
                CLICK SECTION TO EXPAND
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={() => setLegendOpen(false)}
            aria-label="Close legend pane"
            className="hairline-border flex items-center justify-center w-6 h-5 rounded-[2px] cursor-pointer shrink-0"
            style={{
              backgroundColor: "var(--bg-canvas)",
              color: "var(--text-muted)",
            }}
          >
            <X size={12} />
          </button>
        </div>

        {/* Full Guide Trigger */}
        <div className="hairline-b px-3 py-2">
          <button
            type="button"
            onClick={() => setGuideOpen(!guideOpen)}
            aria-label={guideOpen ? "Close full guide pane" : "Open full guide pane"}
            aria-expanded={guideOpen}
            className="w-full hairline-border px-2 py-1.5 rounded-[2px] flex items-center justify-between text-[11px] font-semibold uppercase tracking-[0.04em] cursor-pointer"
            style={{
              backgroundColor: guideOpen ? "var(--bg-canvas)" : "transparent",
              color: guideOpen ? "var(--accent-bull)" : "var(--text-primary)",
            }}
          >
            <span className="truncate">{guideOpen ? "Hide Guide" : "Full Guide"}</span>
            <ArrowRight size={12} />
          </button>
        </div>

        {/* Section 1: Whale Order Flow vs. Liquidations */}
        <AccordionSection
          id="orderflow"
          title="Order Flow"
          railMode={guideOpen}
          expanded={expanded.orderflow}
          onToggle={toggleSection}
          onOpenGuide={openGuideSection}
        >
          <LegendEntry
            title="Round Circles — Whale Sweeps"
            tag="$250k+"
            description="Real 100ms WS burst sweeps only. Teal = aggressive taker buy; Red = aggressive taker sell. Solid ring (B) = Binance; dashed (Y) = Bybit."
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
            title="Fixed TF Escalation & Budget"
            tag="AUTO"
            description="Fixed floors: 1m $250k · 5m $500k · 15m $1M · 1h $2M · 4h $5M · 1d $10M. Nearby same-bar sweeps cluster (xN); viewport caps density by visible bars and auto-hides < 3.5px/bar."
            glyph={
              <span
                className="font-mono-tabular text-[10px] font-semibold"
                style={{ color: "var(--accent-bull)" }}
              >
                xN
              </span>
            }
          />
        </AccordionSection>

        {/* Section 2: Liquidations */}
        <AccordionSection
          id="liquidations"
          title="Liquidations"
          railMode={guideOpen}
          expanded={expanded.liquidations}
          onToggle={toggleSection}
          onOpenGuide={openGuideSection}
        >
          <LegendEntry
            title="Diamond + X — Forced Liqs"
            tag="$25k+"
            description="Hollow rotated squares mark verified forced liquidations (not voluntary whales). Red = longs wiped; Teal = shorts squeezed."
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
          <LegendEntry
            title="16px Left Thermal Bar & Plumes"
            tag="TOP 4"
            description="Continuous left-margin density bar (10x–100x auto-mitigated pools). Top 3–4 heaviest pockets project rightward—stronger & longer = larger pool."
            glyph={
              <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
                <rect x="1" y="1" width="5" height="14" fill="var(--accent-bear)" fillOpacity="0.7" />
                <rect x="6" y="3" width="13" height="3.5" fill="var(--accent-bear)" fillOpacity="0.6" />
                <rect x="6" y="10" width="8" height="2.5" fill="var(--accent-bull)" fillOpacity="0.45" />
              </svg>
            }
          />
        </AccordionSection>

        {/* Section 3: VRVP */}
        <AccordionSection
          id="vrvp"
          title="Volume Profile"
          railMode={guideOpen}
          expanded={expanded.vrvp}
          onToggle={toggleSection}
          onOpenGuide={openGuideSection}
        >
          <LegendEntry
            title="80-Bin VRVP & POC / VA"
            tag="70% VA"
            description="Right-docked buy/sell volume across visible bars. Brighter bins mark the 70% Value Area (VAH/VAL dashed); solid line = POC."
            glyph={
              <svg width="20" height="16" viewBox="0 0 20 16" aria-hidden="true">
                <rect x="11" y="2" width="8" height="3" fill="var(--accent-bull)" fillOpacity="0.4" />
                <rect x="4" y="6" width="15" height="4" fill="var(--accent-bear)" fillOpacity="0.65" />
                <line x1="1" y1="8" x2="19" y2="8" stroke="var(--text-primary)" strokeWidth="1.2" />
              </svg>
            }
          />
        </AccordionSection>

        {/* Section 4: Deribit Options */}
        <AccordionSection
          id="options"
          title="Options & GEX"
          railMode={guideOpen}
          expanded={expanded.options}
          onToggle={toggleSection}
          onOpenGuide={openGuideSection}
        >
          <LegendEntry
            title="Walls, GEX & Max Pain"
            tag="DERIBIT"
            description="Solid red = Call Wall; solid teal = Put Wall; dotted = Max Pain; left micro-bars = top-5 Net GEX strikes (+GEX dampens, -GEX accelerates)."
            glyph={
              <svg width="20" height="14" viewBox="0 0 20 14" aria-hidden="true">
                <line x1="1" y1="3" x2="19" y2="3" stroke="var(--accent-bear)" strokeWidth="1.4" />
                <line x1="1" y1="7" x2="19" y2="7" stroke="var(--accent-neutral)" strokeWidth="1.1" strokeDasharray="2 2" />
                <line x1="1" y1="11" x2="19" y2="11" stroke="var(--accent-bull)" strokeWidth="1.4" />
              </svg>
            }
          />
        </AccordionSection>

        {/* Section 5: Header Telemetry */}
        <AccordionSection
          id="telemetry"
          title="Telemetry"
          railMode={guideOpen}
          expanded={expanded.telemetry}
          onToggle={toggleSection}
          onOpenGuide={openGuideSection}
        >
          <LegendEntry
            title="Session CVD, OI & Funding"
            tag="00:00 UTC"
            description="Session CVD resets at 00:00 UTC and tracks net aggressive taker delta. OI combines Binance + Bybit USD open interest."
            glyph={
              <span
                className="font-mono-tabular text-[10px] font-semibold"
                style={{ color: "var(--accent-bull)" }}
              >
                CVD
              </span>
            }
          />
        </AccordionSection>
      </div>
    </aside>
  );
}
