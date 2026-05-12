"""Authentication APIs."""

from datetime import UTC, datetime
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import OAuth2PasswordRequestForm

from app.core.security import (
    create_access_token,
    create_refresh_token,
    decode_token,
    get_current_user,
    hash_password,
    verify_password,
)
from app.database.connection import get_database

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login")
async def login(form_data: OAuth2PasswordRequestForm = Depends()) -> dict[str, Any]:
    db = get_database()
    user = await db.users.find_one({"username": form_data.username})
    if not user or not verify_password(form_data.password, user.get("password_hash", "")):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid username or password")
    username = user["username"]
    return {
        "access_token": create_access_token(username),
        "refresh_token": create_refresh_token(username),
        "token_type": "bearer",
    }


@router.post("/refresh")
async def refresh(payload: dict[str, str]) -> dict[str, str]:
    refresh_token = payload.get("refresh_token", "")
    decoded = decode_token(refresh_token)
    if decoded.get("type") != "refresh":
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token")
    username = decoded.get("sub")
    if not username:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid refresh token payload")
    return {"access_token": create_access_token(username), "token_type": "bearer"}


@router.post("/logout")
async def logout(_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, str]:
    return {"status": "ok"}


@router.get("/me")
async def me(current_user: dict[str, Any] = Depends(get_current_user)) -> dict[str, Any]:
    return current_user


@router.post("/seed-admin")
async def seed_admin(payload: dict[str, str]) -> dict[str, str]:
    db = get_database()
    username = payload.get("username", "admin")
    email = payload.get("email", "admin@smartsiem.local")
    password = payload.get("password", "admin12345")
    existing = await db.users.find_one({"username": username})
    if existing:
        return {"status": "exists"}
    await db.users.insert_one(
        {
            "username": username,
            "email": email,
            "password_hash": hash_password(password),
            "role": "admin",
            "is_active": True,
            "created_at": datetime.now(UTC).isoformat(),
        }
    )
    return {"status": "created"}
