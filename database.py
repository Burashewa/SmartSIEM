"""MongoDB storage with Geo-IP enrichment for normalized logs."""

import asyncio
import ipaddress
import logging
import time
import uuid
from datetime import datetime
from typing import Any

import requests
from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

from config.settings import Settings

logger = logging.getLogger(__name__)

DB_NAME = "SIEM"
COLLECTION_NAME = "logs"
GEO_API_URL = "https://ipapi.co/{ip}/json/"
GEO_CACHE_TTL_SUCCESS_SEC = 60 * 60 * 24
GEO_CACHE_TTL_FAILURE_SEC = 60 * 15
GEO_RATE_LIMIT_COOLDOWN_SEC = 60 * 5

_geo_cache: dict[str, tuple[float, dict[str, Any]]] = {}
_geo_rate_limited_until = 0.0


def _ensure_source_geo(log_data: dict[str, Any]) -> dict[str, Any]:
    """Ensure source.geo map exists for nested ECS/OCSF event structure."""
    source = log_data.get("source")
    if not isinstance(source, dict):
        source = {}
        log_data["source"] = source
    geo = source.get("geo")
    if not isinstance(geo, dict):
        geo = {}
        source["geo"] = geo
    return geo


def _apply_unknown_geo(log_data: dict[str, Any]) -> dict[str, Any]:
    """Apply default geo fields when lookup is skipped or fails."""
    geo = _ensure_source_geo(log_data)
    geo["country_name"] = geo.get("country_name") or "Unknown"
    geo["city_name"] = geo.get("city_name") or "Unknown"
    return log_data


def _is_non_public_ip(ip: str) -> bool:
    """Return True for loopback/private/link-local/reserved IPs."""
    try:
        parsed = ipaddress.ip_address(ip)
    except ValueError:
        return True
    return (
        parsed.is_loopback
        or parsed.is_private
        or parsed.is_link_local
        or parsed.is_reserved
        or parsed.is_multicast
        or parsed.is_unspecified
    )


def enrich_log_with_geo(log_data: dict[str, Any]) -> dict[str, Any]:
    """
    Enrich log with Geo-IP data from ipapi.co.

    Injects source.geo.city_name and source.geo.country_name.
    On API failure values are set to "Unknown".
    """
    global _geo_rate_limited_until

    ip: Any = None
    source = log_data.get("source")
    if isinstance(source, dict):
        ip = source.get("ip")
    if not ip:
        # Backward compatibility with any legacy flat events.
        ip = log_data.get("ip")
    if not ip or not isinstance(ip, str):
        return _apply_unknown_geo(log_data)

    ip = ip.strip()
    if ip in ("", "localhost") or _is_non_public_ip(ip):
        return _apply_unknown_geo(log_data)

    now = time.time()
    cached = _geo_cache.get(ip)
    if cached and cached[0] > now:
        data = cached[1]
        geo = _ensure_source_geo(log_data)
        geo["city_name"] = data.get("city_name") or "Unknown"
        geo["country_name"] = data.get("country_name") or "Unknown"
        return log_data

    if now < _geo_rate_limited_until:
        return _apply_unknown_geo(log_data)

    try:
        resp = requests.get(GEO_API_URL.format(ip=ip), timeout=5)
        if resp.status_code == 429:
            retry_after = resp.headers.get("Retry-After")
            cooldown = GEO_RATE_LIMIT_COOLDOWN_SEC
            if retry_after and retry_after.isdigit():
                cooldown = max(int(retry_after), GEO_RATE_LIMIT_COOLDOWN_SEC)
            _geo_rate_limited_until = time.time() + cooldown
            logger.warning(
                "Geo-IP rate limited for %s; backing off %ds",
                ip,
                cooldown,
            )
            _geo_cache[ip] = (time.time() + GEO_CACHE_TTL_FAILURE_SEC, {
                "city_name": "Unknown",
                "country_name": "Unknown",
            })
            return _apply_unknown_geo(log_data)
        resp.raise_for_status()
        data = resp.json()
        geo = _ensure_source_geo(log_data)
        geo["city_name"] = data.get("city") or "Unknown"
        geo["country_name"] = data.get("country_name") or "Unknown"
        _geo_cache[ip] = (time.time() + GEO_CACHE_TTL_SUCCESS_SEC, {
            "city_name": geo["city_name"],
            "country_name": geo["country_name"],
        })
    except requests.RequestException as exc:
        logger.warning("Geo-IP lookup failed for %s: %s", ip, exc)
        _geo_cache[ip] = (time.time() + GEO_CACHE_TTL_FAILURE_SEC, {
            "city_name": "Unknown",
            "country_name": "Unknown",
        })
        _apply_unknown_geo(log_data)
    except Exception as exc:
        logger.warning("Geo-IP parse error for %s: %s", ip, exc)
        _geo_cache[ip] = (time.time() + GEO_CACHE_TTL_FAILURE_SEC, {
            "city_name": "Unknown",
            "country_name": "Unknown",
        })
        _apply_unknown_geo(log_data)

    return log_data


