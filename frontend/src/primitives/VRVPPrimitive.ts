import type { LogicalRange, SeriesAttachedParameter, Time } from "lightweight-charts";
import type { CandleBar } from "../types/terminal";
import { withAlpha } from "../utils/colorAlpha";
import type { ThemePalette } from "../utils/themeTokens";
import { computeVrvp, VRVP_DEFAULT_BINS, type VrvpProfile } from "../utils/vrvpCalc";
import { BaseOverlayPrimitive } from "./BaseOverlayPrimitive";

export interface VrvpPrimitiveState {
  candles: readonly CandleBar[];
  visible: boolean;
  rightReservePx: number;
  palette: ThemePalette;
}

export class VRVPPrimitive extends BaseOverlayPrimitive {
  private state: VrvpPrimitiveState;
  private cachedProfile: VrvpProfile | null = null;
  private dirtyProfile = true;
  private rafPending = false;
  private rafId: number | null = null;

  constructor(initialState: VrvpPrimitiveState) {
    super("bottom");
    this.state = initialState;
  }

  public updateState(next: Partial<VrvpPrimitiveState>): void {
    const candlesChanged =
      next.candles !== undefined && next.candles !== this.state.candles;
    this.state = { ...this.state, ...next };
    if (candlesChanged || (next.visible === true && !this.cachedProfile)) {
      this.dirtyProfile = true;
    }
    this.triggerUpdate();
  }

  private readonly handleVisibleRangeChange = (_range: LogicalRange | null): void => {
    this.dirtyProfile = true;
    if (this.rafPending || typeof requestAnimationFrame !== "function") {
      return;
    }
    this.rafPending = true;
    this.rafId = requestAnimationFrame(() => {
      this.rafPending = false;
      this.rafId = null;
      this.triggerUpdate();
    });
  };

  override attached(param: SeriesAttachedParameter<Time>): void {
    super.attached(param);
    this.chart
      ?.timeScale()
      .subscribeVisibleLogicalRangeChange(this.handleVisibleRangeChange);
  }

  protected override onDetached(): void {
    this.chart
      ?.timeScale()
      .unsubscribeVisibleLogicalRangeChange(this.handleVisibleRangeChange);
    if (this.rafId !== null && typeof cancelAnimationFrame === "function") {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
      this.rafPending = false;
    }
  }

  private ensureProfile(): VrvpProfile | null {
    if (!this.chart || !this.state.visible) {
      return null;
    }
    if (!this.dirtyProfile && this.cachedProfile) {
      return this.cachedProfile;
    }

    const { candles } = this.state;
    if (candles.length === 0) {
      this.cachedProfile = null;
      this.dirtyProfile = false;
      return null;
    }

    const logicalRange = this.chart.timeScale().getVisibleLogicalRange();
    let visibleCandles: readonly CandleBar[];
    if (logicalRange) {
      const startIdx = Math.max(0, Math.floor(logicalRange.from));
      const endIdx = Math.min(candles.length - 1, Math.ceil(logicalRange.to));
      visibleCandles =
        startIdx <= endIdx ? candles.slice(startIdx, endIdx + 1) : [];
    } else {
      visibleCandles = candles;
    }

    this.cachedProfile = computeVrvp(visibleCandles, VRVP_DEFAULT_BINS);
    this.dirtyProfile = false;
    return this.cachedProfile;
  }

  private drawTag(
    ctx: CanvasRenderingContext2D,
    label: string,
    xRight: number,
    y: number,
    textColor: string,
    borderColor: string,
    bgColor: string,
  ): void {
    ctx.font = "500 9px 'JetBrains Mono', monospace";
    const padX = 4;
    const height = 14;
    const textWidth = ctx.measureText(label).width;
    const boxWidth = textWidth + padX * 2;
    const x = Math.max(4, xRight - boxWidth);
    const top = Math.round(y - height * 0.5);

    ctx.fillStyle = bgColor;
    ctx.fillRect(x, top, boxWidth, height);
    ctx.strokeStyle = borderColor;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.strokeRect(x + 0.5, top + 0.5, boxWidth - 1, height - 1);

    ctx.fillStyle = textColor;
    ctx.textBaseline = "middle";
    ctx.fillText(label, x + padX, top + height * 0.5 + 0.5);
  }

  protected drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
  ): void {
    if (!this.state.visible || !this.series || !this.chart) {
      return;
    }
    const profile = this.ensureProfile();
    if (!profile || profile.maxBinTotalUsd <= 0) {
      return;
    }

    const { palette, rightReservePx } = this.state;
    const rightEdgeX = Math.max(40, mediaWidth - rightReservePx);
    const maxBarWidth = Math.min(mediaWidth * 0.18, Math.max(32, rightEdgeX - 16));

    ctx.save();

    for (let i = 0; i < profile.bins.length; i += 1) {
      const bin = profile.bins[i]!;
      if (bin.totalUsd <= 0) {
        continue;
      }
      const yTop = this.series.priceToCoordinate(bin.high);
      const yBottom = this.series.priceToCoordinate(bin.low);
      if (yTop === null || yBottom === null) {
        continue;
      }

      const top = Math.min(yTop, yBottom);
      const bottom = Math.max(yTop, yBottom);
      if (bottom < 0 || top > mediaHeight) {
        continue;
      }

      const barHeight = Math.max(1, bottom - top - 0.5);
      const totalWidth = (bin.totalUsd / profile.maxBinTotalUsd) * maxBarWidth;
      const buyWidth = totalWidth * (bin.buyUsd / bin.totalUsd);
      const sellWidth = Math.max(0, totalWidth - buyWidth);
      const alpha = bin.inValueArea ? 0.34 : 0.16;

      if (sellWidth > 0.25) {
        ctx.fillStyle = withAlpha(palette.bear, alpha);
        ctx.fillRect(rightEdgeX - sellWidth, top, sellWidth, barHeight);
      }
      if (buyWidth > 0.25) {
        ctx.fillStyle = withAlpha(palette.bull, alpha);
        ctx.fillRect(rightEdgeX - totalWidth, top, buyWidth, barHeight);
      }
    }

    // VAH / VAL dashed lines
    const drawVaLine = (price: number, label: string) => {
      const y = this.series?.priceToCoordinate(price) ?? null;
      if (y === null || y < 0 || y > mediaHeight) {
        return;
      }
      const cy = this.crispY(y);
      ctx.strokeStyle = withAlpha(palette.neutral, 0.72);
      ctx.lineWidth = 1;
      ctx.setLineDash([4, 4]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(rightEdgeX, cy);
      ctx.stroke();

      this.drawTag(
        ctx,
        label,
        rightEdgeX - 4,
        cy,
        palette.textMuted,
        withAlpha(palette.neutral, 0.65),
        palette.bgSurface,
      );
    };

    drawVaLine(profile.vahPrice, "VAH");
    drawVaLine(profile.valPrice, "VAL");

    // POC solid ray
    const yPoc = this.series.priceToCoordinate(profile.pocPrice);
    if (yPoc !== null && yPoc >= 0 && yPoc <= mediaHeight) {
      const cy = this.crispY(yPoc);
      ctx.strokeStyle = palette.textPrimary;
      ctx.lineWidth = 1;
      ctx.setLineDash([]);
      ctx.beginPath();
      ctx.moveTo(0, cy);
      ctx.lineTo(rightEdgeX, cy);
      ctx.stroke();

      this.drawTag(
        ctx,
        "POC",
        rightEdgeX - 4,
        cy,
        palette.textPrimary,
        palette.textPrimary,
        palette.bgSurface,
      );
    }

    ctx.restore();
  }
}
