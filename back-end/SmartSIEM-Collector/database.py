"""MongoDB storage for normalized logs (geo from pipeline enrichment, not blocking HTTP)."""

import asyncio
import logging
import uuid
from datetime import datetime
from typing import Any

from pymongo import MongoClient
from pymongo.database import Database
from pymongo.collection import Collection

from config.settings import Settings

logger = logging.getLogger(__name__)

DB_NAME = "SIEM"
COLLECTION_NAME = "logs"


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
    """Convert timestamp, add created_at, ensure source.geo defaults for storage.

    Geo resolution uses EnrichmentManager (e.g. MaxMind) on the ingest path.
    This step must not perform blocking HTTP so Mongo inserts are never tied
    to external Geo API rate limits or latency.
    """
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

    return _apply_unknown_geo(doc)


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
        # TLS: options come only from the connection string (e.g. Atlas mongodb+srv).
        # Do not pass tlsCAFile here unless you intend a dedicated Mongo CA bundle
        # (never reuse Aiven Kafka ca.pem for Atlas).
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
