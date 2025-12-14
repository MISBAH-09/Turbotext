import asyncio
import logging
import os
from collections import OrderedDict
from dataclasses import replace
from typing import List, Any
from concurrent.futures import ProcessPoolExecutor
from uuid import uuid4

from fastapi import FastAPI, HTTPException, UploadFile, File, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse

from backend.config import Settings, load_settings
from backend.models import (
    AnalyzeRequest,
    AnalyzeResponse,
    FileResult,
    HealthResponse,
)
from backend.processing.file_worker import process_document
from backend.services.file_decode import decode_uploaded_file


logger = logging.getLogger("backend")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")


class _ContentCache:
    """Tiny LRU cache to keep decoded text for on-demand editor loads."""

    def __init__(self, capacity: int):
        self.capacity = max(1, capacity)
        self._store: OrderedDict[str, str] = OrderedDict()

    def put(self, key: str, value: str) -> None:
        self._store[key] = value
        self._store.move_to_end(key)
        if len(self._store) > self.capacity:
            self._store.popitem(last=False)

    def get(self, key: str) -> str | None:
        value = self._store.get(key)
        if value is not None:
            self._store.move_to_end(key)
        return value


settings: Settings = load_settings()
content_cache = _ContentCache(settings.content_cache_items)
process_workers = settings.process_workers or max(1, os.cpu_count() or 1)
try:
    process_pool = ProcessPoolExecutor(max_workers=process_workers)
    process_pool_workers = process_workers
except PermissionError as exc:  # pragma: no cover - environment-specific
    logger.warning("Process pool unavailable (%s); falling back to threads", exc)
    process_pool = None
    process_pool_workers = 0

app = FastAPI(title="Spell/Grammar Analysis API", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", response_class=HTMLResponse)
async def index() -> str:
    return """
    <html>
      <head><title>Analysis API</title></head>
      <body style="font-family: Arial, sans-serif; max-width: 720px; margin: 2rem auto;">
        <h1>Spell & Grammar Analysis API</h1>
        <p>Server is running.</p>
        <ul>
          <li><a href="/docs">Open API Docs</a></li>
          <li>Health check: <code>/health</code></li>
          <li>Analyze: <code>POST /analyze</code> with JSON body <code>{"documents":[{"id":"doc1","content":"text..."}]}</code></li>
          <li>Analyze files: <code>POST /analyze-files</code> (form-data files)</li>
        </ul>
      </body>
    </html>
    """


@app.get("/health", response_model=HealthResponse)
async def health() -> HealthResponse:
    return HealthResponse(details={"process_workers": process_pool_workers})


async def _analyze_single(doc: dict, effective_settings: Settings, include_content: bool = True) -> FileResult:
    loop = asyncio.get_running_loop()
    content_id = doc.get("content_id")
    cached_available = content_cache.get(content_id) is not None if content_id else False
    try:
        result = await loop.run_in_executor(
            process_pool, process_document, doc["id"], doc["content"], effective_settings
        )
        if not include_content:
            result = {**result, "content": None}
        return FileResult(
            **result,
            content_id=content_id,
            content_available=include_content or cached_available,
        )
    except Exception as exc:  # pragma: no cover - guardrail
        logger.exception("Failed to analyze %s", doc.get("id"))
        return FileResult(
            id=doc.get("id", ""),
            tokens=[],
            issues=[],
            stats={},
            error=str(exc),
            content_id=content_id,
            content_available=include_content or cached_available,
        )


@app.post("/analyze")
async def analyze(
    request: Request,
    files: List[UploadFile] | None = File(default=None),
    include_content: bool = False,
) -> Any:
    # Multipart form-data path: treat as file uploads and return a simplified summary.
    if files:
        if len(files) > settings.max_files:
            raise HTTPException(
                status_code=400,
                detail=f"Too many files; limit is {settings.max_files}",
            )

        documents = []
        for idx, f in enumerate(files):
            data = await f.read()
            if len(data) > settings.max_file_bytes:
                raise HTTPException(
                    status_code=400,
                    detail=f"File '{f.filename}' exceeds {settings.max_file_bytes} bytes",
                )
            text, _ = decode_uploaded_file(f.filename, data)
            content_id = uuid4().hex
            if not include_content:
                content_cache.put(content_id, text)
            documents.append({"id": f.filename or f"file{idx+1}", "content": text, "content_id": content_id})

        effective_settings = replace(settings)
        results = await asyncio.gather(
            *[_analyze_single(doc, effective_settings, include_content) for doc in documents]
        )

        formatted = []
        for res in results:
            spelling_errors = []
            grammar_errors = []
            for issue in res.issues:
                if issue.type == "spelling":
                    spelling_errors.append(
                        {
                            "word": issue.original,
                            "suggestions": issue.suggestions,
                            "start": issue.position.start,
                            "end": issue.position.end,
                        }
                    )
                else:
                    grammar_errors.append(
                        {
                            "issue": issue.message,
                            "suggestions": issue.suggestions,
                            "start": issue.position.start,
                            "end": issue.position.end,
                        }
                    )
            formatted.append(
                {
                    "filename": res.id,
                    "spelling_errors": spelling_errors,
                    "grammar_errors": grammar_errors,
                }
            )

        return {"status": "success", "files": formatted}

    # JSON path: preserve existing request/response shape.
    try:
        payload = await request.json()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid JSON body")

    try:
        parsed = AnalyzeRequest.model_validate(payload)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=str(exc))

    if len(parsed.documents) > settings.max_files:
        raise HTTPException(
            status_code=400,
            detail=f"Too many files; limit is {settings.max_files}",
        )

    effective_settings = replace(
        settings,
        chunk_size=parsed.chunk_size or settings.chunk_size,
        chunk_overlap=parsed.chunk_overlap or settings.chunk_overlap,
        language=parsed.language or settings.language,
    )

    tasks = [
        _analyze_single(doc.model_dump(), effective_settings, include_content) for doc in parsed.documents
    ]
    results = await asyncio.gather(*tasks)
    return AnalyzeResponse(files=results)


