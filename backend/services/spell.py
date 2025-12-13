import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Dict, Iterable, List, Sequence, Tuple

try:
    # Lightweight frequency lists shipped in the wheel; avoids needing a local dictionary file.
    from wordfreq import top_n_list, zipf_frequency
except Exception:  # pragma: no cover - optional dependency
    top_n_list = None  # type: ignore
    zipf_frequency = None  # type: ignore


# Domain expansion: academic, mental health, tech, common compounds (US/UK variants).
EXTRA_WORDS = {
    "long-term",
    "short-term",
    "face-to-face",
    "well-being",
    "burnout",
    "burn-out",
    "overdependence",
    "over-dependence",
    "overdependence",
    "e-learning",
    "self-esteem",
    "prefrontal",
    "executive-function",
    "attention-span",
    "sleep-deprived",
    "sleep-deprivation",
    "hyperactivity",
    "adhd",
    "anxiety",
    "depression",
    "cognition",
    "cognitive",
    "neural",
    "neuroscience",
    "dopamine",
    "serotonin",
    "oxytocin",
    "prefrontal-cortex",
    "hippocampus",
    "neurotransmitter",
    "neurotransmitters",
    "evidence-based",
    "peer-reviewed",
    "meta-analysis",
    "randomized",
    "randomised",
    "placebo",
    "placebo-controlled",
    "double-blind",
    "socioeconomic",
    "wellbeing",
    "well-being",
    "well being",
    "real-time",
    "part-time",
    "full-time",
    "longstanding",
    "self-regulation",
    "self-control",
    "self-report",
    "self-reported",
    "co-occurring",
    "coexisting",
    "baseline",
    "posttest",
    "post-test",
    "pretest",
    "pre-test",
    "ecommerce",
    "e-commerce",
    "cybersecurity",
    "cyber-security",
    "multitask",
    "multitasking",
    "multitasker",
    "internet-based",
    "online",
    "offline",
    "wellbeing",
    "wellness",
}


def damerau_levenshtein(a: str, b: str) -> int:
    """Compute Damerau-Levenshtein distance (case-insensitive)."""
    a = a.lower()
    b = b.lower()
    if a == b:
        return 0
    if not a:
        return len(b)
    if not b:
        return len(a)

    len_a, len_b = len(a), len(b)
    dist = [[0] * (len_b + 1) for _ in range(len_a + 1)]
    for i in range(len_a + 1):
        dist[i][0] = i
    for j in range(len_b + 1):
        dist[0][j] = j

    for i in range(1, len_a + 1):
        for j in range(1, len_b + 1):
            cost = 0 if a[i - 1] == b[j - 1] else 1
            dist[i][j] = min(
                dist[i - 1][j] + 1,      # deletion
                dist[i][j - 1] + 1,      # insertion
                dist[i - 1][j - 1] + cost  # substitution
            )
            # Transposition fix: use +1 instead of +cost
            if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
                dist[i][j] = min(dist[i][j], dist[i - 2][j - 2] + 1)
    return dist[len_a][len_b]


class BKNode:
    def __init__(self, term: str):
        self.term = term
        self.children: Dict[int, "BKNode"] = {}


class BKTree:
    def __init__(self):
        self.root: BKNode | None = None

    def insert(self, term: str) -> None:
        if self.root is None:
            self.root = BKNode(term)
            return
        node = self.root
        while True:
            dist = damerau_levenshtein(term, node.term)
            child = node.children.get(dist)
            if child:
                node = child
                continue
            node.children[dist] = BKNode(term)
            break

    def search(self, term: str, max_distance: int) -> List[Tuple[str, int]]:
        if self.root is None:
            return []
        results: List[Tuple[str, int]] = []
        stack = [self.root]
        while stack:
            node = stack.pop()
            dist = damerau_levenshtein(term, node.term)
            if dist <= max_distance:
                results.append((node.term, dist))
            low, high = max(0, dist - max_distance), dist + max_distance
            for edge, child in node.children.items():
                if low <= edge <= high:
                    stack.append(child)
        return results


