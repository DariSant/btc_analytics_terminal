---
name: anti-slop-ui-tokens
description: Institutional Swiss financial UI design system, 4-theme CSS custom property token matrix, Canvas theme reader, strict 100vh zero-scroll viewport geometry, tabular-nums typography, and banned CSS/Tailwind slop patterns. Use whenever building or auditing frontend styles, components, or Canvas overlays.
---

# Institutional Anti-Slop Design System & Theme Tokens Skill

## 1. Canonical 4-Theme CSS Custom Property Matrix (`tokens.css`)

Copy these exact hex codes verbatim. Switching themes mutates `<html data-theme="...">` and persists to `localStorage` under `"btc-terminal-theme"`.

```css
:root,
html[data-theme="oled-dark"] {
  --bg-canvas: #09090B;
  --bg-surface: #111114;
  --border-hairline: #222227;
  --text-primary: #EDEDEF;
  --text-muted: #8A8A93;
  --accent-bull: #2DD4BF;
  --accent-bear: #F43F5E;
  --accent-neutral: #A1A1AA;
  --grid-line: rgba(34, 34, 39, 0.45);
}

html[data-theme="midnight-navy"] {
  --bg-canvas: #0B1221;
  --bg-surface: #111B2E;
  --border-hairline: #1E2D4A;
  --text-primary: #E2E8F0;
  --text-muted: #8B9BB4;
  --accent-bull: #34D399;
  --accent-bear: #FB7185;
  --accent-neutral: #94A3B8;
  --grid-line: rgba(30, 45, 74, 0.45);
}

html[data-theme="warm-off-white"] {
  --bg-canvas: #F7F6F2;
  --bg-surface: #EFECE6;
  --border-hairline: #DDD8CE;
  --text-primary: #1C1B18;
  --text-muted: #6B665E;
  --accent-bull: #0F766E;
  --accent-bear: #BE123C;
  --accent-neutral: #57534E;
  --grid-line: rgba(221, 216, 206, 0.55);
}

html[data-theme="pure-white"] {
  --bg-canvas: #FFFFFF;
  --bg-surface: #F8F9FA;
  --border-hairline: #E5E7EB;
  --text-primary: #111827;
  --text-muted: #6B7280;
  --accent-bull: #059669;
  --accent-bear: #DC2626;
  --accent-neutral: #4B5563;
  --grid-line: rgba(229, 231, 235, 0.65);
}

html,
body,
#root {
  height: 100vh;
  width: 100vw;
  margin: 0;
  padding: 0;
  overflow: hidden;
  background-color: var(--bg-canvas);
  color: var(--text-primary);
  font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
  -webkit-font-smoothing: antialiased;
}

.font-mono-tabular {
  font-family: 'JetBrains Mono', monospace;
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum" 1, "zero" 1;
}
```

### Canvas Theme Token Bridge (`readThemeTokens`)

HTML5 Canvas `ctx.strokeStyle` / `ctx.fillStyle` cannot parse `var(--accent-bull)` reliably across browsers. Export a typed reader for `UnifiedChart.tsx` and all primitives:

```ts
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

export function readThemeTokens(): ThemePalette {
  const s = getComputedStyle(document.documentElement);
  const pick = (name: string, fallback: string) => s.getPropertyValue(name).trim() || fallback;
  return {
    bgCanvas: pick('--bg-canvas', '#09090B'),
    bgSurface: pick('--bg-surface', '#111114'),
    borderHairline: pick('--border-hairline', '#222227'),
    textPrimary: pick('--text-primary', '#EDEDEF'),
    textMuted: pick('--text-muted', '#8A8A93'),
    bull: pick('--accent-bull', '#2DD4BF'),
    bear: pick('--accent-bear', '#F43F5E'),
    neutral: pick('--accent-neutral', '#A1A1AA'),
    gridLine: pick('--grid-line', 'rgba(34, 34, 39, 0.45)'),
  };
}
```

---

## 2. Locked Viewport Shell Geometry (`100vh` Zero-Scroll)

* **Root Wrapper:** `display: flex; flex-direction: column; height: 100vh; width: 100vw; overflow: hidden;`
* **Top Telemetry Strip (`TopTelemetryBar.tsx`):** Exact `height: 40px; flex-shrink: 0; border-bottom: 1px solid var(--border-hairline); background: var(--bg-surface);`
  * Separate telemetry metrics (`Mark Price`, `Funding + Countdown`, `Aggregated OI`, `Session CVD`, `P/C Ratio & Max Pain`) with crisp `1px` vertical dividers (`width: 1px; height: 20px; background: var(--border-hairline);`).
* **Workspace Row:** `display: flex; flex: 1; height: calc(100vh - 40px); min-height: 0; width: 100vw;`
  * **Unified Chart Host:** `flex: 1; min-width: 0; height: 100%; position: relative;` (`ResizeObserver` calls `chart.resize(entry.contentRect.width, entry.contentRect.height)` immediately when drawer toggles).
  * **Right Control Drawer (`ControlDrawer.tsx`):** When open, exact `width: 260px; flex-shrink: 0; height: 100%; border-left: 1px solid var(--border-hairline); background: var(--bg-surface);`. When collapsed, `display: none` (or `width: 0px; overflow: hidden; border-left: none;`).

---

## 3. Strictly Prohibited "AI Slop" Patterns (Automated Test Gate)

Step 5.2 (`antiSlopAudit.test.ts`) scans every file in `frontend/src/` and fails the build if ANY of these tokens appear:

| Category | Forbidden CSS / Tailwind Tokens | Required Institutional Replacement |
| --- | --- | --- |
| **Glassmorphism** | `backdrop-filter`, `backdrop-blur`, `backdrop-blur-*` | Opaque `--bg-surface` or `--bg-canvas` surfaces |
| **Gradients** | `linear-gradient`, `radial-gradient`, `conic-gradient`, `bg-gradient-*` | Flat semantic fills (`--bg-surface`, `--accent-bull` with alpha on canvas) |
| **Elevation / Glows** | `box-shadow` (except `none`), `text-shadow`, `drop-shadow`, `shadow-sm/md/lg/xl/2xl` | `1px solid var(--border-hairline)` structural borders |
| **Pill / Card Bloat** | `rounded-lg`, `rounded-xl`, `rounded-2xl`, `rounded-3xl`, `border-radius > 4px` | Sharp `0px`–`2px` (`rounded-none` or `rounded-[2px]`); `50%` allowed ONLY on `6px` status dot |
| **Jittering Numbers** | Proportional sans-serif digits on prices, OI, CVD, strikes, countdowns | Mandatory `.font-mono-tabular` class on every numeric element |