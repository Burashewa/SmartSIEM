"""Pydantic models for detection rules."""

from typing import Any

from pydantic import BaseModel, Field


class DetectionRule(BaseModel):
    rule_id: str
    name: str
    type: str
    severity: str
    event_type: str
    config: dict[str, Any] = Field(default_factory=dict)
    status: str = "ACTIVE"


class DetectionRuleOut(DetectionRule):
    id: str
