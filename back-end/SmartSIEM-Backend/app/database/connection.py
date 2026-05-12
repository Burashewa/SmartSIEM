"""MongoDB connection and index bootstrap utilities."""

from __future__ import annotations

from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from pymongo import ASCENDING, DESCENDING

from app.core.config import Settings, get_settings

_mongo_client: AsyncIOMotorClient | None = None


async def connect_to_mongo(settings: Settings | None = None) -> AsyncIOMotorClient:
    """Initialize and cache a Motor client."""

    global _mongo_client
    if _mongo_client is not None:
        return _mongo_client

    cfg = settings or get_settings()
    _mongo_client = AsyncIOMotorClient(
        cfg.mongo_uri,
        serverSelectionTimeoutMS=cfg.mongo_connect_timeout_ms,
    )
    await _mongo_client.admin.command("ping")
    return _mongo_client


def get_database(settings: Settings | None = None) -> AsyncIOMotorDatabase:
    """Return active application database."""

    if _mongo_client is None:
        raise RuntimeError("MongoDB connection has not been initialized.")
    cfg = settings or get_settings()
    return _mongo_client[cfg.mongo_db_name]


async def ensure_indexes(
    database: AsyncIOMotorDatabase | None = None,
    settings: Settings | None = None,
) -> None:
    """Create baseline indexes used by logs, alerts, and core entities."""

    cfg = settings or get_settings()
    # db = database or get_database(cfg)
    db = database if database is not None else get_database(cfg)
    ttl_seconds = cfg.log_retention_days * 24 * 60 * 60

    await db.logs.create_index([("timestamp", DESCENDING)], expireAfterSeconds=ttl_seconds)
    await db.logs.create_index([("source.ip", ASCENDING), ("timestamp", DESCENDING)])
    await db.logs.create_index([("severity", ASCENDING), ("timestamp", DESCENDING)])
    await db.logs.create_index([("event.type", ASCENDING), ("timestamp", DESCENDING)])

    await db.alerts.create_index([("trigger_time", DESCENDING)])
    await db.alerts.create_index([("rule_id", ASCENDING), ("status", ASCENDING)])
    await db.alerts.create_index([("severity", ASCENDING), ("status", ASCENDING)])

    await db.detection_rules.create_index([("status", ASCENDING)])
    await db.detection_rules.create_index([("type", ASCENDING)])

    await db.users.create_index([("username", ASCENDING)], unique=True)
    await db.users.create_index([("email", ASCENDING)], unique=True)

    await db.agents.create_index([("agent_id", ASCENDING)], unique=True)
    await db.agents.create_index([("last_seen", DESCENDING)])
    await db.reports.create_index([("created_at", DESCENDING)])
    await db.incidents.create_index([("created_at", DESCENDING)])
    await db.incidents.create_index([("status", ASCENDING), ("severity", ASCENDING)])


async def close_mongo_connection() -> None:
    """Close Motor client if it exists."""

    global _mongo_client
    if _mongo_client is None:
        return
    _mongo_client.close()
    _mongo_client = None
