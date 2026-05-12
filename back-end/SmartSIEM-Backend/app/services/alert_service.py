"""Alert service: persistence and websocket fanout."""

from __future__ import annotations

import uuid
from datetime import UTC, datetime
from typing import Any

from app.database.connection import get_database
from app.services.websocket_service import ws_manager


class AlertService:
    async def create_alert(self, alert: dict[str, Any]) -> dict[str, Any]:
        db = get_database()
        doc = dict(alert)
        doc.setdefault("alert_id", str(uuid.uuid4()))
        doc.setdefault("trigger_time", datetime.now(UTC).isoformat())
        doc.setdefault("status", "NEW")
        result = await db.alerts.insert_one(doc)
        doc["id"] = str(result.inserted_id)
        await ws_manager.broadcast("alert.new", doc)
        return doc
