import type {
  LiquidationBand,
  LiquidationSideLiteral,
  RealizedLiquidation,
  TimeframeLiteral,
} from "../types/terminal";
import { withAlpha } from "../utils/colorAlpha";
import type { ThemePalette } from "../utils/themeTokens";
import { snapTimestampToBar } from "../utils/timeSnap";
import { BaseOverlayPrimitive } from "./BaseOverlayPrimitive";

export const THERMAL_STRIP_WIDTH_PX = 16;
export const THERMAL_STEP_PX = 2;
export const THERMAL_SIGMA_PX = 14;
export const MAX_PEAK_PROJECTIONS = 4;

export interface LiquidationPrimitiveState {
  predictedBands: readonly LiquidationBand[];
  realizedLiquidations: readonly RealizedLiquidation[];
  timeframe: TimeframeLiteral;
  visible: boolean;
  palette: ThemePalette;
}

export interface MappedLiquidationBand {
  y: number;
  band: LiquidationBand;
}

export interface ThermalDensityRow {
  y: number;
  side: LiquidationSideLiteral;
  density: number;
}

/**
 * Scale horizontal projection length from the left thermal bar proportionally
 * to liquidation intensity so heavier liquidation levels reach deeper into the chart.
 */
export function computeProjectionLengthPx(
  intensity: number,
  availableWidthPx: number,
): number {
  if (availableWidthPx <= 0) {
    return 0;
  }
  const clamped = Math.min(1, Math.max(0, intensity));
  const minRatio = 0.14;
  const maxRatio = 0.72;
  const ratio = minRatio + (maxRatio - minRatio) * Math.pow(clamped, 1.15);
  return Math.round(availableWidthPx * ratio);
}

/**
 * Compute continuous kernel-smoothed vertical liquidation density rows across [0, heightPx]
 * for the 16px left-docked thermal strip.
 */
export function computeThermalDensityRows(
  mappedBands: readonly MappedLiquidationBand[],
  heightPx: number,
  stepPx: number = THERMAL_STEP_PX,
  sigmaPx: number = THERMAL_SIGMA_PX,
): ThermalDensityRow[] {
  if (mappedBands.length === 0 || heightPx <= 0 || stepPx <= 0) {
    return [];
  }

  const rowCount = Math.ceil(heightPx / stepPx);
  const longDensities = new Float64Array(rowCount);
  const shortDensities = new Float64Array(rowCount);
  const invTwoSigmaSq = 1 / (2 * sigmaPx * sigmaPx);
  const cutoffPx = sigmaPx * 3.2;

  for (let b = 0; b < mappedBands.length; b += 1) {
    const { y: yBand, band } = mappedBands[b]!;
    if (band.intensity <= 0) {
      continue;
    }
    const startRow = Math.max(0, Math.floor((yBand - cutoffPx) / stepPx));
    const endRow = Math.min(
      rowCount - 1,
      Math.ceil((yBand + cutoffPx) / stepPx),
    );
    const target = band.side === "long_liq" ? longDensities : shortDensities;

    for (let r = startRow; r <= endRow; r += 1) {
      const yCenter = r * stepPx + stepPx * 0.5;
      const dy = yCenter - yBand;
      target[r]! += band.intensity * Math.exp(-(dy * dy) * invTwoSigmaSq);
    }
  }

  let maxDensity = 0;
  for (let r = 0; r < rowCount; r += 1) {
    const dominant = Math.max(longDensities[r]!, shortDensities[r]!);
    if (dominant > maxDensity) {
      maxDensity = dominant;
    }
  }

  if (maxDensity <= 0) {
    return [];
  }

  const normalizer = Math.max(maxDensity, 0.2);
  const rows: ThermalDensityRow[] = [];
  for (let r = 0; r < rowCount; r += 1) {
    const longVal = longDensities[r]!;
    const shortVal = shortDensities[r]!;
    const dominant = Math.max(longVal, shortVal);
    if (dominant <= 0.01) {
      continue;
    }
    rows.push({
      y: r * stepPx,
      side: longVal >= shortVal ? "long_liq" : "short_liq",
      density: Math.min(1, dominant / normalizer),
    });
  }
  return rows;
}

