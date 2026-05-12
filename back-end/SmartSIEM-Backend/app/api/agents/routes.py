"""Agents CRUD APIs."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user
from app.database.connection import get_database
from app.database.models import AgentCreate

router = APIRouter(prefix="/agents", tags=["agents"])


@router.get("")
async def list_agents(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = get_database()
    rows = await db.agents.find({}).to_list(length=500)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return rows


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_or_update_agent(payload: AgentCreate, _user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    db = get_database()
    doc = payload.model_dump()
    doc["last_seen"] = datetime.now(UTC).isoformat()
    await db.agents.update_one({"agent_id": payload.agent_id}, {"$set": doc}, upsert=True)
    return {"status": "ok", "agent_id": payload.agent_id}


@router.delete("/{agent_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_agent(agent_id: str, _user: dict[str, Any] = Depends(get_current_user)) -> None:
    db = get_database()
    oid = ObjectId(agent_id)
    result = await db.agents.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Agent not found")
