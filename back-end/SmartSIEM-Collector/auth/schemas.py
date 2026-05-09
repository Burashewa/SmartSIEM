from __future__ import annotations

from pydantic import BaseModel, EmailStr, Field


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8, max_length=256)
    display_name: str | None = Field(default=None, max_length=120)


class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class RefreshRequest(BaseModel):
    refresh_token: str


class LogoutRequest(BaseModel):
    refresh_token: str


class UserPublic(BaseModel):
    id: str
    email: EmailStr
    display_name: str | None = None


class AuthTokens(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"


class AuthResponse(BaseModel):
    user: UserPublic
    tokens: AuthTokens


class AgentCreateRequest(BaseModel):
    name: str = Field(min_length=1, max_length=120)
    # When True, the collector stores the API key encrypted (Fernet w/ a key
    # derived from auth_jwt_secret) so the user can retrieve it later via
    # GET /agents/{id}/key. When False (default) the key is shown once and
    # only its hash is stored.
    store_encrypted: bool = False


class AgentPublic(BaseModel):
    id: str
    name: str
    created_at: str
    last_used_at: str | None = None
    # Indicates the plaintext key can be retrieved via GET /agents/{id}/key.
    key_stored: bool = False


class AgentCreateResponse(BaseModel):
    agent: AgentPublic
    api_key: str


class AgentKeyResponse(BaseModel):
    agent_id: str
    api_key: str

