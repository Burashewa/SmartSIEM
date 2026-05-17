"""Shared HTTP helpers for collector test scripts (POST /api/logs, health, worker /stats)."""

from __future__ import annotations

import json
import urllib.error
import urllib.request
import uuid
from datetime import datetime, timezone


def iso_now() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _request_json(
    url: str,
    *,
    method: str = "GET",
    data: bytes | None = None,
    headers: dict[str, str] | None = None,
    timeout: float = 15.0,
) -> tuple[int, object | str | None]:
    req = urllib.request.Request(url, data=data, method=method, headers=headers or {})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as resp:
            body = resp.read().decode("utf-8", errors="replace")
            status = resp.status
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        status = exc.code
        return status, body
    try:
        return status, json.loads(body) if body.strip() else None
    except json.JSONDecodeError:
        return status, body


def post_ingest(base_url: str, payload: object) -> tuple[int, str]:
    """POST a JSON object or array to the collector /api/logs endpoint."""
    raw = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    url = f"{base_url.rstrip('/')}/api/logs"
    req = urllib.request.Request(url, data=raw, method="POST", headers={"Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=120) as resp:
            return resp.status, resp.read().decode("utf-8", errors="replace")
    except urllib.error.HTTPError as exc:
        body = exc.read().decode("utf-8", errors="replace") if exc.fp else ""
        return exc.code, body


def get_collector_health(base_url: str) -> tuple[int, object | str | None]:
    return _request_json(f"{base_url.rstrip('/')}/health", method="GET")


def get_worker_stats(worker_url: str) -> tuple[int, object | str | None]:
    return _request_json(f"{worker_url.rstrip('/')}/stats", method="GET")


def to_new_contract_event(payload: dict[str, object]) -> dict[str, object]:
    """Attach ingest contract fields while keeping legacy keys for compatibility tests."""
    event = dict(payload)
    event.setdefault("event_id", str(uuid.uuid4()))
    event.setdefault("timestamp", iso_now())
    event.setdefault("source", "smartsiem-agent")
    event.setdefault("deviceId", "test-device-001")

    event_type = str(event.get("event_type", "")).strip().upper()
    auth_fail_types = {"AUTH_FAIL"}
    auth_success_types = {"AUTH_SUCCESS"}
    if "event" not in event:
        if event_type in auth_fail_types:
            event["event"] = "authentication"
            event.setdefault("action", "login")
            event.setdefault("status", "failed")
        elif event_type in auth_success_types:
            event["event"] = "authentication"
            event.setdefault("action", "login")
            event.setdefault("status", "success")

    if "user" not in event:
        username = event.get("username")
        user_id = event.get("user_id")
        if isinstance(username, str) and username.strip():
            event["user"] = username
        elif isinstance(user_id, str) and user_id.strip():
            event["user"] = user_id

    return event
