---
name: exchange-stream-quirks
description: Exact payload schemas, side-polarity inversions, WebSocket keepalives, HTTP 451 geo-block fallbacks, and 100ms burst aggregation patterns for Binance USDS-M Futures, Bybit V5 Linear, and Deribit v2 Options public APIs. Use when implementing or testing exchange connectors and whale/CVD state.
---

# Public Crypto Exchange Stream & REST Quirks Skill

## 1. Critical Side-Polarity Matrix (Prevent Silent Inversions)

Binance and Bybit use opposite semantics for liquidation side fields and boolean maker flags. Use this exact mapping table and assert every row in `test_connectors_normalization.py`:

| Venue & Stream | Raw Field & Value | Economic Meaning | Canonical Output |
| --- | --- | --- | --- |
| **Binance** `btcusdt@aggTrade` | `"m": false` (`isBuyerMaker` is false) | Buyer crossed spread (aggressive buy) | `side = "buy"` |
| **Binance** `btcusdt@aggTrade` | `"m": true` (`isBuyerMaker` is true) | Seller crossed spread (aggressive sell) | `side = "sell"` |
| **Binance** `btcusdt@forceOrder` | `o["S"] == "SELL"` | Forced sell order closed a **Long** | `side = "long_liq"` |
| **Binance** `btcusdt@forceOrder` | `o["S"] == "BUY"` | Forced buy order closed a **Short** | `side = "short_liq"` |
| **Bybit** `publicTrade.BTCUSDT` | `item["S"] == "Buy"` | Aggressive taker buy | `side = "buy"` |
| **Bybit** `publicTrade.BTCUSDT` | `item["S"] == "Sell"` | Aggressive taker sell | `side = "sell"` |
| **Bybit** `allLiquidation.BTCUSDT` | `item["S"] == "Buy"` | **Long** position was liquidated | `side = "long_liq"` |
| **Bybit** `allLiquidation.BTCUSDT` | `item["S"] == "Sell"` | **Short** position was liquidated | `side = "short_liq"` |

---

## 2. Exact Raw Payload Shapes & Edge Cases

### A. Binance USDS-M Combined Stream Envelope

Combined URL (`wss://fstream.binance.com/market/stream?streams=...`) wraps every event in `{"stream": "<name>", "data": {...}}`:

```json
{
  "stream": "btcusdt@forceOrder",
  "data": {
    "e": "forceOrder",
    "E": 1763938813105,
    "o": {
      "s": "BTCUSDT",
      "S": "SELL",
      "o": "LIMIT",
      "q": "1.250",
      "p": "94180.00",
      "ap": "94210.50",
      "X": "FILLED",
      "T": 1763938813100
    }
  }
}
```

* **Price Rule:** Always prefer average fill price `ap` when non-zero: `price = float(o["ap"]) if float(o.get("ap") or 0) > 0 else float(o["p"])`.
* **Kline Time Conversion:** Binance kline start time `k["t"]` (WS) and `row[0]` (REST `/fapi/v1/klines`) are in **milliseconds**. Divide by `1000` (`int(k["t"] // 1000)`) when constructing `CandleBar.time` (UTC seconds).

### B. Bybit V5 Linear WebSocket Quirks

* **Mandatory Client Ping:** Bybit drops silent connections. Run a dedicated task sending `await ws.send('{"op":"ping"}')` every `20.0` seconds while connected; ignore `{"op": "pong", ...}` and `{"op": "subscribe", "success": true}` control frames.
* **`allLiquidation` List vs. Dict:** Across Bybit V5 upgrades, `msg["data"]` may be a `list` of dicts (`[{"T": ..., "s": "BTCUSDT", "S": "Buy", "v": "0.85", "p": "94100.0"}]`) or a single `dict`. Always normalize via:
  ```python
  raw_data = msg.get("data")
  items = raw_data if isinstance(raw_data, list) else ([raw_data] if isinstance(raw_data, dict) else [])
  ```

### C. Bybit REST Kline Fallback Ordering Trap (`HTTP 451` Defense)

If Binance REST returns `HTTP 451` (geo-blocked region) or `5xx`:
* Mark `state.binance_available = False` and fall back to Bybit `GET /v5/market/kline?category=linear&symbol=BTCUSDT&interval={bybit_tf}&limit=1000` where `bybit_tf` maps `{"1m": "1", "5m": "5", "15m": "15", "1h": "60", "4h": "240", "1d": "D"}`.
* **CRITICAL ORDERING TRAP:** Binance `/fapi/v1/klines` returns candles **oldest-first (ascending)**, whereas Bybit `/v5/market/kline` returns `result["list"]` **newest-first (descending)** and omits taker-buy split (estimate `taker_buy_usd = quote_usd * (0.55 if close >= open else 0.45)` only during fallback). Always sort ascending by timestamp (`rows.sort(key=lambda r: int(r[0]))`) before loading into `MarketState`!

