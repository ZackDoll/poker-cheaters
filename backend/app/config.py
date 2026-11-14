from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

BACKEND_DIR = Path(__file__).resolve().parent.parent


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=BACKEND_DIR / ".env", extra="ignore")

    database_url: str = "postgresql+psycopg://poker:poker@localhost:5432/poker"
    max_upload_bytes: int = Field(default=50 * 1024 * 1024, gt=0)
    signal_timeout_seconds: float = Field(default=15.0, gt=0)

    # Live rooms. The secret is shared with the Vercel login function that signs room
    # tokens. Empty means live rooms refuse every connection.
    room_token_secret: str = ""
    cors_origins: list[str] = ["http://localhost:3000", "http://localhost:5173"]

    # Placeholders chosen by hand, not fitted to data. Every entry in
    # app/ml/registry.py needs a weight here, or startup fails.
    bluff_prior: float = Field(default=0.35, gt=0, lt=1)
    fusion_weights: dict[str, float] = {
        "statistics": 1.0,
        "facial": 0.5,
        "speech": 0.5,
        "live_facial": 0.5,
    }


@lru_cache
def get_settings() -> Settings:
    return Settings()
