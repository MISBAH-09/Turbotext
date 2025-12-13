# Spell & Grammar Analysis Backend

FastAPI service that spell-checks and grammar-checks documents with two-level parallelism (processes per document, threads per chunk). Supports JSON text input and file uploads.

## Features
- Inter-file parallelism via `ProcessPoolExecutor`.
- Intra-file parallelism via `ThreadPoolExecutor` on text chunks.
- Spell checking with BK-tree suggestions (Damerau–Levenshtein, edit distance ≤ 2).
- Grammar checking via `language_tool_python` (prefers local LanguageTool install to avoid downloads).
- Token offsets preserved (char, line, column) for frontend highlighting.
- Endpoints: `/health`, `/`, `/docs`, `POST /analyze`, `POST /analyze-files`.

## Directory Layout
- `backend/app.py` – FastAPI app, routes, process pool wiring.
- `backend/models.py` – Pydantic request/response models.
- `backend/config.py` – Settings (env-driven).
- `backend/services/spell.py` – BK-tree, dictionary loader.
- `backend/services/grammar.py` – LanguageTool wrapper (thread-safe check, destructor patch).
- `backend/processing/chunk_worker.py` – Chunk analysis (spell + grammar).
- `backend/processing/file_worker.py` – Per-document orchestration, tokens/stats aggregation.
- `data/dictionary.json` – Sample dictionary.
- `files/` – Sample input files for testing.

## Configuration (env vars)
- `STORAGE_ROOT` (unused for current flow, default `storage`).
- `DICTIONARY_PATH` (default `data/dictionary.json`).
- `LANGUAGE` (default `en-US`).
- `LANGUAGE_TOOL_PATH` – Point to local LanguageTool directory to avoid downloads (e.g., `data/language_tool`).
- `CHUNK_SIZE` (default `4096`), `CHUNK_OVERLAP` (default `128`).
- `PROCESS_WORKERS` (default auto CPU), `THREAD_WORKERS` (default auto).
- `MAX_FILES` (default `16`), `MAX_FILE_BYTES` (default `5MB`).

## Install
```bash
pip3 install -r requirements.txt
```

### Java requirement
LanguageTool needs Java (JDK/JRE). Install a recent JDK (e.g., Temurin 17/21) and ensure `java -version` works in a new shell.

### LanguageTool setup (offline, recommended)
1) Download LanguageTool standalone: https://languagetool.org/download (e.g., LanguageTool-6.6.zip).  
2) Extract it to `data/LanguageTool-6.6` (already the default path in this repo). After extraction you should see:
   - `data/LanguageTool-6.6/languagetool.jar`
   - `data/LanguageTool-6.6/org/`
   - `data/LanguageTool-6.6/META-INF/`
3) Set env var so the backend can find it (PowerShell example):
   ```powershell
   setx LANGUAGE_TOOL_PATH "D:\BTWITSME\SEMESTER 6\Parallel & Distributed Computing\Project\backend\data\LanguageTool-6.6"
   ```
   Then open a new shell so the env var is picked up.
4) Start the API (`uvicorn backend.app:app --reload`) and check logs for successful LanguageTool initialization. If it fails, grammar checks are skipped.

If you prefer downloads each run, omit `LANGUAGE_TOOL_PATH`, but offline is faster and avoids network calls.

Notes:
- If `DICTIONARY_PATH` does not exist, the service now falls back to the `wordfreq` package to seed a reasonable English wordlist (much fewer false positives). Keep `wordfreq` installed or provide your own dictionary JSON to control vocabulary.
- Grammar checking still requires `language-tool-python` plus a local LanguageTool install (recommended via `LANGUAGE_TOOL_PATH` to avoid downloads).

## Run
```bash
cd /Users/mac/Desktop/techweer/prospecta
python3 -m uvicorn backend.app:app --reload
```

### One-click start (recommended)
- macOS/Linux: `./run_backend.sh` (optional overrides: `HOST=127.0.0.1 PORT=8000 RELOAD=1`)
- Windows (PowerShell): `./run_backend.ps1` (optional env: `HOST`, `PORT`, `RELOAD=1`)

Both scripts will:
- create `.venv` if missing and install `requirements.txt`
- check for `data/LanguageTool-6.6/languagetool.jar` (or `LANGUAGE_TOOL_PATH`)
- start `uvicorn backend.app:app`

## API
### Health
`GET /health` → `{"status":"ok","details":{"process_workers":N}}`

### Analyze raw text
`POST /analyze`  
Request:
```json
{
  "documents": [
    {"id": "doc1", "content": "there is som errrs in file"}
  ]
}
```
Response (shape):
```json
{
  "files": [
    {
      "id": "doc1",
      "tokens": [ {"text":"there","position":{...}}, ... ],
      "issues": [
        {
          "type": "spelling",
          "message": "Possible misspelling",
          "original": "som",
          "suggestions": ["some"],
          "position": {"start":8,"end":11,"line":1,"col":9}
        }
      ],
      "stats": {"word_count": 6, "spelling_issues": 2, "grammar_issues": 0, ...},
      "error": null
    }
  ]
}
```

### Analyze uploaded files
`POST /analyze` (form-data, key `files`) – returns simplified summary  
Example:
```bash
curl -X POST http://127.0.0.1:8000/analyze \
  -F "files=@files/report1.txt" \
  -F "files=@files/example.docx"
```

`POST /analyze-files` (form-data) – returns full tokens/issues payload  
Example:
```bash
curl -X POST http://127.0.0.1:8000/analyze-files \
  -F "files=@files/report1.txt" \
  -F "files=@files/example.docx"
```

## How It Works
- Request docs → process pool distributes per-document work.
- Each document: load spell checker + grammar tool, compute line offsets, chunk text with overlap, thread pool analyzes chunks, dedupes issues, collects tokens and stats.
- Grammar tool is guarded by a thread lock; destructor patched to avoid upstream attr errors.

## Troubleshooting
- Grammar disabled & logs mention Java: install Java and ensure `java -version` works in the shell that starts uvicorn.
- Grammar disabled & LanguageTool path missing: set `LANGUAGE_TOOL_PATH` to your extracted LanguageTool folder (e.g., `data/LanguageTool-6.6`).
- Missing `python-multipart`: `pip3 install python-multipart`.
- LanguageTool downloads each run: set `LANGUAGE_TOOL_PATH=/path/to/LanguageTool-*/`.
- Import errors when running Uvicorn: run from project root (`python3 -m uvicorn backend.app:app --reload`).
