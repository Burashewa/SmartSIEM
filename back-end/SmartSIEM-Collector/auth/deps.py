from __future__ import annotations

from typing import Any

from fastapi import Depends, HTTPException, Request
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from auth.security import decode_access_token
from config.settings import Settings


_bearer = HTTPBearer(auto_error=False)


def get_settings() -> Settings:
    return Settings()


def get_access_token(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> str | None:
    if not creds:
        return None
    if creds.scheme.lower() != "bearer":
        return None
    return creds.credentials


def require_user_id(
    token: str | None = Depends(get_access_token),
    settings: Settings = Depends(get_settings),
) -> str:
    if not token:
        raise HTTPException(status_code=401, detail="Missing Authorization header")
    try:
        payload = decode_access_token(token, secret=settings.auth_jwt_secret, issuer=settings.auth_jwt_issuer)
    except ValueError:
        raise HTTPException(status_code=401, detail="Invalid token")
    return payload["sub"]


def get_agent_api_key(request: Request) -> str | None:
    hdr = request.headers.get("x-api-key")
    if hdr and hdr.strip():
        return hdr.strip()
    auth = request.headers.get("authorization")
    if not auth:
        return None
    parts = auth.split()
    if len(parts) == 2 and parts[0].lower() == "bearer" and parts[1].strip():
        return parts[1].strip()
    return None

