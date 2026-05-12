"""Shared rule primitives for parser regex modules."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Pattern


@dataclass(frozen=True)
class RegexRule:
    """Single parsing rule for either line or message scopes."""

    log_type: str
    pattern: Pattern[str]
    priority: int = 0
    scope: str = "line"

    def match(self, text: str) -> re.Match[str] | None:
        return self.pattern.match(text)
