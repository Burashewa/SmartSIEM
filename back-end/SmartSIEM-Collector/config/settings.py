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

    # Queue output ("file" | "mongodb" | "kafka" | "mongodb+kafka" | "null")
    queue_output: str = "file"
    queue_file_path: str = "logs.ndjson"
    queue_batch_size: int = 100
    queue_flush_interval_ms: int = 1000

    # MongoDB (when queue_output="mongodb"); set via MONGO_URI env var
    mongo_uri: str = "mongodb://localhost:27017"

    # Kafka (Aiven, etc.) (when queue_output includes "kafka")
    kafka_bootstrap_servers: str = ""
    kafka_topic: str = "normalized-logs"
    kafka_cert_folder: str = "certs"

    # Enrichment (post-normalize, pre-output)
    enrichment_enabled: bool = True
    geoip_mmdb_path: str = ""
    critical_assets_json_path: str = ""
    user_directory_json_path: str = ""
    threat_intel_enabled: bool = False
    threat_intel_provider: str = "placeholder"
