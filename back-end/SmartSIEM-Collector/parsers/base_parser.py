"""Log parsing logic: match incoming logs to regex rules and extract fields."""

import json
import logging
import re
from dataclasses import dataclass
from typing import Any

from parsers.regex_rules import get_line_rules, get_message_rules

logger = logging.getLogger(__name__)

_SYSLOG_PARENT_TYPES = ("syslog_rfc3164", "syslog_rfc5424", "kali_syslog")


@dataclass
class ParseResult:
    """Result of parsing a single log entry."""

    log_type: str
    fields: dict[str, Any]
    raw: str

    def to_dict(self) -> dict[str, Any]:
        """Convert to dict for downstream normalization."""
        return {"log_type": self.log_type, "fields": self.fields, "raw": self.raw}


class BaseParser:
    """
    Matches incoming logs against regex rules and extracts named fields.

    Handles both plain text (syslog) and JSON payloads. For JSON from the
    HTTP API, preserves all original JSON fields (including key casing), then
    optionally parses message text for additional extracted fields.
    """

    def __init__(self) -> None:
        self._line_rules = get_line_rules()
        self._message_rules = get_message_rules()

    def parse(self, raw: str, source: str = "") -> ParseResult:
        """
        Parse a log entry into log_type and extracted fields.

        Args:
            raw: Raw log string (plain text or JSON).
            source: Optional source identifier for logging.

        Returns:
            ParseResult with log_type, fields dict, and original raw.
        """
        if not raw or not raw.strip():
            return ParseResult(log_type="empty", fields={}, raw=raw)

        logger.debug("Parse start source=%s bytes=%d", source or "unknown", len(raw))

        # JSON payload (from HTTP API)
        if self._is_json(raw):
            out = self._parse_json(raw, source)
            logger.debug("Parse end (json) log_type=%s fields=%d", out.log_type, len(out.fields))
            return out

        # Plain text (syslog, access logs, etc.)
        out = self._parse_text(raw.strip(), source)
        logger.debug("Parse end (text) log_type=%s fields=%d", out.log_type, len(out.fields))
        return out

    def _is_json(self, s: str) -> bool:
        """Check if string looks like JSON (object or array)."""
        t = s.strip()
        return t.startswith("{") or t.startswith("[")

    def _parse_json(self, raw: str, source: str) -> ParseResult:
        """
        Parse JSON payload and preserve all keys with original casing.

        If message text exists (Message/message/msg/log/raw/event), run regex
        parsing on that text and merge extracted fields without overriding
        original API JSON keys.
        """
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON from %s: %s", source or "unknown", exc)
            return ParseResult(log_type="parse_error", fields={"error": str(exc)}, raw=raw)

        if isinstance(data, list):
            # Batch: parse first element only; caller should split batches
            if not data:
                return ParseResult(log_type="json_batch_empty", fields={}, raw=raw)
            data = data[0]
            if not isinstance(data, dict):
                return ParseResult(log_type="json_batch_invalid", fields={}, raw=raw)

        if not isinstance(data, dict):
            return ParseResult(log_type="json_invalid", fields={}, raw=raw)

        # Preserve every JSON key-value pair with original key casing.
        json_fields: dict[str, Any] = {}
        for k, v in data.items():
            # Preserve native JSON scalar types (bool/int/float) so downstream
            # mappers can normalize richer schemas without lossy string casts.
            json_fields[k] = v

        message = self._find_internal_message_text(data)
        if not message:
            message = self._synthesize_syslog_line_from_nxlog(data)
        if message:
            # Run regex on internal text. Merge only missing keys so API JSON
            # fields remain authoritative and unchanged.
            sub_result = self._parse_text(message, source)
            merged = dict(json_fields)
            for key, value in sub_result.fields.items():
                if key not in merged:
                    merged[key] = value
            return ParseResult(
                log_type=sub_result.log_type,
                fields=merged,
                raw=raw,
            )

        # No message field: treat as pre-structured JSON
        return ParseResult(
            log_type="json",
            fields=json_fields,
            raw=raw,
        )

    def _find_internal_message_text(self, data: dict[str, object]) -> str | None:
        """Find best-effort internal log text from JSON payloads."""
        for key in ("message", "Message", "msg", "log", "raw", "event", "Event"):
            value = data.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()

        for value in data.values():
            if isinstance(value, dict):
                nested = self._find_internal_message_text(value)
                if nested:
                    return nested
            if isinstance(value, list):
                nested = self._find_internal_message_in_list(value)
                if nested:
                    return nested

        return None

    def _find_internal_message_in_list(self, values: list[object]) -> str | None:
        """Search nested arrays for message-like content."""
        for item in values:
            if isinstance(item, str) and item.strip():
                return item.strip()
            if isinstance(item, dict):
                nested = self._find_internal_message_text(item)
                if nested:
                    return nested
            if isinstance(item, list):
                nested = self._find_internal_message_in_list(item)
                if nested:
                    return nested
        return None

    def _synthesize_syslog_line_from_nxlog(self, data: dict[str, object]) -> str | None:
        """
        NXLog xm_json via om_http may emit metadata dicts without a canonical message field.

        When timestamps and hostname look like syslog and a body field exists, rebuild
        a single line so kali_syslog + message parsers can extract fields.
        """
        time_raw = (
            data.get("EventReceivedTime") or data.get("timestamp") or data.get("@timestamp")
        )
        host_raw = data.get("Hostname") or data.get("hostname") or data.get("MachineName")

        if not isinstance(time_raw, str) or not time_raw.strip():
            return None
        hn = ""
        if isinstance(host_raw, str) and host_raw.strip():
            hn = host_raw.strip()
        elif isinstance(host_raw, (int, float)):
            hn = str(host_raw)
        elif host_raw:
            hn = str(host_raw).strip()

        if not hn:
            return None

        candidate_keys = (
            "RawMessage",
            "raw_message",
            "full_message",
            "Message",
            "message",
            "msg",
            "Line",
            "line",
            "payload",
            "text",
            "SYSLOGMESSAGE",
            "syslog_msg",
            "BODY",
            "body",
            "MESSAGE",
            "NXLogMessage",
            "NxlogMessage",
        )
        msg_text: str | None = None
        for ck in candidate_keys:
            raw = data.get(ck)
            if isinstance(raw, str) and raw.strip():
                msg_text = raw.strip()
                break

        prog = ""
        if msg_text:
            for pk in (
                "SourceModuleName",
                "ProgramName",
                "Program",
                "process_name",
                "process",
                "daemon",
                "syslog_progname",
            ):
                pr = data.get(pk)
                if isinstance(pr, str) and pr.strip():
                    prog = pr.strip().replace(":", "")
                    break
            if not prog:
                prog = "*"
            line = f"{time_raw.strip()} {hn} {prog}: {msg_text}"
            return line

        # Metadata-only payloads (often when RawMessage omitted)
        if self._looks_like_meta_only_nxlog(data):
            fac = ""
            sev = ""
            fac_v = data.get("syslog_facility_code") or data.get("Facility")
            if isinstance(fac_v, (int, str)) and str(fac_v).strip():
                fac = str(fac_v).strip()
            sev_v = data.get("syslog_severity_code") or data.get("SeverityValue")
            if isinstance(sev_v, (int, str)) and str(sev_v).strip():
                sev = str(sev_v).strip()

            mods = ",".join(
                f"{k}={data[k]}"
                for k in sorted(data.keys())
                if any(x in str(k).lower() for x in ("sourcemodule", "hostname", "received", "nxlog"))
            )
            return (
                f"{time_raw.strip()} {hn} nxlog_meta: syslog_facility={fac}; syslog_severity={sev}; {mods}"
            )

        return None

    def _looks_like_meta_only_nxlog(self, data: dict[str, object]) -> bool:
        if len(data) < 2:
            return False
        has_host = any(
            isinstance(data.get(k), str) and str(data.get(k)).strip()
            for k in ("Hostname", "hostname")
        )
        has_time = any(
            isinstance(data.get(k), str) and str(data.get(k)).strip()
            for k in ("EventReceivedTime", "timestamp", "@timestamp")
        )
        if not has_host or not has_time:
            return False

        body_keys_present = False
        for k in (
            "RawMessage",
            "Message",
            "message",
            "msg",
            "NXLogMessage",
            "NxlogMessage",
            "NXLOG_MESSAGE",
        ):
            v = data.get(k)
            if isinstance(v, str) and v.strip():
                body_keys_present = True
                break

        meta_signal = ("SourceModuleName" in data) or ("SourceModuleType" in data)
        return meta_signal and not body_keys_present

    def _parse_text(self, text: str, source: str) -> ParseResult:
        """Apply line rules, then message rules on syslog message if matched."""
        for rule in self._line_rules:
            match = rule.match(text)
            if match:
                fields = self._match_to_fields(match)
                log_type = rule.log_type

                # If syslog, try message-level rules for finer typing
                if rule.log_type in _SYSLOG_PARENT_TYPES:
                    msg = fields.get("message", "")
                    if msg:
                        for mrule in self._message_rules:
                            mm = mrule.match(msg)
                            if mm:
                                mfields = self._match_to_fields(mm)
                                merged = {k: v for k, v in fields.items() if k != "message"}
                                merged.update(mfields)
                                return ParseResult(
                                    log_type=mrule.log_type,
                                    fields=merged,
                                    raw=text,
                                )

                return ParseResult(log_type=log_type, fields=fields, raw=text)

        # No line rule: try message-level rules (e.g. JSON with only message field)
        for rule in self._message_rules:
            match = rule.match(text)
            if match:
                return ParseResult(
                    log_type=rule.log_type,
                    fields=self._match_to_fields(match),
                    raw=text,
                )

        logger.debug("No rule matched for log from %s: %.80s...", source or "unknown", text)
        return ParseResult(
            log_type="unknown",
            fields={"message": text},
            raw=text,
        )

    def _match_to_fields(self, match: re.Match[str]) -> dict[str, str]:
        """Convert regex match to dict of non-None group values."""
        return {
            k: v
            for k, v in match.groupdict().items()
            if v is not None and v != "" and v != "-"
        }
