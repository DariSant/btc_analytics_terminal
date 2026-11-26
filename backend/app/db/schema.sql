-- SQLite WAL Schema for BTC Analytics Terminal
-- Retention policy: 14-day rolling window pruned hourly by ts_ms

CREATE TABLE IF NOT EXISTS whale_trades (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_ms INTEGER NOT NULL,
    venue TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    size_btc REAL NOT NULL,
    notional_usd REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_whale_trades_ts_notional
    ON whale_trades (ts_ms, notional_usd);

CREATE TABLE IF NOT EXISTS liquidations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_ms INTEGER NOT NULL,
    venue TEXT NOT NULL,
    side TEXT NOT NULL,
    price REAL NOT NULL,
    size_btc REAL NOT NULL,
    notional_usd REAL NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_liquidations_ts
    ON liquidations (ts_ms);

CREATE TABLE IF NOT EXISTS options_snapshots (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    ts_ms INTEGER NOT NULL,
    expiry_key TEXT NOT NULL,
    underlying_price REAL NOT NULL,
    call_wall REAL NOT NULL,
    put_wall REAL NOT NULL,
    max_pain REAL NOT NULL,
    put_call_ratio REAL NOT NULL,
    net_gex_usd REAL NOT NULL,
    strikes_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_options_snapshots_expiry_ts
    ON options_snapshots (expiry_key, ts_ms);
