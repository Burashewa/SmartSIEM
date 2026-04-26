"""Standard Pydantic schema for SIEM-normalized log events."""

import json
from datetime import datetime, timezone
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

def _ingestion_source_to_siem(
    ingestion_source: str,
    payload_source: str | None = None,
) -> SourceType | None:
    """Map ingestion source + optional payload source to SIEM source category."""
    s = ingestion_source.lower()
    payload = (payload_source or "").strip().lower()

    if s.startswith("http") and payload in {"os", "system", "linux", "kali"}:
        return "system"

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
    "hostname": "deviceId",
    "Hostname": "deviceId",
    "timestamp": "timestamp",
    "EventReceivedTime": "timestamp",
    "username": "user",
    "user": "user",
    "AccountName": "user",
    "TargetUserName": "user",
    "runas_user": "role",
    "message": "metadata",
    "Message": "event",
    "priority": "metadata",
    "method": "method",
    "path": "endpoint",
    "status": "status",
    "user_agent": "userAgent",
    "program": "metadata",
    "app_name": "metadata",
    "Severity": "severity",
    "SourceModuleName": "tags",
    "ProcessID": "metadata",
    "source": "metadata",
}

_FIELD_MAP_CI: dict[str, str] = {k.lower(): v for k, v in _FIELD_MAP.items()}

_AUTH_LOG_TYPES = {
    "ssh_failed_password",
    "ssh_accepted",
    "sudo",
    "unix_chkpwd",
    "pam_session",
    "authentication_failure",
}

_FAILED_TERMS = ("failed", "failure", "incorrect", "invalid", "denied")
_SUCCESS_TERMS = ("accepted", "success", "opened")


def _safe_to_text(value: Any) -> str:
    """Convert arbitrary values to a normalized lowercase text string."""
    if value is None:
        return ""
    if isinstance(value, str):
        return value.lower()
    return str(value).lower()


def _normalize_timestamp(value: Any) -> str | None:
    """Normalize timestamp; emit UTC ISO-8601 when timezone info is present."""
    if value is None:
        return None
    if isinstance(value, datetime):
        if value.tzinfo is not None:
            return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        return value.isoformat()

    text = str(value).strip()
    if not text:
        return None

    if "t" in text.lower():
        iso_candidate = text.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(iso_candidate)
            if parsed.tzinfo is not None:
                return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
            return parsed.isoformat()
        except ValueError:
            return text

    return text


def _get_case_insensitive(fields: dict[str, Any], wanted_key: str) -> Any:
    """Return a field value by case-insensitive key lookup."""
    wanted = wanted_key.lower()
    for key, value in fields.items():
        if key.lower() == wanted:
            return value
    return None


def _resolve_field_attr(key: str, siem_attrs: set[str]) -> str:
    """Resolve parser key to SIEM attribute using exact + case-insensitive maps."""
    if key in _FIELD_MAP:
        return _FIELD_MAP[key]

    lowered = key.lower()
    if lowered in _FIELD_MAP_CI:
        return _FIELD_MAP_CI[lowered]

    for attr in siem_attrs:
        if attr.lower() == lowered:
            return attr

    return key


def _infer_status(log_type: str, fields: dict[str, Any], current: StatusType | None) -> StatusType | None:
    """Infer event status from log_type + field text, preserving HTTP numeric logic."""
    status = current

    parser_status = _get_case_insensitive(fields, "status")
    if parser_status is not None:
        ps = str(parser_status).strip()
        if ps in ("200", "201", "2xx"):
            status = "success"
        elif ps and ps.startswith(("4", "5")):
            status = "failed"

    combined_text = " ".join([
        _safe_to_text(log_type),
        " ".join(_safe_to_text(v) for v in fields.values()),
    ])

    if any(term in combined_text for term in _FAILED_TERMS):
        return "failed"
    if any(term in combined_text for term in _SUCCESS_TERMS):
        return "success"
    return status


def _infer_severity(log_type: str, fields: dict[str, Any]) -> str | None:
    """Infer severity for auth/system events with conservative defaults."""
    log_type_l = log_type.lower()
    combined_text = " ".join([
        log_type_l,
        " ".join(_safe_to_text(v) for v in fields.values()),
    ])

    if (
        log_type_l == "ssh_failed_password"
        or log_type_l == "authentication_failure"
        or (log_type_l == "sudo" and "incorrect" in combined_text and "password" in combined_text)
        or "authentication_failure" in combined_text
    ):
        return "high"

    if (
        "session opened" in combined_text
        or "session closed" in combined_text
        or log_type_l == "pam_session"
        or "stopping service" in combined_text
    ):
        return "medium"

    if (
        log_type_l in {"kali_syslog", "syslog_rfc3164", "syslog_rfc5424"}
        or "systemd" in combined_text
        or "fwupdmgr" in combined_text
    ):
        return "low"

    return None


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

    payload_source = _safe_to_text(_get_case_insensitive(fields, "source")) or None
    siem_source = _ingestion_source_to_siem(source, payload_source=payload_source) if source else None

    hostname_field = _get_case_insensitive(fields, "hostname")
    if hostname_field is not None and str(hostname_field).strip():
        siem_source = "system"

    status = _infer_status(log_type, fields, current=None)

    if payload_source in {"os", "system", "linux", "kali"} and log_type in _AUTH_LOG_TYPES:
        siem_source = "auth"
    elif payload_source in {"os", "system", "linux", "kali"} and siem_source == "web":
        siem_source = "system"

    severity = _infer_severity(log_type, fields)

    mapped: dict[str, Any] = {
        "source": siem_source,
        "severity": severity,
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

        key_l = key.lower()

        if key_l in {"timestamp", "eventreceivedtime"}:
            normalized_ts = _normalize_timestamp(value)
            if normalized_ts is not None:
                mapped["timestamp"] = normalized_ts
            continue

        if log_type == "sudo" and key_l == "command":
            mapped["resource"] = str(value)
            mapped["metadata"][key] = value
            continue

        if key_l in {"program", "pid", "tty", "pwd"}:
            mapped["metadata"][key] = value
            continue

        attr = _resolve_field_attr(key, siem_attrs)
        # Preserve dict/list for payload, metadata, raw, tags
        if attr in ("payload", "metadata", "raw") and isinstance(value, dict):
            mapped[attr] = value
        elif attr == "tags" and isinstance(value, list):
            mapped["tags"] = [str(x) for x in value if x is not None]
        elif attr == "tags":
            tag = str(value).strip()
            if tag and tag not in mapped["tags"]:
                mapped["tags"].append(tag)
        elif attr == "status" and value not in ("success", "failed"):
            mapped["metadata"][key] = value
        elif attr in siem_attrs:
            mapped[attr] = value
        else:
            mapped["metadata"][key] = value

    source_tag_candidates: list[str] = []
    if payload_source:
        source_tag_candidates.append(payload_source)
    hostname = _get_case_insensitive(fields, "hostname")
    if isinstance(hostname, str) and hostname.strip():
        source_tag_candidates.append(hostname.strip().lower())

    for tag in source_tag_candidates:
        if tag not in mapped["tags"]:
            mapped["tags"].append(tag)

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
