from __future__ import annotations

import csv
import json
import re
import unicodedata
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Final

from etl.transformers.jmdict_transformer import DictionaryRecord

_LEVEL_PATTERN: Final = re.compile(r"(?<![A-Z0-9])N([1-5])(?![A-Z0-9])", re.IGNORECASE)
_LEVEL_ORDER: Final = ("N5", "N4", "N3", "N2", "N1")
_WORD_KEYS: Final = (
    "word",
    "expression",
    "term",
    "vocabulary",
    "kanji",
    "japanese",
    "jp",
)
_READING_KEYS: Final = ("reading", "kana", "hiragana", "pronunciation")


@dataclass(frozen=True, slots=True)
class JlptLoadStats:
    files_loaded: int
    terms_by_level: dict[str, int]
    unique_terms: int


class JlptEnricher:
    """Cross-reference words/readings against OpenJLPT-style N5-N1 files."""

    def __init__(self, term_levels: Mapping[str, str], stats: JlptLoadStats) -> None:
        self.term_levels = dict(term_levels)
        self.stats = stats
        self.matches = 0
        self.misses = 0

    @classmethod
    def from_directory(cls, directory: Path) -> JlptEnricher:
        if not directory.exists() or not directory.is_dir():
            raise FileNotFoundError(f"JLPT vocabulary directory does not exist: {directory}")

        files_by_level: dict[str, list[Path]] = {level: [] for level in _LEVEL_ORDER}
        for path in sorted(directory.rglob("*")):
            if not path.is_file() or path.suffix.lower() not in {".csv", ".tsv", ".txt", ".json"}:
                continue
            level = _infer_level(path)
            if level:
                files_by_level[level].append(path)

        term_levels: dict[str, str] = {}
        terms_by_level: dict[str, int] = {}
        files_loaded = 0

        # Process easiest first. If a source has overlap, a basic word keeps its easiest level.
        for level in _LEVEL_ORDER:
            level_terms: set[str] = set()
            for path in files_by_level[level]:
                files_loaded += 1
                level_terms.update(_iter_terms(path))
            terms_by_level[level] = len(level_terms)
            for term in level_terms:
                term_levels.setdefault(term, level)

        if files_loaded == 0:
            raise FileNotFoundError(f"No N5-N1 .csv/.tsv/.txt/.json files found below {directory}")

        return cls(
            term_levels,
            JlptLoadStats(
                files_loaded=files_loaded,
                terms_by_level=terms_by_level,
                unique_terms=len(term_levels),
            ),
        )

    def lookup(self, word: str, kana: str | None = None) -> str:
        for candidate in (word, kana):
            if candidate and (level := self.term_levels.get(_normalize(candidate))):
                self.matches += 1
                return level
        self.misses += 1
        return "NONE"

    def enrich(self, record: DictionaryRecord) -> DictionaryRecord:
        record.jlpt_level = self.lookup(record.word, record.kana)
        return record


def _infer_level(path: Path) -> str | None:
    match = _LEVEL_PATTERN.search(path.stem.upper()) or _LEVEL_PATTERN.search(
        path.parent.name.upper()
    )
    return f"N{match.group(1)}" if match else None


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip()


def _contains_japanese(value: str) -> bool:
    return any(
        0x3040 <= ord(char) <= 0x30FF
        or 0x3400 <= ord(char) <= 0x4DBF
        or 0x4E00 <= ord(char) <= 0x9FFF
        for char in value
    )


def _iter_terms(path: Path) -> Iterator[str]:
    suffix = path.suffix.lower()
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        for term in _terms_from_json(data):
            normalized = _normalize(term)
            if normalized and _contains_japanese(normalized):
                yield normalized
        return

    sample = path.read_text(encoding="utf-8-sig", errors="replace")
    if not sample.strip():
        return

    if suffix in {".csv", ".tsv"}:
        delimiter = "\t" if suffix == ".tsv" else _detect_delimiter(sample[:8_192])
        rows = csv.DictReader(sample.splitlines(), delimiter=delimiter)
        normalized_headers = {
            header.lower().strip(): header for header in (rows.fieldnames or []) if header
        }
        selected_headers = [
            normalized_headers[key]
            for key in (*_WORD_KEYS, *_READING_KEYS)
            if key in normalized_headers
        ]
        if selected_headers:
            for row in rows:
                for header in selected_headers:
                    value = _normalize(row.get(header, ""))
                    if value and _contains_japanese(value):
                        yield value
            return

    for line in sample.splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        for value in re.split(r"[\t,|]", stripped)[:2]:
            normalized = _normalize(value)
            if normalized and _contains_japanese(normalized):
                yield normalized


def _terms_from_json(data: Any) -> Iterable[str]:
    if isinstance(data, list):
        for item in data:
            yield from _terms_from_json(item)
    elif isinstance(data, dict):
        emitted = False
        lowered = {str(key).lower(): value for key, value in data.items()}
        for key in (*_WORD_KEYS, *_READING_KEYS):
            value = lowered.get(key)
            if isinstance(value, str):
                emitted = True
                yield value
        if not emitted:
            for value in data.values():
                if isinstance(value, (list, dict)):
                    yield from _terms_from_json(value)
    elif isinstance(data, str) and _contains_japanese(data):
        yield data


def _detect_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",\t|").delimiter
    except csv.Error:
        return ","
