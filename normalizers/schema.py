"""Standard Pydantic schema for normalized log events."""

from datetime import datetime
from typing import Any

from pydantic import BaseModel, Field, field_validator


class NormalizedLog(BaseModel):
    """
    Canonical schema for log events after parsing and normalization.

    Maps extracted fields from various log types to a uniform structure
    suitable for SIEM storage and downstream processing.
    """

    # Core identification
    log_type: str = Field(..., description="Parsed log type (e.g. ssh_failed_password)")
    raw: str = Field(..., description="Original raw log payload")
    source: str = Field(default="", description="Ingestion source (e.g. udp:192.168.1.1:514)")

    # Timestamp (ISO 8601 preferred)
    timestamp: str | None = Field(default=None, description="Event timestamp from log or ingestion")

    # Host / network
    hostname: str | None = Field(default=None, description="Host that generated the log")
    src_ip: str | None = Field(default=None, description="Source/client IP address")
    dst_ip: str | None = Field(default=None, description="Destination IP (if applicable)")

    # Identity / auth
    username: str | None = Field(default=None, description="User involved in the event")
    runas_user: str | None = Field(default=None, description="Target user (e.g. sudo)")

    # HTTP / web (for access logs)
    method: str | None = Field(default=None, description="HTTP method")
    path: str | None = Field(default=None, description="Request path")
    status: str | None = Field(default=None, description="HTTP status code")
    user_agent: str | None = Field(default=None, description="User-Agent header")

    # Message and metadata
    message: str | None = Field(default=None, description="Log message or summary")
    facility: str | None = Field(default=None, description="Syslog facility/priority")
    program: str | None = Field(default=None, description="Program/process name")

    # Catch-all for unmapped fields (preserves full extraction)
    extra: dict[str, str] = Field(default_factory=dict, description="Additional extracted fields")

    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    def to_json_dict(self) -> dict[str, Any]:
        """Serialize to dict, excluding None values for compact output."""
        data = self.model_dump()
        return {k: v for k, v in data.items() if v is not None and v != ""}


# ---------------------------------------------------------------------------
# Field mapping: parser output key -> NormalizedLog attribute
# ---------------------------------------------------------------------------

_FIELD_MAP: dict[str, str] = {
    "client_ip": "src_ip",
    "hostname": "hostname",
    "timestamp": "timestamp",
    "username": "username",
    "runas_user": "runas_user",
    "user": "username",
    "message": "message",
    "priority": "facility",
    "method": "method",
    "path": "path",
    "status": "status",
    "user_agent": "user_agent",
    "program": "program",
    "app_name": "program",
}


def normalize(
    log_type: str,
    fields: dict[str, str],
    raw: str,
    source: str = "",
) -> NormalizedLog:
    """
    Map parsed fields to the canonical NormalizedLog schema.

    Args:
        log_type: Parsed log type from BaseParser.
        fields: Extracted fields from parsing.
        raw: Original raw log string.
        source: Ingestion source identifier.

    Returns:
        Validated NormalizedLog instance.
    """
    mapped: dict[str, Any] = {
        "log_type": log_type,
        "raw": raw,
        "source": source,
    }

    extra: dict[str, str] = {}

    for key, value in fields.items():
        if not value:
            continue
        attr = _FIELD_MAP.get(key, key)
        if attr in NormalizedLog.model_fields and attr not in ("extra", "log_type", "raw", "source"):
            mapped[attr] = value
        else:
            extra[key] = value

    mapped["extra"] = extra

    return NormalizedLog(**mapped)
