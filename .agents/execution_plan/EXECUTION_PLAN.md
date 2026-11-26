# BTC Derivatives & Order-Flow Analytics Terminal — Master Execution Plan

## 1. Executive Overview & Execution Governance

### 1.1 Product Scope & Core Mandates
This execution plan governs the end-to-end build of a single-page, minimalist, real-time **Bitcoin (`BTCUSDT` perpetuals + `BTC` options)** market-structure and order-flow analytics terminal powered exclusively by free public exchange APIs.

* **Asset Scope:** Bitcoin only (`BTCUSDT` linear perpetuals on Binance Futures and Bybit V5; `BTC` options on Deribit).
* **Application Mode:** Read-only Single-Page Application (SPA). Zero user accounts, zero drawing tools, zero alerting, and zero vertical or horizontal page scrolling (`100vh` $\times$ `100vw` viewport lock).
* **Unified Chart Mandate:** Every analytical layer renders onto **one primary TradingView Lightweight Charts v5.3+ instance**, individually toggleable from a collapsible `260px` right-hand control drawer.
* **Institutional "Zero-Slop" Visual Standard:** Swiss typographic discipline inspired by Linear and institutional execution desks—`1px` solid hairline borders, `tabular-nums` monospace numeric readouts, four calibrated CSS custom-property themes, zero neon glows, zero `backdrop-filter` glassmorphism, zero drop-shadow elevation cards, and zero decorative gradients.

---

### 1.2 Architectural Decision Records (ADR Log)
To prevent implementation ambiguity, all architectural trade-offs are locked prior to development:

| ADR ID | Locked Decision | Technical Rationale |
| :--- | :--- | :--- |
| **ADR-01** | **Fly.io (`fra` Frankfurt) + Persistent Volume SQLite (`aiosqlite` in WAL mode)** | Hosting the Python backend in Frankfurt (`fra`) avoids `HTTP 451` geo-blocking returned by Binance Futures (`fstream.binance.com` / `fapi.binance.com`) to US cloud IPs. Pairing a single always-on Fly micro-VM with an attached `1 GB` persistent volume running SQLite in `WAL` mode eliminates free-tier spin-down gaps in Tier-2 forward history, removes external cloud-DB network latency, and keeps local Docker behavior identical to production. |
| **ADR-02** | **Hybrid REST Backfill + Multiplexed `/ws/btc` with Client `set_timeframe`** | Streaming all 6 timeframe klines to every browser wastes bandwidth, while pushing 1,500-bar histories over WebSockets blocks live tick delivery. Clients fetch historical candles and Tier-2 overlays via cacheable HTTP `GET` calls on startup/filter change, and send `{"type": "set_timeframe", "interval": "5m"}` on `/ws/btc` to receive live candle ticks only for their active interval alongside global whale, liquidation, options, and header events. |
| **ADR-03** | **Pure-Python Analytical Black-76 Gamma & Standard Dealer GEX Sign** | Deribit's `/public/get_book_summary_by_currency` provides `open_interest`, `mark_iv`, and `underlying_price` for all ~700 BTC options in one call, but omits Greeks. Computing exact Gamma analytically via Black-76 using Python's built-in `math` module executes in $< 2\text{ ms}$, avoids 700 rate-limited `/public/ticker` calls per minute, avoids `120 MB` `scipy`/`numpy` Docker bloat, and applies the institutional convention (`+Call GEX` / `-Put GEX`). |
| **ADR-04** | **OI-Weighted Swing Leverage Projection with Auto-Mitigation & Edge-First Thermal Rendering** | Exchanges do not expose open trader liquidation prices. Estimating isolated 10x, 25x, 50x, and 100x liquidation pockets from high-volume, positive-OI swing highs/lows surfaces actionable liquidity pools, and deleting ("mitigating") any band the moment a subsequent candle's `[low, high]` crosses its price prevents stale lines from accumulating. On the canvas, rendering continuous liquidation density inside a narrow `16px` left-docked vertical thermal bar while projecting tag-free horizontal heat gradients from the left margin onto the candlesticks for only the top `3–4` highest-density pockets (with both intensity and horizontal length proportional to liquidation volume) keeps the chart unobstructed for order-flow bubbles, VRVP, and options walls. |
| **ADR-05** | **Per-Venue `100ms` Whale Burst Aggregation & Custom `ISeriesPrimitive` Bubbles** | Large market sweeps split into dozens of child fills within milliseconds across Binance and Bybit. Grouping consecutive same-side fills per venue within a `100ms` window consolidates each sweep into one venue-tagged print (`binance` or `bybit`) with circle area proportional to USD notional. Rendering via a custom Lightweight Charts v5 `ISeriesPrimitive` allows multiple bubbles at different prices inside the exact same candle timestamp (which built-in LWC series prohibit). |
| **ADR-06** | **Client-Side 80-Bin VRVP & `00:00 UTC` Taker-Buy Backfilled Session CVD** | Computing Visible Range Volume Profile (VRVP) on the client from currently visible candles guarantees `60 FPS` panning across `1m` through `1d` without requiring multi-month `1m` trade archives. Anchoring Session CVD to `00:00 UTC` and backfilling via Binance's `1m` `takerBuyQuoteAssetVolume` ensures mid-day server restarts never reset cumulative delta to zero. |
| **ADR-07** | **Standardized `40px` Header Strip & Strict `calc(100vh - 40px)` Canvas** | Standardizes the top telemetry bar to `40px` height across the entire codebase, locking workspace geometry to `100vh` without scrollbars. |

---

### 1.3 Subagent Roster Reference
Subagents execute **strictly sequentially** (one agent active at a time with full CLI/shell access in the shared workspace). This execution plan **only assigns Subagent IDs to tasks**; each subagent's persona, core focus, technical skills, CLI tool boundaries, and operating discipline are defined separately in **`.agents/subagents/SUBAGENTS.md`**.

| Subagent ID | Role Title | Summoned In Steps |
| :--- | :--- | :--- |
| **`SA-ARCH`** | Protocol & Workspace Architect | Step 1.1, Step 1.2 |
| **`SA-INGEST`** | Async Exchange Ingestion & Persistence Engineer | Step 2.1, Step 2.2, Step 2.4 |
| **`SA-QUANT`** | Derivatives & Market-Structure Quant Engineer | Step 2.3 |
| **`SA-API`** | FastAPI Real-Time Stream & REST Orchestrator | Step 2.5 |
| **`SA-UI`** | Institutional Design System & React Shell Engineer | Step 3.1, Step 3.2 |
| **`SA-CHART`** | Lightweight Charts v5 & Canvas Primitives Engineer | Step 4.1, Step 4.2, Step 4.3 |
| **`SA-OPS`** | DevOps, Deployment & End-to-End QA Engineer | Step 5.1, Step 5.2 |

---

### 1.4 Sequential Execution & Handoff Rules
1. **Strict Gatekeeping:** Step $N+1$ MUST NOT start until every CLI verification command and Pass/Fail criterion in Step $N$ exits with code `0`.
2. **File Ownership Boundaries:** Each step lists **Target Files Owned**. A subagent may read any repository file for context, but may only create or modify files listed in its step scope (unless fixing a type import explicitly broken by its task).
3. **Zero Placeholder Rule:** Stubbed `TODO` functions, mock random data generators in production code paths, and `any` / `# type: ignore` suppressions are prohibited.
4. **Handoff Log:** Upon passing all verification commands, each subagent appends a brief completion entry (timestamp, step ID, test counts, exit codes) to `PROGRESS_LOG.md`.

---

## 2. Canonical Monorepo Directory Topology

All sequential steps MUST adhere to this exact directory layout:

