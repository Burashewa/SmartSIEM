"""Pydantic models for log events."""

from typing import Any

from pydantic import BaseModel, Field


class LogEventCreate(BaseModel):
    timestamp: str
    event: dict[str, Any]
    source: dict[str, Any]
    destination: dict[str, Any] = Field(default_factory=dict)
    user: dict[str, Any] = Field(default_factory=dict)
    host: dict[str, Any] = Field(default_factory=dict)
    observer: dict[str, Any] = Field(default_factory=dict)
    network: dict[str, Any] = Field(default_factory=dict)
    service: dict[str, Any] = Field(default_factory=dict)
    process: dict[str, Any] = Field(default_factory=dict)
    message: str = ""
    raw_log: str = ""
    deviceId: str = ""


class LogEventOut(LogEventCreate):
    id: str
