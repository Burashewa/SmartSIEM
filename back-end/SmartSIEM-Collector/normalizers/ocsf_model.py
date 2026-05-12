"""Flat normalized event model."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field


class OCSFEvent(BaseModel):
    """Normalized event in flat transport-agnostic structure."""

    timestamp: str = Field(default="")
    source: str = Field(default="")
    severity: str = Field(default="")
    event: str = Field(default="")
    action: str = Field(default="")
    status: str = Field(default="")
    user: str = Field(default="")
    role: str = Field(default="")
    deviceId: str = Field(default="")
    sessionId: str = Field(default="")
    endpoint: str = Field(default="")
    method: str = Field(default="")
    resource: str = Field(default="")
    payload: dict[str, Any] = Field(default_factory=dict)
    metadata: dict[str, Any] = Field(default_factory=dict)
    tags: list[Any] = Field(default_factory=list)
    message: str = Field(default="")
    log: str = Field(default="")
    line: str = Field(default="")
    rawLine: str = Field(default="")
    raw: dict[str, Any] = Field(default_factory=dict)

    model_config = {"extra": "allow", "str_strip_whitespace": True}

    def to_normalized_json(self) -> str:
        """Serialize normalized event to JSON string."""
        data = self.model_dump(mode="json")
        return json.dumps(data, ensure_ascii=False, default=str)

    def to_siem_json(self) -> str:
        """Backward-compatible alias for legacy callers."""
        return self.to_normalized_json()

    def to_json_dict(self) -> dict[str, Any]:
        """Return JSON-serializable dict for output pipeline."""
        return self.model_dump(mode="json")


SIEMEvent = OCSFEvent
