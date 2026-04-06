"""
alert_writer.py — MongoDB-backed alert persistence for SmartSIEM.

Replaces the original JSON-file AlertWriter with:
  - insert_one / insert_many to MongoDB alerts_col
  - 30-second deduplication via a compound unique index on (rule_id, ip, dedup_bucket)
  - Real-time WebSocket broadcast via Flask-SocketIO on every new alert
  - Aggregation-pipeline stats (no in-memory counters needed)
"""

import time
import threading
from typing import List, Optional

from pymongo.errors import DuplicateKeyError, BulkWriteError

from models import SecurityAlert
from db import alerts_col, logs_col


# ── Deduplication helper ──────────────────────────────────────────────────────

def _dedup_bucket(ts: float, window: int = 30) -> int:
    """Map a Unix timestamp to the nearest 30-second bucket (integer key)."""
    return int(ts // window)


# ── Writer ────────────────────────────────────────────────────────────────────

class MongoAlertWriter:
    """
    Thread-safe alert writer backed by MongoDB.

    Usage:
        from alert_writer import writer
        written = writer.write_many(alerts)
    """

    def __init__(self) -> None:
        self._suppressed  = 0
        self._total       = 0
        self._lock        = threading.Lock()

        # socketio is set by app.py after the SocketIO instance is created
        # to avoid a circular import at module load time.
        self._socketio    = None

    # ── Registration (called once from app.py) ────────────────────────────────

    def register_socketio(self, sio) -> None:
        """Inject the Flask-SocketIO instance so we can broadcast alerts."""
        self._socketio = sio

    # ── Write a single alert ──────────────────────────────────────────────────

    def write(self, alert: SecurityAlert) -> bool:
        """
        Persist one alert to MongoDB.

        Returns:
            True  — alert was stored (new)
            False — alert was suppressed (duplicate within 30-second window)
        """
        now    = time.time()
        bucket = _dedup_bucket(now)
        doc    = alert.to_dict()
        doc["dedup_bucket"] = bucket          # used by the compound unique index

        try:
            alerts_col.insert_one(doc)
        except DuplicateKeyError:
            with self._lock:
                self._suppressed += 1
            return False

        with self._lock:
            self._total += 1

        # ── Real-time push ──────────────────────────────────────────────────
        self._emit_alert(doc)
        return True

    # ── Write many alerts (bulk, ordered=False for speed) ────────────────────

    def write_many(self, alerts: List[SecurityAlert]) -> List[SecurityAlert]:
        """
        Persist a list of alerts using bulk insert where possible.

        Returns the list of alerts that were actually stored (not suppressed).
        """
        if not alerts:
            return []

        now    = time.time()
        bucket = _dedup_bucket(now)
        docs   = []
        for alert in alerts:
            d = alert.to_dict()
            d["dedup_bucket"] = bucket
            docs.append(d)

        written_alerts: List[SecurityAlert] = []

        try:
            result = alerts_col.insert_many(docs, ordered=False)
            inserted_ids = set(result.inserted_ids)

            # Match inserted docs back to their SecurityAlert objects
            for alert, doc in zip(alerts, docs):
                if doc.get("_id") in inserted_ids:
                    written_alerts.append(alert)
                    self._emit_alert(doc)

            with self._lock:
                self._total      += len(written_alerts)
                self._suppressed += len(alerts) - len(written_alerts)

        except BulkWriteError as bwe:
            # Some were inserted, some were duplicates — handle gracefully
            inserted_count = bwe.details.get("nInserted", 0)
            dup_count      = len([
                e for e in bwe.details.get("writeErrors", [])
                if e.get("code") == 11000   # duplicate key
            ])

            with self._lock:
                self._total      += inserted_count
                self._suppressed += dup_count

            # Emit for every doc that was actually inserted
            inserted_indices = set()
            for err in bwe.details.get("writeErrors", []):
                inserted_indices.add(err.get("index"))

            for i, (alert, doc) in enumerate(zip(alerts, docs)):
                if i not in inserted_indices:
                    written_alerts.append(alert)
                    self._emit_alert(doc)

        return written_alerts

    # ── Read helpers ──────────────────────────────────────────────────────────

    def read_all(
        self,
        limit:   int           = 100,
        severity: Optional[str] = None,
        rule_id:  Optional[str] = None,
        ip:       Optional[str] = None,
    ) -> List[dict]:
        """Query alerts with optional filters, most-recent first."""
        flt = {}
        if severity:
            flt["severity"] = severity
        if rule_id:
            flt["rule_id"]  = rule_id
        if ip:
            flt["ip"]       = ip

        cursor = (
            alerts_col
            .find(flt, {"_id": 0, "dedup_bucket": 0})
            .sort("trigger_time", -1)
            .limit(limit)
        )
        return list(cursor)

    # ── Stats via aggregation pipeline ────────────────────────────────────────

    def stats(self) -> dict:
        """Return counts by severity and by rule_id from the DB."""
        by_severity: dict = {"LOW": 0, "MEDIUM": 0, "HIGH": 0, "CRITICAL": 0}
        by_rule:     dict = {}

        sev_pipeline = [
            {"$group": {"_id": "$severity", "count": {"$sum": 1}}}
        ]
        for row in alerts_col.aggregate(sev_pipeline):
            if row["_id"]:
                by_severity[row["_id"]] = row["count"]

        rule_pipeline = [
            {"$group": {"_id": "$rule_id", "count": {"$sum": 1}}}
        ]
        for row in alerts_col.aggregate(rule_pipeline):
            if row["_id"]:
                by_rule[row["_id"]] = row["count"]

        with self._lock:
            suppressed = self._suppressed
            total      = self._total

        return {
            "total_alerts":  total,
            "suppressed":    suppressed,
            "by_severity":   by_severity,
            "by_rule":       by_rule,
        }

    # ── Internal ──────────────────────────────────────────────────────────────

    def _emit_alert(self, doc: dict) -> None:
        """Broadcast a new_alert event via SocketIO (if registered)."""
        if self._socketio is None:
            return
        try:
            # Remove MongoDB internals before sending to clients
            clean = {k: v for k, v in doc.items() if k not in ("_id", "dedup_bucket")}
            print(f"[SmartSIEM][writer] EMITTING new_alert for {clean.get('rule_id')}")
            self._socketio.emit("new_alert", clean)
        except Exception as exc:
            print(f"[SmartSIEM][writer] SocketIO emit error: {exc}")


# ── Module-level singleton ────────────────────────────────────────────────────
writer = MongoAlertWriter()
