#!/usr/bin/env python3
"""
POST sample logs to the SmartSIEM Collector HTTP API (/api/logs) for end-to-end checks:
collector -> parse/normalize/enrich -> Kafka -> detection-worker.

Delegates scenario execution to ``alert_scenarios.run_all_alert_scenarios`` (same coverage as
``trigger_all_alerts.py``). Shared HTTP helpers live in ``collector_ingest_client.py``.

Usage::

    python scripts/send_test_logs_to_collector.py
    python scripts/send_test_logs_to_collector.py --base-url http://127.0.0.1:5000
    python scripts/trigger_all_alerts.py --worker-url http://127.0.0.1:4000
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

_scripts_dir = Path(__file__).resolve().parent
if str(_scripts_dir) not in sys.path:
    sys.path.insert(0, str(_scripts_dir))

from alert_scenarios import run_all_alert_scenarios


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Send test logs through the collector to exercise detection-worker rules"
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:5000",
        help="Collector HTTP base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--worker-url",
        default="http://127.0.0.1:4000",
        help="Detection worker base URL for before/after /stats (default: %(default)s)",
    )
    parser.add_argument(
        "--delay-ms", type=int, default=120, help="Pause between single-log POSTs (default %(default)s)"
    )
    parser.add_argument(
        "--file-mod-count",
        type=int,
        default=100,
        help="FILE_MODIFY events for ransomware-burst rule (default %(default)s, must be >= 100)",
    )
    args = parser.parse_args()

    return run_all_alert_scenarios(
        base_url=args.base_url,
        delay_ms=args.delay_ms,
        file_mod_count=args.file_mod_count,
        worker_url=args.worker_url or None,
    )


if __name__ == "__main__":
    raise SystemExit(main())
