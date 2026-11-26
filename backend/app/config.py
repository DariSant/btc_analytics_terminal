"""Application configuration via Pydantic BaseSettings."""

from functools import lru_cache

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Runtime configuration loaded from environment variables with safe local defaults."""

    SQLITE_PATH: str = "./data/terminal.db"
    CORS_ORIGINS: list[str] = [
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ]
    BINANCE_REST_URL: str = "https://fapi.binance.com"
    BINANCE_WS_URL: str = (
        "wss://fstream.binance.com/market/stream?streams="
        "btcusdt@aggTrade/btcusdt@forceOrder/btcusdt@markPrice@1s/"
        "btcusdt@kline_1m/btcusdt@kline_5m/btcusdt@kline_15m/"
        "btcusdt@kline_1h/btcusdt@kline_4h/btcusdt@kline_1d"
    )
    BYBIT_REST_URL: str = "https://api.bybit.com"
    BYBIT_WS_URL: str = "wss://stream.bybit.com/v5/public/linear"
    DERIBIT_REST_URL: str = "https://www.deribit.com/api/v2"
    WHALE_MIN_USD: float = 100_000.0
    LIQ_MIN_USD: float = 25_000.0
    RETENTION_DAYS: int = 14

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached Settings instance."""
    return Settings()
