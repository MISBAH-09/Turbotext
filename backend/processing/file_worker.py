import os
import time
from concurrent.futures import ThreadPoolExecutor
from typing import Dict, List, Tuple

from backend.config import Settings
from backend.processing.chunk_worker import analyze_chunk, compute_line_offsets, WORD_RE, offset_to_position
from backend.services.grammar import GrammarNotAvailable, get_language_tool
from backend.services.spell import get_spell_checker


def chunk_text(text: str, size: int, overlap: int) -> List[Tuple[int, str]]:
    """Yield (start_offset, chunk_text). Keeps a small overlap to avoid split tokens."""
    chunks: List[Tuple[int, str]] = []
    idx, n = 0, len(text)
    while idx < n:
        end = min(n, idx + size)
        # Extend to the next whitespace boundary (within a cap) to avoid cutting a word.
        boundary = end
        while boundary < n and not text[boundary].isspace() and boundary - idx < size + overlap:
            boundary += 1
        end = min(boundary, n)
        chunks.append((idx, text[idx:end]))
        if end == n:
            break
        idx = max(end - overlap, idx + 1)
    return chunks


def deduplicate_issues(issues: List[Dict]) -> List[Dict]:
    def _rank(item: Dict) -> Tuple[int, int, int]:
        type_rank = 0 if item["type"] == "grammar" else 1
        suggestion_rank = -len(item.get("suggestions") or [])
        message_rank = -len(item.get("message", ""))
        return (type_rank, suggestion_rank, message_rank)

    best_by_span: Dict[Tuple[int, int], Dict] = {}
    for issue in issues:
        pos = issue["position"]
        key = (pos["start"], pos["end"])
        current = best_by_span.get(key)
        if current is None or _rank(issue) < _rank(current):
            best_by_span[key] = issue

    deduped = sorted(best_by_span.values(), key=lambda i: (i["position"]["start"], i["position"]["end"]))
    return deduped


def collect_tokens(text: str, line_offsets: List[int]) -> List[Dict]:
    tokens: List[Dict] = []
    for match in WORD_RE.finditer(text):
        abs_start = match.start()
        abs_end = match.end()
        line, col = offset_to_position(abs_start, line_offsets)
        tokens.append(
            {
                "text": match.group(),
                "position": {
                    "start": abs_start,
                    "end": abs_end,
                    "line": line,
                    "col": col,
                },
            }
        )
    return tokens


def process_document(doc_id: str, text: str, settings: Settings) -> Dict:
    spell_checker = get_spell_checker(settings.dictionary_path)
    grammar_enabled = not settings.disable_grammar
    try:
        grammar_tool = get_language_tool(settings.language, path=settings.language_tool_path) if grammar_enabled else None
    except GrammarNotAvailable:
        grammar_tool = None
        grammar_enabled = False

    started = time.time()
    line_offsets = compute_line_offsets(text)
    tokens = collect_tokens(text, line_offsets)

    chunk_size = settings.chunk_size
    overlap = min(settings.chunk_overlap, chunk_size // 4)
    chunks = chunk_text(text, chunk_size, overlap)

    max_workers = settings.thread_workers or min(32, max(4, (os.cpu_count() or 4)))
    issues: List[Dict] = []
    with ThreadPoolExecutor(max_workers=max_workers) as executor:
        futures = [
            executor.submit(
                analyze_chunk, chunk_text_part, start_offset, line_offsets, spell_checker, grammar_tool
            )
            for start_offset, chunk_text_part in chunks
        ]
        for future in futures:
            issues.extend(future.result())

    issues = deduplicate_issues(issues)
    duration_ms = int((time.time() - started) * 1000)
    severity_counts = {"error": 0, "suggestion": 0}
    for i in issues:
        sev = i.get("severity", "error")
        if sev not in severity_counts:
            severity_counts["suggestion"] += 1
        else:
            severity_counts[sev] += 1
    weighted_errors = severity_counts["error"] + 0.3 * severity_counts["suggestion"]
    weighted_accuracy = 100.0
    if tokens:
        weighted_accuracy = max(0.0, 100.0 - (weighted_errors / len(tokens)) * 100.0)

    return {
        "id": doc_id,
        "tokens": tokens,
        "issues": issues,
        "stats": {
            "duration_ms": duration_ms,
            "chunks": len(chunks),
            "thread_workers": max_workers,
            "bytes": len(text.encode("utf-8")),
            "word_count": len(tokens),
            "spelling_issues": sum(1 for i in issues if i["type"] == "spelling"),
            "grammar_issues": sum(1 for i in issues if i["type"] == "grammar"),
            "severity_counts": severity_counts,
            "weighted_errors": weighted_errors,
            "weighted_accuracy": weighted_accuracy,
            "grammar_enabled": grammar_enabled,
        },
        "error": None,
    }
