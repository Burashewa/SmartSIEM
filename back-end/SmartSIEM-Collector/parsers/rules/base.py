"""Shared rule primitives for parser regex modules."""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Pattern


@dataclass(frozen=True)
class RegexRule:
    """
    A single parsing rule: log type, compiled pattern, and match priority.

    scope: "line" = match full input; "message" = match only syslog message part.
    """

    log_type: str
    pattern: Pattern[str]
    priority: int = 0
    scope: str = "line"

    def match(self, text: str) -> re.Match[str] | None:
        """Return match object if text matches, else None."""
        return self.pattern.match(text)
