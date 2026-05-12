"""Application settings for SmartSIEM unified backend."""

from functools import lru_cache
from typing import Literal

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Settings loaded from environment variables and optional .env."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    app_name: str = "SmartSIEM Backend"
    environment: str = "development"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173"

    http_host: str = "0.0.0.0"
    http_port: int = 8080

    mongo_uri: str = "mongodb://localhost:27017"
    mongo_db_name: str = "siem"
    mongo_connect_timeout_ms: int = 10000

    ingest_queue_maxsize: int = Field(default=10000, ge=1)
    detection_queue_maxsize: int = Field(default=10000, ge=1)
    ingest_worker_batch_size: int = Field(default=250, ge=1)
    ingest_worker_flush_interval_ms: int = Field(default=500, ge=50)

    log_retention_days: int = Field(default=30, ge=1)
    log_level: str = "INFO"
    log_format: Literal["json", "text"] = "json"

    jwt_secret_key: str = "change-me"
    jwt_algorithm: str = "HS256"
    access_token_expire_minutes: int = Field(default=15, ge=1)
    refresh_token_expire_minutes: int = Field(default=10080, ge=1)

    ingestion_rate_limit: str = "500/minute"
    websocket_ping_interval_sec: int = Field(default=30, ge=5)

    enrichment_enabled: bool = True
    geoip_mmdb_path: str = ""
    critical_assets_json_path: str = ""
    user_directory_json_path: str = ""
    threat_intel_enabled: bool = False
    threat_intel_provider: str = "placeholder"

    default_admin_username: str = "admin"
    default_admin_email: str = "admin@smartsiem.local"
    default_admin_password: str = "admin123"

    @property
    def cors_origin_list(self) -> list[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    """Return cached settings instance to keep config reads consistent."""
    return Settings()
