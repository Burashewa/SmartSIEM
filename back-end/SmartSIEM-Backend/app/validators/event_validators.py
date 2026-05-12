# """Validation and cleaning helpers for normalized event payloads."""

# from __future__ import annotations

# import copy
# import ipaddress
# from typing import Any


# class SIEMValidator:
#     ALLOWED_SEVERITY = {"low", "medium", "high", "critical"}

#     def validate_and_clean(self, event: dict[str, Any]) -> tuple[bool, dict[str, Any], list[str]]:
#         if not isinstance(event, dict):
#             return False, {}, ["event must be a dictionary"]
#         cleaned = copy.deepcopy(event)
#         errors: list[str] = []
#         self._strip_string_values(cleaned)
#         self._ensure_device_id(cleaned)
#         self._normalize_ip_fields(cleaned, errors)
#         self._normalize_and_validate_severity(cleaned, errors)
#         self._validate_required_fields(cleaned, errors)
#         return len(errors) == 0, cleaned, errors

#     def _strip_string_values(self, value: Any) -> Any:
#         if isinstance(value, dict):
#             for key, item in value.items():
#                 value[key] = self._strip_string_values(item)
#             return value
#         if isinstance(value, list):
#             for idx, item in enumerate(value):
#                 value[idx] = self._strip_string_values(item)
#             return value
#         if isinstance(value, str):
#             return value.strip()
#         return value

#     def _ensure_device_id(self, event: dict[str, Any]) -> None:
#         device_id = event.get("deviceId")
#         if isinstance(device_id, str) and device_id.strip():
#             return
#         source = event.get("source")
#         if isinstance(source, dict):
#             host = source.get("host")
#             if isinstance(host, dict):
#                 host_name = host.get("name")
#                 if isinstance(host_name, str) and host_name.strip():
#                     event["deviceId"] = host_name.strip()

#     def _normalize_ip_fields(self, event: dict[str, Any], errors: list[str]) -> None:
#         for path in (("source", "ip"), ("destination", "ip"), ("ip",)):
#             holder: Any = event
#             for key in path[:-1]:
#                 if not isinstance(holder, dict):
#                     holder = None
#                     break
#                 holder = holder.get(key)
#             if not isinstance(holder, dict):
#                 continue
#             field = path[-1]
#             ip_value = holder.get(field)
#             if ip_value is None or ip_value == "":
#                 continue
#             try:
#                 holder[field] = str(ipaddress.ip_address(str(ip_value)))
#             except ValueError:
#                 errors.append(f"invalid ip format at {'.'.join(path)}")

#     def _normalize_and_validate_severity(self, event: dict[str, Any], errors: list[str]) -> None:
#         event_obj = event.get("event")
#         if not isinstance(event_obj, dict):
#             return
#         severity = event_obj.get("severity")
#         if severity is None:
#             return
#         severity_text = str(severity).strip().lower()
#         event_obj["severity"] = severity_text
#         if severity_text not in self.ALLOWED_SEVERITY:
#             errors.append("event.severity must be one of low, medium, high, critical")

#     def _validate_required_fields(self, event: dict[str, Any], errors: list[str]) -> None:
#         timestamp = event.get("timestamp")
#         if not isinstance(timestamp, str) or not timestamp.strip():
#             errors.append("missing or invalid 'timestamp'")
#         source = event.get("source")
#         if not isinstance(source, dict) or not source:
#             errors.append("missing or invalid 'source'")
#         event_obj = event.get("event")
#         if not isinstance(event_obj, dict) or not event_obj:
#             errors.append("missing or invalid 'event'")
#         device_id = event.get("deviceId")
#         if not isinstance(device_id, str) or not device_id.strip():
#             errors.append("missing or invalid 'deviceId'")


# def validate_event(event: dict[str, Any]) -> tuple[bool, list[str]]:
#     validator = SIEMValidator()
#     is_valid, _, errors = validator.validate_and_clean(event)
#     return is_valid, errors


"""Validation and cleaning helpers for normalized event payloads."""

from __future__ import annotations

import ipaddress
from datetime import datetime
from typing import Any


