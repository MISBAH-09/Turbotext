#!/usr/bin/env bash
# One-shot launcher for TurboText: ensures deps, picks free ports, starts backend + frontend.

set -euo pipefail

ROOT_DIR="$(cd -- "$(dirname "$0")" && pwd)"

CONFIG_FILE="${ROOT_DIR}/config.env"
if [ -f "${CONFIG_FILE}" ]; then
  echo "Loading config from ${CONFIG_FILE}"
  set -a
  . "${CONFIG_FILE}"
  set +a
fi

API_PORT="${API_PORT:-8000}"
APP_PORT="${APP_PORT:-3000}"
PROCESS_WORKERS="${PROCESS_WORKERS:-}"
THREAD_WORKERS="${THREAD_WORKERS:-}"
CHUNK_SIZE="${CHUNK_SIZE:-}"
CHUNK_OVERLAP="${CHUNK_OVERLAP:-}"
LANGUAGE_TOOL_PATH="${LANGUAGE_TOOL_PATH:-}"
DICTIONARY_PATH="${DICTIONARY_PATH:-}"
LANGUAGE="${LANGUAGE:-}"

BACKEND_ENV=()
[ -n "${PROCESS_WORKERS}" ] && BACKEND_ENV+=(PROCESS_WORKERS="${PROCESS_WORKERS}")
[ -n "${THREAD_WORKERS}" ] && BACKEND_ENV+=(THREAD_WORKERS="${THREAD_WORKERS}")
[ -n "${CHUNK_SIZE}" ] && BACKEND_ENV+=(CHUNK_SIZE="${CHUNK_SIZE}")
[ -n "${CHUNK_OVERLAP}" ] && BACKEND_ENV+=(CHUNK_OVERLAP="${CHUNK_OVERLAP}")
[ -n "${LANGUAGE_TOOL_PATH}" ] && BACKEND_ENV+=(LANGUAGE_TOOL_PATH="${LANGUAGE_TOOL_PATH}")
[ -n "${DICTIONARY_PATH}" ] && BACKEND_ENV+=(DICTIONARY_PATH="${DICTIONARY_PATH}")
[ -n "${LANGUAGE}" ] && BACKEND_ENV+=(LANGUAGE="${LANGUAGE}")

find_free_port() {
  python3 - "$1" <<'PY'
import socket, sys
start = int(sys.argv[1])
port = start
while port < start + 50:
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        if s.connect_ex(("127.0.0.1", port)) != 0:
            print(port)
            sys.exit(0)
    port += 1
print(start)  # fallback
PY
}

# Resolve ports to free ones if needed
API_PORT="$(find_free_port "${API_PORT}")"
APP_PORT="$(find_free_port "${APP_PORT}")"

echo "API_PORT=${API_PORT}  APP_PORT=${APP_PORT}"

echo "Ensuring frontend dependencies..."
(
  cd "${ROOT_DIR}/Turbo-Text-Frontend"
  if [ ! -d node_modules ]; then
    npm install
  fi
)

echo "Starting backend..."
(
  cd "${ROOT_DIR}/backend"
  env PORT="${API_PORT}" ${BACKEND_ENV[@]+"${BACKEND_ENV[@]}"} ./run_backend.sh
) &
BACKEND_PID=$!

cleanup() {
  echo
  echo "Stopping backend (pid ${BACKEND_PID})..."
  kill "${BACKEND_PID}" 2>/dev/null || true
}
trap cleanup EXIT INT TERM

wait_for_backend() {
  local url="http://127.0.0.1:${API_PORT}/health"
  local retries=40
  local delay=0.5
  echo "Waiting for backend to become healthy at ${url} ..."
  for i in $(seq 1 ${retries}); do
    if curl -fsS --max-time 1 "${url}" >/dev/null 2>&1; then
      echo "Backend is up."
      return 0
    fi
    sleep "${delay}"
  done
  echo "Backend did not respond at ${url} after $(echo "${retries}*${delay}" | bc)s"
  exit 1
}

wait_for_backend

echo "Starting frontend..."
cd "${ROOT_DIR}/Turbo-Text-Frontend"
REACT_APP_API_BASE_URL="http://127.0.0.1:${API_PORT}" PORT="${APP_PORT}" npm start
