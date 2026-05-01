#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# In Cursor AppImage terminals, these can break Python venv discovery.
unset APPIMAGE APPDIR ELECTRON_RUN_AS_NODE

if [[ ! -x "venv/bin/python" ]]; then
  echo "venv not found. Run: ./scripts/setup_venv.sh"
  exit 1
fi

exec venv/bin/python main.py
