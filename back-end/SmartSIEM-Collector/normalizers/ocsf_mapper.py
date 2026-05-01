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
        self._event = self._fields.get("event") if isinstance(self._fields.get("event"), dict) else {}
        self._source = self._fields.get("source") if isinstance(self._fields.get("source"), dict) else {}
        self._destination = (
            self._fields.get("destination")
            if isinstance(self._fields.get("destination"), dict)
            else {}
        )
        self._user = self._fields.get("user") if isinstance(self._fields.get("user"), dict) else {}
        self._host = self._fields.get("host") if isinstance(self._fields.get("host"), dict) else {}
        self._observer = (
            self._fields.get("observer") if isinstance(self._fields.get("observer"), dict) else {}
        )
        self._network = (
            self._fields.get("network") if isinstance(self._fields.get("network"), dict) else {}
        )
        self._service = (
            self._fields.get("service") if isinstance(self._fields.get("service"), dict) else {}
        )
        self._process = (
            self._fields.get("process") if isinstance(self._fields.get("process"), dict) else {}
        )

    def map(self) -> dict[str, Any]:
        """Return transformed nested normalized event."""
        ecs_action_meta = self._ecs_action_and_meta()
        category = (
            self._pick_nested(self._event, "category") or ecs_action_meta["category"]
        )
        severity = (
            self._pick_nested(self._event, "severity") or ecs_action_meta["severity"]
        )
        outcome = (
            self._pick_nested(self._event, "outcome") or ecs_action_meta["outcome"]
        )
        event_action = (
            self._pick_nested(self._event, "action")
            or self._pick_field("event_action", "ecs_action")
            or ecs_action_meta["event_action"]
        )
        timestamp = self._normalize_timestamp(
            self._pick_field("timestamp", "EventReceivedTime", "time")
        )
        source_port = self._to_int(
            self._pick_nested(self._source, "port")
            or self._pick_field("source_port", "src_port", "client_port", "port")
        )
        destination_port = self._to_int(
            self._pick_nested(self._destination, "port")
            or self._pick_field("destination_port", "dest_port", "dst_port", "dport")
        )
        source_geo = self._source.get("geo") if isinstance(self._source.get("geo"), dict) else {}
        source_host = self._source.get("host") if isinstance(self._source.get("host"), dict) else {}
        destination_host = (
            self._destination.get("host")
            if isinstance(self._destination.get("host"), dict)
            else {}
        )

        mapped: dict[str, Any] = {
            "time": timestamp,
            "event": {
                "id": str(
                    self._pick_nested(self._event, "id")
                    or self._pick_field("event_id", "EventID", "id")
                    or ""
                ),
                "category": category,
                "type": str(
                    self._pick_nested(self._event, "type")
                    or self._pick_field("event_type", "type")
                    or ecs_action_meta["event_type"]
                    or "start"
                ),
                "action": str(event_action),
                "outcome": outcome,
                "severity": severity,
            },
            "source": {
                "ip": (
                    self._pick_nested(self._source, "ip")
                    or self._pick_field("dhcp_ip", "ip", "client_ip", "src_ip", "source_ip")
                ),
                "port": source_port,
                "host": {
                    "name": self._pick_nested(source_host, "name")
                    or self._pick_field("Hostname", "hostname", "source_host"),
                },
                "geo": {
                    "country_name": self._pick_nested(source_geo, "country_name")
                    or self._pick_field("country_name", "country"),
                    "city_name": self._pick_nested(source_geo, "city_name")
                    or self._pick_field("city_name", "city"),
                },
            },
            "destination": {
                "ip": self._pick_nested(self._destination, "ip")
                or self._pick_field("destination_ip", "dst_ip", "dest_ip"),
                "port": destination_port,
                "host": {
                    "name": self._pick_nested(destination_host, "name")
                    or self._pick_field("destination_host", "dst_host", "dest_host"),
                },
            },
            "user": {
                "name": self._pick_nested(self._user, "name")
                or self._pick_field(
                    "user",
                    "username",
                    "AccountName",
                    "TargetUserName",
                    "ruser",
                    "logname",
                ),
                "domain": self._pick_nested(self._user, "domain")
                or self._pick_field("domain", "user_domain", "Domain"),
            },
            "host": {
                "type": self._pick_nested(self._host, "type")
                or self._pick_field("host_type", "device_type"),
            },
            "observer": {
                "vendor": self._pick_nested(self._observer, "vendor")
                or self._pick_field("vendor", "observer_vendor"),
                "product": self._pick_nested(self._observer, "product")
                or self._pick_field("product", "observer_product"),
            },
            "network": {
                "transport": self._pick_nested(self._network, "transport")
                or self._pick_field("transport", "proto", "protocol"),
            },
            "service": {
                "name": self._pick_nested(self._service, "name")
                or ecs_action_meta["service_name"]
                or None,
            },
            "process": {
                "command_line": self._pick_nested(self._process, "command_line")
                or ecs_action_meta["command_line"]
                or None,
            },
            "message": self._pick_field("message", "Message", "msg") or self._result.raw,
            "raw_data": self._pick_field("raw_log") or self._result.raw,
        }
        mapped["service"] = {k: v for k, v in mapped["service"].items() if v is not None}
        mapped["process"] = {k: v for k, v in mapped["process"].items() if v is not None}
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
            lowered = key.lower()
            for existing_key, value in self._fields.items():
                if existing_key.lower() == lowered:
                    return value
        return None

    def _pick_nested(self, data: dict[str, Any], key: str) -> Any:
        value = data.get(key) if isinstance(data, dict) else None
        if isinstance(value, str) and not value.strip():
            return None
        return value

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
        value = self._pick_field("status", "result", "outcome")
        if value is None:
            return "unknown"
        return self._STATUS_MAP.get(str(value).strip().lower(), "unknown")

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


def normalize(
    log_type: str,
    fields: dict[str, Any],
    raw: str | dict[str, Any],
    source: str = "",
) -> OCSFEvent:
    """Normalize parser output using the OCSF mapper engine."""
    import logging

    logger = logging.getLogger(__name__)
    logger.debug("Normalize start log_type=%s fields=%d source=%s", log_type, len(fields), source or "unknown")
    _ = source  # Mapper is ingestion-source agnostic by design.
    raw_text = raw if isinstance(raw, str) else json.dumps(raw, ensure_ascii=False, default=str)
    result = ParseResult(log_type=log_type, fields=fields, raw=raw_text)
    mapped = LogToOCSFMapper(result).map()
    if "time" in mapped:
        mapped["timestamp"] = mapped.pop("time")
    if "raw_data" in mapped:
        mapped["raw_log"] = mapped.pop("raw_data")
    out = OCSFEvent(**mapped)
    logger.debug("Normalize end keys=%d", len(out.model_dump(mode="json")))
    return out