def _parse_timestamp(ts: str | None) -> datetime | None:
    """Parse ISO 8601 or common log timestamp to datetime."""
    if not ts or not isinstance(ts, str):
        return None
    ts = ts.strip()
    if not ts:
        return None
    normalized = ts.replace("Z", "+00:00")
    for fmt in (
        "%Y-%m-%dT%H:%M:%S%z",
        "%Y-%m-%dT%H:%M:%S.%f%z",
        "%Y-%m-%dT%H:%M:%S",
        "%Y-%m-%dT%H:%M:%S.%f",
        "%Y-%m-%d %H:%M:%S",
        "%d/%b/%Y:%H:%M:%S %z",
        "%d/%b/%Y:%H:%M:%S",
        "%b %d %H:%M:%S",
    ):
        try:
            return datetime.strptime(normalized, fmt)
        except ValueError:
            continue
    try:
        return datetime.fromisoformat(normalized)
    except ValueError:
        return None


def _prepare_for_mongo(log_data: dict[str, Any]) -> dict[str, Any]:
    """Convert timestamp, add created_at, enrich with Geo-IP."""
    import copy

    doc = copy.deepcopy(log_data)
    doc["created_at"] = datetime.utcnow()

    ts = doc.get("timestamp")
    if ts:
        parsed = _parse_timestamp(ts) if isinstance(ts, str) else ts
        if isinstance(parsed, datetime):
            doc["timestamp"] = parsed

    event = doc.get("event")
    if isinstance(event, dict):
        event_id = event.get("id")
        if not isinstance(event_id, str) or not event_id.strip():
            event["id"] = str(uuid.uuid4())
        # Keep compatibility with existing Mongo unique index on top-level event_id.
        doc["event_id"] = event["id"]
    else:
        # Backward compatibility for non-nested event shape.
        event_id = doc.get("event_id")
        if not isinstance(event_id, str) or not event_id.strip():
            doc["event_id"] = str(uuid.uuid4())

    return enrich_log_with_geo(doc)


def store_log_sync(
    log_data: dict[str, Any],
    *,
    client: MongoClient | None = None,
    mongo_uri: str | None = None,
) -> None:
    """Synchronously store a log document in MongoDB."""
    uri = mongo_uri or (Settings().mongo_uri if not client else None)
    if not client and not uri:
        raise ValueError("Provide client or mongo_uri")

    if not client:
        client = MongoClient(uri)

    db: Database = client[DB_NAME]
    coll: Collection = db[COLLECTION_NAME]
    doc = _prepare_for_mongo(log_data)
    coll.insert_one(doc)
    logger.debug("Inserted log into MongoDB")


async def store_log_async(
    log_data: dict[str, Any],
    *,
    mongo_uri: str | None = None,
) -> None:
    """Store log in MongoDB asynchronously (runs in executor to avoid blocking)."""
    uri = mongo_uri or Settings().mongo_uri

    def _do_store() -> None:
        client = MongoClient(uri)
        try:
            store_log_sync(log_data, client=client)
        finally:
            client.close()

    loop = asyncio.get_event_loop()
    await loop.run_in_executor(None, _do_store)
