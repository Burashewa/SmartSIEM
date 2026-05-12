"""Dashboard and KPI APIs."""

from typing import Any

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/dashboard", tags=["dashboard"])


@router.get("/kpis")
async def dashboard_kpis(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    total_events = await db.logs.count_documents({})
    total_alerts = await db.alerts.count_documents({})
    total_agents = await db.agents.count_documents({})
    open_alerts = await db.alerts.count_documents({"status": {"$in": ["NEW", "INVESTIGATING"]}})
    return {
        "total_events": total_events,
        "total_alerts": total_alerts,
        "total_agents": total_agents,
        "open_alerts": open_alerts,
    }


@router.get("/chart/logs")
async def logs_chart(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    pipeline = [
        {"$group": {"_id": {"$substr": ["$timestamp", 0, 13]}, "count": {"$sum": 1}}},
        {"$sort": {"_id": 1}},
        {"$limit": 48},
    ]
    rows = await db.logs.aggregate(pipeline).to_list(length=48)
    return {"series": [{"time": row["_id"], "count": row["count"]} for row in rows]}


@router.get("/chart/alerts")
async def alerts_chart(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    pipeline = [{"$group": {"_id": "$severity", "count": {"$sum": 1}}}]
    rows = await db.alerts.aggregate(pipeline).to_list(length=20)
    return {"series": [{"severity": row["_id"], "count": row["count"]} for row in rows]}


@router.get("/geo")
async def geo_points(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    pipeline = [
        {"$match": {"source.geo.latitude": {"$exists": True}, "source.geo.longitude": {"$exists": True}}},
        {"$project": {"_id": 0, "lat": "$source.geo.latitude", "lon": "$source.geo.longitude", "ip": "$source.ip"}},
        {"$limit": 500},
    ]
    rows = await db.logs.aggregate(pipeline).to_list(length=500)
    return {"points": rows}


@router.get("/top-sources")
async def top_sources(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    pipeline = [
        {"$group": {"_id": "$source.ip", "count": {"$sum": 1}}},
        {"$sort": {"count": -1}},
        {"$limit": 10},
    ]
    rows = await db.logs.aggregate(pipeline).to_list(length=10)
    return {"sources": [{"ip": row["_id"], "count": row["count"]} for row in rows]}
