"""Active mapper from parser output to nested normalized event records."""

from __future__ import annotations

import json
from datetime import datetime, timezone
from typing import Any

from normalizers.ocsf_model import OCSFEvent
from parsers.base_parser import ParseResult


class LogToOCSFMapper:
    """Map parser results into nested normalized event dictionaries."""

    _AUTH_TYPES = {
        "ssh_failed_password",
        "ssh_accepted",
        "sudo",
        "sudo_incorrect_password",
        "pam_sudo_auth_failure",
        "unix_chkpwd",
        "pam_session",
        "authentication_failure",
        "authentication",
    }

    _ACCOUNT_CHANGE_TOKENS = {
        "useradd",
        "usermod",
        "userdel",
        "groupadd",
        "groupmod",
        "groupdel",
        "account_change",
        "password_change",
        "privilege_change",
    }

    _NETWORK_TYPES = {
        "firewall",
        "dns",
        "netflow",
        "network",
        "http_access",
        "connection",
        "dhcp_lease",
    }

    _SEVERITY_MAP = {
        "informational": "low",
        "info": "low",
        "low": "low",
        "medium": "medium",
        "med": "medium",
        "high": "high",
        "critical": "critical",
        "crit": "critical",
    }

    _STATUS_MAP = {
        "success": "success",
        "ok": "success",
        "passed": "success",
        "accepted": "success",
        "failure": "failure",
        "failed": "failure",
        "error": "failure",
        "denied": "failure",
        "rejected": "failure",
    }

    def __init__(self, result: ParseResult) -> None:
        self._result = result
        self._log_type = (result.log_type or "unknown").strip().lower()
        self._fields = dict(result.fields or {})
        self._flattened_fields = self._flatten_nested(self._fields)

    def map(self) -> dict[str, Any]:
        """Return transformed flat normalized event."""
        ecs_action_meta = self._ecs_action_and_meta()
        mapped: dict[str, Any] = dict(self._fields)

        event_id = self._coerce_string(self._pick_field("event_id", "eventId", "EventID", "id"))
        timestamp = self._normalize_timestamp(
            self._pick_field("timestamp", "@timestamp", "EventReceivedTime", "time")
        )
        source = self._normalize_source(
            self._pick_field(
                "source",
                "source_name",
                "observer.product",
                "observer_product",
                "Hostname",
                "hostname",
            )
        )
        severity = self._determine_severity()
        status = self._normalize_status(
            self._pick_field("status", "result", "event.outcome", "outcome")
        )
        action = (
            self._coerce_string(
                self._pick_field("action", "event.action", "event_action", "ecs_action")
            )
            or ecs_action_meta["event_action"]
        )
        event_name = (
            self._normalize_event_name(self._pick_field("event", "eventName", "event_name"))
            or action
            or self._log_type
            or "unknown"
        )
        user = self._normalize_user(
            self._pick_field(
                "user",
                "username",
                "user.name",
                "AccountName",
                "TargetUserName",
                "ruser",
                "logname",
            )
        )

        ip_value = self._coerce_string(
            self._pick_field("ip", "source.ip", "destination.ip", "src_ip", "dst_ip")
        )
        device_id = self._coerce_string(
            self._pick_field("deviceId", "device_id", "host.name", "hostname", "Hostname")
        )
        session_id = self._coerce_string(self._pick_field("sessionId", "session_id"))
        endpoint = self._coerce_string(self._pick_field("endpoint", "url.path", "path"))
        method = self._coerce_string(self._pick_field("method", "http.request.method"))
        resource = self._coerce_string(self._pick_field("resource"))

        message = self._coerce_string(
            self._pick_field("message", "Message", "msg", "log", "line", "rawLine")
        ) or self._result.raw
        log_value = self._coerce_string(self._pick_field("log")) or message
        line_value = self._coerce_string(self._pick_field("line")) or log_value
        raw_line = self._coerce_string(self._pick_field("rawLine")) or line_value

        payload = self._coerce_dict(self._pick_field("payload")) or {}
        metadata = self._coerce_dict(self._pick_field("metadata")) or {}
        tags = self._coerce_list(self._pick_field("tags")) or []
        raw_obj = self._coerce_dict(self._pick_field("raw")) or {}

        mapped.update(
            {
                "timestamp": timestamp,
                "source": source or "unknown",
                "severity": severity,
                "event": event_name,
                "action": action or "",
                "status": status,
                "user": user or "",
                "role": self._coerce_string(self._pick_field("role")) or "",
                "deviceId": device_id or "",
                "sessionId": session_id or "",
                "endpoint": endpoint or "",
                "method": method or "",
                "resource": resource or "",
                "payload": payload,
                "metadata": metadata,
                "tags": tags,
                "message": message,
                "log": log_value,
                "line": line_value,
                "rawLine": raw_line,
                "raw": raw_obj,
            }
        )
        if event_id:
            mapped["event_id"] = event_id
        if ip_value:
            mapped["ip"] = ip_value
        else:
            mapped.pop("ip", None)
        return mapped

    def _ecs_action_and_meta(self) -> dict[str, Any]:
        """Derive ECS-style fields from regex log_type."""
        lt = self._log_type
        command = self._pick_field("command")
        service = self._pick_field("service")

        if lt == "unix_chkpwd":
            return {
                "event_action": "password_check",
                "category": "authentication",
                "event_type": "event",
                "outcome": "failure",
                "severity": "medium",
                "command_line": None,
                "service_name": None,
            }
        if lt == "pam_sudo_auth_failure":
            return {
                "event_action": "sudo_auth",
                "category": "authentication",
                "event_type": "event",
                "outcome": "failure",
                "severity": "high",
                "command_line": None,
                "service_name": None,
            }
        if lt == "sudo_incorrect_password":
            return {
                "event_action": "sudo_command",
                "category": "authentication",
                "event_type": "event",
                "outcome": "failure",
                "severity": "medium",
                "command_line": command,
                "service_name": None,
            }
        if lt == "sudo":
            return {
                "event_action": "sudo_command",
                "category": "authentication",
                "event_type": "event",
                "outcome": "success",
                "severity": "medium",
                "command_line": command,
                "service_name": None,
            }
        if lt == "dhcp_lease":
            return {
                "event_action": "dhcp_lease",
                "category": "network_activity",
                "event_type": "event",
                "outcome": "success",
                "severity": "low",
                "command_line": None,
                "service_name": None,
            }
        if lt == "systemd_started":
            return {
                "event_action": "service_started",
                "category": "host",
                "event_type": "start",
                "outcome": "success",
                "severity": "low",
                "command_line": None,
                "service_name": service,
            }
        if lt == "systemd_finished":
            return {
                "event_action": "service_finished",
                "category": "host",
                "event_type": "end",
                "outcome": "success",
                "severity": "low",
                "command_line": None,
                "service_name": service,
            }
        # Default fallbacks
        return {
            "event_action": lt,
            "category": self._determine_category(),
            "event_type": "start",
            "outcome": self._determine_status(),
            "severity": self._determine_severity(),
            "command_line": command,
            "service_name": service,
        }

    def _pick_field(self, *keys: str) -> Any:
        for key in keys:
            if key in self._fields:
                return self._fields[key]
            if key in self._flattened_fields:
                return self._flattened_fields[key]
            lowered = key.lower()
            for existing_key, value in self._fields.items():
                if existing_key.lower() == lowered:
                    return value
            for existing_key, value in self._flattened_fields.items():
                if existing_key.lower() == lowered:
                    return value
        return None

    def _coerce_string(self, value: Any) -> str | None:
        if value is None:
            return None
        if isinstance(value, str):
            text = value.strip()
            return text or None
        if isinstance(value, (int, float, bool)):
            return str(value)
        return None

    def _coerce_dict(self, value: Any) -> dict[str, Any] | None:
        if isinstance(value, dict):
            return value
        return None

    def _coerce_list(self, value: Any) -> list[Any] | None:
        if isinstance(value, list):
            return value
        return None

    def _normalize_source(self, value: Any) -> str | None:
        top = self._coerce_string(value)
        if top:
            return top
        return (
            self._coerce_string(
                self._pick_field("source.name", "host.name", "observer.product", "observer_product")
            )
            or None
        )

    def _normalize_event_name(self, value: Any) -> str | None:
        direct = self._coerce_string(value)
        if direct:
            return direct
        return self._coerce_string(
            self._pick_field("event.name", "event.category", "event.type", "event.action")
        )

    def _normalize_user(self, value: Any) -> str | None:
        direct = self._coerce_string(value)
        if direct:
            return direct
        return self._coerce_string(self._pick_field("user.name"))

    def _flatten_nested(
        self, fields: dict[str, Any], prefix: str = ""
    ) -> dict[str, Any]:
        flat: dict[str, Any] = {}
        for key, value in fields.items():
            full_key = f"{prefix}.{key}" if prefix else str(key)
            if isinstance(value, dict):
                flat.update(self._flatten_nested(value, full_key))
            else:
                flat[full_key] = value
        return flat

    def _determine_category(self) -> str:
        text_blob = f"{self._log_type} {' '.join(str(v).lower() for v in self._fields.values())}"
        if self._log_type in self._AUTH_TYPES or "auth" in text_blob or "login" in text_blob:
            return "authentication"
        if any(token in text_blob for token in self._ACCOUNT_CHANGE_TOKENS):
            return "account_change"
        if (
            self._log_type in self._NETWORK_TYPES
            or any(token in text_blob for token in ("network", "dns", "ip", "port", "connection"))
        ):
            return "network_activity"
        return "unknown"

    def _determine_severity(self) -> str:
        value = self._pick_field("severity", "Severity", "level", "priority")
        if value is None:
            return "low"
        if isinstance(value, (int, float)):
            ivalue = int(value)
            if ivalue >= 5:
                return "critical"
            if ivalue == 4:
                return "high"
            if ivalue == 3:
                return "medium"
            return "low"
        text = str(value).strip().lower()
        if text.isdigit():
            ivalue = int(text)
            if ivalue >= 5:
                return "critical"
            if ivalue == 4:
                return "high"
            if ivalue == 3:
                return "medium"
            return "low"
        return self._SEVERITY_MAP.get(text, "low")

    def _determine_status(self) -> str:
        value = self._pick_field("status", "result", "outcome", "event.outcome")
        if value is None:
            return "unknown"
        return self._STATUS_MAP.get(str(value).strip().lower(), "unknown")

    def _normalize_status(self, value: Any) -> str:
        if value is None:
            return self._determine_status()
        mapped = self._STATUS_MAP.get(str(value).strip().lower())
        if mapped:
            return mapped
        text = self._coerce_string(value)
        return text or "unknown"

    def _normalize_timestamp(self, value: Any) -> str:
        if value is None:
            return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        if isinstance(value, datetime):
            if value.tzinfo is None:
                return value.isoformat()
            return value.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        text = str(value).strip()
        if not text:
            return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")
        candidate = text.replace("Z", "+00:00")
        try:
            parsed = datetime.fromisoformat(candidate)
            if parsed.tzinfo is None:
                return parsed.isoformat()
            return parsed.astimezone(timezone.utc).isoformat().replace("+00:00", "Z")
        except ValueError:
            return text

    def _to_int(self, value: Any) -> int | None:
        if value is None:
            return None
        try:
            return int(str(value).strip())
        except (ValueError, TypeError):
            return None

    def _to_float(self, value: Any) -> float | None:
        if value is None:
            return None
        try:
            return float(str(value).strip())
        except (ValueError, TypeError):
            return None


def normalize(
    log_type: str,
    fields: dict[str, Any],
    raw: str | dict[str, Any],
    source: str = "",
) -> OCSFEvent:
    """Normalize parser output into a flat SIEM event."""
    import logging

    logger = logging.getLogger(__name__)
    logger.debug("Normalize start log_type=%s fields=%d source=%s", log_type, len(fields), source or "unknown")
    _ = source  # Mapper is ingestion-source agnostic by design.
    raw_text = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False, default=str)
    result = ParseResult(log_type=log_type, fields=fields, raw=raw_text)
    mapped = LogToOCSFMapper(result).map()
    out = OCSFEvent(**mapped)
    logger.debug("Normalize end keys=%d", len(out.model_dump(mode="json")))
    return out