@app.post("/analyze-files", response_model=AnalyzeResponse)
async def analyze_files(
    files: List[UploadFile] | None = File(default=None),
    file: UploadFile | None = File(default=None),
    include_content: bool = False,
) -> AnalyzeResponse:
    incoming: List[UploadFile] = []
    if file is not None:
        incoming.append(file)
    if files:
        incoming.extend(files)

    if not incoming:
        raise HTTPException(status_code=400, detail="No files provided")
    if len(incoming) > settings.max_files:
        raise HTTPException(status_code=400, detail=f"Too many files; limit is {settings.max_files}")

    documents = []
    for idx, f in enumerate(incoming):
        data = await f.read()
        if len(data) > settings.max_file_bytes:
            raise HTTPException(
                status_code=400,
                detail=f"File '{f.filename}' exceeds {settings.max_file_bytes} bytes",
            )
        text, _ = decode_uploaded_file(f.filename, data)
        content_id = uuid4().hex
        if not include_content:
            content_cache.put(content_id, text)
        documents.append({"id": f.filename or f"file{idx+1}", "content": text, "content_id": content_id})

    effective_settings = replace(settings)
    tasks = [_analyze_single(doc, effective_settings, include_content) for doc in documents]
    results = await asyncio.gather(*tasks)
    return AnalyzeResponse(files=results)


@app.get("/file-content/{content_id}")
async def get_file_content(content_id: str) -> dict:
    cached = content_cache.get(content_id)
    if cached is None:
        raise HTTPException(status_code=404, detail="Content not found or expired")
    return {"file_id": content_id, "content": cached}


# Entrypoint for `uvicorn backend.app:app --reload`
def get_app() -> FastAPI:
    return app
