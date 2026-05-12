"""Nested normalized event model."""

from __future__ import annotations

import json
from typing import Any

from pydantic import BaseModel, Field


class OCSFEvent(BaseModel):
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

    def to_json_dict(self) -> dict[str, Any]:
        return self.model_dump(mode="json")

    def to_normalized_json(self) -> str:
        return json.dumps(self.model_dump(mode="json"), ensure_ascii=False, default=str)


SIEMEvent = OCSFEvent
