"""Log parsing logic: match incoming logs to regex rules and extract fields."""

import json
import logging
import re
from dataclasses import dataclass

from parsers.regex_rules import get_line_rules, get_message_rules

logger = logging.getLogger(__name__)


@dataclass
class ParseResult:
    """Result of parsing a single log entry."""

    log_type: str
    fields: dict[str, str | dict[str, object] | list[object]]
    raw: str

    def to_dict(self) -> dict[str, str | dict[str, str]]:
        """Convert to dict for downstream normalization."""
        return {"log_type": self.log_type, "fields": self.fields, "raw": self.raw}


class BaseParser:
    """
    Matches incoming logs against regex rules and extracts named fields.

    Handles both plain text (syslog) and JSON payloads. For JSON from the
    HTTP API, extracts "message" if present and runs regex on it; other
    JSON fields are merged into the result.
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

        # JSON payload (from HTTP API)
        if self._is_json(raw):
            return self._parse_json(raw, source)

        # Plain text (syslog, access logs, etc.)
        return self._parse_text(raw.strip(), source)

    def _is_json(self, s: str) -> bool:
        """Check if string looks like JSON (object or array)."""
        t = s.strip()
        return t.startswith("{") or t.startswith("[")

    def _parse_json(self, raw: str, source: str) -> ParseResult:
        """
        Parse JSON payload. If "message" exists, run regex on it.
        Merge other JSON keys into fields.
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

        # Preserve structure for nested dicts/lists (pre-structured SIEM JSON)
        json_fields: dict[str, str | dict[str, object] | list[object]] = {}
        for k, v in data.items():
            if v is None:
                continue
            if isinstance(v, (dict, list)):
                json_fields[k] = v
            elif v != "":
                json_fields[k] = str(v)

        message = data.get("message")
        if isinstance(message, str) and message.strip():
            # Run regex on message; merge with JSON fields
            sub_result = self._parse_text(message.strip(), source)
            merged = dict(sub_result.fields)
            for k, v in json_fields.items():
                if k != "message" and k not in merged:
                    merged[k] = v
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

    def _parse_text(self, text: str, source: str) -> ParseResult:
        """Apply line rules, then message rules on syslog message if matched."""
        for rule in self._line_rules:
            match = rule.match(text)
            if match:
                fields = self._match_to_fields(match)
                log_type = rule.log_type

                # If syslog, try message-level rules for finer typing
                if rule.log_type in ("syslog_rfc3164", "syslog_rfc5424"):
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
