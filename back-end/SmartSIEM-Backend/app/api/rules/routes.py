"""Detection rules APIs."""

from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.database.connection import get_database
from app.database.models import DetectionRule

router = APIRouter(prefix="/rules", tags=["rules"])


@router.get("")
async def list_rules(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = get_database()
    rows = await db.detection_rules.find({}).to_list(length=500)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return rows


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_rule(rule: DetectionRule, _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    doc = rule.model_dump()
    result = await db.detection_rules.insert_one(doc)
    doc["id"] = str(result.inserted_id)
    doc.pop("_id", None)
    return doc


@router.put("/{rule_id}")
async def update_rule(rule_id: str, payload: DetectionRule, _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    db = get_database()
    oid = ObjectId(rule_id)
    result = await db.detection_rules.update_one({"_id": oid}, {"$set": payload.model_dump()})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return {"status": "updated"}


@router.patch("/{rule_id}/toggle")
async def toggle_rule(rule_id: str, payload: dict[str, bool], _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    enabled = bool(payload.get("enabled", True))
    status_value = "ACTIVE" if enabled else "INACTIVE"
    db = get_database()
    oid = ObjectId(rule_id)
    result = await db.detection_rules.update_one({"_id": oid}, {"$set": {"status": status_value}})
    if result.matched_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
    return {"status": status_value}


@router.delete("/{rule_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_rule(rule_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> None:
    db = get_database()
    oid = ObjectId(rule_id)
    result = await db.detection_rules.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rule not found")
