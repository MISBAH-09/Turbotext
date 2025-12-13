import os
import uuid
from pathlib import Path
from typing import Iterable, Tuple


def _ensure_dir(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)


def build_storage_path(storage_root: str, file_id: str) -> Path:
    return Path(storage_root).joinpath(file_id)


def save_uploads(storage_root: str, uploads: Iterable[Tuple[str, bytes]]) -> list[str]:
    """Persist uploads and return generated file_ids."""
    root = Path(storage_root)
    _ensure_dir(root)

    file_ids: list[str] = []
    for original_name, payload in uploads:
        safe_name = original_name.replace("/", "_")
        file_id = f"{uuid.uuid4().hex}_{safe_name}"
        path = root / file_id
        path.write_bytes(payload)
        file_ids.append(file_id)
    return file_ids


def read_file_text(storage_root: str, file_id: str) -> str:
    path = build_storage_path(storage_root, file_id)
    if not path.exists():
        raise FileNotFoundError(f"file_id '{file_id}' not found in storage")
    return path.read_text(encoding="utf-8", errors="ignore")


def read_file_bytes(storage_root: str, file_id: str) -> bytes:
    path = build_storage_path(storage_root, file_id)
    if not path.exists():
        raise FileNotFoundError(f"file_id '{file_id}' not found in storage")
    return path.read_bytes()
