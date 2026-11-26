import type { CandleBar } from "../types/terminal";

export const VRVP_DEFAULT_BINS = 80;
const VALUE_AREA_TARGET_RATIO = 0.7;

export interface VrvpBin {
  index: number;
  low: number;
  high: number;
  mid: number;
  buyUsd: number;
  sellUsd: number;
  totalUsd: number;
  inValueArea: boolean;
}

export interface VrvpProfile {
  bins: VrvpBin[];
  minPrice: number;
  maxPrice: number;
  binSize: number;
  pocIndex: number;
  pocPrice: number;
  vahPrice: number;
  valPrice: number;
  maxBinTotalUsd: number;
  totalVisibleUsd: number;
}

/**
 * Compute an 80-bin Visible Range Volume Profile (VRVP) with Point of Control (POC)
 * and greedy 70% Value Area (VAL..VAH) over the supplied visible candle bars.
 */
export function computeVrvp(
  candles: readonly CandleBar[],
  numBins: number = VRVP_DEFAULT_BINS,
): VrvpProfile | null {
  if (candles.length === 0 || numBins <= 0) {
    return null;
  }

  let minPrice = Infinity;
  let maxPrice = -Infinity;
  for (let i = 0; i < candles.length; i += 1) {
    const bar = candles[i]!;
    if (bar.low < minPrice) minPrice = bar.low;
    if (bar.high > maxPrice) maxPrice = bar.high;
  }

  if (!Number.isFinite(minPrice) || !Number.isFinite(maxPrice)) {
    return null;
  }

  const rawSpan = maxPrice - minPrice;
  const effectiveSpan = rawSpan > 0 ? rawSpan : Math.max(Math.abs(minPrice) * 1e-4, 1);
  const effectiveMax = rawSpan > 0 ? maxPrice : minPrice + effectiveSpan;
  const binSize = effectiveSpan / numBins;

  const buyUsdByBin = new Float64Array(numBins);
  const sellUsdByBin = new Float64Array(numBins);
  let totalVisibleUsd = 0;

  for (let i = 0; i < candles.length; i += 1) {
    const bar = candles[i]!;
    const buyUsd = Math.max(0, bar.taker_buy_usd);
    const sellUsd = Math.max(0, bar.quote_usd - buyUsd);
    const barTotal = buyUsd + sellUsd;
    if (barTotal <= 0) {
      continue;
    }
    totalVisibleUsd += barTotal;

    const barSpan = bar.high - bar.low;
    if (barSpan <= 0) {
      const idx = Math.min(
        numBins - 1,
        Math.max(0, Math.floor((bar.low - minPrice) / binSize)),
      );
      buyUsdByBin[idx]! += buyUsd;
      sellUsdByBin[idx]! += sellUsd;
      continue;
    }

    const startIdx = Math.min(
      numBins - 1,
      Math.max(0, Math.floor((bar.low - minPrice) / binSize)),
    );
    const endIdx = Math.min(
      numBins - 1,
      Math.max(startIdx, Math.floor((bar.high - minPrice) / binSize)),
    );

    if (startIdx === endIdx) {
      buyUsdByBin[startIdx]! += buyUsd;
      sellUsdByBin[startIdx]! += sellUsd;
      continue;
    }

    for (let m = startIdx; m <= endIdx; m += 1) {
      const binLow = minPrice + m * binSize;
      const binHigh = m === numBins - 1 ? effectiveMax : binLow + binSize;
      const overlap = Math.min(bar.high, binHigh) - Math.max(bar.low, binLow);
      if (overlap > 0) {
        const weight = overlap / barSpan;
        buyUsdByBin[m]! += buyUsd * weight;
        sellUsdByBin[m]! += sellUsd * weight;
      }
    }
  }

  if (totalVisibleUsd <= 0) {
    return null;
  }

  const bins: VrvpBin[] = new Array<VrvpBin>(numBins);
  let pocIndex = 0;
  let maxBinTotalUsd = -1;

  for (let m = 0; m < numBins; m += 1) {
    const low = minPrice + m * binSize;
    const high = m === numBins - 1 ? effectiveMax : low + binSize;
    const buyUsd = buyUsdByBin[m]!;
    const sellUsd = sellUsdByBin[m]!;
    const totalUsd = buyUsd + sellUsd;
    if (totalUsd > maxBinTotalUsd) {
      maxBinTotalUsd = totalUsd;
      pocIndex = m;
    }
    bins[m] = {
      index: m,
      low,
      high,
      mid: (low + high) * 0.5,
      buyUsd,
      sellUsd,
      totalUsd,
      inValueArea: false,
    };
  }

  let lowIdx = pocIndex;
  let highIdx = pocIndex;
  let accumulated = bins[pocIndex]!.totalUsd;
  const targetUsd = totalVisibleUsd * VALUE_AREA_TARGET_RATIO;

  while (accumulated < targetUsd && (lowIdx > 0 || highIdx < numBins - 1)) {
    const downVol = lowIdx > 0 ? bins[lowIdx - 1]!.totalUsd : -1;
    const upVol = highIdx < numBins - 1 ? bins[highIdx + 1]!.totalUsd : -1;

    if (upVol >= downVol && highIdx < numBins - 1) {
      highIdx += 1;
      accumulated += bins[highIdx]!.totalUsd;
    } else if (lowIdx > 0) {
      lowIdx -= 1;
      accumulated += bins[lowIdx]!.totalUsd;
    }
  }

  for (let m = lowIdx; m <= highIdx; m += 1) {
    bins[m]!.inValueArea = true;
  }

  return {
    bins,
    minPrice,
    maxPrice: effectiveMax,
    binSize,
    pocIndex,
    pocPrice: bins[pocIndex]!.mid,
    valPrice: minPrice + lowIdx * binSize,
    vahPrice: minPrice + (highIdx + 1) * binSize,
    maxBinTotalUsd,
    totalVisibleUsd,
  };
}
