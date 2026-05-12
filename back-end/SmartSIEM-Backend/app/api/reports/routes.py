"""Reports CRUD APIs."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/reports", tags=["reports"])


@router.get("")
async def list_reports(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = get_database()
    rows = await db.reports.find({}).sort([("created_at", -1)]).to_list(length=200)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return rows


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_report(payload: dict[str, Any], _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    doc = {"name": payload.get("name", "Report"), "filters": payload.get("filters", {}), "created_at": datetime.now(UTC).isoformat()}
    result = await db.reports.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.delete("/{report_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_report(report_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> None:
    db = get_database()
    oid = ObjectId(report_id)
    result = await db.reports.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Report not found")
