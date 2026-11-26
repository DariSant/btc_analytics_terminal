import type { TimeframeLiteral, WhalePrint } from "../types/terminal";
import { withAlpha } from "../utils/colorAlpha";
import type { ThemePalette } from "../utils/themeTokens";
import {
  applyVisibleBubbleBudget,
  clusterWhaleBubbles,
  computeBubbleZoomPolicy,
  computeScaledWhaleRadius,
  computeVisibleBubbleBudget,
  getFixedWhaleMinUsd,
  type ClusteredWhaleBubble,
} from "../utils/whaleEscalation";
import { BaseOverlayPrimitive } from "./BaseOverlayPrimitive";

export interface WhaleBubblesState {
  whales: readonly WhalePrint[];
  timeframe: TimeframeLiteral;
  candleCount: number;
  visible: boolean;
  palette: ThemePalette;
  onZoomHiddenChange?: (zoomHidden: boolean) => void;
}

interface RenderedBubble {
  x: number;
  y: number;
  r: number;
  bubble: ClusteredWhaleBubble;
}

export class WhaleBubblesPrimitive extends BaseOverlayPrimitive {
  private state: WhaleBubblesState;
  private renderedBubbles: RenderedBubble[] = [];
  private cachedClusters: ClusteredWhaleBubble[] = [];
  private dirtyClusters = true;
  private lastZoomHidden = false;

  constructor(initialState: WhaleBubblesState) {
    super("top");
    this.state = initialState;
  }

  public updateState(next: Partial<WhaleBubblesState>): void {
    const clusterInvalidated =
      next.whales !== undefined || next.timeframe !== undefined;

    this.state = { ...this.state, ...next };
    if (clusterInvalidated) {
      this.dirtyClusters = true;
    }
    this.triggerUpdate();
  }

  public findBubbleAtPoint(px: number, py: number): ClusteredWhaleBubble | null {
    if (!this.state.visible || this.lastZoomHidden) {
      return null;
    }
    for (let i = this.renderedBubbles.length - 1; i >= 0; i -= 1) {
      const item = this.renderedBubbles[i]!;
      const dx = px - item.x;
      const dy = py - item.y;
      const hitRadius = item.r + 4;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return item.bubble;
      }
    }
    return null;
  }

  private ensureClusters(): readonly ClusteredWhaleBubble[] {
    if (!this.dirtyClusters) {
      return this.cachedClusters;
    }
    this.cachedClusters = clusterWhaleBubbles(
      this.state.whales,
      this.state.timeframe,
    );
    this.dirtyClusters = false;
    return this.cachedClusters;
  }

  private notifyZoomHidden(hidden: boolean): void {
    if (hidden !== this.lastZoomHidden) {
      this.lastZoomHidden = hidden;
      this.state.onZoomHiddenChange?.(hidden);
    }
  }

  protected drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
  ): void {
    this.renderedBubbles = [];
    if (!this.state.visible || !this.chart || !this.series) {
      this.notifyZoomHidden(false);
      return;
    }

    const timeScale = this.chart.timeScale();
    const logicalRange = timeScale.getVisibleLogicalRange();
    const fallbackCount = Math.max(1, this.state.candleCount);
    const visibleBars = logicalRange
      ? Math.max(1, logicalRange.to - logicalRange.from)
      : fallbackCount;
    const pxPerBar = mediaWidth / visibleBars;
    const zoomPolicy = computeBubbleZoomPolicy(pxPerBar);

    if (!zoomPolicy.visible) {
      this.notifyZoomHidden(true);
      return;
    }
    this.notifyZoomHidden(false);

    const clusters = this.ensureClusters();
    if (clusters.length === 0) {
      return;
    }

    const tfMinUsd = getFixedWhaleMinUsd(this.state.timeframe);
    const visibleCandidates: Array<{
      x: number;
      y: number;
      r: number;
      notional_usd: number;
      bubble: ClusteredWhaleBubble;
    }> = [];

    for (let i = 0; i < clusters.length; i += 1) {
      const bubble = clusters[i]!;
      const x = timeScale.timeToCoordinate(bubble.barTime);
      const y = this.series.priceToCoordinate(bubble.price);
      if (x === null || y === null) {
        continue;
      }
      const r = computeScaledWhaleRadius(
        bubble.notional_usd,
        tfMinUsd,
        zoomPolicy.maxRadiusPx,
      );
      if (
        r <= 1 ||
        x + r < 0 ||
        x - r > mediaWidth ||
        y + r < 0 ||
        y - r > mediaHeight
      ) {
        continue;
      }
      visibleCandidates.push({
        x,
        y,
        r,
        notional_usd: bubble.notional_usd,
        bubble,
      });
    }

    const budget = computeVisibleBubbleBudget(visibleBars);
    const toRender = applyVisibleBubbleBudget(visibleCandidates, budget);
    if (toRender.length === 0) {
      return;
    }

    const { palette } = this.state;

    ctx.save();
    for (let i = 0; i < toRender.length; i += 1) {
      const { x, y, r, bubble } = toRender[i]!;
      const color = bubble.side === "buy" ? palette.bull : palette.bear;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(color, 0.32 * zoomPolicy.alphaScale);
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(color, 0.88 * zoomPolicy.alphaScale);
      if (bubble.venue === "bybit") {
        ctx.setLineDash([2, 2]);
      } else if (bubble.venue === "mixed") {
        ctx.setLineDash([4, 2]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();

      if (r >= 14) {
        ctx.setLineDash([]);
        ctx.font = "600 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = withAlpha(palette.textPrimary, zoomPolicy.alphaScale);
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        const glyph =
          bubble.venue === "mixed"
            ? "B+Y"
            : bubble.venue === "binance"
              ? "B"
              : "Y";
        ctx.fillText(glyph, x, y + 0.5);
      }

      this.renderedBubbles.push({ x, y, r, bubble });
    }
    ctx.restore();
  }
}
