# TurboText (Frontend + Backend)

Unified setup for the TurboText FastAPI backend and React frontend.

## Prerequisites
- Python 3.10+ (with `python3`/`pip3` on PATH)
- Node.js 18+ (with `npm`)
- Java runtime for LanguageTool (required for grammar checks)

## Configuration
- Root config file: `config.env` (loaded automatically by `run_app.sh`). Override any setting via env vars as well.
- Key options:
  - `API_PORT` (default 8000), `APP_PORT` (default 3000)
  - `PROCESS_WORKERS`, `THREAD_WORKERS`, `CHUNK_SIZE`, `CHUNK_OVERLAP`
  - `LANGUAGE`, `DICTIONARY_PATH`, `LANGUAGE_TOOL_PATH`

## One-shot dev start
From the repo root:
```bash
# first-time setup: ensure deps are installed
(cd backend && ./run_backend.sh --help >/dev/null 2>&1 || true)
(cd Turbo-Text-Frontend && npm install)

# launch both servers (default ports: API 8000, app 3000)
./run_app.sh
```
- Backend: http://127.0.0.1:8000 (change with `API_PORT=8001 ./run_app.sh`)
- Frontend: http://localhost:3000 (change with `APP_PORT=3001 ./run_app.sh`)

The launcher auto-wires `REACT_APP_API_BASE_URL` for the frontend.

## Manual starts
- Backend: `cd backend && ./run_backend.sh` (or `PORT=8001 ./run_backend.sh`)
- Frontend: `cd Turbo-Text-Frontend && npm start` (use `.env` with `REACT_APP_API_BASE_URL=http://127.0.0.1:8000` if custom port)

## Notes
- If port 8000 is busy, pick another via `API_PORT=8001`.
- Grammar checks need a local LanguageTool install; see `backend/README.md` for setup and env vars.
