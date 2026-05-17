#!/usr/bin/env python3
"""
Trigger every default detection-worker alert via the collector HTTP API.

Same scenarios as ``send_test_logs_to_collector.py``; use this entry point when you only
care about firing alerts (naming clarity).

    python scripts/trigger_all_alerts.py
    python scripts/trigger_all_alerts.py --base-url http://127.0.0.1:5000 --worker-url http://127.0.0.1:4000
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
        description="POST all test scenarios to the collector to trigger default detection alerts"
    )
    parser.add_argument(
        "--base-url",
        default="http://127.0.0.1:5000",
        help="Collector HTTP base URL (default: %(default)s)",
    )
    parser.add_argument(
        "--worker-url",
        default="http://127.0.0.1:4000",
        help="Detection worker /stats URL (default: %(default)s; pass empty to skip)",
    )
    parser.add_argument("--delay-ms", type=int, default=120, help="Pause between POSTs (default %(default)s)")
    parser.add_argument(
        "--file-mod-count",
        type=int,
        default=100,
        help="FILE_MODIFY events for ransomware-burst threshold (default %(default)s, use >= 100)",
    )
    args = parser.parse_args()
    wurl = (args.worker_url or "").strip()
    return run_all_alert_scenarios(
        base_url=args.base_url,
        delay_ms=args.delay_ms,
        file_mod_count=args.file_mod_count,
        worker_url=wurl if wurl else None,
    )


if __name__ == "__main__":
    raise SystemExit(main())