```text
btc-terminal/
├── .github/
│   └── workflows/
│       └── ci.yml
├── backend/
│   ├── app/
│   │   ├── __init__.py
│   │   ├── main.py                  # FastAPI entry, lifespan, CORS, routers
│   │   ├── config.py                # Pydantic Settings (env vars, thresholds, URLs)
│   │   ├── schemas.py               # Canonical Pydantic v2 REST & WS payloads
│   │   ├── db/
│   │   │   ├── __init__.py
│   │   │   ├── schema.sql           # SQLite WAL DDL & indexes
│   │   │   └── repository.py        # Async aiosqlite writer, queries, retention job
│   │   ├── connectors/
│   │   │   ├── __init__.py
│   │   │   ├── base.py              # Exponential backoff + jitter + heartbeat base
│   │   │   ├── binance.py           # Binance USDS-M WS + REST kline/OI/CVD backfill
│   │   │   ├── bybit.py             # Bybit V5 linear WS (20s ping) + REST fallback
│   │   │   └── deribit.py           # Deribit 60s options book summary poller
│   │   ├── engine/
│   │   │   ├── __init__.py
│   │   │   ├── state.py             # Ring buffers (1500 bars x 6 TFs) & live telemetry
│   │   │   ├── whale_aggregator.py  # Per-venue 100ms burst aggregator
│   │   │   ├── liquidations.py      # Realized filter + OI pivot leverage + mitigation
│   │   │   └── options_quant.py     # Black-76 Gamma, Net GEX, Walls, Max Pain
│   │   └── api/
│   │       ├── __init__.py
│   │       ├── routes.py            # REST endpoints (/health, /klines, /overlays, /options)
│   │       └── ws_hub.py            # /ws/btc ConnectionManager & set_timeframe router
│   ├── tests/
│   │   ├── __init__.py
│   │   ├── conftest.py
│   │   ├── test_schemas.py
│   │   ├── test_repository.py
│   │   ├── test_connectors_normalization.py
│   │   ├── test_quant_engines.py
│   │   └── test_api_and_ws.py
│   ├── Dockerfile
│   └── pyproject.toml
├── frontend/
│   ├── public/
│   │   └── favicon.svg
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx
│   │   ├── styles/
│   │   │   └── tokens.css           # 4-theme CSS variables, reset, tabular-nums rules
│   │   ├── types/
│   │   │   └── terminal.ts          # Exact mirror of backend/app/schemas.py
│   │   ├── store/
│   │   │   └── useTerminalStore.ts  # Zustand state (theme, TF, toggles, expiry, data)
│   │   ├── services/
│   │   │   ├── apiClient.ts         # Typed REST fetcher
│   │   │   └── wsClient.ts          # Reconnecting /ws/btc manager + set_timeframe sync
│   │   ├── utils/
│   │   │   ├── formatters.ts        # Compact USD, price, countdown, signed delta formatters
│   │   │   ├── timeSnap.ts          # Candle timestamp floor snapping utility
│   │   │   └── vrvpCalc.ts          # Pure 80-bin VRVP + POC + 70% VAH/VAL calculator
│   │   ├── components/
│   │   │   ├── TopTelemetryBar.tsx  # 40px high-density header strip
│   │   │   ├── ControlDrawer.tsx    # 260px collapsible right overlay/filter pane
│   │   │   ├── LegendDrawer.tsx     # 260px hidden-by-default Chart Legend & Field Guide pane
│   │   │   └── UnifiedChart.tsx     # LWC v5.3+ host & primitive lifecycle binder
│   │   ├── primitives/
│   │   │   ├── VRVPPrimitive.ts         # Right-docked volume profile + POC/VAH/VAL lines
│   │   │   ├── WhaleBubblesPrimitive.ts # Proportional venue-tagged trade circles
│   │   │   ├── LiquidationPrimitive.ts  # 16px left-docked thermal bar, intensity-scaled heat projections & realized markers
│   │   │   └── OptionsWallsPrimitive.ts # Call/Put walls & Max Pain rays + axis labels
│   │   └── __tests__/
│   │       ├── timeSnap.test.ts
│   │       ├── vrvpCalc.test.ts
│   │       ├── store.test.ts
│   │       └── antiSlopAudit.test.ts
│   ├── index.html
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── scripts/
│   └── smoke_e2e.py                 # Full-stack REST + WS contract verification script
├── .env.example
├── fly.toml
├── netlify.toml
└── PROGRESS_LOG.md
```

---

## 3. Data Contracts, Exchange Normalization & Quantitative Specifications

### 3.1 External Exchange Endpoints & Critical Normalization Traps
Subagents implementing connectors MUST follow these exact URLs and field mappings to avoid silent side-inversion bugs:

#### A. Binance USDS-M Futures (Primary Perp Source)
* **REST Base:** `https://fapi.binance.com`
  * Historical Klines: `GET /fapi/v1/klines?symbol=BTCUSDT&interval={tf}&limit=1500` where `{tf}` $\in$ `{"1m", "5m", "15m", "1h", "4h", "1d"}`.
    * Index mapping: `[0]` open time (ms), `[1]` open, `[2]` high, `[3]` low, `[4]` close, `[5]` base volume (BTC), `[7]` quote volume (USD), `[9]` taker buy base volume (BTC), `[10]` taker buy quote volume (USD).
  * Mark Price & Funding: `GET /fapi/v1/premiumIndex?symbol=BTCUSDT` (`markPrice`, `lastFundingRate`, `nextFundingTime`).
  * 24h Rolling Ticker: `GET /fapi/v1/ticker/24hr?symbol=BTCUSDT` (`priceChangePercent`).
  * Open Interest History: `GET /futures/data/openInterestHist?symbol=BTCUSDT&period=5m&limit=289` (`sumOpenInterestValue` in USD).
* **WebSocket Combined Stream:**
  * Primary URI: `wss://fstream.binance.com/market/stream?streams=btcusdt@aggTrade/btcusdt@forceOrder/btcusdt@markPrice@1s/btcusdt@kline_1m/btcusdt@kline_5m/btcusdt@kline_15m/btcusdt@kline_1h/btcusdt@kline_4h/btcusdt@kline_1d`
  * Handshake Fallback URI: `wss://fstream.binance.com/stream?streams=...` (same stream list).
  * **`aggTrade` Side Rule:** Field `m` (`isBuyerMaker` boolean):
    * `m == False` $\rightarrow$ **Aggressive Taker Buy** (`side = "buy"`).
    * `m == True` $\rightarrow$ **Aggressive Taker Sell** (`side = "sell"`).
  * **`forceOrder` Side Rule:** Filter `o.s == "BTCUSDT"` (and if `st` exists in payload, require `st == 1` for USDT-margined contract). Field `o.S` represents the **forced liquidation order side**:
    * `o.S == "SELL"` $\rightarrow$ **Long Liquidated** (`side = "long_liq"`).
    * `o.S == "BUY"` $\rightarrow$ **Short Liquidated** (`side = "short_liq"`).
    * Price = `float(o.ap)` if `float(o.ap) > 0` else `float(o.p)`; Notional USD = $\text{price} \times \text{float}(o.q)$.

#### B. Bybit V5 Linear Perpetuals (Redundancy, Co-Stream & Geo-Block Fallback)
* **REST Base:** `https://api.bybit.com`
  * Tickers (OI, Funding, Mark Price): `GET /v5/market/tickers?category=linear&symbol=BTCUSDT`
  * Kline Fallback (if Binance returns `HTTP 451` or `5xx`): `GET /v5/market/kline?category=linear&symbol=BTCUSDT&interval={1|5|15|60|240|D}&limit=1000`
* **WebSocket URI:** `wss://stream.bybit.com/v5/public/linear`
  * **Mandatory Heartbeat:** Client MUST send `{"op": "ping"}` every `20` seconds.
  * **Subscription Message:** `{"op": "subscribe", "args": ["publicTrade.BTCUSDT", "allLiquidation.BTCUSDT", "tickers.BTCUSDT"]}`
  * **`publicTrade.BTCUSDT` Side Rule:** Iterate each item in `data` list:
    * `item["S"] == "Buy"` $\rightarrow$ **Aggressive Taker Buy** (`side = "buy"`).
    * `item["S"] == "Sell"` $\rightarrow$ **Aggressive Taker Sell** (`side = "sell"`).
  * **`allLiquidation.BTCUSDT` Side Rule (CRITICAL INVERSION VS. BINANCE):** Normalize `items = msg["data"] if isinstance(msg["data"], list) else [msg["data"]]`. In Bybit V5 `allLiquidation`, `S` denotes the **liquidated position side**, NOT the closing order side:
    * `item["S"] == "Buy"` $\rightarrow$ **Long Liquidated** (`side = "long_liq"`).
    * `item["S"] == "Sell"` $\rightarrow$ **Short Liquidated** (`side = "short_liq"`).
    * Price = `float(item["p"])`; Notional USD = $\text{price} \times \text{float}(\text{item}[\text{"v"}])$.

#### C. Deribit Public Options API v2
* **REST Endpoint:** `GET https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option` (polled every `60` seconds).
* **Instrument Name Parser:** Match regex `^BTC-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-(C|P)$` (skip combo instruments).
  * Parse expiry date string (e.g., `27DEC26`) and anchor exact settlement timestamp to **`08:00:00 UTC`** on that calendar date.
  * Ignore expired contracts where $t_{\text{expiry}} \le t_{\text{now}}$ or `open_interest <= 0`.

---

### 3.2 Quantitative Engine Mathematical Specifications

#### 1. Session CVD (`00:00 UTC` Daily Anchor)
* **Cold-Start Backfill:** At backend startup, fetch all `1m` Binance klines from today's `00:00:00 UTC` (`startTime`) up to the last closed minute. Compute initial Session CVD in USD:
  $$\text{CVD}_{\text{init}} = \sum_{k} \left( 2 \times Q_{\text{takerBuy, USD}, k} - Q_{\text{total, USD}, k} \right)$$
* **Live Accumulation:** Accumulate from the primary perp trade stream (Binance `aggTrade`, automatically failing over to Bybit `publicTrade` only while Binance WS is disconnected so arbitrage sweeps are never double-counted):
  $$\text{CVD}_{t} = \text{CVD}_{t-1} + s \cdot (P \times q), \quad s = \begin{cases} +1 & \text{if side} = \text{"buy"} \\ -1 & \text{if side} = \text{"sell"} \end{cases}$$
* **Daily Rollover:** When UTC date advances past `00:00:00 UTC`, reset $\text{CVD} = 0.0$.

