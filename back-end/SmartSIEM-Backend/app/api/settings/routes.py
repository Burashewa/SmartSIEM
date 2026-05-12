"""Settings APIs."""

from typing import Any

from fastapi import APIRouter, Depends

from app.core.security import get_current_user
from app.database.connection import get_database

router = APIRouter(prefix="/settings", tags=["settings"])


@router.get("")
async def get_settings_items(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    doc = await db.settings.find_one({"_id": "global"})
    if not doc:
        return {
            "retention_days": 30,
            "alerting_enabled": True,
            "integrations": {},
        }
    return {
        "retention_days": doc.get("retention_days", 30),
        "alerting_enabled": doc.get("alerting_enabled", True),
        "integrations": doc.get("integrations", {}),
    }


@router.put("")
async def update_settings(payload: dict[str, Any], _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    db = get_database()
    await db.settings.update_one({"_id": "global"}, {"$set": payload}, upsert=True)
    return {"status": "updated"}