class SIEMValidator:
    """
    Validates and normalizes SIEM event payloads.
    """

    ALLOWED_SEVERITY = {
        "info",
        "low",
        "medium",
        "high",
        "warning",
        "critical",
        "error",
    }

    # Optional severity normalization map
    SEVERITY_MAP = {
        "warn": "warning",
        "err": "error",
        "fatal": "critical",
    }

    def validate_and_clean(
        self,
        event: dict[str, Any],
    ) -> tuple[bool, dict[str, Any], list[str]]:
        """
        Validate and normalize an incoming event.

        Returns:
            (
                is_valid,
                cleaned_event,
                list_of_errors
            )
        """

        if not isinstance(event, dict):
            return False, {}, ["event must be a dictionary"]

        errors: list[str] = []

        try:
            # NOTE:
            # Avoid deepcopy for performance in streaming pipelines.
            cleaned = dict(event)

            self._strip_string_values(cleaned)
            self._ensure_device_id(cleaned)

            self._normalize_ip_fields(cleaned, errors)
            self._normalize_and_validate_severity(cleaned, errors)

            self._validate_timestamp(cleaned, errors)
            self._validate_required_fields(cleaned, errors)

            return len(errors) == 0, cleaned, errors

        except Exception as exc:
            # Prevent validator crashes from killing collector workers
            return False, {}, [f"validator internal error: {str(exc)}"]

    # -------------------------------------------------------------------------
    # CLEANING
    # -------------------------------------------------------------------------

    def _strip_string_values(self, value: Any) -> Any:
        """
        Recursively trim whitespace from all strings.
        """

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
        """
        Ensure deviceId exists.
        Falls back to source.host.name if available.
        """

        device_id = event.get("deviceId")

        if isinstance(device_id, str) and device_id.strip():
            return

        source = event.get("source")

        if not isinstance(source, dict):
            return

        host = source.get("host")

        if not isinstance(host, dict):
            return

        host_name = host.get("name")

        if isinstance(host_name, str) and host_name.strip():
            event["deviceId"] = host_name.strip()

    # -------------------------------------------------------------------------
    # IP NORMALIZATION
    # -------------------------------------------------------------------------

    def _normalize_ip_fields(
        self,
        event: dict[str, Any],
        errors: list[str],
    ) -> None:
        """
        Normalize and validate IP fields.
        """

        paths = [
            ("source", "ip"),
            ("destination", "ip"),
            ("ip",),
        ]

        for path in paths:
            value = self._get_nested(event, path)

            if value in (None, ""):
                continue

            try:
                normalized_ip = str(ipaddress.ip_address(str(value)))
                self._set_nested(event, path, normalized_ip)

            except ValueError:
                errors.append(
                    f"invalid ip format at {'.'.join(path)}"
                )

    # -------------------------------------------------------------------------
    # SEVERITY
    # -------------------------------------------------------------------------

    def _normalize_and_validate_severity(
        self,
        event: dict[str, Any],
        errors: list[str],
    ) -> None:
        """
        Normalize severity values.
        """

        event_obj = event.get("event")

        if not isinstance(event_obj, dict):
            return

        severity = event_obj.get("severity")

        if severity is None:
            return

        severity_text = str(severity).strip().lower()

        # Map aliases
        severity_text = self.SEVERITY_MAP.get(
            severity_text,
            severity_text,
        )

        event_obj["severity"] = severity_text

        if severity_text not in self.ALLOWED_SEVERITY:
            errors.append(
                "event.severity must be one of: "
                f"{', '.join(sorted(self.ALLOWED_SEVERITY))}"
            )

    # -------------------------------------------------------------------------
    # TIMESTAMP
    # -------------------------------------------------------------------------

    def _validate_timestamp(
        self,
        event: dict[str, Any],
        errors: list[str],
    ) -> None:
        """
        Validate ISO timestamp.
        """

        timestamp = event.get("timestamp")

        if not isinstance(timestamp, str) or not timestamp.strip():
            errors.append("missing or invalid 'timestamp'")
            return

        try:
            # Support timestamps ending with Z
            normalized = timestamp.replace("Z", "+00:00")

            parsed = datetime.fromisoformat(normalized)

            # Normalize stored timestamp
            event["timestamp"] = parsed.isoformat()

        except ValueError:
            errors.append(
                "timestamp must be valid ISO-8601 format"
            )

    # -------------------------------------------------------------------------
    # REQUIRED FIELDS
    # -------------------------------------------------------------------------

    def _validate_required_fields(
        self,
        event: dict[str, Any],
        errors: list[str],
    ) -> None:
        """
        Validate required top-level fields.
        """

        source = event.get("source")

        if not isinstance(source, dict) or not source:
            errors.append("missing or invalid 'source'")

        event_obj = event.get("event")

        if not isinstance(event_obj, dict) or not event_obj:
            errors.append("missing or invalid 'event'")

        device_id = event.get("deviceId")

        if not isinstance(device_id, str) or not device_id.strip():
            errors.append("missing or invalid 'deviceId'")

    # -------------------------------------------------------------------------
    # NESTED HELPERS
    # -------------------------------------------------------------------------

    def _get_nested(
        self,
        data: dict[str, Any],
        path: tuple[str, ...],
    ) -> Any:
        """
        Safely retrieve nested dictionary value.
        """

        current: Any = data

        for key in path:
            if not isinstance(current, dict):
                return None

            current = current.get(key)

        return current

    def _set_nested(
        self,
        data: dict[str, Any],
        path: tuple[str, ...],
        value: Any,
    ) -> None:
        """
        Safely set nested dictionary value.
        """

        current: Any = data

        for key in path[:-1]:
            if key not in current or not isinstance(current[key], dict):
                current[key] = {}

            current = current[key]

        current[path[-1]] = value


def validate_event(
    event: dict[str, Any],
) -> tuple[bool, list[str]]:
    """
    Convenience validation wrapper.
    """

    validator = SIEMValidator()

    is_valid, _, errors = validator.validate_and_clean(event)

    return is_valid, errors

