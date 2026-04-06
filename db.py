"""
db.py — MongoDB connection and collection management for SmartSIEM.

Reads configuration from .env via python-dotenv.
All other modules import `logs_col` and `alerts_col` from here.
"""

import os
import sys
from dotenv import load_dotenv
from pymongo import MongoClient, ASCENDING, DESCENDING
from pymongo.errors import ConnectionFailure, OperationFailure

# ── Load .env ────────────────────────────────────────────────────────────────
load_dotenv()

MONGO_URI        = os.getenv("Mongo_URI")
DB_NAME          = os.getenv("DB_NAME", "SIEM")
LOG_COLLECTION   = os.getenv("LOG_COLLECTION", "logs")
ALERT_COLLECTION = os.getenv("ALERT_COLLECTION", "alerts")

if not MONGO_URI:
    print("[SmartSIEM][db] ERROR: Mongo_URI is not set in .env", file=sys.stderr)
    sys.exit(1)

# ── Client (singleton, thread-safe connection pool) ───────────────────────────
_client = MongoClient(
    MONGO_URI,
    serverSelectionTimeoutMS=5_000,
    connectTimeoutMS=5_000,
    socketTimeoutMS=10_000,
    maxPoolSize=50,       # plenty for our thread pool
    retryWrites=True,
)

_db = _client[DB_NAME]

# Public collection handles
logs_col   = _db[LOG_COLLECTION]
alerts_col = _db[ALERT_COLLECTION]


def _ensure_indexes() -> None:
    """Create indexes once at startup. Safe to call on every restart."""
    try:
        # ── logs collection ──────────────────────────────────────────────
        logs_col.create_index([("timestamp", DESCENDING)], background=True)
        logs_col.create_index([("ip", ASCENDING)],          background=True)
        logs_col.create_index([("event", ASCENDING)],       background=True)
        logs_col.create_index([("status", ASCENDING)],      background=True)
        logs_col.create_index([("event_id", ASCENDING)],    background=True, unique=True)

        # ── alerts collection ────────────────────────────────────────────
        alerts_col.create_index([("trigger_time", DESCENDING)], background=True)
        alerts_col.create_index([("severity", ASCENDING)],      background=True)
        alerts_col.create_index([("rule_id", ASCENDING)],       background=True)
        alerts_col.create_index([("ip", ASCENDING)],            background=True)
        # Compound dedup key: rule + IP + 30-second time bucket
        alerts_col.create_index(
            [("rule_id", ASCENDING), ("ip", ASCENDING), ("dedup_bucket", ASCENDING)],
            unique=True
        )

        print(f"[SmartSIEM][db] Indexes ensured on '{DB_NAME}'")
    except OperationFailure as exc:
        # Non-fatal: may fail on Atlas free-tier if indexes already exist
        print(f"[SmartSIEM][db] Index warning: {exc}")


def ping() -> bool:
    """Return True if MongoDB responds to a ping, False otherwise."""
    try:
        _client.admin.command("ping")
        return True
    except ConnectionFailure:
        return False


# ── Run on import ─────────────────────────────────────────────────────────────
try:
    _client.admin.command("ping")
    print(f"[SmartSIEM][db] Connected to MongoDB  db='{DB_NAME}'")
    _ensure_indexes()
except ConnectionFailure as exc:
    print(f"[SmartSIEM][db] WARNING: could not reach MongoDB at startup: {exc}", file=sys.stderr)
