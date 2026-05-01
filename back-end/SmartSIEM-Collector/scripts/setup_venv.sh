#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

# In Cursor AppImage terminals, these can break Python venv discovery.
unset APPIMAGE APPDIR ELECTRON_RUN_AS_NODE

/usr/bin/python3.13 -m venv venv
venv/bin/python -m pip install --upgrade pip
venv/bin/python -m pip install -r requirements.txt

echo "Virtual environment ready at: $ROOT_DIR/venv"
echo "Activate with: source venv/bin/activate"