/**
 * Pick only the top 3-4 highest-intensity liquidation pockets for horizontal
 * heat projections onto candlesticks.
 */
export function selectTopPeakBands(
  mappedBands: readonly MappedLiquidationBand[],
  maxPeaks: number = MAX_PEAK_PROJECTIONS,
): MappedLiquidationBand[] {
  if (mappedBands.length === 0 || maxPeaks <= 0) {
    return [];
  }
  return [...mappedBands]
    .sort((a, b) => b.band.intensity - a.band.intensity)
    .slice(0, maxPeaks);
}

export class LiquidationPrimitive extends BaseOverlayPrimitive {
  private state: LiquidationPrimitiveState;

  constructor(initialState: LiquidationPrimitiveState) {
    super("bottom");
    this.state = initialState;
  }

  public updateState(next: Partial<LiquidationPrimitiveState>): void {
    this.state = { ...this.state, ...next };
    this.triggerUpdate();
  }

  private drawThermalStrip(
    ctx: CanvasRenderingContext2D,
    mappedBands: readonly MappedLiquidationBand[],
    mediaHeight: number,
    palette: ThemePalette,
  ): void {
    ctx.fillStyle = withAlpha(palette.bgSurface, 0.9);
    ctx.fillRect(0, 0, THERMAL_STRIP_WIDTH_PX, mediaHeight);

    const rows = computeThermalDensityRows(mappedBands, mediaHeight);
    for (let i = 0; i < rows.length; i += 1) {
      const row = rows[i]!;
      const color = row.side === "long_liq" ? palette.bear : palette.bull;
      const contrasted = Math.pow(row.density, 1.35);
      ctx.fillStyle = withAlpha(color, 0.06 + contrasted * 0.9);
      ctx.fillRect(0, row.y, THERMAL_STRIP_WIDTH_PX - 1, THERMAL_STEP_PX);
    }

    const dividerX = THERMAL_STRIP_WIDTH_PX - 0.5;
    ctx.strokeStyle = palette.borderHairline;
    ctx.lineWidth = 1;
    ctx.setLineDash([]);
    ctx.beginPath();
    ctx.moveTo(dividerX, 0);
    ctx.lineTo(dividerX, mediaHeight);
    ctx.stroke();
  }

  private drawPeakProjections(
    ctx: CanvasRenderingContext2D,
    peaks: readonly MappedLiquidationBand[],
    mediaWidth: number,
    palette: ThemePalette,
  ): void {
    const stripRightX = THERMAL_STRIP_WIDTH_PX;
    const availableWidth = mediaWidth - stripRightX;
    if (peaks.length === 0 || availableWidth <= 12) {
      return;
    }

    for (let i = 0; i < peaks.length; i += 1) {
      const { y, band } = peaks[i]!;
      const color = band.side === "long_liq" ? palette.bear : palette.bull;
      const clampedIntensity = Math.min(1, Math.max(0.15, band.intensity));
      const strength = Math.pow(clampedIntensity, 1.15);
      const projWidth = computeProjectionLengthPx(
        clampedIntensity,
        availableWidth,
      );
      if (projWidth <= 4) {
        continue;
      }

      const projEndX = stripRightX + projWidth;
      const bandHeight = Math.max(
        5,
        Math.min(12, Math.round(5 + clampedIntensity * 7)),
      );

      // Canvas 2D gradient expanding rightward from the left thermal bar
      const grad = ctx.createLinearGradient(stripRightX, 0, projEndX, 0);
      grad.addColorStop(0, withAlpha(color, Math.min(0.68, 0.12 + 0.48 * strength)));
      grad.addColorStop(0.35, withAlpha(color, 0.28 * strength));
      grad.addColorStop(0.75, withAlpha(color, 0.1 * strength));
      grad.addColorStop(1, withAlpha(color, 0));

      ctx.fillStyle = grad;
      ctx.fillRect(stripRightX, y - bandHeight * 0.5, projWidth, bandHeight);

      // High-intensity core spine for heavy liquidation levels
      if (clampedIntensity >= 0.45) {
        const coreGrad = ctx.createLinearGradient(stripRightX, 0, projEndX, 0);
        coreGrad.addColorStop(0, withAlpha(color, Math.min(0.88, 0.65 * strength)));
        coreGrad.addColorStop(0.55, withAlpha(color, 0.24 * strength));
        coreGrad.addColorStop(1, withAlpha(color, 0));
        ctx.fillStyle = coreGrad;
        ctx.fillRect(stripRightX, y - 1, projWidth * 0.85, 2);
      }
    }
  }

