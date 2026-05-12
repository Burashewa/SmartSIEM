"""Analytics APIs."""

from typing import Any

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/events/by-source")
async def events_by_source(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    pipeline = [
        {"$group": {"_id": "$source.ip", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    rows = await db.logs.aggregate(pipeline).to_list(length=20)
    return {"items": [{"source_ip": row["_id"], "count": row["count"]} for row in rows]}


@router.get("/alerts/by-rule")
async def alerts_by_rule(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    pipeline = [
        {"$group": {"_id": "$rule_id", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 20},
    ]
    rows = await db.alerts.aggregate(pipeline).to_list(length=20)
    return {"items": [{"rule_id": row["_id"], "count": row["count"]} for row in rows]}
