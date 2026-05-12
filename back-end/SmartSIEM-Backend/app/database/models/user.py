"""Pydantic models for users."""

from pydantic import BaseModel, Field


class UserCreate(BaseModel):
    username: str
    email: str
    password: str = Field(min_length=8)
    role: str = "analyst"
    is_active: bool = True


class UserOut(BaseModel):
    id: str
    username: str
    email: str
    role: str
    is_active: bool
