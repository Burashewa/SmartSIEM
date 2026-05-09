from __future__ import annotations

import logging

from fastapi import APIRouter, Depends, HTTPException

from auth.deps import require_user_id

logger = logging.getLogger(__name__)
from auth.schemas import (
    AgentCreateRequest,
    AgentCreateResponse,
    AgentKeyResponse,
    AgentPublic,
    AuthResponse,
    LoginRequest,
    LogoutRequest,
    RefreshRequest,
    RegisterRequest,
    UserPublic,
)
from auth.service import (
    create_agent,
    delete_agent,
    get_agent_api_key,
    get_user_public_by_id,
    list_agents,
    login,
    logout,
    refresh,
    register_user,
)
from config.settings import Settings


router = APIRouter()


def get_settings() -> Settings:
    return Settings()


@router.post("/auth/register", response_model=UserPublic)
def post_register(payload: RegisterRequest, settings: Settings = Depends(get_settings)) -> UserPublic:
    try:
        user = register_user(
            settings=settings,
            email=str(payload.email),
            password=payload.password,
            display_name=payload.display_name,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc))
    return UserPublic(**user)


@router.post("/auth/login", response_model=AuthResponse)
def post_login(payload: LoginRequest, settings: Settings = Depends(get_settings)) -> AuthResponse:
    try:
        user, access, refresh_token = login(
            settings=settings,
            email=str(payload.email),
            password=payload.password,
        )
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return AuthResponse(
        user=UserPublic(**user),
        tokens={"access_token": access, "refresh_token": refresh_token, "token_type": "bearer"},
    )


@router.post("/auth/refresh", response_model=AuthResponse)
def post_refresh(payload: RefreshRequest, settings: Settings = Depends(get_settings)) -> AuthResponse:
    try:
        user, access, new_refresh = refresh(settings=settings, refresh_token=payload.refresh_token)
    except ValueError as exc:
        raise HTTPException(status_code=401, detail=str(exc))
    return AuthResponse(
        user=UserPublic(**user),
        tokens={"access_token": access, "refresh_token": new_refresh, "token_type": "bearer"},
    )


@router.post("/auth/logout")
def post_logout(payload: LogoutRequest, settings: Settings = Depends(get_settings)) -> dict[str, str]:
    logout(settings=settings, refresh_token=payload.refresh_token)
    return {"status": "ok"}


@router.get("/auth/me", response_model=UserPublic)
def get_me(user_id: str = Depends(require_user_id), settings: Settings = Depends(get_settings)) -> UserPublic:
    user = get_user_public_by_id(settings=settings, user_id=user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return UserPublic(**user)


@router.get("/agents", response_model=list[AgentPublic])
def get_agents(user_id: str = Depends(require_user_id), settings: Settings = Depends(get_settings)) -> list[AgentPublic]:
    docs = list_agents(settings=settings, user_id=user_id)
    return [AgentPublic(**d) for d in docs]


@router.post("/agents", response_model=AgentCreateResponse)
def post_agents(
    payload: AgentCreateRequest,
    user_id: str = Depends(require_user_id),
    settings: Settings = Depends(get_settings),
) -> AgentCreateResponse:
    try:
        agent, api_key = create_agent(
            settings=settings,
            user_id=user_id,
            name=payload.name,
            store_encrypted=payload.store_encrypted,
        )
    except ValueError as exc:
        # Misconfiguration (e.g. empty signing secret) we can surface to the UI.
        raise HTTPException(status_code=400, detail=str(exc))
    except Exception as exc:  # pragma: no cover - defensive
        # Make sure the frontend always receives JSON with a real cause instead
        # of a generic "Internal Server Error" that breaks JSON.parse client-side.
        logger.exception("Failed to create agent")
        raise HTTPException(
            status_code=500,
            detail=f"create_agent failed: {exc.__class__.__name__}: {exc}",
        )
    return AgentCreateResponse(agent=AgentPublic(**agent), api_key=api_key)


@router.get("/agents/{agent_id}/key", response_model=AgentKeyResponse)
def get_agent_key(
    agent_id: str,
    user_id: str = Depends(require_user_id),
    settings: Settings = Depends(get_settings),
) -> AgentKeyResponse:
    try:
        api_key = get_agent_api_key(settings=settings, user_id=user_id, agent_id=agent_id)
    except LookupError as exc:
        raise HTTPException(status_code=404, detail=str(exc))
    except PermissionError as exc:
        # 410 Gone: the resource exists but its plaintext is not retrievable.
        raise HTTPException(status_code=410, detail=str(exc))
    except ValueError as exc:
        raise HTTPException(status_code=500, detail=str(exc))
    return AgentKeyResponse(agent_id=agent_id, api_key=api_key)


@router.delete("/agents/{agent_id}")
def delete_agents(
    agent_id: str,
    user_id: str = Depends(require_user_id),
    settings: Settings = Depends(get_settings),
) -> dict[str, str]:
    ok = delete_agent(settings=settings, user_id=user_id, agent_id=agent_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Agent not found")
    return {"status": "ok"}

