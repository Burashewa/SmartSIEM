"""Detection service ported from legacy detection worker."""

from __future__ import annotations

import math
import re
import uuid
from collections import defaultdict, deque
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

from app.database.connection import get_database

DEFAULT_RULES: list[dict[str, Any]] = [
    {
        "rule_id": "rule-auth-bruteforce-60s-5",
        "name": "Brute force login threshold",
        "type": "threshold",
        "severity": "HIGH",
        "event_type": "AUTH_FAIL",
        "config": {"window_sec": 60, "threshold": 5, "key_fields": ["source_ip", "username"]},
        "status": "ACTIVE",
    },
    {
        "rule_id": "rule-proc-powershell-encoded",
        "name": "PowerShell encoded command detection",
        "type": "pattern",
        "severity": "HIGH",
        "event_type": "PROC_CREATE",
        "config": {"field": "command_line", "pattern": r"(?i)\b(powershell|pwsh)\b.*\b(-enc|-encodedcommand)\b"},
        "status": "ACTIVE",
    },
    {
        "rule_id": "rule-dns-entropy-suspicious",
        "name": "Suspicious DNS entropy",
        "type": "statistical",
        "severity": "MEDIUM",
        "event_type": "DNS_QUERY",
        "config": {"entropy_gt": 3.5, "length_gt": 25, "field": "query"},
        "status": "ACTIVE",
    },
]

DEFAULT_RECOMMENDATIONS: dict[str, dict[str, Any]] = {
    "rule-auth-bruteforce-60s-5": {
        "summary": "Possible brute force login activity.",
        "action_steps": ["Block or rate-limit source IP.", "Force password reset and MFA."],
    },
    "rule-proc-powershell-encoded": {
        "summary": "Suspicious PowerShell encoded command execution.",
        "action_steps": ["Isolate host.", "Decode command and inspect child activity."],
    },
    "rule-dns-entropy-suspicious": {
        "summary": "Suspicious DNS query entropy.",
        "action_steps": ["Block domain.", "Correlate with host process tree."],
    },
}


def map_event_type(event: dict[str, Any]) -> str:
    current = str(event.get("event_type") or "").strip()
    if current:
        return current
    log_type = str(event.get("event", {}).get("type") or "").lower()
    if "ssh_failed" in log_type or "auth_failure" in log_type:
        return "AUTH_FAIL"
    if "ssh_accepted" in log_type or "pam_session" in log_type:
        return "AUTH_SUCCESS"
    if "apache" in log_type:
        return "HTTP_ACCESS"
    if "dhcp" in log_type:
        return "NET_CONN"
    if "sudo" in log_type:
        return "PROC_CREATE"
    return log_type.upper() if log_type else "UNKNOWN"


def map_to_detection_event(event: dict[str, Any]) -> dict[str, Any]:
    src = event.get("source") if isinstance(event.get("source"), dict) else {}
    usr = event.get("user") if isinstance(event.get("user"), dict) else {}
    proc = event.get("process") if isinstance(event.get("process"), dict) else {}
    raw_log = event.get("raw_log")
    raw_data: dict[str, Any]
    if isinstance(raw_log, dict):
        raw_data = dict(raw_log)
    else:
        raw_data = {"raw_log": str(raw_log or "")}
    if proc.get("command_line"):
        raw_data.setdefault("command_line", proc.get("command_line"))
    raw_data.setdefault("message", event.get("message"))
    username = usr.get("name")
    domain = usr.get("domain")
    user_id = f"{domain}\\{username}" if username and domain else username or domain
    return {
        **event,
        "timestamp": event.get("timestamp"),
        "event_type": map_event_type(event),
        "source_ip": src.get("ip"),
        "username": username,
        "user_id": user_id,
        "process_name": str(proc.get("command_line", "")).split(" ")[0] if proc.get("command_line") else None,
        "raw_data": raw_data,
    }


@dataclass
class SequenceSession:
    state: str
    user_id: str | None
    last_transition: float


