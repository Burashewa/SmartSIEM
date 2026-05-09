from __future__ import annotations

import logging
from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from pymongo import MongoClient
from pymongo.collection import Collection
from pymongo.database import Database

from config.settings import Settings

logger = logging.getLogger(__name__)

AUTH_DB_NAME = "SIEM"
USERS_COLL = "users"
SESSIONS_COLL = "sessions"
AGENTS_COLL = "agents"


def utc_now() -> datetime:
    return datetime.now(UTC)


def get_client(settings: Settings | None = None) -> MongoClient:
    s = settings or Settings()
    return MongoClient(s.mongo_uri)


def get_db(client: MongoClient) -> Database:
    return client[AUTH_DB_NAME]


def users(db: Database) -> Collection:
    return db[USERS_COLL]


def sessions(db: Database) -> Collection:
    return db[SESSIONS_COLL]


def agents(db: Database) -> Collection:
    return db[AGENTS_COLL]


# Indexes left behind by an earlier (camelCase) schema that conflict with the
# current snake_case design. They blanket-collide on null when new docs are
# inserted, so we drop them on every startup. Add new legacy names here as
# needed - dropping a non-existent index is a no-op.
_LEGACY_AGENT_INDEXES: tuple[str, ...] = (
    "agentId_1",
    "apiKeyId_1",
    "userId_1",
    "userId_1_name_1",
    "apiKeyStorageMode_1",
)


def _drop_legacy_indexes(coll: Collection, names: tuple[str, ...]) -> None:
    existing = {ix["name"] for ix in coll.list_indexes()}
    for name in names:
        if name in existing:
            try:
                coll.drop_index(name)
                logger.warning("Dropped legacy index %s.%s", coll.name, name)
            except Exception:  # pragma: no cover - defensive
                logger.exception("Failed to drop legacy index %s.%s", coll.name, name)


def ensure_auth_indexes(settings: Settings | None = None) -> None:
    client = get_client(settings)
    try:
        db = get_db(client)
        users(db).create_index("email", unique=True, name="uniq_email")
        sessions(db).create_index("refresh_token_hash", unique=True, name="uniq_refresh_hash")
        sessions(db).create_index("user_id", name="idx_sessions_user_id")
        sessions(db).create_index("expires_at", expireAfterSeconds=0, name="ttl_sessions_expires_at")

        agents_coll = agents(db)
        _drop_legacy_indexes(agents_coll, _LEGACY_AGENT_INDEXES)
        agents_coll.create_index("user_id", name="idx_agents_user_id")
        # Partial filter so legacy docs without `api_key_hash` (multiple nulls)
        # don't violate uniqueness.
        agents_coll.create_index(
            "api_key_hash",
            unique=True,
            name="uniq_agent_api_key_hash",
            partialFilterExpression={"api_key_hash": {"$type": "string"}},
        )
    finally:
        client.close()


def oid(s: str) -> ObjectId:
    return ObjectId(s)


def oid_str(v: Any) -> str:
    return str(v) if isinstance(v, ObjectId) else str(v)

