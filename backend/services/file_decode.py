from io import BytesIO
from pathlib import Path
from typing import Tuple

try:  # Optional import; only used for DOCX handling.
    from docx import Document  # type: ignore
except Exception:  # pragma: no cover - optional dependency
    Document = None  # type: ignore


def decode_uploaded_file(filename: str | None, data: bytes) -> Tuple[str, str]:
    """
    Decode an uploaded file into plain text.
    Returns (text, reason) where reason is informative for logging.
    """
    name = filename or ""
    ext = Path(name).suffix.lower()

    if ext == ".docx" and Document is not None:
        try:
            doc = Document(BytesIO(data))
            text = "\n".join(p.text for p in doc.paragraphs)
            if text.strip():
                return text, "docx-parsed"
        except Exception:
            pass  # fall through to text decode

    # Fallback: try utf-8 then latin-1
    try:
        return data.decode("utf-8"), "utf-8"
    except Exception:
        return data.decode("latin-1", errors="ignore"), "latin-1"
