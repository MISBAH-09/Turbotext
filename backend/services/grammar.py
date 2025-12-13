import inspect
import logging
import os
import threading
from functools import lru_cache
from pathlib import Path
from typing import Any, List, Optional

_lock = threading.Lock()
logger = logging.getLogger(__name__)


class GrammarNotAvailable(RuntimeError):
    pass


def _resolve_language_tool_path(path: Optional[str]) -> Optional[str]:
    """Resolve a LanguageTool directory path with fallbacks to common locations."""
    if not path:
        return None

    candidates = []
    p = Path(path).expanduser()
    candidates.append(p)
    # If relative, also try relative to project root (two levels up from this file)
    base_dir = Path(__file__).resolve().parents[1]
    candidates.append(base_dir / path)

    for candidate in candidates:
        if candidate.exists():
            return str(candidate)
    return None


@lru_cache(maxsize=4)
def get_language_tool(language: str = "en-US", path: Optional[str] = None) -> Any:
    try:
        import language_tool_python  # type: ignore
    except ImportError as exc:
        raise GrammarNotAvailable(
            "language_tool_python is not installed. Run `pip install language_tool_python`."
        ) from exc

    resolved_path = _resolve_language_tool_path(path)
    if path and not resolved_path:
        logger.warning("LANGUAGE_TOOL_PATH '%s' not found; using default LanguageTool initialization", path)

    # Patch upstream destructor to tolerate missing attrs in some builds.
    try:
        LT = language_tool_python.LanguageTool
        if not getattr(LT, "_patched_del", False):
            orig_del = getattr(LT, "__del__", None)

            def safe_del(self):  # type: ignore[override]
                if not hasattr(self, "_new_spellings_persist"):
                    self._new_spellings_persist = False
                if not hasattr(self, "_new_spellings"):
                    self._new_spellings = []
                if orig_del:
                    try:
                        orig_del(self)
                    except AttributeError:
                        # Suppress destructor attr errors
                        return

            setattr(LT, "__del__", safe_del)
            setattr(LT, "_patched_del", True)
    except Exception:
        pass

    init_exc: Exception | None = None
    supports_path_arg = "path" in inspect.signature(language_tool_python.LanguageTool.__init__).parameters
    try:
        def _init_tool() -> Any:
            if path:
                if supports_path_arg:
                    return language_tool_python.LanguageTool(language, path=resolved_path or path)
                # Older language_tool_python versions do not accept `path`; set env so the JAR is discovered.
                jar_dir = resolved_path or path
                os.environ["LTP_JAR_DIR_PATH"] = str(jar_dir)
                os.environ.setdefault("LTP_PATH", str(Path(jar_dir).parent))
                return language_tool_python.LanguageTool(language)
            return language_tool_python.LanguageTool(language)

        tool = _init_tool()
        if not hasattr(tool, "_new_spellings_persist"):
            tool._new_spellings_persist = False  # type: ignore[attr-defined]
        if not hasattr(tool, "_new_spellings"):
            tool._new_spellings = []  # type: ignore[attr-defined]
        return tool
    except Exception as exc:
        init_exc = exc

    # If a path was explicitly provided, do not attempt the public API; surface the original error for clarity.
    if path:
        logger.error("LanguageTool initialization failed (path=%s): %s", path, init_exc)
        raise GrammarNotAvailable(
            f"LanguageTool could not be initialized with the provided path ({path}). "
            f"Reason: {init_exc}"
        ) from init_exc

    # Fallback to public endpoint if offline setup is unavailable (only when available in the package)
    try:
        public_cls = getattr(language_tool_python, "LanguageToolPublic", None)
        if not public_cls:
            raise GrammarNotAvailable(
                "LanguageToolPublic is not available. Upgrade language_tool_python or provide LANGUAGE_TOOL_PATH to a local LanguageTool install."
            )
        tool = public_cls(language)
        if not hasattr(tool, "_new_spellings_persist"):
            tool._new_spellings_persist = False  # type: ignore[attr-defined]
        if not hasattr(tool, "_new_spellings"):
            tool._new_spellings = []  # type: ignore[attr-defined]
        return tool
    except Exception as exc:
        logger.error("LanguageTool initialization failed: %s", exc)
        raise GrammarNotAvailable(
            "LanguageTool could not be initialized. Provide LANGUAGE_TOOL_PATH with a local LanguageTool installation to avoid downloads."
        ) from exc


def check_text(tool: Any, text: str) -> List[Any]:
    # language_tool_python instances are not guaranteed thread-safe
    with _lock:
        return tool.check(text)