#### 2. Per-Venue `100ms` Whale Burst Aggregation & Bubble Area Scaling
* Maintain two independent burst accumulators: one for `venue = "binance"` and one for `venue = "bybit"`.
* Within a venue, while incoming trades share the same `side` and satisfy $T_{\text{trade}} - T_{\text{windowStart}} \le 100\text{ ms}$, accumulate total base quantity $Q = \sum q_i$ and USD notional $N_{\text{USD}} = \sum (P_i \cdot q_i)$.
* When a trade arrives with $T_{\text{trade}} - T_{\text{windowStart}} > 100\text{ ms}$, opposite `side`, or after a `120ms` async flush timer expires:
  * Compute burst VWAP price:
    $$P_{\text{vwap}} = \frac{N_{\text{USD}}}{Q}$$
  * If $N_{\text{USD}} \ge \$100,000$, emit a `WhalePrint` event (and enqueue for SQLite persistence).
* **Frontend Bubble Radius Formula:** Circle **area** ($\pi R^2$) scales linearly with notional USD, clamped to $[4\text{ px}, 28\text{ px}]$:
  $$R = \min\left(28, \max\left(4, 4 + 24 \times \sqrt{\frac{\max(0, N_{\text{USD}} - 100,000)}{4,900,000}}\right)\right)$$

#### 3. Predictive Liquidation Clusters & Real-Time Sweep Mitigation
* **Swing Pivot Detection:** On the active timeframe's 1,500-bar ring buffer, identify local 5-bar fractal swing highs ($\text{high}_i = \max_{j \in [i-5, i+5]} \text{high}_j$) and swing lows ($\text{low}_i = \min_{j \in [i-5, i+5]} \text{low}_j$) where candle quote volume $V_i \ge 1.2 \times \text{SMA}_{20}(V)_i$ and OI weight $w_{\text{OI}} = \max(1.0, 1.0 + \max(0, \Delta \text{OI}_{\text{pct}}) \times 10)$.
* **Leverage Tier Projection:** For isolated leverage tiers $L \in \{10, 25, 50, 100\}$ using maintenance margin rate $m = 0.004$:
  $$P_{\text{liq, long}}(L) = P_{\text{low}, i} \times \left(1 - \frac{1}{L} + m\right)$$
  $$P_{\text{liq, short}}(L) = P_{\text{high}, i} \times \left(1 + \frac{1}{L} - m\right)$$
* **Mandatory Auto-Mitigation:** For each candidate band created at bar index $i$:
  * If any subsequent candle $j > i$ (or live mark/trade price) satisfies $\text{low}_j \le P_{\text{liq, long}}(L)$, **discard/delete** that long band immediately.
  * If any subsequent candle $j > i$ (or live mark/trade price) satisfies $\text{high}_j \ge P_{\text{liq, short}}(L)$, **discard/delete** that short band immediately.
* **Cluster Merging:** Bucket surviving unmitigated bands within $0.15\%$ price width, summing intensity scores $I = V_i \cdot w_{\text{OI}} \cdot \ln(L)$, normalized to $[0.0, 1.0]$, and retain the top 12 long clusters below price and top 12 short clusters above price.

#### 4. Deribit Options: Black-76 Gamma, Net GEX, Walls & Max Pain
* Let $F$ = `underlying_price` (USD), $K$ = strike price, $\sigma = \max(\text{mark\_iv} / 100.0, 0.05)$, and time to expiry in years:
  $$T = \max\left(\frac{t_{\text{expiry}} - t_{\text{now}}}{365.25 \times 86400}, \frac{1}{525960}\right)$$
* Compute Black-76 Gamma ($r = 0$) using standard `math` functions:
  $$d_1 = \frac{\ln(F / K) + 0.5 \sigma^2 T}{\sigma \sqrt{T}}, \quad \phi(d_1) = \frac{1}{\sqrt{2\pi}} e^{-0.5 d_1^2}, \quad \Gamma = \frac{\phi(d_1)}{F \sigma \sqrt{T}}$$
* **Net Dollar GEX per $1\%$ Move at Strike $K$:**
  $$\text{GEX}_{\text{USD}}(K) = \left(\text{OI}_{\text{call}}(K) \cdot \Gamma_{\text{call}}(K) - \text{OI}_{\text{put}}(K) \cdot \Gamma_{\text{put}}(K)\right) \times F^2 \times 0.01$$
* **Call Wall & Put Wall:** Within the selected expiry scope (`"ALL"` or specific ISO date `"YYYY-MM-DD"`), `call_wall` is $\arg\max_K \text{OI}_{\text{call}}(K)$ and `put_wall` is $\arg\max_K \text{OI}_{\text{put}}(K)$.
* **Max Pain:** Across all active strikes $\mathcal{K}$ in the selected expiry scope:
  $$S_{\text{maxPain}} = \arg\min_{S \in \mathcal{K}} \sum_{K \in \mathcal{K}} \left( \text{OI}_{\text{call}}(K) \cdot \max(0, S - K) + \text{OI}_{\text{put}}(K) \cdot \max(0, K - S) \right)$$

#### 5. Client-Side 80-Bin Visible Range Volume Profile (VRVP)
* Extract currently visible candles $B_{\text{vis}}$ from Lightweight Charts' logical range `[from, to]`.
* Let $P_{\min} = \min_{b \in B_{\text{vis}}} b.\text{low}$ and $P_{\max} = \max_{b \in B_{\text{vis}}} b.\text{high}$. Divide $[P_{\min}, P_{\max}]$ into $M = 80$ equal price bins of height $h = (P_{\max} - P_{\min}) / 80$.
* For each candle $b \in B_{\text{vis}}$, let $V_{\text{buy}} = b.\text{takerBuyQuoteUsd}$ and $V_{\text{sell}} = \max(0, b.\text{quoteUsd} - b.\text{takerBuyQuoteUsd})$. Distribute $V_{\text{buy}}$ and $V_{\text{sell}}$ proportionally across every bin overlapping $[b.\text{low}, b.\text{high}]$.
* **POC:** Midpoint price of bin $m^*$ maximizing $(V_{\text{buy}, m} + V_{\text{sell}, m})$.
* **VAH & VAL ($70\%$ Value Area):** Starting from $m^*$, greedily expand one bin upward or downward (choosing whichever neighbor has greater total volume) until cumulative volume reaches $\ge 0.70 \times \sum_{m=0}^{79} V_{\text{total}, m}$. `VAH` is the upper edge of the highest included bin; `VAL` is the lower edge of the lowest included bin.

---

### 3.3 SQLite WAL Schema & Rolling Retention Policy
Database file path: `/data/terminal.db` in production (`./data/terminal.db` locally), initialized with `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA temp_store=MEMORY;`.

* `whale_trades`: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `ts_ms INTEGER NOT NULL`, `venue TEXT NOT NULL`, `side TEXT NOT NULL`, `price REAL NOT NULL`, `size_btc REAL NOT NULL`, `notional_usd REAL NOT NULL` (Index on `(ts_ms, notional_usd)`). Only insert prints where $N_{\text{USD}} \ge \$100,000$.
* `liquidations`: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `ts_ms INTEGER NOT NULL`, `venue TEXT NOT NULL`, `side TEXT NOT NULL`, `price REAL NOT NULL`, `size_btc REAL NOT NULL`, `notional_usd REAL NOT NULL` (Index on `(ts_ms)`). Only insert forced orders where $N_{\text{USD}} \ge \$25,000$.
* `options_snapshots`: `id INTEGER PRIMARY KEY AUTOINCREMENT`, `ts_ms INTEGER NOT NULL`, `expiry_key TEXT NOT NULL`, `underlying_price REAL NOT NULL`, `call_wall REAL NOT NULL`, `put_wall REAL NOT NULL`, `max_pain REAL NOT NULL`, `put_call_ratio REAL NOT NULL`, `net_gex_usd REAL NOT NULL`, `strikes_json TEXT NOT NULL` (Index on `(expiry_key, ts_ms)`). Written every `30` minutes.
* **Retention Job:** Hourly background task deletes rows from all three tables where `ts_ms < now_ms - (14 * 86400 * 1000)` (14-day rolling window, keeping database size well under `150 MB`).

---

### 3.4 REST & Multiplexed `/ws/btc` Wire Contracts

#### REST Endpoints (`backend/app/api/routes.py`)
1. `GET /api/v1/health` $\rightarrow$ `{ status, uptime_sec, binance_ws, bybit_ws, deribit_last_sync_ms, sqlite_ok }`
2. `GET /api/v1/klines?interval=5m&limit=1500` $\rightarrow$ `{ interval, candles: CandleBar[], predicted_liquidations: LiquidationBand[] }`
   * Note: `CandleBar.time` is Unix timestamp in **integer UTC seconds** (required by Lightweight Charts `UTCTimestamp`).
3. `GET /api/v1/overlays/history?since_ms=...&min_whale_usd=100000` $\rightarrow$ `{ whales: WhalePrint[], liquidations: RealizedLiquidation[] }`
4. `GET /api/v1/options?expiry=ALL` $\rightarrow$ `{ selected_expiry, available_expiries: ExpirySummary[], summary: OptionsSurfaceSummary }`

#### WebSocket Endpoint (`WS /ws/btc`)
* **Client $\rightarrow$ Server Command:**
  ```json
  { "type": "set_timeframe", "interval": "5m" }
  ```
