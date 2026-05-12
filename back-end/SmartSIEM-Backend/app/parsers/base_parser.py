"""Log parsing logic: match incoming logs to regex rules and extract fields."""

import json
import logging
import re
from dataclasses import dataclass

from app.parsers.regex_rules import get_line_rules, get_message_rules

logger = logging.getLogger(__name__)
_SYSLOG_PARENT_TYPES = ("syslog_rfc3164", "syslog_rfc5424", "kali_syslog")


@dataclass
class ParseResult:
    log_type: str
    fields: dict[str, str | dict[str, object] | list[object]]
    raw: str


class BaseParser:
    def __init__(self) -> None:
        self._line_rules = get_line_rules()
        self._message_rules = get_message_rules()

    def parse(self, raw: str, source: str = "") -> ParseResult:
        if not raw or not raw.strip():
            return ParseResult(log_type="empty", fields={}, raw=raw)
        if self._is_json(raw):
            return self._parse_json(raw, source)
        return self._parse_text(raw.strip(), source)

    def _is_json(self, s: str) -> bool:
        t = s.strip()
        return t.startswith("{") or t.startswith("[")

    def _parse_json(self, raw: str, source: str) -> ParseResult:
        try:
            data = json.loads(raw)
        except json.JSONDecodeError as exc:
            logger.warning("Invalid JSON from %s: %s", source or "unknown", exc)
            return ParseResult(log_type="parse_error", fields={"error": str(exc)}, raw=raw)
        if isinstance(data, list):
            if not data:
                return ParseResult(log_type="json_batch_empty", fields={}, raw=raw)
            data = data[0]
            if not isinstance(data, dict):
                return ParseResult(log_type="json_batch_invalid", fields={}, raw=raw)
        if not isinstance(data, dict):
            return ParseResult(log_type="json_invalid", fields={}, raw=raw)

        json_fields: dict[str, str | dict[str, object] | list[object]] = {}
        for k, v in data.items():
            if isinstance(v, (dict, list)):
                json_fields[k] = v
            elif v is None:
                json_fields[k] = ""
            else:
                json_fields[k] = str(v)

        message = self._find_internal_message_text(data) or self._synthesize_syslog_line_from_nxlog(data)
        if message:
            sub_result = self._parse_text(message, source)
            merged = dict(json_fields)
            merged.update(sub_result.fields)
            return ParseResult(log_type=sub_result.log_type, fields=merged, raw=raw)
        return ParseResult(log_type="json", fields=json_fields, raw=raw)

    def _find_internal_message_text(self, data: dict[str, object]) -> str | None:
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
        time_raw = data.get("EventReceivedTime") or data.get("timestamp") or data.get("@timestamp")
        host_raw = data.get("Hostname") or data.get("hostname") or data.get("MachineName")
        if not isinstance(time_raw, str) or not time_raw.strip():
            return None
        hn = str(host_raw).strip() if host_raw else ""
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
        if msg_text:
            return f"{time_raw.strip()} {hn} *: {msg_text}"
        return None

    def _parse_text(self, text: str, source: str) -> ParseResult:
        for rule in self._line_rules:
            match = rule.match(text)
            if match:
                fields = self._match_to_fields(match)
                if rule.log_type in _SYSLOG_PARENT_TYPES:
                    msg = fields.get("message", "")
                    if msg:
                        for mrule in self._message_rules:
                            mm = mrule.match(msg)
                            if mm:
                                mfields = self._match_to_fields(mm)
                                merged = {k: v for k, v in fields.items() if k != "message"}
                                merged.update(mfields)
                                return ParseResult(log_type=mrule.log_type, fields=merged, raw=text)
                return ParseResult(log_type=rule.log_type, fields=fields, raw=text)
        for rule in self._message_rules:
            match = rule.match(text)
            if match:
                return ParseResult(log_type=rule.log_type, fields=self._match_to_fields(match), raw=text)
        logger.debug("No rule matched for log from %s: %.80s...", source or "unknown", text)
        return ParseResult(log_type="unknown", fields={"message": text}, raw=text)

    def _match_to_fields(self, match: re.Match[str]) -> dict[str, str]:
        return {k: v for k, v in match.groupdict().items() if v is not None and v != "" and v != "-"}
