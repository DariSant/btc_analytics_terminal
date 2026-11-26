// @vitest-environment node
import { readdirSync, readFileSync, statSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const SRC_ROOT = fileURLToPath(new URL("..", import.meta.url));

function collectSourceFiles(dir: string): string[] {
  const results: string[] = [];
  for (const entry of readdirSync(dir)) {
    const fullPath = join(dir, entry);
    if (statSync(fullPath).isDirectory()) {
      results.push(...collectSourceFiles(fullPath));
      continue;
    }
    const ext = extname(entry);
    if (
      (ext === ".css" || ext === ".ts" || ext === ".tsx") &&
      !entry.endsWith(".d.ts") &&
      !fullPath.endsWith("antiSlopAudit.test.ts")
    ) {
      results.push(fullPath);
    }
  }
  return results;
}

const BANNED_STYLE_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  { label: "backdrop-filter", regex: /backdrop-filter/i },
  { label: "backdrop-blur", regex: /backdrop-blur/i },
  { label: "CSS linear-gradient", regex: /(?<![a-zA-Z0-9_])linear-gradient\s*\(/i },
  { label: "CSS radial-gradient", regex: /(?<![a-zA-Z0-9_])radial-gradient\s*\(/i },
  { label: "CSS conic-gradient", regex: /(?<![a-zA-Z0-9_])conic-gradient\s*\(/i },
  { label: "Tailwind bg-gradient-*", regex: /\bbg-gradient-/ },
  { label: "drop-shadow", regex: /drop-shadow/i },
  { label: "text-shadow", regex: /text-shadow/i },
  { label: "box-shadow (non-none)", regex: /box-shadow\s*:\s*(?!none\b)/i },
  { label: "Tailwind shadow-sm/md/lg/xl/2xl", regex: /\bshadow-(?:sm|md|lg|xl|2xl)\b/ },
  { label: "Tailwind rounded-lg/xl/2xl/3xl", regex: /\brounded-(?:lg|xl|2xl|3xl)\b/ },
];

const FORBIDDEN_LWC_V4_PATTERNS: ReadonlyArray<{ label: string; regex: RegExp }> = [
  { label: "addCandlestickSeries", regex: /\baddCandlestickSeries\b/ },
  { label: "addHistogramSeries", regex: /\baddHistogramSeries\b/ },
  { label: "addLineSeries", regex: /\baddLineSeries\b/ },
  { label: "series.setMarkers", regex: /\.setMarkers\s*\(/ },
];

const EXPECTED_THEME_PALETTES: ReadonlyArray<{
  name: string;
  tokens: Record<string, string>;
}> = [
  {
    name: "oled-dark",
    tokens: {
      "--bg-canvas": "#09090B",
      "--bg-surface": "#111114",
      "--border-hairline": "#222227",
      "--text-primary": "#EDEDEF",
      "--text-muted": "#8A8A93",
      "--accent-bull": "#2DD4BF",
      "--accent-bear": "#F43F5E",
      "--accent-neutral": "#A1A1AA",
    },
  },
  {
    name: "midnight-navy",
    tokens: {
      "--bg-canvas": "#0B1221",
      "--bg-surface": "#111B2E",
      "--border-hairline": "#1E2D4A",
      "--text-primary": "#E2E8F0",
      "--text-muted": "#8B9BB4",
      "--accent-bull": "#34D399",
      "--accent-bear": "#FB7185",
      "--accent-neutral": "#94A3B8",
    },
  },
  {
    name: "warm-off-white",
    tokens: {
      "--bg-canvas": "#F7F6F2",
      "--bg-surface": "#EFECE6",
      "--border-hairline": "#DDD8CE",
      "--text-primary": "#1C1B18",
      "--text-muted": "#6B665E",
      "--accent-bull": "#0F766E",
      "--accent-bear": "#BE123C",
      "--accent-neutral": "#57534E",
    },
  },
  {
    name: "pure-white",
    tokens: {
      "--bg-canvas": "#FFFFFF",
      "--bg-surface": "#F8F9FA",
      "--border-hairline": "#E5E7EB",
      "--text-primary": "#111827",
      "--text-muted": "#6B7280",
      "--accent-bull": "#059669",
      "--accent-bear": "#DC2626",
      "--accent-neutral": "#4B5563",
    },
  },
];

describe("Institutional Anti-Slop Design & LWC v5 Audit", () => {
  const files = collectSourceFiles(SRC_ROOT);

  it("scans all frontend source files including tokens.css", () => {
    expect(files.length).toBeGreaterThanOrEqual(15);
    expect(files.some((f) => f.replace(/\\/g, "/").endsWith("styles/tokens.css"))).toBe(true);
  });

  it("contains zero banned glassmorphism, CSS gradient, shadow, or pill tokens", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const { label, regex } of BANNED_STYLE_PATTERNS) {
        if (regex.test(content)) {
          violations.push(`${relative(SRC_ROOT, file)}: matched ${label}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("contains zero deprecated Lightweight Charts v4 API calls", () => {
    const violations: string[] = [];
    for (const file of files) {
      const content = readFileSync(file, "utf8");
      for (const { label, regex } of FORBIDDEN_LWC_V4_PATTERNS) {
        if (regex.test(content)) {
          violations.push(`${relative(SRC_ROOT, file)}: matched ${label}`);
        }
      }
    }
    expect(violations).toEqual([]);
  });

  it("locks all 4 theme hex palettes, tabular-nums, and 40px/260px shell geometry in tokens.css", () => {
    const tokensCss = readFileSync(join(SRC_ROOT, "styles", "tokens.css"), "utf8");
    expect(tokensCss.length).toBeGreaterThan(0);

    for (const { name, tokens } of EXPECTED_THEME_PALETTES) {
      const blockMatch = tokensCss.match(
        new RegExp(`html\\[data-theme="${name}"\\]\\s*\\{([\\s\\S]*?)\\}`),
      );
      expect(blockMatch, `Missing theme block for ${name}`).not.toBeNull();
      const blockBody = blockMatch?.[1] ?? "";
      for (const [cssVar, hex] of Object.entries(tokens)) {
        expect(blockBody, `Missing ${cssVar}: ${hex} in ${name}`).toContain(`${cssVar}: ${hex};`);
      }
    }

    expect(tokensCss).toContain(".font-mono-tabular");
    expect(tokensCss).toContain("font-variant-numeric: tabular-nums;");
    expect(tokensCss).toContain("height: 40px;");
    expect(tokensCss).toContain("height: calc(100vh - 40px);");
    expect(tokensCss).toContain("width: 260px;");

    const topBar = readFileSync(join(SRC_ROOT, "components", "TopTelemetryBar.tsx"), "utf8");
    const controlDrawer = readFileSync(join(SRC_ROOT, "components", "ControlDrawer.tsx"), "utf8");
    expect(topBar).toContain("font-mono-tabular");
    expect(controlDrawer).toContain("font-mono-tabular");
  });
});
