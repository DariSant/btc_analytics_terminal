import type { OptionsSurfaceSummary } from "../types/terminal";
import { withAlpha } from "../utils/colorAlpha";
import { formatBtcSize, formatStrike } from "../utils/formatters";
import type { ThemePalette } from "../utils/themeTokens";
import { BaseOverlayPrimitive } from "./BaseOverlayPrimitive";

export interface OptionsWallsState {
  summary: OptionsSurfaceSummary | null;
  showWalls: boolean;
  showMaxPain: boolean;
  leftReservePx: number;
  rightReservePx: number;
  palette: ThemePalette;
}

export class OptionsWallsPrimitive extends BaseOverlayPrimitive {
  private state: OptionsWallsState;

  constructor(initialState: OptionsWallsState) {
    super("top");
    this.state = initialState;
  }

  public updateState(next: Partial<OptionsWallsState>): void {
    this.state = { ...this.state, ...next };
    this.triggerUpdate();
  }

  private drawStrikeLineAndTag(
    ctx: CanvasRenderingContext2D,
    price: number,
    label: string,
    color: string,
    dashed: number[],
    mediaWidth: number,
    mediaHeight: number,
    leftReservePx: number,
    rightReservePx: number,
    palette: ThemePalette,
  ): void {
    if (!this.series || !Number.isFinite(price) || price <= 0) {
      return;
    }
    const y = this.series.priceToCoordinate(price);
    if (y === null || y < 0 || y > mediaHeight) {
      return;
    }

    const cy = this.crispY(y);
    const lineRightX = Math.max(40, mediaWidth - rightReservePx);

    ctx.strokeStyle = color;
    ctx.lineWidth = 1;
    ctx.setLineDash(dashed);
    ctx.beginPath();
    ctx.moveTo(leftReservePx, cy);
    ctx.lineTo(lineRightX, cy);
    ctx.stroke();

    ctx.setLineDash([]);
    ctx.font = "500 9px 'JetBrains Mono', monospace";
    const padX = 5;
    const boxH = 15;
    const textWidth = ctx.measureText(label).width;
    const boxW = textWidth + padX * 2;
    const boxX = Math.max(leftReservePx + 4, lineRightX - boxW - 4);
    const boxY = Math.round(cy - boxH * 0.5);

    ctx.fillStyle = palette.bgSurface;
    ctx.fillRect(boxX, boxY, boxW, boxH);
    ctx.strokeStyle = color;
    ctx.strokeRect(boxX + 0.5, boxY + 0.5, boxW - 1, boxH - 1);

    ctx.fillStyle = color;
    ctx.textAlign = "left";
    ctx.textBaseline = "middle";
    ctx.fillText(label, boxX + padX, boxY + boxH * 0.5 + 0.5);
  }

  private drawLeftGexMicroBars(
    ctx: CanvasRenderingContext2D,
    summary: OptionsSurfaceSummary,
    mediaHeight: number,
    leftReservePx: number,
    palette: ThemePalette,
  ): void {
    if (!this.series || summary.top_gex_strikes.length === 0) {
      return;
    }
    const top5 = summary.top_gex_strikes.slice(0, 5);
    let maxAbsGex = 0;
    for (let i = 0; i < top5.length; i += 1) {
      const absGex = Math.abs(top5[i]!.net_gex_usd);
      if (absGex > maxAbsGex) {
        maxAbsGex = absGex;
      }
    }
    if (maxAbsGex <= 0) {
      return;
    }

    for (let i = 0; i < top5.length; i += 1) {
      const item = top5[i]!;
      const y = this.series.priceToCoordinate(item.strike);
      if (y === null || y < 0 || y > mediaHeight) {
        continue;
      }
      const barWidth = Math.max(
        4,
        (Math.abs(item.net_gex_usd) / maxAbsGex) * 36,
      );
      const color = item.net_gex_usd >= 0 ? palette.bull : palette.bear;
      ctx.fillStyle = withAlpha(color, 0.72);
      ctx.fillRect(leftReservePx, Math.round(y - 1.5), barWidth, 3);
    }
  }

  protected drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
  ): void {
    const {
      summary,
      showWalls,
      showMaxPain,
      leftReservePx,
      rightReservePx,
      palette,
    } = this.state;
    if (!summary || (!showWalls && !showMaxPain) || !this.series) {
      return;
    }

    ctx.save();

    if (showWalls) {
      this.drawLeftGexMicroBars(ctx, summary, mediaHeight, leftReservePx, palette);

      const callLabel = `CALL WALL ${formatStrike(summary.call_wall)} | OI: ${formatBtcSize(summary.call_wall_oi)} | +GEX`;
      this.drawStrikeLineAndTag(
        ctx,
        summary.call_wall,
        callLabel,
        palette.bear,
        [],
        mediaWidth,
        mediaHeight,
        leftReservePx,
        rightReservePx,
        palette,
      );

      const putLabel = `PUT WALL ${formatStrike(summary.put_wall)} | OI: ${formatBtcSize(summary.put_wall_oi)} | -GEX`;
      this.drawStrikeLineAndTag(
        ctx,
        summary.put_wall,
        putLabel,
        palette.bull,
        [],
        mediaWidth,
        mediaHeight,
        leftReservePx,
        rightReservePx,
        palette,
      );
    }

    if (showMaxPain) {
      const maxPainLabel = `MAX PAIN ${formatStrike(summary.max_pain)}`;
      this.drawStrikeLineAndTag(
        ctx,
        summary.max_pain,
        maxPainLabel,
        palette.neutral,
        [2, 3],
        mediaWidth,
        mediaHeight,
        leftReservePx,
        rightReservePx,
        palette,
      );
    }

    ctx.restore();
  }
}
