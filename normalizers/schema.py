"""Standard Pydantic schema for SIEM-normalized log events."""

import json
from typing import Any, Literal

from pydantic import BaseModel, Field


# ---------------------------------------------------------------------------
# Restricted value types
# ---------------------------------------------------------------------------

SourceType = Literal["web", "auth", "api", "system", "file"]
StatusType = Literal["success", "failed"]


class SIEMEvent(BaseModel):
    """
    Standardized SIEM event schema.

    All optional fields default to None (serializes as null in JSON).
    """

    timestamp: str | None = Field(default=None, description="ISO 8601 event timestamp")
    source: SourceType | None = Field(default=None, description="Event source category")
    severity: str | None = Field(default=None, description="Severity level (e.g. low, medium, high)")
    event: str | None = Field(default=None, description="Event type (e.g. authentication)")
    action: str | None = Field(default=None, description="Action performed (e.g. login)")
    status: StatusType | None = Field(default=None, description="Outcome: success or failed")
    user: str | None = Field(default=None, description="User involved in the event")
    role: str | None = Field(default=None, description="User role")
    ip: str | None = Field(default=None, description="Client/source IP address")
    deviceId: str | None = Field(default=None, description="Device identifier")
    sessionId: str | None = Field(default=None, description="Session identifier")
    endpoint: str | None = Field(default=None, description="API/HTTP endpoint path")
    method: str | None = Field(default=None, description="HTTP method")
    resource: str | None = Field(default=None, description="Resource accessed")
    payload: dict[str, Any] | None = Field(default=None, description="Request/event payload")
    userAgent: str | None = Field(default=None, description="User-Agent header")
    latitude: float | None = Field(default=None, description="Geolocation latitude")
    longitude: float | None = Field(default=None, description="Geolocation longitude")
    tags: list[str] = Field(default_factory=list, description="Event tags")
    metadata: dict[str, Any] = Field(default_factory=dict, description="Additional metadata")
    raw: dict[str, Any] = Field(default_factory=dict, description="Original unparsed log (always included)")

    model_config = {"extra": "forbid", "str_strip_whitespace": True}

    def to_siem_json(self) -> str:
        """
        Serialize to JSON string with explicit null for unset fields.

        Fields with None values are included as null in the output.
        """
        data = self.model_dump(mode="json")
        return json.dumps(data, ensure_ascii=False, default=str)

    def to_json_dict(self) -> dict[str, Any]:
        """Return dict for pipeline (includes nulls, JSON-serializable)."""
        return self.model_dump(mode="json")


# ---------------------------------------------------------------------------
# Mapping: ingestion source -> SIEM source category
# ---------------------------------------------------------------------------

def _ingestion_source_to_siem(ingestion_source: str) -> SourceType | None:
    """Map ingestion source (udp:, http:) to SIEM source category."""
    s = ingestion_source.lower()
    if s.startswith("http"):
        return "web"
    if "api" in s or "rest" in s:
        return "api"
    if "auth" in s or "login" in s:
        return "auth"
    if s.startswith("udp") or s.startswith("tcp") or "syslog" in s:
        return "system"
    return None


# ---------------------------------------------------------------------------
# Mapping: parser output -> SIEMEvent
# ---------------------------------------------------------------------------

_FIELD_MAP: dict[str, str] = {
    "client_ip": "ip",
    "hostname": "metadata",  # store in metadata
    "timestamp": "timestamp",
    "username": "user",
    "user": "user",
    "runas_user": "role",
    "message": "metadata",
    "priority": "metadata",
    "method": "method",
    "path": "endpoint",
    "status": "status",
    "user_agent": "userAgent",
    "program": "metadata",
    "app_name": "metadata",
}


def normalize(
    log_type: str,
    fields: dict[str, Any],
    raw: str | dict[str, Any],
    source: str = "",
) -> SIEMEvent:
    """
    Map parsed fields to the SIEM event schema.

    Args:
        log_type: Parsed log type from BaseParser.
        fields: Extracted fields from parsing.
        raw: Original raw log (string or dict).
        source: Ingestion source identifier (e.g. udp:192.168.1.1:514).

    Returns:
        Validated SIEMEvent instance.
    """
    raw_dict: dict[str, Any] = (
        {"log": raw} if isinstance(raw, str) else raw
    )

    siem_source = _ingestion_source_to_siem(source) if source else None

    # Infer status from log_type
    status: StatusType | None = None
    if "failed" in log_type or "fail" in log_type or "error" in log_type:
        status = "failed"
    elif "accepted" in log_type or "success" in log_type:
        status = "success"

    # Map parser status if present (may be str or int from HTTP status)
    parser_status = fields.get("status")
    if parser_status is not None:
        ps = str(parser_status).strip()
        if ps in ("200", "201", "2xx"):
            status = "success"
        elif ps and ps.startswith(("4", "5")):
            status = "failed"

    mapped: dict[str, Any] = {
        "source": siem_source,
        "event": log_type,
        "status": status,
        "tags": [log_type],
        "metadata": {},
        "raw": raw_dict,
    }

    # Map known fields to top-level SIEM attrs; rest go to metadata
    siem_attrs = {f for f in SIEMEvent.model_fields if f not in ("raw", "metadata", "tags")}
    for key, value in fields.items():
        if value is None or (isinstance(value, str) and not value.strip()):
            continue
        attr = _FIELD_MAP.get(key, key)
        # Preserve dict/list for payload, metadata, raw, tags
        if attr in ("payload", "metadata", "raw") and isinstance(value, dict):
            mapped[attr] = value
        elif attr == "tags" and isinstance(value, list):
            mapped["tags"] = [str(x) for x in value if x is not None]
        elif attr == "status" and value not in ("success", "failed"):
            mapped["metadata"][key] = value
        elif attr in siem_attrs:
            mapped[attr] = value
        else:
            mapped["metadata"][key] = value

    return SIEMEvent(**mapped)


# ---------------------------------------------------------------------------
# Example usage
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    event = SIEMEvent(
        timestamp="2026-03-18T10:30:00Z",
        source="web",
        severity="medium",
        event="authentication",
        action="login",
        status="failed",
        user="admin",
        role="user",
        ip="192.168.1.10",
        deviceId="chrome_windows",
        sessionId="sess_123",
        endpoint="/login",
        method="POST",
        resource=None,
        payload={"username": "admin", "password": "' OR 1=1 --"},
        userAgent="Mozilla/5.0",
        latitude=9.03,
        longitude=38.74,
        tags=["authentication", "web"],
        metadata={},
        raw={},
    )
    print(event.to_siem_json())
    print()
    print("--- from normalize() ---")
    n = normalize(
        log_type="ssh_failed_password",
        fields={"username": "admin", "client_ip": "192.168.1.1", "port": "22"},
        raw="<34>Oct 11 22:14:15 host sshd: Failed password for admin from 192.168.1.1 port 22",
        source="udp:10.0.0.1:514",
    )
    print(n.to_siem_json())
