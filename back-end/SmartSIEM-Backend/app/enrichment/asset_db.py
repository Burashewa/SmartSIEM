"""Local critical assets and user directory lookups (JSON files)."""

from __future__ import annotations

import json
import logging
from pathlib import Path
from typing import Any

logger = logging.getLogger(__name__)


def load_json_list(path: str | None) -> list[dict[str, Any]]:
    if not path or not str(path).strip():
        return []
    p = Path(path)
    if not p.is_file():
        logger.warning("Enrichment JSON not found: %s", p)
        return []
    try:
        data = json.loads(p.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        logger.warning("Failed to load %s: %s", p, exc)
        return []
    if isinstance(data, list):
        return [x for x in data if isinstance(x, dict)]
    if isinstance(data, dict):
        return [data]
    return []


def enrich_assets_and_users(
    event: dict[str, Any],
    *,
    critical_assets: list[dict[str, Any]],
    user_directory: list[dict[str, Any]],
) -> dict[str, Any]:
    enrichment = event.get("enrichment")
    if not isinstance(enrichment, dict):
        enrichment = {}

    device_id = event.get("deviceId")
    device_id = device_id.strip() if isinstance(device_id, str) else None

    source_host = None
    source = event.get("source")
    if isinstance(source, dict):
        host = source.get("host")
        if isinstance(host, dict):
            hn = host.get("name")
            if isinstance(hn, str) and hn.strip():
                source_host = hn.strip()

    user_name = None
    user = event.get("user")
    if isinstance(user, dict):
        un = user.get("name")
        if isinstance(un, str) and un.strip():
            user_name = un.strip()

    for row in critical_assets:
        rid = row.get("device_id") or row.get("deviceId") or row.get("hostname")
        if rid is None:
            continue
        rid_s = str(rid).strip()
        if device_id and rid_s == device_id:
            enrichment["asset"] = {k: v for k, v in row.items() if k not in ("device_id", "deviceId")}
            break
        if source_host and rid_s.lower() == source_host.lower():
            enrichment["asset"] = {k: v for k, v in row.items() if k not in ("device_id", "deviceId", "hostname")}
            break

    for row in user_directory:
        un = row.get("username") or row.get("user") or row.get("name")
        if un is None or user_name is None:
            continue
        if str(un).strip().lower() == user_name.lower():
            enrichment["user_directory"] = {k: v for k, v in row.items() if k not in ("username", "user", "name")}
            break

    if enrichment:
        event["enrichment"] = enrichment
    return event
