import type { TimeframeLiteral, WhalePrint } from "../types/terminal";
import { withAlpha } from "../utils/colorAlpha";
import type { ThemePalette } from "../utils/themeTokens";
import { snapTimestampToBar } from "../utils/timeSnap";
import { BaseOverlayPrimitive } from "./BaseOverlayPrimitive";

export interface WhaleBubblesState {
  whales: readonly WhalePrint[];
  timeframe: TimeframeLiteral;
  minWhaleUsd: number;
  visible: boolean;
  palette: ThemePalette;
}

interface RenderedBubble {
  x: number;
  y: number;
  r: number;
  whale: WhalePrint;
}

export function computeWhaleRadius(notionalUsd: number): number {
  const scaled =
    4 + 24 * Math.sqrt(Math.max(0, notionalUsd - 100_000) / 4_900_000);
  return Math.min(28, Math.max(4, scaled));
}

export class WhaleBubblesPrimitive extends BaseOverlayPrimitive {
  private state: WhaleBubblesState;
  private renderedBubbles: RenderedBubble[] = [];

  constructor(initialState: WhaleBubblesState) {
    super("top");
    this.state = initialState;
  }

  public updateState(next: Partial<WhaleBubblesState>): void {
    this.state = { ...this.state, ...next };
    this.triggerUpdate();
  }

  public findBubbleAtPoint(px: number, py: number): WhalePrint | null {
    if (!this.state.visible) {
      return null;
    }
    // Iterate reverse (topmost/latest rendered first)
    for (let i = this.renderedBubbles.length - 1; i >= 0; i -= 1) {
      const b = this.renderedBubbles[i]!;
      const dx = px - b.x;
      const dy = py - b.y;
      const hitRadius = b.r + 4;
      if (dx * dx + dy * dy <= hitRadius * hitRadius) {
        return b.whale;
      }
    }
    return null;
  }

  protected drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
  ): void {
    this.renderedBubbles = [];
    if (!this.state.visible || !this.chart || !this.series) {
      return;
    }

    const { whales, timeframe, minWhaleUsd, palette } = this.state;
    const timeScale = this.chart.timeScale();

    ctx.save();
    for (let i = 0; i < whales.length; i += 1) {
      const whale = whales[i]!;
      if (whale.notional_usd < minWhaleUsd) {
        continue;
      }

      const barTime = snapTimestampToBar(whale.ts_ms, timeframe);
      const x = timeScale.timeToCoordinate(barTime);
      const y = this.series.priceToCoordinate(whale.price);
      if (x === null || y === null) {
        continue;
      }

      const r = computeWhaleRadius(whale.notional_usd);
      if (x + r < 0 || x - r > mediaWidth || y + r < 0 || y - r > mediaHeight) {
        continue;
      }

      const color = whale.side === "buy" ? palette.bull : palette.bear;

      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fillStyle = withAlpha(color, 0.32);
      ctx.fill();

      ctx.lineWidth = 1;
      ctx.strokeStyle = withAlpha(color, 0.88);
      if (whale.venue === "bybit") {
        ctx.setLineDash([2, 2]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();

      if (r >= 14) {
        ctx.setLineDash([]);
        ctx.font = "600 9px 'JetBrains Mono', monospace";
        ctx.fillStyle = palette.textPrimary;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(whale.venue === "binance" ? "B" : "Y", x, y + 0.5);
      }

      this.renderedBubbles.push({ x, y, r, whale });
    }
    ctx.restore();
  }
}
