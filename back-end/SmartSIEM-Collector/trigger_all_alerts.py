#!/usr/bin/env python3
"""Launcher for ``scripts/trigger_all_alerts.py`` (run from this directory)."""

import runpy
import sys
from pathlib import Path

_target = Path(__file__).resolve().parent / "scripts" / "trigger_all_alerts.py"
if not _target.is_file():
    print(f"Missing {_target}", file=sys.stderr)
    raise SystemExit(1)
sys.argv[0] = str(_target)
runpy.run_path(str(_target), run_name="__main__")