  private drawRealizedMarkers(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
    palette: ThemePalette,
  ): void {
    if (!this.chart || !this.series) {
      return;
    }
    const { realizedLiquidations, timeframe } = this.state;
    const timeScale = this.chart.timeScale();

    ctx.lineWidth = 1.25;
    ctx.setLineDash([]);

    for (let i = 0; i < realizedLiquidations.length; i += 1) {
      const liq = realizedLiquidations[i]!;
      const barTime = snapTimestampToBar(liq.ts_ms, timeframe);
      const x = timeScale.timeToCoordinate(barTime);
      const y = this.series.priceToCoordinate(liq.price);
      if (x === null || y === null) {
        continue;
      }

      const size = Math.min(
        12,
        Math.max(
          6,
          6 + 6 * Math.sqrt(Math.max(0, liq.notional_usd - 25_000) / 1_000_000),
        ),
      );
      const r = size * 0.5;
      if (
        x + r < THERMAL_STRIP_WIDTH_PX ||
        x - r > mediaWidth ||
        y + r < 0 ||
        y - r > mediaHeight
      ) {
        continue;
      }

      const color = liq.side === "long_liq" ? palette.bear : palette.bull;
      ctx.strokeStyle = color;

      // Hollow diamond + inner x marker (distinct from circular Whale Bubbles)
      ctx.beginPath();
      ctx.moveTo(x, y - r);
      ctx.lineTo(x + r, y);
      ctx.lineTo(x, y + r);
      ctx.lineTo(x - r, y);
      ctx.closePath();
      ctx.stroke();

      const inner = r * 0.45;
      ctx.beginPath();
      ctx.moveTo(x - inner, y - inner);
      ctx.lineTo(x + inner, y + inner);
      ctx.moveTo(x + inner, y - inner);
      ctx.lineTo(x - inner, y + inner);
      ctx.stroke();
    }
  }

  protected drawOverlay(
    ctx: CanvasRenderingContext2D,
    mediaWidth: number,
    mediaHeight: number,
  ): void {
    if (!this.state.visible || !this.chart || !this.series) {
      return;
    }

    const { predictedBands, palette } = this.state;

    const mappedBands: MappedLiquidationBand[] = [];
    const visiblePeakCandidates: MappedLiquidationBand[] = [];
    for (let i = 0; i < predictedBands.length; i += 1) {
      const band = predictedBands[i]!;
      const y = this.series.priceToCoordinate(band.price);
      if (y === null) {
        continue;
      }
      const mapped = { y, band };
      mappedBands.push(mapped);
      if (y >= -16 && y <= mediaHeight + 16) {
        visiblePeakCandidates.push(mapped);
      }
    }

    ctx.save();
    this.drawThermalStrip(ctx, mappedBands, mediaHeight, palette);
    const topPeaks = selectTopPeakBands(
      visiblePeakCandidates,
      MAX_PEAK_PROJECTIONS,
    );
    this.drawPeakProjections(ctx, topPeaks, mediaWidth, palette);
    this.drawRealizedMarkers(ctx, mediaWidth, mediaHeight, palette);
    ctx.restore();
  }
}