### D. Deribit Options Instrument Parser

Endpoint: `GET https://www.deribit.com/api/v2/public/get_book_summary_by_currency?currency=BTC&kind=option`

```python
import re
from datetime import datetime, timezone

DERIBIT_OPT_RE = re.compile(r"^BTC-(\d{1,2}[A-Z]{3}\d{2})-(\d+)-(C|P)$")

def parse_deribit_instrument(name: str) -> tuple[str, int, float, str] | None:
    """Returns (iso_expiry_date, expiry_ts_sec, strike, opt_type) or None for combos."""
    match = DERIBIT_OPT_RE.match(name)
    if not match:
        return None
    date_str, strike_str, opt_type = match.groups()
    dt = datetime.strptime(date_str, "%d%b%y").replace(
        hour=8, minute=0, second=0, tzinfo=timezone.utc
    )
    return dt.strftime("%Y-%m-%d"), int(dt.timestamp()), float(strike_str), opt_type
```

---

## 3. Per-Venue `100ms` Whale Burst Aggregator Pattern

Keep separate buckets per `venue` (`"binance"` and `"bybit"`). Flush whenever side flips, `ts_ms - window_start_ms > 100`, or an async `120ms` timer fires so isolated single sweeps never sit unflushed:

```python
import asyncio
from dataclasses import dataclass
from typing import Awaitable, Callable
from app.schemas import VenueLiteral, WhalePrint

@dataclass
class _BurstBucket:
    side: str
    window_start_ms: int
    last_ts_ms: int
    total_btc: float
    total_usd: float

class WhaleBurstAggregator:
    def __init__(
        self,
        min_notional_usd: float,
        on_emit: Callable[[WhalePrint], Awaitable[None]],
    ) -> None:
        self._min_usd = min_notional_usd
        self._on_emit = on_emit
        self._buckets: dict[VenueLiteral, _BurstBucket | None] = {
            "binance": None,
            "bybit": None,
        }
        self._flush_tasks: dict[VenueLiteral, asyncio.Task[None] | None] = {
            "binance": None,
            "bybit": None,
        }

    async def ingest_trade(
        self, venue: VenueLiteral, side: str, price: float, size_btc: float, ts_ms: int
    ) -> None:
        notional = price * size_btc
        bucket = self._buckets[venue]
        if bucket is not None and (
            bucket.side != side or (ts_ms - bucket.window_start_ms) > 100
        ):
            await self._flush(venue)
            bucket = None

        if bucket is None:
            self._buckets[venue] = _BurstBucket(
                side=side,
                window_start_ms=ts_ms,
                last_ts_ms=ts_ms,
                total_btc=size_btc,
                total_usd=notional,
            )
            self._schedule_timer(venue)
        else:
            bucket.last_ts_ms = ts_ms
            bucket.total_btc += size_btc
            bucket.total_usd += notional

    def _schedule_timer(self, venue: VenueLiteral) -> None:
        existing = self._flush_tasks[venue]
        if existing is not None and not existing.done():
            existing.cancel()
        self._flush_tasks[venue] = asyncio.create_task(self._delayed_flush(venue))

    async def _delayed_flush(self, venue: VenueLiteral) -> None:
        try:
            await asyncio.sleep(0.12)
            await self._flush(venue)
        except asyncio.CancelledError:
            return

    async def _flush(self, venue: VenueLiteral) -> None:
        bucket = self._buckets[venue]
        self._buckets[venue] = None
        if bucket is None or bucket.total_btc <= 0 or bucket.total_usd < self._min_usd:
            return
        vwap = bucket.total_usd / bucket.total_btc
        await self._on_emit(
            WhalePrint(
                ts_ms=bucket.last_ts_ms,
                venue=venue,
                side="buy" if bucket.side == "buy" else "sell",
                price=round(vwap, 2),
                size_btc=round(bucket.total_btc, 6),
                notional_usd=round(bucket.total_usd, 2),
            )
        )

    async def close(self) -> None:
        for venue in ("binance", "bybit"):
            task = self._flush_tasks[venue]
            if task is not None and not task.done():
                task.cancel()
            await self._flush(venue)
```