* **Server $\rightarrow$ Client Envelopes (Discriminated Union on `"type"`):**
  * `"kline"` (pushed at max `4 Hz` for client's subscribed `interval`): `{ "type": "kline", "interval": "5m", "candle": { "time": 1763938800, "open": 94210.5, "high": 94250.0, "low": 94190.0, "close": 94240.0, "volume_btc": 42.1, "quote_usd": 3967500.0, "taker_buy_usd": 2150000.0, "is_closed": false } }`
  * `"whale"`: `{ "type": "whale", "data": { "ts_ms": 1763938812450, "venue": "binance", "side": "buy", "price": 94242.1, "size_btc": 3.45, "notional_usd": 325135.25 } }`
  * `"liquidation"`: `{ "type": "liquidation", "data": { "ts_ms": 1763938813100, "venue": "bybit", "side": "short_liq", "price": 94255.0, "size_btc": 1.2, "notional_usd": 113106.0 } }`
  * `"liq_bands"`: `{ "type": "liq_bands", "interval": "5m", "bands": [ ... ] }` (pushed on candle close or whenever a live price sweep mitigates an active band)
  * `"telemetry"` (pushed every `1s`): `{ "type": "telemetry", "data": { "mark_price": 94240.5, "index_price": 94218.0, "change_24h_pct": 2.41, "funding_rate": 0.000102, "next_funding_ms": 1763942400000, "open_interest_usd": 19450200000.0, "oi_change_24h_pct": 4.15, "session_cvd_usd": 148200000.0 } }`
  * `"options_update"` (pushed every `60s`): `{ "type": "options_update", "available_expiries": [...], "surfaces_by_expiry": { "ALL": {...}, ... } }` (lightweight top-strikes summary).

---

## 4. Anti-Slop Design System & Viewport Geometry Specification

### 4.1 Viewport Lock (`100vh` $\times$ `100vw`)
* `html, body, #root`: `height: 100vh; width: 100vw; overflow: hidden; margin: 0; padding: 0;`
* **Top Telemetry Strip:** Exact height `40px` (`border-bottom: 1px solid var(--border-hairline)`).
* **Main Workspace Row:** `display: flex; height: calc(100vh - 40px); width: 100vw;`
  * **Unified Chart Container:** `flex: 1; min-width: 0; height: 100%; position: relative;` (`ResizeObserver` triggers `chart.resize(width, height)` synchronously when the right drawer opens or closes).
  * **Collapsible Right Control Drawer:** Width `260px` when open, `0px` (`display: none` or collapsed width `0px` with `overflow: hidden`) when closed; `border-left: 1px solid var(--border-hairline)`.

### 4.2 4-Theme CSS Custom Property Matrix (`data-theme` on `<html>`)

| CSS Variable | `oled-dark` (Default) | `midnight-navy` | `warm-off-white` | `pure-white` |
| :--- | :--- | :--- | :--- | :--- |
| `--bg-canvas` | `#09090B` | `#0B1221` | `#F7F6F2` | `#FFFFFF` |
| `--bg-surface` | `#111114` | `#111B2E` | `#EFECE6` | `#F8F9FA` |
| `--border-hairline` | `#222227` | `#1E2D4A` | `#DDD8CE` | `#E5E7EB` |
| `--text-primary` | `#EDEDEF` | `#E2E8F0` | `#1C1B18` | `#111827` |
| `--text-muted` | `#8A8A93` | `#8B9BB4` | `#6B665E` | `#6B7280` |
| `--accent-bull` | `#2DD4BF` | `#34D399` | `#0F766E` | `#059669` |
| `--accent-bear` | `#F43F5E` | `#FB7185` | `#BE123C` | `#DC2626` |
| `--accent-neutral` | `#A1A1AA` | `#94A3B8` | `#57534E` | `#4B5563` |
| `--grid-line` | `rgba(34,34,39,0.45)` | `rgba(30,45,74,0.45)` | `rgba(221,216,206,0.55)` | `rgba(229,231,235,0.65)` |

### 4.3 Strict Typography & Visual Prohibition Rules
* **UI Labels:** `'Inter', -apple-system, BlinkMacSystemFont, sans-serif`, `11px`–`12px`, uppercase section headers with `letter-spacing: 0.04em`.
* **All Numeric Telemetry, Prices, Strikes & Timestamps:** `'JetBrains Mono', monospace` with mandatory `font-variant-numeric: tabular-nums;` so live tick updates never shift horizontal layout by even `1px`.
* **Banned CSS Properties (Enforced by Automated Test in Step 5.2):** `backdrop-filter`, `box-shadow` (except `none`), `text-shadow`, `linear-gradient`, `radial-gradient`, `conic-gradient`, `border-radius` $> 4\text{px}$ on containers (except `50%` on status dots).

---

## 5. Phased Sequential Execution Plan

---

### PHASE 1: Workspace Foundation & Cross-Stack Contracts

#### Step 1.1 — Monorepo Scaffolding & Strict Toolchains
* **Assigned Subagent:** `SA-ARCH` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Empty repository root.
* **Target Files Owned:** `.gitignore`, `.env.example`, `PROGRESS_LOG.md`, `backend/pyproject.toml`, `backend/app/__init__.py`, `backend/app/config.py`, `frontend/package.json`, `frontend/tsconfig.json`, `frontend/vite.config.ts`, `frontend/index.html`.
* **Step Goal:** Initialize reproducible Python 3.12 and React 19 + TypeScript + Vite + Tailwind v4 toolchains with strict static type checking and exact dependency versions.
* **Granular Tasks:**
  1. Create `backend/pyproject.toml` pinning `fastapi>=0.115.0`, `uvicorn[standard]>=0.32.0`, `websockets>=13.1`, `httpx>=0.27.2`, `aiosqlite>=0.20.0`, `pydantic>=2.9.0`, `pydantic-settings>=2.6.0`, plus dev tools `pytest`, `pytest-asyncio`, `ruff`, `mypy`.
  2. Create `backend/app/config.py` with `Settings(BaseSettings)` defining `SQLITE_PATH`, `CORS_ORIGINS`, `BINANCE_REST_URL`, `BINANCE_WS_URL`, `BYBIT_REST_URL`, `BYBIT_WS_URL`, `DERIBIT_REST_URL`, `WHALE_MIN_USD=100000`, `LIQ_MIN_USD=25000`, `RETENTION_DAYS=14`.
  3. Create `frontend/package.json` pinning `react@^19.0.0`, `react-dom@^19.0.0`, `lightweight-charts@^5.3.0`, `zustand@^5.0.0`, `lucide-react` (optional minimal icons), `tailwindcss`, `typescript`, `vite`, `vitest`, `@testing-library/react`, `jsdom`. **Do not add nonexistent `@tradingview/lwc-plugin-*` packages unless strictly verified; custom `ISeriesPrimitive` classes use `lightweight-charts` built-in types.**
  4. Configure `frontend/index.html` to load Google Fonts (`Inter:wght@400;500;600` and `JetBrains+Mono:wght@400;500;600`) with `display=swap` and set `<html lang="en" data-theme="oled-dark">`.
  5. Install dependencies (`pip install -e ".[dev]"` in a backend `.venv` or `uv` venv; `npm install` in `frontend/`).
* **Mandatory CLI Verification:**
  ```bash
  cd backend && ruff check . && mypy app
  cd ../frontend && npx tsc --noEmit
  ```
* **Pass/Fail Criteria:** Both commands exit `0`; `node_modules/lightweight-charts` resolves to `>=5.3.0`; `.env.example` documents `VITE_API_URL` and `VITE_WS_URL`.

---

#### Step 1.2 — Canonical Data Contracts, SQLite DDL & TypeScript Mirrors
* **Assigned Subagent:** `SA-ARCH`
* **Prerequisites:** Step 1.1 passed.
* **Target Files Owned:** `backend/app/schemas.py`, `backend/app/db/schema.sql`, `backend/tests/test_schemas.py`, `frontend/src/types/terminal.ts`.
* **Step Goal:** Lock 100% of REST, WebSocket, and SQLite data structures across Python and TypeScript before any business logic is written.
* **Granular Tasks:**
  1. Write `backend/app/db/schema.sql` implementing `whale_trades`, `liquidations`, and `options_snapshots` tables with composite indexes specified in Section 3.3.
  2. Write `backend/app/schemas.py` using Pydantic v2 `BaseModel` (`ConfigDict(extra="forbid")`) for: `TimeframeLiteral` (`"1m" | "5m" | "15m" | "1h" | "4h" | "1d"`), `VenueLiteral`, `CandleBar`, `WhalePrint`, `RealizedLiquidation`, `LiquidationBand`, `StrikeMetrics`, `ExpirySummary`, `OptionsSurfaceSummary`, `HeaderTelemetry`, client `WsClientCommand`, and discriminated union `WsServerEvent`.
  3. Write `frontend/src/types/terminal.ts` mirroring every field name and type in `backend/app/schemas.py`, plus `ThemeId` (`"oled-dark" | "midnight-navy" | "warm-off-white" | "pure-white"`) and `LayerVisibilityState`.
  4. Write `backend/tests/test_schemas.py` validating JSON serialization round-trips, timestamp integer bounds, and rejection of invalid intervals/sides.
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest tests/test_schemas.py -v && mypy app
  cd ../frontend && npx tsc --noEmit
  ```
* **Pass/Fail Criteria:** `100%` of schema unit tests pass; zero `any` types in `frontend/src/types/terminal.ts`.

---

### PHASE 2: Resilient Python Ingestion, Quant Engine & Streaming API

#### Step 2.1 — Async SQLite WAL Repository & Rolling Retention Worker
* **Assigned Subagent:** `SA-INGEST` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Step 1.2 passed.
* **Target Files Owned:** `backend/app/db/__init__.py`, `backend/app/db/repository.py`, `backend/tests/test_repository.py`.
* **Step Goal:** Build a non-blocking async SQLite storage layer with queued batch writes and automated 14-day retention pruning.
* **Granular Tasks:**
  1. Implement `TerminalRepository` in `backend/app/db/repository.py` using `aiosqlite`. On `initialize()`, auto-create parent directory, execute `PRAGMA journal_mode=WAL; PRAGMA synchronous=NORMAL; PRAGMA busy_timeout=5000;`, and apply `schema.sql`.
  2. Implement an internal `asyncio.Queue` batch writer flushing buffered `WhalePrint` ($\ge \$100,000$) and `RealizedLiquidation` ($\ge \$25,000$) records every `1.0s` (or `50` items) inside a single transaction so burst liquidations never lock the event loop.
  3. Implement `save_options_snapshot()`, `get_recent_whales(since_ms, min_usd, limit=2000)`, `get_recent_liquidations(since_ms, limit=2000)`, and `prune_expired(retention_days=14)`.
  4. Write `backend/tests/test_repository.py` testing initialization, threshold enforcement, batch flush, query filtering, and retention deletion against a temporary SQLite file.
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest tests/test_repository.py -v && ruff check app/db && mypy app/db
  ```
* **Pass/Fail Criteria:** All repository async tests pass; `PRAGMA journal_mode` returns `"wal"` in test assertions.

---

#### Step 2.2 — Binance & Bybit Connectors, Whale Aggregator & Session CVD
* **Assigned Subagent:** `SA-INGEST`
* **Prerequisites:** Step 2.1 passed.
* **Target Files Owned:** `backend/app/connectors/__init__.py`, `backend/app/connectors/base.py`, `backend/app/connectors/binance.py`, `backend/app/connectors/bybit.py`, `backend/app/engine/__init__.py`, `backend/app/engine/state.py`, `backend/app/engine/whale_aggregator.py`, `backend/tests/test_connectors_normalization.py`.
* **Step Goal:** Ingest live multi-venue perpetual market streams with resilient reconnection, geo-block fallback, `100ms` per-venue whale burst aggregation, normalized liquidations, and `00:00 UTC` Session CVD.
* **Granular Tasks:**
  1. Implement `MarketState` in `backend/app/engine/state.py` holding `collections.deque(maxlen=1500)` candle ring buffers for all 6 timeframes, aggregated Open Interest (Binance + Bybit USD sum), Funding Rate + next funding timestamp, Mark Price, 24h change $\%$, and `00:00 UTC` Session CVD with automatic midnight UTC rollover check.
  2. Implement `WhaleBurstAggregator` in `backend/app/engine/whale_aggregator.py` enforcing independent `100ms` same-side windows per venue (`"binance"` and `"bybit"`), computing VWAP price and emitting `WhalePrint` when $N_{\text{USD}} \ge \$100,000$.
  3. Implement `ReconnectingWSConnector` in `backend/app/connectors/base.py` with exponential backoff (`1s` to `30s` max + random jitter) and staleness watchdog (force reconnect if zero messages arrive for `45s`).
  4. Implement `BinanceConnector` (`binance.py`):
     * Startup backfill of 1,500 candles per timeframe + OI history + today's `1m` klines since `00:00 UTC` to seed $\text{CVD}_{\text{init}}$ via Section 3.2 Formula 1.
     * Graceful `HTTP 451` / timeout catch: mark `binance_available = False` and delegate candle/telemetry backfill to `BybitConnector` without crashing startup.
     * Combined WebSocket listener normalizing `aggTrade` (`m == False` $\rightarrow$ `"buy"`), `forceOrder` (`o.S == "SELL"` $\rightarrow$ `"long_liq"`), `markPrice@1s`, and `kline_{tf}`.
  5. Implement `BybitConnector` (`bybit.py`):
     * `20s` async `{"op": "ping"}` loop.
     * Normalize `publicTrade.BTCUSDT` (`S == "Buy"` $\rightarrow$ `"buy"`), `allLiquidation.BTCUSDT` (**inverted rule:** `S == "Buy"` $\rightarrow$ `"long_liq"`, `S == "Sell"` $\rightarrow$ `"short_liq"`), and `tickers.BTCUSDT`.
  6. Write `backend/tests/test_connectors_normalization.py` feeding captured JSON fixtures from Binance and Bybit to verify side normalization (especially liquidation side parity), `100ms` whale burst VWAP math, HTTP `451` fallback behavior, and Session CVD backfill + midnight rollover.
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest tests/test_connectors_normalization.py -v && ruff check app/connectors app/engine && mypy app
  ```
* **Pass/Fail Criteria:** `100%` pass on connector normalization, whale burst VWAP, CVD backfill, and `HTTP 451` fallback unit tests.

---

#### Step 2.3 — Black-76 Options Quant Engine & Self-Mitigating Liquidation Clusters
* **Assigned Subagent:** `SA-QUANT` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Step 2.2 passed.
* **Target Files Owned:** `backend/app/engine/options_quant.py`, `backend/app/engine/liquidations.py`, `backend/tests/test_quant_engines.py`.
* **Step Goal:** Implement pure, deterministic mathematical engines for Deribit Black-76 GEX/Walls/Max Pain and auto-mitigated OI-weighted predictive liquidation bands.
* **Granular Tasks:**
  1. Implement `backend/app/engine/options_quant.py`:
     * Parse Deribit `instrument_name` (`BTC-DDMMMYY-STRIKE-C|P`) to exact `08:00:00 UTC` expiry timestamp.
     * Compute analytical Black-76 Gamma, per-strike Call OI, Put OI, and Net Dollar GEX (`+Call GEX / -Put GEX`) using Section 3.2 Formula 4 (pure Python `math` only; floor $T$ at 1 minute and $\sigma$ at `0.05`).
     * Compute `call_wall`, `put_wall`, `put_call_ratio`, and exact `max_pain` both for `"ALL"` (aggregated across all active expiries) and for every individual expiry key `"YYYY-MM-DD"`.
  2. Implement `backend/app/engine/liquidations.py`:
     * Detect 5-bar fractal swing highs and swing lows weighted by volume $\ge 1.2 \times \text{SMA}_{20}(V)$ and positive OI delta.
     * Project 10x, 25x, 50x, and 100x isolated liquidation bands ($m = 0.004$).
     * Enforce **strict sweep mitigation**: scan all subsequent bars $j > i$ and provide an incremental `mitigate_with_price(low, high)` method for real-time ticks that deletes any band touched by price immediately.
     * Merge surviving bands within $0.15\%$ proximity and return top 12 long bands and top 12 short bands sorted by normalized intensity $[0.0, 1.0]$.
  3. Write `backend/tests/test_quant_engines.py` verifying:
     * Black-76 Gamma accuracy against known analytical reference values, positive Call GEX vs. negative Put GEX, zero-crash near-expiry clamping, and exact Max Pain strike selection on synthetic option chains.
     * Predictive liquidation projection accuracy and proof that a subsequent candle wick crossing a predicted 50x band immediately removes that band while leaving untouched 25x/10x bands intact.
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest tests/test_quant_engines.py -v && ruff check app/engine && mypy app/engine
  ```
* **Pass/Fail Criteria:** All quant unit tests pass; processing a 800-instrument synthetic Deribit book finishes in $< 25\text{ ms}$ in benchmark test assertion.

---

#### Step 2.4 — Deribit 60s Poller & Tier-2 Snapshot Integration
* **Assigned Subagent:** `SA-INGEST`
* **Prerequisites:** Step 2.3 passed.
* **Target Files Owned:** `backend/app/connectors/deribit.py` *(plus wiring state hooks in `backend/app/engine/state.py` and extending `backend/tests/test_connectors_normalization.py`)*.
* **Step Goal:** Poll Deribit's BTC options book summary every `60` seconds, update live multi-expiry option surfaces in `MarketState`, and persist `30`-minute Tier-2 snapshots to SQLite.
* **Granular Tasks:**
  1. Implement `DeribitOptionsPoller` in `backend/app/connectors/deribit.py` using shared `httpx.AsyncClient(timeout=10.0)` calling `/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option` immediately on startup and every `60s` thereafter with retry backoff.
  2. Feed raw `result` list into `options_quant.compute_options_surfaces()`, atomically swap the computed `surfaces_by_expiry` dictionary on `MarketState`, and invoke a broadcast callback.
  3. Persist `"ALL"` and top-3 nearest expiry summaries into `TerminalRepository.save_options_snapshot()` once every `30` minutes.
  4. Add mock `httpx` transport tests in `test_connectors_normalization.py` covering valid Deribit JSON-RPC payloads, malformed/combo instrument skipping, and HTTP timeout recovery.
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest -v && ruff check app && mypy app
  ```
* **Pass/Fail Criteria:** Entire backend test suite passes with zero warnings or type errors.

---

#### Step 2.5 — FastAPI Lifecycle, REST Backfill & Multiplexed `/ws/btc` Hub
* **Assigned Subagent:** `SA-API` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Step 2.4 passed.
* **Target Files Owned:** `backend/app/api/__init__.py`, `backend/app/api/ws_hub.py`, `backend/app/api/routes.py`, `backend/app/main.py`, `backend/tests/test_api_and_ws.py`.
* **Step Goal:** Expose low-latency REST backfill endpoints and a backpressure-safe multiplexed `/ws/btc` broadcaster supporting per-client `set_timeframe` subscriptions.
* **Granular Tasks:**
  1. Implement `ConnectionManager` in `backend/app/api/ws_hub.py`:
     * Track connected clients and each client's subscribed `interval` (default `"5m"`).
     * Listen for client `{"type": "set_timeframe", "interval": "..."}` messages, validate via `WsClientCommand`, and switch that client's kline & `liq_bands` routing immediately.
     * Protect against slow consumers by wrapping `send_json` in `asyncio.wait_for(..., timeout=2.0)` and disconnecting stalled sockets cleanly without blocking healthy subscribers.
     * Throttle outbound `kline` updates per interval to max `4 Hz` (`250ms` coalescing, except immediate flush when `is_closed == True`) and `telemetry` broadcasts to `1 Hz`.
  2. Implement REST routes in `backend/app/api/routes.py` matching Section 3.4 (`/api/v1/health`, `/api/v1/klines`, `/api/v1/overlays/history`, `/api/v1/options`).
  3. Implement `backend/app/main.py` using FastAPI `lifespan` context manager to initialize SQLite, run REST backfills, launch background tasks (`BinanceConnector`, `BybitConnector`, `DeribitOptionsPoller`, `1h` retention pruner, `1s` telemetry emitter), configure CORS, and cancel all tasks cleanly on shutdown.
  4. Write `backend/tests/test_api_and_ws.py` using FastAPI `TestClient` / `httpx.AsyncClient` to verify every REST endpoint, WebSocket connection handshake, `set_timeframe` filtering (proving a client subscribed to `"15m"` does NOT receive `"1m"` kline frames while still receiving `"whale"` and `"telemetry"` frames), and graceful shutdown.
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest -v && ruff check . && mypy app
  ```
* **Pass/Fail Criteria:** `100%` of backend tests pass; all REST and `/ws/btc` schemas validate strictly against `schemas.py`.

---

### PHASE 3: Frontend Foundation, State Sync & Institutional Shell

#### Step 3.1 — 4-Theme Token Engine, Utilities, Zustand Store & WS/REST Sync
* **Assigned Subagent:** `SA-UI` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Step 2.5 passed.
* **Target Files Owned:** `frontend/src/styles/tokens.css`, `frontend/src/utils/formatters.ts`, `frontend/src/utils/timeSnap.ts`, `frontend/src/utils/vrvpCalc.ts`, `frontend/src/store/useTerminalStore.ts`, `frontend/src/services/apiClient.ts`, `frontend/src/services/wsClient.ts`, `frontend/src/__tests__/timeSnap.test.ts`, `frontend/src/__tests__/vrvpCalc.test.ts`, `frontend/src/__tests__/store.test.ts`.
* **Step Goal:** Build the deterministic client state layer, 4-theme CSS custom property foundation, coordinate time-snapping math, 80-bin VRVP calculator, and resilient backend synchronization.
* **Granular Tasks:**
  1. Write `frontend/src/styles/tokens.css` defining all 4 themes from Section 4.2 (`oled-dark`, `midnight-navy`, `warm-off-white`, `pure-white`), `100vh` overflow lock, `1px` hairline utility classes, `.font-mono-tabular` (`font-family: 'JetBrains Mono', monospace; font-variant-numeric: tabular-nums;`), and zero gradients/shadows. Persist selected theme in `localStorage` and sync `<html data-theme="...">` plus provide a `readThemeTokens()` JS helper so HTML5 Canvas primitives read exact active hex colors.
  2. Implement `frontend/src/utils/timeSnap.ts`:
     * `snapTimestampToBar(tsMs: number, interval: TimeframeLiteral): UTCTimestamp` computing $\lfloor (\text{tsMs} / 1000) / S_{\text{tf}} \rfloor \times S_{\text{tf}}$ so whale prints and liquidations always align to valid bar coordinates across `1m` through `1d`.
  3. Implement `frontend/src/utils/vrvpCalc.ts` computing the 80-bin buy/sell volume profile, `pocPrice`, `vahPrice`, and `valPrice` ($70\%$ Value Area) per Section 3.2 Formula 5.
  4. Implement `frontend/src/store/useTerminalStore.ts` (Zustand):
     * UI state: `theme`, `timeframe` (default `"5m"`), `drawerOpen` (default `true`), `layers` (`volume`, `vrvp`, `whales`, `liquidations`, `optionsWalls`, `maxPain` — all default `true`), `selectedExpiry` (`"ALL"`), `minWhaleUsd` (`100000 | 250000 | 500000 | 1000000`, default `250000`), `wsStatus`.
     * Market data slices: `candles`, `whales` (capped at latest `1,500`), `realizedLiquidations` (capped at latest `1,500`), `predictedLiqBands`, `optionsSummary`, `availableExpiries`, `telemetry`.
  5. Implement `apiClient.ts` and `wsClient.ts`:
     * On initial load or `timeframe` change: fetch `/api/v1/klines` + `/api/v1/overlays/history` + `/api/v1/options`, populate store, and send `{"type": "set_timeframe", "interval": tf}` over `/ws/btc`.
     * Auto-reconnect `/ws/btc` with exponential backoff (`1s`–`15s`) and automatic state resync on reconnect.
  6. Write Vitest unit tests (`timeSnap.test.ts`, `vrvpCalc.test.ts`, `store.test.ts`).
* **Mandatory CLI Verification:**
  ```bash
  cd frontend && npx tsc --noEmit && npx vitest run
  ```
* **Pass/Fail Criteria:** Zero TypeScript errors; `100%` of Vitest tests pass for `timeSnap` across all 6 intervals, `vrvpCalc` ($70\%$ Value Area invariant), and store transitions.

---

#### Step 3.2 — `100vh` Zero-Scroll Shell: `40px` Header Strip & `260px` Control Drawer
* **Assigned Subagent:** `SA-UI`
* **Prerequisites:** Step 3.1 passed.
* **Target Files Owned:** `frontend/src/components/TopTelemetryBar.tsx`, `frontend/src/components/ControlDrawer.tsx`, `frontend/src/App.tsx`, `frontend/src/main.tsx`.
* **Step Goal:** Assemble the institutional single-page terminal chrome with live telemetry readouts, timeframe switcher, 4-theme switcher, and collapsible control drawer.
* **Granular Tasks:**
  1. Build `TopTelemetryBar.tsx` locked to `height: 40px`:
     * Left cluster: Connection status dot (`6px` solid circle), `BTCUSDT` ticker badge, Mark Price + 24h $\%$ delta (`tabular-nums`).
     * Center compact telemetry strip (`1px` vertical dividers): **Funding Rate + live `HH:MM:SS` countdown**, **Aggregated OI (compact USD + 24h $\%$ $\Delta$)**, **Session CVD (signed compact USD colored with `--accent-bull` / `--accent-bear`)**, **Options P/C Ratio & Max Pain** (reactive to `selectedExpiry`).
     * Right cluster: Segmented Timeframe pills (`1m`, `5m`, `15m`, `1h`, `4h`, `1d`), 4-Theme selector buttons, and Control Drawer collapse toggle button.
  2. Build `ControlDrawer.tsx` (`width: 260px`, collapsible):
     * **Section 1 — Chart Overlays:** Clean hairline toggle rows with crisp `1px` indicator switches for `Volume`, `VRVP (POC / VA)`, `Whale Order Flow`, `Liquidation Levels`, `Put / Call Walls`, and `Max Pain`.
     * **Section 2 — Whale Filter:** Segmented threshold pills (`$100k`, `$250k`, `$500k`, `$1M`).
     * **Section 3 — Options Expiry:** `"All Expiries"` + scrollable/compact list of live Deribit dates showing each expiry's BTC OI weight percentage, plus a compact 4-row strike telemetry readout (`Call Wall`, `Put Wall`, `Max Pain`, `Net GEX` with `+GEX Stabilizer` / `-GEX Accelerator` semantic tag).
  3. Wire `App.tsx` so the main chart slot occupies `flex-1 h-full min-w-0` inside the `calc(100vh - 40px)` workspace row and starts `wsClient` + initial REST bootstrap on mount.
* **Mandatory CLI Verification:**
  ```bash
  cd frontend && npx tsc --noEmit && npx vitest run && npm run build
  ```
* **Pass/Fail Criteria:** Production Vite bundle compiles cleanly; zero scrollbars at `1280x720` and `1920x1080` viewport dimensions; every numeric readout carries `tabular-nums`.

---

### PHASE 4: Unified Lightweight Charts v5 Host & Custom Canvas Primitives

#### Step 4.1 — Lightweight Charts v5.3+ Core Host, Volume Split & Live Sync
* **Assigned Subagent:** `SA-CHART` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Step 3.2 passed.
* **Target Files Owned:** `frontend/src/components/UnifiedChart.tsx` *( mounted into `frontend/src/App.tsx`)*.
* **Step Goal:** Instantiate the unified TradingView Lightweight Charts v5.3+ canvas using strictly v5 APIs, synchronize theme tokens and resize events, and render incremental `60 FPS` candles + bottom-docked volume bars.
* **Granular Tasks:**
  1. Create chart via `createChart(container, options)` using active CSS custom-property colors from `readThemeTokens()`, disabling TradingView watermark attribution clutter only within Apache-2.0 attribution guidelines (keep subtle compliant attribution link in control drawer footer), setting right price scale margins (`top: 0.08`, `bottom: 0.20`), crosshair in `CrosshairMode.Normal`, and `timeVisible: true`.
  2. **Strict v5 Series API:**
     * Main candles: `chart.addSeries(CandlestickSeries, { upColor, downColor, borderUpColor, borderDownColor, wickUpColor, wickDownColor })`.
     * Volume histogram: `chart.addSeries(HistogramSeries, { priceFormat: { type: 'volume' }, priceScaleId: 'volume' })` configured via `chart.priceScale('volume').applyOptions({ scaleMargins: { top: 0.82, bottom: 0 } })` so volume occupies the bottom `18%` of the unified pane without overlapping price candles.
  3. Wire store subscriptions without React re-render thrashing:
     * Call `.setData()` **only** when `timeframe` changes or full REST backfill loads.
     * Call `.update(bar)` for incremental `/ws/btc` `"kline"` ticks.
     * Toggle `volumeSeries.applyOptions({ visible: layers.volume })` on `Volume` switch toggle.
     * Re-apply palette colors via `chart.applyOptions(...)` and `candlestickSeries.applyOptions(...)` whenever `theme` changes.
     * Bind `ResizeObserver` on the chart container so opening/closing the `260px` drawer resizes the canvas at `60 FPS` with zero layout jump.
* **Mandatory CLI Verification:**
  ```bash
  cd frontend && npx tsc --noEmit && npm run build
  ```
* **Pass/Fail Criteria:** Zero deprecated v4 calls (`addCandlestickSeries` / `addHistogramSeries` absent from codebase via grep check); Vite build passes cleanly.

---

#### Step 4.2 — Custom Primitives Part 1: `VRVPPrimitive` & `WhaleBubblesPrimitive`
* **Assigned Subagent:** `SA-CHART`
* **Prerequisites:** Step 4.1 passed.
* **Target Files Owned:** `frontend/src/primitives/VRVPPrimitive.ts`, `frontend/src/primitives/WhaleBubblesPrimitive.ts`, `frontend/src/components/UnifiedChart.tsx` *(attaching primitives)*.
* **Step Goal:** Attach hardware-smooth Canvas 2D `ISeriesPrimitive` overlays for right-docked 80-bin VRVP (`POC` + `VAH/VAL`) and multi-venue area-proportional Whale Order-Flow Bubbles.
* **Granular Tasks:**
  1. **Coordinate Space Discipline (Critical LWC v5 Rule):** Inside `IPrimitivePaneRenderer.draw(target)`, use `target.useMediaCoordinateSpace(({ context, mediaSize }) => { ... })` when drawing directly with CSS coordinates returned by `timeScale().timeToCoordinate(t)` and `series.priceToCoordinate(p)` (aligning `1px` horizontal lines to `Math.floor(y) + 0.5` so hairlines never blur).
  2. Implement `VRVPPrimitive` (`ISeriesPrimitive<Time>`):
     * Subscribe to `chart.timeScale().subscribeVisibleLogicalRangeChange` (throttled via `requestAnimationFrame`), slice visible `CandleBar[]`, and run `vrvpCalc` (80 bins).
     * Draw right-docked horizontal stacked buy/sell bars spanning max `18%` of `mediaSize.width` from the right chart edge using translucent `--accent-bull` (`alpha: 0.28`) and `--accent-bear` (`alpha: 0.28`), leaving bars inside the `70%` Value Area slightly higher contrast than out-of-value bins.
     * Draw crisp `1px` horizontal rays across the visible profile/chart for **POC** (solid `1px` `--text-primary` with compact `"POC"` tag), **VAH**, and **VAL** (dashed `1px` `--accent-neutral` with `"VAH"` / `"VAL"` tags). Hide completely when `layers.vrvp == false`.
  3. Implement `WhaleBubblesPrimitive` (`ISeriesPrimitive<Time>`):
     * Filter `whales` by `notional_usd >= minWhaleUsd` and visible time bounds.
     * Map each print's X coordinate via `timeScale().timeToCoordinate(snapTimestampToBar(ts_ms, timeframe))` and Y coordinate via `series.priceToCoordinate(price)`. Skip safely if either returns `null`.
     * Compute circle radius $R \in [4, 28]$ via Section 3.2 Formula 2. Draw translucent fill (`alpha: 0.32`) + crisp `1px` stroke (`alpha: 0.88`) using `--accent-bull` for `"buy"` and `--accent-bear` for `"sell"`. Distinguish venue subtly (`solid` `1px` ring for Binance, `2px-2px` micro-dashed ring or tiny `B`/`Y` glyph on bubbles with $R \ge 14\text{ px}$) and expose hovered bubble details (`Venue`, `Side`, `$ Notional`, `Price`, `UTC Time`) in a compact top-left chart HUD bar when crosshair approaches $(X, Y)$ within $R + 4\text{ px}$.
* **Mandatory CLI Verification:**
  ```bash
  cd frontend && npx tsc --noEmit && npx vitest run && npm run build
  ```
* **Pass/Fail Criteria:** Both primitives attach via `candlestickSeries.attachPrimitive(...)`, respect `layers.vrvp`, `layers.whales`, and `minWhaleUsd` toggles instantaneously, and compile with zero TypeScript errors.

---

#### Step 4.3 — Custom Primitives Part 2: `LiquidationPrimitive` & `OptionsWallsPrimitive`
* **Assigned Subagent:** `SA-CHART`
* **Prerequisites:** Step 4.2 passed.
* **Target Files Owned:** `frontend/src/primitives/LiquidationPrimitive.ts`, `frontend/src/primitives/OptionsWallsPrimitive.ts`, `frontend/src/components/UnifiedChart.tsx`.
* **Step Goal:** Complete the unified chart overlay suite with a left-docked `16px` liquidation thermal bar + intensity-scaled top 3–4 peak projections (tag-free), realized liquidation markers, and expiry-filtered Deribit Put/Call Walls, Net GEX polarity tags, and Max Pain ray.
* **Granular Tasks:**
  1. Implement `LiquidationPrimitive` (`ISeriesPrimitive<Time>`):
     * **Docked `16px` Left-Margin Vertical Thermal Bar (Continuous Density):** Reserve a narrow `16px` vertical thermal bar docked flush along the left margin (`x = 0` to `16`, bounded on the right by a `1px` crisp `--border-hairline` divider). Kernel-smooth all surviving unmitigated `LiquidationBand` items from `predictedLiqBands` across visible price Y coordinates to render continuous liquidation density across every price level (`--accent-bear` for long-liq downside pools; `--accent-bull` for short-liq upside pools, using a high-contrast power curve so heavy liquidation levels stand out vividly).
     * **Top `3–4` Peak Horizontal Heat Projections (Left-to-Right, Tag-Free):** Rank surviving `predictedLiqBands` by `intensity` and select the top `3–4` highest-density pockets. Project tag-free horizontal Canvas 2D `ctx.createLinearGradient(...)` heat plumes expanding rightward from `x = 16` into the chart (never CSS `linear-gradient`, keeping `antiSlopAudit.test.ts` green). Scale **both** opacity/core intensity (`5px`–`12px` height + bright inner core on heavy levels) and horizontal expansion length (`14%`–`72%` of available chart width) monotonically with `band.intensity`—the more potential liquidations at a level, the stronger and longer the projection. Omit text tags completely (`LIQ ...` tags removed).
     * **Realized Liquidations:** Plot verified forced orders ($\ge \$25,000$) at `(snapped_bar_time, price)` as crisp hollow `x` / diamond crosshair markers (`6px`–`12px` scaled by log notional) so they never visually collide with circular Whale Bubbles. Hide thermal bar, peak projections, and markers when `layers.liquidations == false`.
  2. Implement `OptionsWallsPrimitive` (`ISeriesPrimitive<Time>`):
     * Read active `optionsSummary` (dynamically updated whenever `selectedExpiry` changes in the right drawer).
     * When `layers.optionsWalls == true`:
       * Draw **Call Wall** (`call_wall` strike) as a `1px` solid `--accent-bear` horizontal ray with right-edge pill tag `CALL WALL $100,000 | OI: 4,120 BTC | +GEX` and also render top-5 secondary strike GEX micro-bars (`max 36px` wide) offset cleanly right of the `16px` left liquidation bar (`x = 18` when active, `0` when hidden) so major gamma magnets/pockets are visible without cluttering candles.
       * Draw **Put Wall** (`put_wall` strike) as a `1px` solid `--accent-bull` horizontal ray with right-edge pill tag `PUT WALL $90,000 | OI: 3,850 BTC | -GEX`.
     * When `layers.maxPain == true`:
       * Draw **Max Pain** (`max_pain` strike) as a `1px` dotted `--accent-neutral` horizontal line with tag `MAX PAIN $92,000`.
  3. Wire all 6 layer switches, `selectedExpiry`, `minWhaleUsd`, and `theme` updates in `UnifiedChart.tsx` to call `primitive.requestUpdate()` immediately on state change.
* **Mandatory CLI Verification:**
  ```bash
  cd frontend && npx tsc --noEmit && npx vitest run && npm run build
  ```
* **Pass/Fail Criteria:** All 4 custom primitives (`VRVP`, `WhaleBubbles`, `Liquidation`, `OptionsWalls`) compile cleanly, detach cleanly on unmount, and respond to all 6 toggle switches + expiry selector + whale threshold pills.

---

### PHASE 5: Deployment Topology, CI/CD & End-to-End Verification

#### Step 5.1 — Dockerization, Fly.io (`fra`) Config, Netlify Config & CI Pipeline
* **Assigned Subagent:** `SA-OPS` *(capabilities & constraints defined in `.agents/subagents/SUBAGENTS.md`)*
* **Prerequisites:** Step 4.3 passed.
* **Target Files Owned:** `backend/Dockerfile`, `.dockerignore`, `fly.toml`, `netlify.toml`, `.github/workflows/ci.yml`.
* **Step Goal:** Package the backend for non-US (`fra` Frankfurt) deployment with persistent SQLite storage on Fly.io and configure zero-config static SPA deployment on Netlify.
* **Granular Tasks:**
  1. Write `backend/Dockerfile` based on `python:3.12-slim`, creating a non-root `appuser`, pre-creating `/data` owned by `appuser`, installing production dependencies cleanly, exposing port `8000`, and adding a Docker `HEALTHCHECK` hitting `http://127.0.0.1:8000/api/v1/health`.
  2. Write `fly.toml`:
     * Set `primary_region = "fra"` (Frankfurt, Germany — mandatory to avoid Binance US `HTTP 451`).
     * Configure `min_machines_running = 1`, `auto_stop_machines = "off"` (prevents spin-down gaps in Tier-2 liquidation/whale collection), `vm.size = "shared-cpu-1x"`, `vm.memory = "512mb"`.
     * Mount persistent volume `[mounts] source = "btc_terminal_data" destination = "/data"` with `SQLITE_PATH = "/data/terminal.db"`.
  3. Write `netlify.toml`:
     * `base = "frontend"`, `command = "npm ci && npm run build"`, `publish = "dist"`.
     * SPA redirect `/* -> /index.html` (`status = 200`) plus strict security headers (`X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`).
  4. Write `.github/workflows/ci.yml` running backend (`ruff`, `mypy`, `pytest`) and frontend (`tsc --noEmit`, `vitest run`, `npm run build`) checks on every push/PR.
* **Mandatory CLI Verification:**
  ```bash
  grep -q 'primary_region = "fra"' fly.toml
  cd backend && ruff check . && mypy app && pytest
  cd ../frontend && npx tsc --noEmit && npm run build
  ```
  *(Plus `docker build -t btc-terminal-backend ./backend` if Docker daemon is active in the environment.)*
* **Pass/Fail Criteria:** `fly.toml` locks `primary_region = "fra"` and `/data` mount; `netlify.toml` builds `frontend/dist` cleanly; CI YAML syntax is valid.

---

#### Step 5.2 — Full-Stack Integration Smoke Harness & Anti-Slop Design Audit
* **Assigned Subagent:** `SA-OPS`
* **Prerequisites:** Step 5.1 passed.
* **Target Files Owned:** `frontend/src/__tests__/antiSlopAudit.test.ts`, `scripts/smoke_e2e.py`, `README.md`.
* **Step Goal:** Prove end-to-end backend-to-frontend contract integrity, enforce zero-slop CSS discipline automatically, and produce concise deployment runbooks.
* **Granular Tasks:**
  1. Write `frontend/src/__tests__/antiSlopAudit.test.ts` scanning all `.css` and `.tsx`/`.ts` files under `frontend/src/` to assert:
     * Zero occurrences of `backdrop-filter`, `backdrop-blur`, `linear-gradient`, `radial-gradient`, `drop-shadow`, `shadow-lg`, `shadow-xl`, `shadow-2xl`.
     * Presence of all 4 theme blocks (`oled-dark`, `midnight-navy`, `warm-off-white`, `pure-white`) with exact hex values from Section 4.2.
     * Presence of `tabular-nums` in numeric typography styles and exact `40px` header height + `260px` drawer width.
     * Zero deprecated Lightweight Charts v4 method calls (`addCandlestickSeries`, `addHistogramSeries`, `addLineSeries`).
  2. Write `scripts/smoke_e2e.py` booting the FastAPI ASGI app in-process (or against local port `8000` with mocked/live upstream toggles), verifying `/api/v1/health`, `/api/v1/klines?interval=5m`, `/api/v1/options?expiry=ALL`, `/api/v1/overlays/history`, connecting to `/ws/btc`, sending `{"type": "set_timeframe", "interval": "15m"}`, and asserting receipt of valid Pydantic/TS-compatible `"telemetry"` and `"kline"` frames.
  3. Write `README.md` documenting local development startup, Fly.io volume + region deployment commands (`fly volumes create btc_terminal_data --region fra --size 1`, `fly deploy`), and Netlify environment variable setup (`VITE_API_URL`, `VITE_WS_URL`).
* **Mandatory CLI Verification:**
  ```bash
  cd backend && pytest -v && ruff check . && mypy app
  cd ../frontend && npx tsc --noEmit && npx vitest run && npm run build
  python scripts/smoke_e2e.py
  ```
* **Pass/Fail Criteria:** `100%` of backend tests, frontend tests, anti-slop CSS assertions, production bundle build, and end-to-end WebSocket/REST smoke script exit with status `0`.

---

## 6. Architecture & Completeness Self-Audit Matrix

Every requirement from the product specification and technical audit has been cross-checked against the phased execution plan:

| Verification Dimension | Requirement | Covered Where | Risk Status |
| :--- | :--- | :--- | :--- |
| **Geo-Blocking & Uptime** | Non-US backend for Binance (`HTTP 451`) + no cold-start sleep gaps for Tier-2 collection | ADR-01, Step 2.2 (Bybit fallback), Step 5.1 (`fly.toml` pinned to `fra`, `auto_stop_machines = "off"`, `/data` SQLite WAL volume) | **Mitigated** |
| **Exchange Side Inversion** | Binance `forceOrder` (`SELL` = Long Liq) vs. Bybit `allLiquidation` (`Buy` = Long Liq) + `aggTrade` `m` flag | Section 3.1.A & 3.1.B, Step 2.2, `test_connectors_normalization.py` | **Mitigated** |
| **Deribit Missing Greeks** | Compute Net GEX, Call/Put Walls & Max Pain from 60s `get_book_summary_by_currency` without 700 ticker calls | ADR-03, Section 3.2.4 (Black-76 analytical Gamma via pure `math`), Step 2.3 & Step 2.4 | **Mitigated** |
| **Predictive Liq Clutter** | Project 10x/25x/50x/100x density from high-volume OI swings, remove swept bands, and keep the chart center open | ADR-04, Section 3.2.3 (sweep auto-mitigation), Step 2.3, Step 4.3 (`16px` docked thermal strip + top 3–4 peak projections) | **Mitigated** |
| **Multi-Venue Whale Flow** | Aggregate consecutive sweeps per venue (`100ms`), area-scaled bubbles at exact price, multiple prints per candle | ADR-05, Section 3.2.2, Step 2.2, Step 3.1 (`timeSnap.ts`), Step 4.2 (`WhaleBubblesPrimitive`) | **Mitigated** |
| **Higher-TF VRVP Starvation** | 60 FPS VRVP + POC + 70% VAH/VAL across `1m` to `1d` without multi-year `1m` trade history | ADR-06, Section 3.2.5 (80-bin client visible-bar distribution), Step 3.1 (`vrvpCalc.ts`), Step 4.2 (`VRVPPrimitive`) | **Mitigated** |
| **Session CVD Persistence** | Survive mid-day backend restarts without resetting Session CVD to `0` | ADR-06, Section 3.2.1 (`00:00 UTC` Binance `1m` taker-buy quote volume backfill + midnight rollover), Step 2.2 | **Mitigated** |
| **LWC v5 API & DPI Crispness** | Strict v5 `addSeries(CandlestickSeries)` + `ISeriesPrimitive` `useMediaCoordinateSpace` `0.5px` hairline alignment | Step 1.1, Step 4.1, Step 4.2, Step 5.2 (`antiSlopAudit.test.ts` v4 ban check) | **Mitigated** |
| **Layout & Zero-Slop Design** | `100vh` no-scroll, `40px` top strip, `260px` right drawer, 4 exact themes, `tabular-nums`, zero glows/gradients/blurs | ADR-07, Section 4.1–4.3, Step 3.1, Step 3.2, Step 5.2 automated CSS audit | **Mitigated** |
| **Subagent Separation** | Plan references subagent IDs sequentially; full agent profiles/skills separated into `.agents/subagents/SUBAGENTS.md` | Section 1.3, Section 1.4, Steps 1.1–5.2 | **Verified** |