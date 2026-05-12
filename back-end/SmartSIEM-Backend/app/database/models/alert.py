"""Pydantic models for alerts."""

from typing import Any

from pydantic import BaseModel, Field


class AlertBase(BaseModel):
    rule_id: str
    rule_name: str
    severity: str
    event_type: str
    trigger_time: str
    source_ip: str | None = None
    user_id: str | None = None
    description: str
    linked_events: list[Any] = Field(default_factory=list)
    recommendation: dict[str, Any] | None = None
    status: str = "NEW"


class AlertCreate(AlertBase):
    alert_id: str | None = None


class AlertOut(AlertBase):
    id: str
    alert_id: str
