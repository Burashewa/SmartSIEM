"""Users CRUD APIs."""

from datetime import UTC, datetime
from typing import Any

from bson import ObjectId
from fastapi import APIRouter, Depends, HTTPException, status

from app.core.security import get_current_user, hash_password, require_roles
from app.database.connection import get_database
from app.database.models import UserCreate

router = APIRouter(prefix="/users", tags=["users"])


@router.get("")
async def list_users(_user: dict[str, Any] = Depends(get_current_user)) -> list[dict[str, Any]]:
    db = get_database()
    rows = await db.users.find({}, {"password_hash": 0}).to_list(length=500)
    for row in rows:
        row["id"] = str(row.pop("_id"))
    return rows


@router.post("", status_code=status.HTTP_201_CREATED)
async def create_user(
    payload: UserCreate,
    _admin: dict[str, Any] = Depends(require_roles("admin")),
) -> dict[str, Any]:
    db = get_database()
    existing = await db.users.find_one({"$or": [{"username": payload.username}, {"email": payload.email}]})
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="User already exists")
    doc = payload.model_dump()
    password = doc.pop("password")
    doc["password_hash"] = hash_password(password)
    doc["created_at"] = datetime.now(UTC).isoformat()
    result = await db.users.insert_one(doc)
    doc.pop("password_hash", None)
    doc["id"] = str(result.inserted_id)
    return doc


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_user(
    user_id: str,
    _admin: dict[str, Any] = Depends(require_roles("admin")),
) -> None:
    db = get_database()
    oid = ObjectId(user_id)
    result = await db.users.delete_one({"_id": oid})
    if result.deleted_count == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
