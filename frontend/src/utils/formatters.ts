const priceFormatter = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const integerFormatter = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 0,
});

export function formatPrice(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "--";
  }
  return `$${priceFormatter.format(value)}`;
}

export function formatStrike(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value) || value <= 0) {
    return "--";
  }
  return `$${integerFormatter.format(Math.round(value))}`;
}

export function formatCompactUsd(
  value: number | null | undefined,
  options: { signed?: boolean } = {},
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  const abs = Math.abs(value);
  const sign = options.signed
    ? value > 0
      ? "+"
      : value < 0
        ? "-"
        : ""
    : value < 0
      ? "-"
      : "";

  if (abs >= 1e9) {
    return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  }
  if (abs >= 1e6) {
    return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  }
  if (abs >= 1e3) {
    return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

export function formatPct(
  value: number | null | undefined,
  signed: boolean = true,
): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  const sign = signed && value > 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}%`;
}

export function formatFundingRate(rate: number | null | undefined): string {
  if (rate === null || rate === undefined || !Number.isFinite(rate)) {
    return "--";
  }
  const pct = rate * 100;
  const sign = pct > 0 ? "+" : "";
  return `${sign}${pct.toFixed(4)}%`;
}

export function formatCountdown(
  targetMs: number | null | undefined,
  nowMs: number = Date.now(),
): string {
  if (targetMs === null || targetMs === undefined || !Number.isFinite(targetMs) || targetMs <= 0) {
    return "--:--:--";
  }
  const remainingSec = Math.max(0, Math.floor((targetMs - nowMs) / 1000));
  const hours = Math.floor(remainingSec / 3600);
  const minutes = Math.floor((remainingSec % 3600) / 60);
  const seconds = remainingSec % 60;
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
}

export function formatBtcSize(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  if (Math.abs(value) >= 100) {
    return `${integerFormatter.format(Math.round(value))} BTC`;
  }
  return `${value.toFixed(2)} BTC`;
}

export function formatRatio(value: number | null | undefined): string {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "--";
  }
  return value.toFixed(2);
}

export function formatUtcTime(tsMs: number): string {
  const d = new Date(tsMs);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} UTC`;
}
