#!/bin/sh
set -eu

ROOT=$(CDPATH= cd -- "$(dirname -- "$0")/.." && pwd)
PYTHON="$ROOT/.venv/bin/python"

if [ ! -x "$PYTHON" ]; then
  echo "Backend environment is missing. Run: python3 -m venv .venv && .venv/bin/pip install -r backend/requirements.txt" >&2
  exit 1
fi

cleanup() {
  if [ -n "${BACKEND_PID:-}" ]; then
    kill "$BACKEND_PID" 2>/dev/null || true
  fi
}
trap cleanup EXIT INT TERM

cd "$ROOT"
if curl -fsS http://127.0.0.1:5001/ >/dev/null 2>&1; then
  echo "Using the Flask API already running on http://127.0.0.1:5001"
else
  "$PYTHON" -m flask --app backend.main run --host 127.0.0.1 --port 5001 --no-debugger --no-reload &
  BACKEND_PID=$!
fi

cd "$ROOT/frontend"
"$ROOT/frontend/node_modules/.bin/vite"
