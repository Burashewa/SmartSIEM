"""Alert APIs."""

from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, Query, status

from app.api.common import build_sort, paginated_response
from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/alerts", tags=["alerts"])


@router.get("")
async def list_alerts(
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=500),
    status_filter: str | None = Query(None, alias="status"),
    severity: str | None = None,
    sort: str | None = None,
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, Any]:
    db = get_database()
    filters: dict[str, Any] = {}
    if status_filter:
        filters["status"] = status_filter
    if severity:
        filters["severity"] = severity
    total = await db.alerts.count_documents(filters)
    cursor = db.alerts.find(filters).sort(build_sort(sort, default_field="trigger_time")).skip((page - 1) * limit).limit(limit)
    data = await cursor.to_list(length=limit)
    for item in data:
        item["id"] = str(item.pop("_id"))
    return paginated_response(data, total, page, limit)


@router.get("/{alert_id}")
async def get_alert(alert_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    try:
        oid = ObjectId(alert_id)
    except Exception as exc:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid alert id") from exc
    doc = await db.alerts.find_one({"_id": oid})
    if not doc:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    doc["id"] = str(doc.pop("_id"))
    return doc


@router.patch("/{alert_id}")
async def update_alert_status(
    alert_id: str,
    payload: dict[str, str],
    _user: dict[str, Any] = Depends(get_current_user),
) -> dict[str, str]:
    new_status = payload.get("status")
    if new_status not in {"NEW", "INVESTIGATING", "RESOLVED"}:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Invalid status")
    db = get_database()
    oid = ObjectId(alert_id)
    result = await db.alerts.update_one({"_id": oid}, {"$set": {"status": new_status}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
    return {"status": new_status}


@router.delete("/{alert_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_alert(alert_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> None:
    db = get_database()
    oid = ObjectId(alert_id)
    result = await db.alerts.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Alert not found")
