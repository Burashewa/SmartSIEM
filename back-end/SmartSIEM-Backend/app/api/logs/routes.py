"""Logs CRUD endpoints."""

from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.common import build_sort, paginated_response
from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/logs", tags=["logs"])


@router.get("")
async def list_logs(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    source_ip: str | None = None,
    severity: str | None = None,
    search: str | None = None,
    sort: str | None = None,
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_database()
    filters: dict[str, Any] = {}
    if source_ip:
        filters["source.ip"] = source_ip
    if severity:
        filters["event.severity"] = severity.lower()
    if search:
        filters["$or"] = [{"message": {"$regex": search, "$options": "i"}}, {"raw_log": {"$regex": search, "$options": "i"}}]
    total = await db.logs.count_documents(filters)
    cursor = db.logs.find(filters).sort(build_sort(sort)).skip((page - 1) * limit).limit(limit)
    data = await cursor.to_list(length=limit)
    for item in data:
        item["id"] = str(item.pop("_id"))
    return paginated_response(data, total, page, limit)


@router.get("/{log_id}")
async def get_log(log_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    try:
        oid = ObjectId(log_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid log id") from exc
    doc = await db.logs.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.delete("/{log_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_log(log_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> None:
    db = get_database()
    try:
        oid = ObjectId(log_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid log id") from exc
    result = await db.logs.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Log not found")
