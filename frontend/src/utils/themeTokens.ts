import type { ThemeId } from "../types/terminal";

export const THEME_STORAGE_KEY = "btc-terminal-theme";

export interface ThemeMeta {
  id: ThemeId;
  label: string;
  shortLabel: string;
}

export const THEMES: readonly ThemeMeta[] = [
  { id: "oled-dark", label: "OLED Dark", shortLabel: "OLED" },
  { id: "midnight-navy", label: "Midnight Navy", shortLabel: "NAVY" },
  { id: "warm-off-white", label: "Warm Paper", shortLabel: "WARM" },
  { id: "pure-white", label: "Pure White", shortLabel: "LITE" },
] as const;

export interface ThemePalette {
  bgCanvas: string;
  bgSurface: string;
  borderHairline: string;
  textPrimary: string;
  textMuted: string;
  bull: string;
  bear: string;
  neutral: string;
  gridLine: string;
}

const VALID_THEMES = new Set<ThemeId>([
  "oled-dark",
  "midnight-navy",
  "warm-off-white",
  "pure-white",
]);

export function isThemeId(value: string | null): value is ThemeId {
  return value !== null && VALID_THEMES.has(value as ThemeId);
}

export function getStoredTheme(): ThemeId {
  if (typeof window === "undefined") {
    return "oled-dark";
  }
  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemeId(raw) ? raw : "oled-dark";
  } catch {
    return "oled-dark";
  }
}

export function applyTheme(theme: ThemeId): void {
  if (typeof document !== "undefined") {
    document.documentElement.setAttribute("data-theme", theme);
  }
  if (typeof window !== "undefined") {
    try {
      window.localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Storage may be unavailable in restricted contexts.
    }
  }
}

export function readThemeTokens(): ThemePalette {
  if (typeof document === "undefined" || typeof getComputedStyle !== "function") {
    return {
      bgCanvas: "#09090B",
      bgSurface: "#111114",
      borderHairline: "#222227",
      textPrimary: "#EDEDEF",
      textMuted: "#8A8A93",
      bull: "#2DD4BF",
      bear: "#F43F5E",
      neutral: "#A1A1AA",
      gridLine: "rgba(34, 34, 39, 0.45)",
    };
  }
  const s = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string): string =>
    s.getPropertyValue(name).trim() || fallback;

  return {
    bgCanvas: pick("--bg-canvas", "#09090B"),
    bgSurface: pick("--bg-surface", "#111114"),
    borderHairline: pick("--border-hairline", "#222227"),
    textPrimary: pick("--text-primary", "#EDEDEF"),
    textMuted: pick("--text-muted", "#8A8A93"),
    bull: pick("--accent-bull", "#2DD4BF"),
    bear: pick("--accent-bear", "#F43F5E"),
    neutral: pick("--accent-neutral", "#A1A1AA"),
    gridLine: pick("--grid-line", "rgba(34, 34, 39, 0.45)"),
  };
}
