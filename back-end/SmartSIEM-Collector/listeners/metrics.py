"""In-process counters for the SmartSIEM Collector HTTP layer.

These counters are intentionally simple and non-persistent: they live for the
lifetime of the collector process and are exposed via /metrics for the
dashboard.
"""

from __future__ import annotations

import threading
import time
from collections import defaultdict
from typing import Any

_lock = threading.Lock()
_counters: dict[str, int] = defaultdict(int)
_per_source: dict[str, int] = defaultdict(int)
_started_at: float = time.time()


def increment(name: str, amount: int = 1) -> None:
    if amount <= 0:
        return
    with _lock:
        _counters[name] += amount


def increment_source(source: str, amount: int = 1) -> None:
    if amount <= 0 or not source:
        return
    with _lock:
        _per_source[source] += amount


def snapshot() -> dict[str, Any]:
    with _lock:
        return {
            "started_at": _started_at,
            "uptime_seconds": time.time() - _started_at,
            "counters": dict(_counters),
            "per_source": dict(_per_source),
        }
