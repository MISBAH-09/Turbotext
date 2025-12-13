import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """Configuration for the analysis service."""

    storage_root: str = os.environ.get("STORAGE_ROOT", "storage")
    dictionary_path: str = os.environ.get("DICTIONARY_PATH", "data/dictionary.json")
    language: str = os.environ.get("LANGUAGE", "en-US")
    # Default to the bundled LanguageTool directory if present; override via LANGUAGE_TOOL_PATH to use another install.
    language_tool_path: str = os.environ.get("LANGUAGE_TOOL_PATH", "data/LanguageTool-6.6")
    chunk_size: int = int(os.environ.get("CHUNK_SIZE", "4096"))
    chunk_overlap: int = int(os.environ.get("CHUNK_OVERLAP", "128"))
    process_workers: int = int(os.environ.get("PROCESS_WORKERS", "0"))  # 0 → auto
    thread_workers: int = int(os.environ.get("THREAD_WORKERS", "0"))  # 0 → auto
    max_files: int = int(os.environ.get("MAX_FILES", "1000"))
    max_file_bytes: int = int(os.environ.get("MAX_FILE_BYTES", str(5 * 1024 * 1024)))  # 5MB
    disable_grammar: bool = os.environ.get("DISABLE_GRAMMAR", "0") == "1"


def load_settings() -> Settings:
    return Settings()
