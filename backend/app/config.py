from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "NEON AI TRADING HQ"
    app_env: str = "development"
    trading_mode: str = "DEMO"
    live_trading_enabled: bool = False

    database_url: str = ""
    redis_url: str = ""

    binance_testnet: bool = True
    binance_api_key: str = ""
    binance_api_secret: str = ""

    gemini_api_key: str = ""
    anthropic_api_key: str = ""
    ollama_base_url: str = "http://localhost:11434"

    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")


settings = Settings()