def load_dictionary(dictionary_path: str) -> Tuple[Sequence[str], Dict[str, int]]:
    """
    Load a JSON dictionary file containing either a list or dict of words.

    If the configured dictionary is missing, we fall back to the `wordfreq` package
    (shipped with frequency lists) to avoid flagging nearly every word as a misspelling.
    """
    path = Path(dictionary_path)
    if path.exists():
        data = json.loads(path.read_text(encoding="utf-8"))
        if isinstance(data, dict):
            words = list(data.keys())
            freq = {k.lower(): int(v) for k, v in data.items()}
        if isinstance(data, list):
            words = data
            freq = {w.lower(): 1 for w in data}
        else:
            raise ValueError("Dictionary JSON must be a list or object")
        return words, freq

    # Dictionary file missing — try wordfreq for a robust built-in lexicon.
    if top_n_list and zipf_frequency:
        words = top_n_list("en", n=50000, wordlist="best")
        frequencies = {w.lower(): int(zipf_frequency(w, "en") * 100) for w in words}
        return words, frequencies

    # Last-resort fallback: small hand-curated list to keep the service running.
    fallback = [
        "a", "an", "and", "another", "content", "contain", "document", "errors", "example",
        "for", "grammar", "goes", "here", "how", "identifies", "in", "intentional", "is",
        "it", "mistakes", "paragraph", "purposes", "sentences", "several", "spelling",
        "testing", "text", "that", "the", "this", "to", "with", "works", "wrong", "your"
    ]
    return fallback, {w: 10 for w in fallback}


class SpellChecker:
    def __init__(self, words: Iterable[str], frequencies: Dict[str, int] | None = None, max_distance: int = 2):
        self.dictionary = {w.lower() for w in words}
        self.freq = {k.lower(): v for k, v in (frequencies or {}).items()}
        self.tree = BKTree()
        self.max_distance = max_distance
        for word in self.dictionary:
            self.tree.insert(word)

    def is_correct(self, word: str) -> bool:
        return word.lower() in self.dictionary

    def suggest(self, word: str, limit: int = 5) -> List[str]:
        """Suggest corrections for a misspelled word."""
        word_lower = word.lower().strip(".,!?;:'\"")
        if not word_lower:
            return []

        candidates = self.tree.search(word_lower, self.max_distance)

        # Sort by: distance, frequency, length, alphabetical
        candidates.sort(
            key=lambda x: (
                x[1],                          # smaller distance better
                -self.freq.get(x[0], 0),       # higher frequency better
                len(x[0]),                     # shorter length preferred
                x[0]                           # alphabetical tie-breaker
            )
        )

        out = [term for term, _ in candidates[:limit]]
        # Preserve casing style of the input for the top suggestion set.
        if word[:1].isupper():
            out = [s.capitalize() for s in out]
        return out


@lru_cache(maxsize=4)
def get_spell_checker(dictionary_path: str, max_distance: int = 2) -> SpellChecker:
    """Load a SpellChecker instance from a JSON dictionary file."""
    words, freq = load_dictionary(dictionary_path)
    # Expand dictionary with domain/compound words; keep simple frequency boost.
    expanded_words = list(words) + list(EXTRA_WORDS)
    for w in EXTRA_WORDS:
        freq.setdefault(w.lower(), 10)
    return SpellChecker(expanded_words, freq, max_distance=max_distance)


# import json
# from functools import lru_cache
# from pathlib import Path
# from typing import Dict, Iterable, List, Sequence, Tuple


# def damerau_levenshtein(a: str, b: str) -> int:
#     """Compute Damerau-Levenshtein distance (case-insensitive)."""
#     a = a.lower()
#     b = b.lower()
#     if a == b:
#         return 0
#     if not a:
#         return len(b)
#     if not b:
#         return len(a)

#     len_a, len_b = len(a), len(b)
#     dist = [[0] * (len_b + 1) for _ in range(len_a + 1)]
#     for i in range(len_a + 1):
#         dist[i][0] = i
#     for j in range(len_b + 1):
#         dist[0][j] = j

#     for i in range(1, len_a + 1):
#         for j in range(1, len_b + 1):
#             cost = 0 if a[i - 1] == b[j - 1] else 1
#             dist[i][j] = min(
#                 dist[i - 1][j] + 1,      # deletion
#                 dist[i][j - 1] + 1,      # insertion
#                 dist[i - 1][j - 1] + cost  # substitution
#             )
#             if i > 1 and j > 1 and a[i - 1] == b[j - 2] and a[i - 2] == b[j - 1]:
#                 dist[i][j] = min(dist[i][j], dist[i - 2][j - 2] + cost)
#     return dist[len_a][len_b]


