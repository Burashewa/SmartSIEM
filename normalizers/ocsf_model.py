"""Nested normalized event model."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field


class OCSFEvent(BaseModel):
    """Normalized event in nested transport-agnostic structure."""

    timestamp: str = Field(default="")
    event: dict[str, Any] = Field(default_factory=dict)
    source: dict[str, Any] = Field(default_factory=dict)
    destination: dict[str, Any] = Field(default_factory=dict)
    user: dict[str, Any] = Field(default_factory=dict)
    host: dict[str, Any] = Field(default_factory=dict)
    observer: dict[str, Any] = Field(default_factory=dict)
    network: dict[str, Any] = Field(default_factory=dict)
    service: dict[str, Any] = Field(default_factory=dict)
    process: dict[str, Any] = Field(default_factory=dict)
    message: str = Field(default="")
    raw_log: str = Field(default="")

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
