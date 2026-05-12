"""Validation and cleaning helpers for normalized event payloads."""

from __future__ import annotations

import copy
import ipaddress
from datetime import datetime
from typing import Any


class SIEMValidator:
    """Validate and clean normalized events before persistence."""

    ALLOWED_SEVERITY = {"low", "medium", "high", "critical"}
    REQUIRED_FIELDS = ("timestamp", "source", "event", "deviceId")

    def validate_and_clean(self, event: dict[str, Any]) -> tuple[bool, dict[str, Any], list[str]]:
        """Return (is_valid, cleaned_event, errors)."""
        if not isinstance(event, dict):
            return False, {}, ["event must be a dictionary"]

        cleaned = copy.deepcopy(event)
        errors: list[str] = []

        self._strip_string_values(cleaned)
        self._ensure_device_id(cleaned)
        self._normalize_ip_fields(cleaned, errors)
        self._normalize_and_validate_severity(cleaned, errors)
        self._validate_required_fields(cleaned, errors)

        return len(errors) == 0, cleaned, errors

    def _strip_string_values(self, value: Any) -> Any:
        if isinstance(value, dict):
            for key, item in value.items():
                value[key] = self._strip_string_values(item)
            return value
        if isinstance(value, list):
            for idx, item in enumerate(value):
                value[idx] = self._strip_string_values(item)
            return value
        if isinstance(value, str):
            return value.strip()
        return value

    def _ensure_device_id(self, event: dict[str, Any]) -> None:
        device_id = event.get("deviceId")
        if isinstance(device_id, str) and device_id.strip():
            return

        source = event.get("source")
        if isinstance(source, dict):
            host = source.get("host")
            if isinstance(host, dict):
                host_name = host.get("name")
                if isinstance(host_name, str) and host_name.strip():
                    event["deviceId"] = host_name.strip()
                    return

    def _normalize_ip_fields(self, event: dict[str, Any], errors: list[str]) -> None:
        for path in (("source", "ip"), ("destination", "ip"), ("ip",)):
            holder: Any = event
            for key in path[:-1]:
                if not isinstance(holder, dict):
                    holder = None
                    break
                holder = holder.get(key)
            if not isinstance(holder, dict):
                continue
            field = path[-1]
            ip_value = holder.get(field)
            if ip_value is None or ip_value == "":
                continue
            try:
                holder[field] = str(ipaddress.ip_address(str(ip_value)))
            except ValueError:
                errors.append(f"invalid ip format at {'.'.join(path)}")

    def _normalize_and_validate_severity(self, event: dict[str, Any], errors: list[str]) -> None:
        severity = event.get("severity")
        if severity is None:
            return
        severity_text = str(severity).strip().lower()
        event["severity"] = severity_text
        if severity_text not in self.ALLOWED_SEVERITY:
            errors.append("severity must be one of low, medium, high, critical")

    def _validate_required_fields(self, event: dict[str, Any], errors: list[str]) -> None:
        timestamp = event.get("timestamp")
        if not isinstance(timestamp, str) or not timestamp.strip():
            errors.append("missing or invalid 'timestamp'")
        else:
            candidate = timestamp.strip().replace("Z", "+00:00")
            try:
                datetime.fromisoformat(candidate)
            except ValueError:
                errors.append("missing or invalid 'timestamp'")

        source = event.get("source")
        if not isinstance(source, str) or not source.strip():
            errors.append("missing or invalid 'source'")

        event_name = event.get("event")
        if not isinstance(event_name, str) or not event_name.strip():
            errors.append("missing or invalid 'event'")

        device_id = event.get("deviceId")
        if not isinstance(device_id, str) or not device_id.strip():
            errors.append("missing or invalid 'deviceId'")


def validate_event(event: dict[str, Any]) -> tuple[bool, list[str]]:
    """Compatibility wrapper for old call sites."""
    validator = SIEMValidator()
    is_valid, _, errors = validator.validate_and_clean(event)
    return is_valid, errors