# class BKNode:
#     def __init__(self, term: str):
#         self.term = term
#         self.children: Dict[int, "BKNode"] = {}


# class BKTree:
#     def __init__(self):
#         self.root: BKNode | None = None

#     def insert(self, term: str) -> None:
#         if self.root is None:
#             self.root = BKNode(term)
#             return
#         node = self.root
#         while True:
#             dist = damerau_levenshtein(term, node.term)
#             child = node.children.get(dist)
#             if child:
#                 node = child
#                 continue
#             node.children[dist] = BKNode(term)
#             break

#     def search(self, term: str, max_distance: int) -> List[Tuple[str, int]]:
#         if self.root is None:
#             return []
#         results: list[Tuple[str, int]] = []
#         stack = [self.root]
#         while stack:
#             node = stack.pop()
#             dist = damerau_levenshtein(term, node.term)
#             if dist <= max_distance:
#                 results.append((node.term, dist))
#             low, high = dist - max_distance, dist + max_distance
#             for edge, child in node.children.items():
#                 if low <= edge <= high:
#                     stack.append(child)
#         return results


# def load_dictionary(dictionary_path: str) -> Tuple[Sequence[str], Dict[str, int]]:
#     path = Path(dictionary_path)
#     if not path.exists():
#         # Small fallback to keep the service usable without a dictionary file.
#         fallback = ["the", "and", "to", "of", "in", "for", "with", "on", "this", "that"]
#         return fallback, {w: 1 for w in fallback}

#     data = json.loads(path.read_text(encoding="utf-8"))
#     if isinstance(data, dict):
#         return list(data.keys()), {k: int(v) for k, v in data.items()}
#     if isinstance(data, list):
#         return data, {w: 1 for w in data}
#     raise ValueError("Dictionary JSON must be a list or object")


# # class SpellChecker:
# #     def __init__(self, words: Iterable[str], frequencies: Dict[str, int] | None = None):
# #         self.dictionary = {w.lower() for w in words}
# #         self.freq = frequencies or {}
# #         self.tree = BKTree()
# #         for word in self.dictionary:
# #             self.tree.insert(word)

# #     def is_correct(self, word: str) -> bool:
# #         return word.lower() in self.dictionary

# #     def suggest(self, word: str, max_distance: int = 2, limit: int = 5) -> List[str]:
# #         candidates = self.tree.search(word.lower(), max_distance)
# #         candidates.sort(key=lambda x: (x[1], -self.freq.get(x[0], 0)))
# #         return [term for term, _ in candidates[:limit]]
# class SpellChecker:
#     def __init__(self, words: Iterable[str], frequencies: Dict[str, int] | None = None):
#         self.dictionary = {w.lower() for w in words}
#         self.freq = frequencies or {}
#         self.tree = BKTree()
#         for word in self.dictionary:
#             self.tree.insert(word)

#     def is_correct(self, word: str) -> bool:
#         return word.lower() in self.dictionary

#     def suggest(self, word: str, max_distance: int = 2, limit: int = 5) -> List[str]:
#         word_lower = word.lower()
#         candidates = self.tree.search(word_lower, max_distance)

#         # Sort by distance, then frequency, then alphabetically
#         candidates.sort(
#             key=lambda x: (
#                 x[1],                     # smaller distance better
#                 -self.freq.get(x[0], 0),  # higher frequency better
#                 x[0]                       # alphabetical tie-breaker
#             )
#         )
#         return [term for term, _ in candidates[:limit]]

#     # def suggest(self, word: str, max_distance: int = 2, limit: int = 5) -> List[str]:
#         # word_lower = word.lower()
#         # candidates = self.tree.search(word_lower, max_distance)

#         # # Sort by: distance first, then frequency (higher first), then alphabetically
#         # candidates.sort(
#         #     key=lambda x: (
#         #         x[1],                  # smaller distance better
#         #         -self.freq.get(x[0], 0),  # higher frequency better
#         #         x[0]                    # alphabetical tie-breaker
#         #     )
#         # )
#         # return [term for term, _ in candidates[:limit]]



# @lru_cache(maxsize=4)
# def get_spell_checker(dictionary_path: str) -> SpellChecker:
#     words, freq = load_dictionary(dictionary_path)
#     return SpellChecker(words, freq)
