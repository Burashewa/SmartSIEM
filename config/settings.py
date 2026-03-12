"""Environment-based configuration for SmartSIEM Collector."""

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """Application settings loaded from environment and .env file."""

    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
    )

    # Syslog listener
    syslog_host: str = "0.0.0.0"
    syslog_udp_port: int = 514
    syslog_tcp_port: int = 5140

    # HTTP API listener (for agents sending JSON)
    http_host: str = "0.0.0.0"
    http_port: int = 8080

    # Queue output ("file" | "null")
    queue_output: str = "file"
    queue_file_path: str = "logs.ndjson"
    queue_batch_size: int = 100
    queue_flush_interval_ms: int = 1000
