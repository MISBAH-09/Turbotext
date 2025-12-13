import re
from typing import Any, Dict, List, Tuple

from backend.services.grammar import check_text
from backend.services.spell import SpellChecker

WORD_RE = re.compile(r"[A-Za-z][A-Za-z'-]*")
COMMON_MISSPELLINGS = {
    "buss": ["bus"],
    "tommorrrow": ["tomorrow"],
    "zooo": ["zoo"],
    "sisted": ["sister"],
}
IRREGULAR_PAST = {
    "runned": ["ran"],
    "seen": ["saw"],
}
SINGULAR_SUBJECTS = {"he", "she", "it", "cat", "dog", "student", "child"}
BASE_VERBS = {"chase", "run", "walk", "talk", "wait", "plan"}
ARTICLE_NOUNS = {"park", "zoo", "market", "office"}
MASS_NOUNS = {"homework"}


def compute_line_offsets(text: str) -> List[int]:
    offsets = [0]
    for idx, ch in enumerate(text):
        if ch == "\n":
            offsets.append(idx + 1)
    return offsets


def offset_to_position(offset: int, line_offsets: List[int]) -> Tuple[int, int]:
    # Binary search for the right line
    lo, hi = 0, len(line_offsets) - 1
    while lo <= hi:
        mid = (lo + hi) // 2
        if line_offsets[mid] <= offset:
            lo = mid + 1
        else:
            hi = mid - 1
    line_idx = max(0, lo - 1)
    line_start = line_offsets[line_idx]
    line_no = line_idx + 1
    col_no = (offset - line_start) + 1
    return line_no, col_no


def _make_issue(
    message: str, original: str, suggestions: List[str], start: int, end: int, line_offsets: List[int]
) -> Dict:
    line, col = offset_to_position(start, line_offsets)
    return {
        "type": "grammar",
        "message": message,
        "original": original,
        "suggestions": suggestions,
        "position": {
            "start": start,
            "end": end,
            "line": line,
            "col": col,
        },
    }


def rule_based_grammar_checks(
    chunk_text: str,
    token_spans: List[Tuple[str, int, int]],
    line_offsets: List[int],
) -> List[Dict]:
    issues: List[Dict] = []
    lower_tokens = [w.lower() for w, _, _ in token_spans]

    for idx, (word, start, end) in enumerate(token_spans):
        wl = word.lower()

        if wl in IRREGULAR_PAST:
            issues.append(
                _make_issue("Use the correct past tense form.", word, IRREGULAR_PAST[wl], start, end, line_offsets)
            )

        if wl == "was" and idx > 0 and lower_tokens[idx - 1] in {"they", "we"}:
            issues.append(
                _make_issue("Use a plural verb with a plural subject.", word, ["were"], start, end, line_offsets)
            )

        if wl in {"dont", "don't"} and idx > 0 and lower_tokens[idx - 1] in {"she", "he", "it"}:
            issues.append(
                _make_issue("Use \"doesn't\" for third-person singular.", word, ["doesn't"], start, end, line_offsets)
            )

        if wl == "is":
            window = lower_tokens[max(0, idx - 3) : idx]
            if "and" in window:
                issues.append(
                    _make_issue("Use a plural verb after a compound subject.", word, ["are"], start, end, line_offsets)
                )

        if wl in BASE_VERBS and idx > 0 and lower_tokens[idx - 1] in SINGULAR_SUBJECTS:
            issues.append(
                _make_issue(
                    "Use the third-person singular verb with a singular subject.",
                    word,
                    [f"{wl}s", f"{wl}ed"],
                    start,
                    end,
                    line_offsets,
                )
            )

        if wl in ARTICLE_NOUNS and idx > 0 and lower_tokens[idx - 1] in {"at", "in", "to", "into"}:
            issues.append(
                _make_issue("Add an article before the noun.", word, [f"the {wl}"], start, end, line_offsets)
            )

        if wl.endswith("s") and wl[:-1] in MASS_NOUNS:
            singular = wl[:-1]
            issues.append(
                _make_issue("Use the singular form for this mass noun.", word, [singular], start, end, line_offsets)
            )

    return issues


def analyze_chunk(
    chunk_text: str,
    start_offset: int,
    line_offsets: List[int],
    spell_checker: SpellChecker,
    grammar_tool: Any | None,
) -> List[Dict]:
    issues: List[Dict] = []
    token_spans: List[Tuple[str, int, int]] = []

    for match in WORD_RE.finditer(chunk_text):
        word = match.group()
        abs_start = start_offset + match.start()
        abs_end = start_offset + match.end()
        token_spans.append((word, abs_start, abs_end))
        lower_word = word.lower()

        if lower_word in COMMON_MISSPELLINGS:
            suggestions = COMMON_MISSPELLINGS[lower_word]
        elif not spell_checker.is_correct(word):
            suggestions = spell_checker.suggest(word)
        else:
            continue

        line, col = offset_to_position(abs_start, line_offsets)
        issues.append(
            {
                "type": "spelling",
                "message": "Possible misspelling",
                "original": word,
                "suggestions": suggestions,
                "position": {
                    "start": abs_start,
                    "end": abs_end,
                    "line": line,
                    "col": col,
                },
            }
        )

    if grammar_tool:
        matches = check_text(grammar_tool, chunk_text)
        for match in matches:
            abs_start = start_offset + match.offset
            err_len = getattr(match, "errorLength", None) or getattr(match, "error_length", None) or getattr(match, "length", 0)
            abs_end = abs_start + err_len
            original = chunk_text[match.offset : match.offset + err_len]
            rule_id = getattr(match, "ruleId", "") or getattr(match, "rule_id", "") or ""
            category_id = ""
            try:
                category = getattr(match, "category", None)
                if category and hasattr(category, "id"):
                    category_id = category.id or ""
            except Exception:
                category_id = ""
            issue_type = "spelling" if ("MORFOLOGIK" in rule_id or "SPELL" in rule_id or category_id == "TYPOS") else "grammar"
            repls = getattr(match, "replacements", [])
            if repls and hasattr(repls[0], "value"):
                suggestions = [r.value for r in repls][:5]
            else:
                suggestions = [str(r) for r in repls][:5]
            line, col = offset_to_position(abs_start, line_offsets)
            issues.append(
                {
                    "type": issue_type,
                    "message": match.message,
                    "original": original,
                    "suggestions": suggestions,
                    "position": {
                        "start": abs_start,
                        "end": abs_end,
                        "line": line,
                        "col": col,
                    },
                }
            )

    issues.extend(rule_based_grammar_checks(chunk_text, token_spans, line_offsets))
    return issues
