"""Incidents CRUD APIs."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/incidents", tags=["incidents"])


@router.get("")
async def list_incidents(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = get_database()
    rows = await db.incidents.find({}).sort([("created_at", -1)]).to_list(length=500)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return rows


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_incident(payload: dict[str, Any], _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    doc = {
        "title": payload.get("title", "Untitled incident"),
        "status": payload.get("status", "open"),
        "severity": payload.get("severity", "medium"),
        "description": payload.get("description", ""),
        "created_at": datetime.now(UTC).isoformat(),
    }
    result = await db.incidents.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.patch("/{incident_id}")
async def update_incident(
    incident_id: str,
    payload: dict[str, Any],
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, str]:
    db = get_database()
    oid = ObjectId(incident_id)
    result = await db.incidents.update_one({"_id": oid}, {"$set": payload})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
    return {"status": "updated"}


@router.delete("/{incident_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_incident(incident_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> None:
    db = get_database()
    oid = ObjectId(incident_id)
    result = await db.incidents.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Incident not found")
