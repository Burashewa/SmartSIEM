from __future__ import annotations

from datetime import timedelta
from typing import Any

from bson import ObjectId
from pymongo.errors import DuplicateKeyError

from auth import db as auth_db
from auth.security import (
    create_access_token,
    decrypt_agent_api_key,
    encrypt_agent_api_key,
    hash_agent_api_key,
    hash_password,
    hash_refresh_token,
    new_agent_api_key,
    new_refresh_token,
    now_utc,
    verify_password,
)
from config.settings import Settings


def _user_public(doc: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(doc["_id"]),
        "email": doc["email"],
        "display_name": doc.get("display_name"),
    }

def get_user_public_by_id(*, settings: Settings, user_id: str) -> dict[str, Any] | None:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        user = auth_db.users(db).find_one({"_id": ObjectId(user_id)})
        return _user_public(user) if user else None
    finally:
        client.close()


def register_user(*, settings: Settings, email: str, password: str, display_name: str | None) -> dict[str, Any]:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        doc = {
            "email": email.lower().strip(),
            "password_hash": hash_password(password),
            "display_name": display_name,
            "created_at": auth_db.utc_now(),
        }
        try:
            res = auth_db.users(db).insert_one(doc)
        except DuplicateKeyError as exc:
            raise ValueError("Email already registered") from exc
        doc["_id"] = res.inserted_id
        return _user_public(doc)
    finally:
        client.close()


def login(*, settings: Settings, email: str, password: str) -> tuple[dict[str, Any], str, str]:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        user = auth_db.users(db).find_one({"email": email.lower().strip()})
        if not user or not verify_password(password, user.get("password_hash", "")):
            raise ValueError("Invalid credentials")

        access = create_access_token(
            secret=settings.auth_jwt_secret,
            issuer=settings.auth_jwt_issuer,
            subject=str(user["_id"]),
            expires_in_seconds=settings.auth_access_token_ttl_seconds,
        )
        refresh = new_refresh_token()
        refresh_hash = hash_refresh_token(refresh)
        now = now_utc()
        expires = now + timedelta(seconds=settings.auth_refresh_token_ttl_seconds)
        auth_db.sessions(db).insert_one(
            {
                "user_id": user["_id"],
                "refresh_token_hash": refresh_hash,
                "created_at": now,
                "expires_at": expires,
            }
        )
        return _user_public(user), access, refresh
    finally:
        client.close()


def refresh(*, settings: Settings, refresh_token: str) -> tuple[dict[str, Any], str, str]:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        token_hash = hash_refresh_token(refresh_token)
        sess = auth_db.sessions(db).find_one({"refresh_token_hash": token_hash})
        if not sess:
            raise ValueError("Invalid refresh token")

        user = auth_db.users(db).find_one({"_id": sess["user_id"]})
        if not user:
            auth_db.sessions(db).delete_one({"_id": sess["_id"]})
            raise ValueError("Invalid refresh token")

        # Rotate refresh token (single-use)
        auth_db.sessions(db).delete_one({"_id": sess["_id"]})
        access = create_access_token(
            secret=settings.auth_jwt_secret,
            issuer=settings.auth_jwt_issuer,
            subject=str(user["_id"]),
            expires_in_seconds=settings.auth_access_token_ttl_seconds,
        )
        new_refresh = new_refresh_token()
        now = now_utc()
        auth_db.sessions(db).insert_one(
            {
                "user_id": user["_id"],
                "refresh_token_hash": hash_refresh_token(new_refresh),
                "created_at": now,
                "expires_at": now + timedelta(seconds=settings.auth_refresh_token_ttl_seconds),
            }
        )
        return _user_public(user), access, new_refresh
    finally:
        client.close()


def logout(*, settings: Settings, refresh_token: str) -> None:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        token_hash = hash_refresh_token(refresh_token)
        auth_db.sessions(db).delete_one({"refresh_token_hash": token_hash})
    finally:
        client.close()


def create_agent(
    *,
    settings: Settings,
    user_id: str,
    name: str,
    store_encrypted: bool = False,
) -> tuple[dict[str, Any], str]:
    api_key = new_agent_api_key()
    api_key_hash = hash_agent_api_key(api_key)
    ciphertext: str | None = None
    if store_encrypted:
        ciphertext = encrypt_agent_api_key(secret=settings.auth_jwt_secret, api_key=api_key)
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        doc: dict[str, Any] = {
            "user_id": ObjectId(user_id),
            "name": name,
            "api_key_hash": api_key_hash,
            "created_at": auth_db.utc_now(),
            "last_used_at": None,
        }
        if ciphertext is not None:
            doc["api_key_ciphertext"] = ciphertext
        res = auth_db.agents(db).insert_one(doc)
        doc["_id"] = res.inserted_id
        agent_pub = {
            "id": str(doc["_id"]),
            "name": doc["name"],
            "created_at": doc["created_at"].isoformat(),
            "last_used_at": None,
            "key_stored": ciphertext is not None,
        }
        return agent_pub, api_key
    finally:
        client.close()


def list_agents(*, settings: Settings, user_id: str) -> list[dict[str, Any]]:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        out: list[dict[str, Any]] = []
        for doc in auth_db.agents(db).find({"user_id": ObjectId(user_id)}).sort("created_at", -1):
            out.append(
                {
                    "id": str(doc["_id"]),
                    "name": doc.get("name", ""),
                    "created_at": doc.get("created_at").isoformat() if doc.get("created_at") else "",
                    "last_used_at": doc.get("last_used_at").isoformat() if doc.get("last_used_at") else None,
                    "key_stored": bool(doc.get("api_key_ciphertext")),
                }
            )
        return out
    finally:
        client.close()


def get_agent_api_key(*, settings: Settings, user_id: str, agent_id: str) -> str:
    """Return the decrypted plaintext API key.

    Raises ``LookupError`` when the agent does not exist for this user, and
    ``PermissionError`` when the key was not stored encrypted.
    """
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        doc = auth_db.agents(db).find_one(
            {"_id": ObjectId(agent_id), "user_id": ObjectId(user_id)}
        )
        if not doc:
            raise LookupError("Agent not found")
        ciphertext = doc.get("api_key_ciphertext")
        if not ciphertext:
            raise PermissionError("API key was not stored for this agent")
        return decrypt_agent_api_key(secret=settings.auth_jwt_secret, ciphertext=ciphertext)
    finally:
        client.close()


def delete_agent(*, settings: Settings, user_id: str, agent_id: str) -> bool:
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        res = auth_db.agents(db).delete_one({"_id": ObjectId(agent_id), "user_id": ObjectId(user_id)})
        return res.deleted_count == 1
    finally:
        client.close()


def authenticate_agent_api_key(*, settings: Settings, api_key: str) -> dict[str, Any] | None:
    api_key_hash = hash_agent_api_key(api_key)
    client = auth_db.get_client(settings)
    try:
        db = auth_db.get_db(client)
        agent = auth_db.agents(db).find_one({"api_key_hash": api_key_hash})
        if not agent:
            return None
        auth_db.agents(db).update_one(
            {"_id": agent["_id"]},
            {"$set": {"last_used_at": auth_db.utc_now()}},
        )
        return {"agent_id": str(agent["_id"]), "user_id": str(agent["user_id"]), "name": agent.get("name")}
    finally:
        client.close()

