#!/usr/bin/env bash
# One-click starter for the FastAPI backend (creates venv, checks LanguageTool jar, runs uvicorn).

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
VENV_DIR="$SCRIPT_DIR/.venv"
PYTHON_BIN="${PYTHON:-python3}"
RELOAD=${RELOAD:-0}
HOST=${HOST:-127.0.0.1}
PORT=${PORT:-8000}

# Prefer bundled LanguageTool unless overridden by env.
export LANGUAGE_TOOL_PATH="${LANGUAGE_TOOL_PATH:-$SCRIPT_DIR/data/LanguageTool-6.6}"
LT_JAR="$LANGUAGE_TOOL_PATH/languagetool.jar"

if [ ! -f "$LT_JAR" ]; then
  echo "LanguageTool jar not found at $LT_JAR"
  echo "Download LanguageTool and extract it to '$LANGUAGE_TOOL_PATH' or set LANGUAGE_TOOL_PATH accordingly."
  exit 1
fi

if ! command -v java >/dev/null 2>&1; then
  echo "Java runtime not found; install JDK/JRE so grammar checks work (java -version should succeed)." >&2
fi

if [ ! -d "$VENV_DIR" ]; then
  echo "Creating virtualenv in $VENV_DIR..."
  "$PYTHON_BIN" -m venv "$VENV_DIR"
  source "$VENV_DIR/bin/activate"
  pip install --upgrade pip
  pip install -r "$SCRIPT_DIR/requirements.txt"
else
  source "$VENV_DIR/bin/activate"
fi

cd "$PROJECT_ROOT"
if [ "$RELOAD" = "1" ]; then
  exec uvicorn backend.app:app --host "$HOST" --port "$PORT" --reload
else
  exec uvicorn backend.app:app --host "$HOST" --port "$PORT"
fi