class DetectionService:
    def __init__(self) -> None:
        self._windows: dict[str, deque[float]] = {}
        self._sequences: dict[str, SequenceSession] = {}
        self._hourly_counts: dict[str, int] = defaultdict(int)
        self._recommendations = dict(DEFAULT_RECOMMENDATIONS)

    async def get_rules(self) -> list[dict[str, Any]]:
        db = get_database()
        rules = await db.detection_rules.find({"status": "ACTIVE"}).to_list(length=1000)
        if not rules:
            return DEFAULT_RULES
        for rule in rules:
            rule.pop("_id", None)
        return rules

    async def evaluate(self, event: dict[str, Any]) -> list[dict[str, Any]]:
        detection_event = map_to_detection_event(event)
        alerts: list[dict[str, Any]] = []
        rules = await self.get_rules()
        for rule in rules:
            if rule.get("type") == "threshold":
                alert = self._eval_threshold(detection_event, rule)
                if alert:
                    alerts.append(alert)
            elif rule.get("type") == "pattern":
                alert = self._eval_pattern(detection_event, rule)
                if alert:
                    alerts.append(alert)
            elif rule.get("type") == "statistical":
                alert = self._eval_statistical(detection_event, rule)
                if alert:
                    alerts.append(alert)
        seq_alert = self._eval_sequence(detection_event)
        if seq_alert:
            alerts.append(seq_alert)
        return [self._attach_recommendation(a) for a in alerts]

    def _eval_threshold(self, event: dict[str, Any], rule: dict[str, Any]) -> dict[str, Any] | None:
        key_fields = rule.get("config", {}).get("key_fields", [])
        if not key_fields:
            return None
        values = [event.get(k) for k in key_fields]
        if any(v in (None, "") for v in values):
            return None
        composite_key = f"{rule['rule_id']}:{':'.join(str(v) for v in values)}"
        window_sec = int(rule.get("config", {}).get("window_sec", 60))
        threshold = int(rule.get("config", {}).get("threshold", 1))
        ts = datetime.now(UTC).timestamp()
        bucket = self._windows.setdefault(composite_key, deque())
        bucket.append(ts)
        cutoff = ts - window_sec
        while bucket and bucket[0] < cutoff:
            bucket.popleft()
        if len(bucket) < threshold:
            return None
        self._windows.pop(composite_key, None)
        return self._build_alert(
            rule=rule,
            event=event,
            description=f"Threshold exceeded: {threshold} events in {window_sec}s",
        )

    def _eval_pattern(self, event: dict[str, Any], rule: dict[str, Any]) -> dict[str, Any] | None:
        config = rule.get("config", {})
        field = config.get("field")
        pattern = config.get("pattern")
        if not field or not pattern:
            return None
        value = event.get("raw_data", {}).get(field)
        if value is None:
            return None
        regex = re.compile(pattern)
        if not regex.search(str(value)):
            return None
        return self._build_alert(rule=rule, event=event, description=f"Pattern matched on {field}")

    def _eval_statistical(self, event: dict[str, Any], rule: dict[str, Any]) -> dict[str, Any] | None:
        config = rule.get("config", {})
        field = config.get("field")
        value = event.get("raw_data", {}).get(field) if field else None
        if value is None:
            return None
        entropy = self._entropy(str(value))
        entropy_gt = float(config.get("entropy_gt", 99))
        length_gt = int(config.get("length_gt", 999))
        if len(str(value)) <= length_gt or entropy <= entropy_gt:
            return None
        return self._build_alert(
            rule=rule,
            event=event,
            description=f"Entropy anomaly detected for {field} (entropy={entropy:.2f})",
        )

    def _eval_sequence(self, event: dict[str, Any]) -> dict[str, Any] | None:
        source_ip = event.get("source_ip")
        user_id = event.get("user_id")
        if not source_ip:
            return None
        key = f"seq-001:{source_ip}:{user_id or ''}"
        now = datetime.now(UTC).timestamp()
        session = self._sequences.get(key)
        if session is None:
            session = SequenceSession(state="INIT", user_id=user_id, last_transition=now)
            self._sequences[key] = session
        if now - session.last_transition > 300:
            session.state = "INIT"
        event_type = event.get("event_type")
        if session.state == "INIT" and event_type == "AUTH_FAIL":
            session.state = "AUTH_FAIL_BURST"
            session.last_transition = now
            return None
        if session.state == "AUTH_FAIL_BURST" and event_type == "AUTH_SUCCESS":
            self._sequences.pop(key, None)
            return {
                "alert_id": str(uuid.uuid4()),
                "rule_id": "seq-001",
                "rule_name": "Brute force followed by successful login",
                "severity": "HIGH",
                "event_type": event_type,
                "trigger_time": datetime.now(UTC).isoformat(),
                "source_ip": source_ip,
                "user_id": user_id,
                "description": "Potential brute force followed by successful login.",
                "linked_events": [],
                "recommendation": None,
                "status": "NEW",
            }
        return None

    def run_hourly_stats(self) -> list[dict[str, Any]]:
        alerts: list[dict[str, Any]] = []
        for source_ip, count in list(self._hourly_counts.items()):
            if count > 500:
                alerts.append(
                    {
                        "alert_id": str(uuid.uuid4()),
                        "rule_id": "stat-001",
                        "rule_name": "Statistical Anomaly Detected",
                        "severity": "MEDIUM",
                        "event_type": "ANOMALY",
                        "trigger_time": datetime.now(UTC).isoformat(),
                        "source_ip": source_ip,
                        "description": f"Hourly anomaly count for source {source_ip}: {count}",
                        "linked_events": [],
                        "recommendation": self._recommendations.get("stat-001"),
                        "status": "NEW",
                    }
                )
        self._hourly_counts.clear()
        return alerts

    def _build_alert(self, rule: dict[str, Any], event: dict[str, Any], description: str) -> dict[str, Any]:
        source_ip = event.get("source_ip")
        if source_ip:
            self._hourly_counts[str(source_ip)] += 1
        return {
            "alert_id": str(uuid.uuid4()),
            "rule_id": rule["rule_id"],
            "rule_name": rule["name"],
            "severity": rule.get("severity", "MEDIUM"),
            "event_type": rule.get("event_type", event.get("event_type")),
            "trigger_time": datetime.now(UTC).isoformat(),
            "source_ip": source_ip,
            "user_id": event.get("user_id"),
            "description": description,
            "linked_events": [],
            "recommendation": None,
            "status": "NEW",
        }

    def _attach_recommendation(self, alert: dict[str, Any]) -> dict[str, Any]:
        out = dict(alert)
        out["recommendation"] = self._recommendations.get(
            out.get("rule_id", ""),
            {"summary": "Investigate this alert.", "action_steps": ["Validate and triage context."]},
        )
        return out

    @staticmethod
    def _entropy(value: str) -> float:
        if not value:
            return 0.0
        frequencies: dict[str, int] = defaultdict(int)
        for c in value:
            frequencies[c] += 1
        length = len(value)
        return -sum((count / length) * math.log2(count / length) for count in frequencies.values())
