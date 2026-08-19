from __future__ import annotations

import csv
import json
import re
import unicodedata
import zipfile
from collections.abc import Iterable, Iterator, Mapping
from dataclasses import dataclass
from pathlib import Path
from typing import Any, Literal

from etl.transformers.jmdict_transformer import DictionaryRecord

FrequencyMode = Literal["auto", "rank", "count"]


@dataclass(frozen=True, slots=True)
class FrequencyLoadStats:
    source_records: int
    unique_terms: int
    interpreted_as: str


class FrequencyEnricher:
    """Load Innocent Corpus/Yomitan or delimited frequency data and assign ranks."""

    def __init__(self, ranks: Mapping[str, int], stats: FrequencyLoadStats) -> None:
        self.ranks = dict(ranks)
        self.stats = stats
        self.matches = 0
        self.misses = 0

    @classmethod
    def from_path(cls, path: Path, mode: FrequencyMode = "auto") -> FrequencyEnricher:
        if not path.exists() or not path.is_file():
            raise FileNotFoundError(f"Frequency data does not exist: {path}")

        observations, hint = _load_observations(path)
        if not observations:
            raise ValueError(f"No usable frequency rows found in {path}")

        effective_mode: Literal["rank", "count"]
        if mode == "auto":
            effective_mode = hint
        else:
            effective_mode = mode

        ranks = _to_ranks(observations, effective_mode)
        return cls(
            ranks,
            FrequencyLoadStats(
                source_records=len(observations),
                unique_terms=len(ranks),
                interpreted_as=effective_mode,
            ),
        )

    def lookup(self, word: str, kana: str | None = None) -> int | None:
        candidates = {
            rank
            for value in (word, kana)
            if value and (rank := self.ranks.get(_normalize(value))) is not None
        }
        if not candidates:
            self.misses += 1
            return None
        self.matches += 1
        return min(candidates)

    def enrich(self, record: DictionaryRecord) -> DictionaryRecord:
        record.frequency_rank = self.lookup(record.word, record.kana)
        return record


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip()


def _numeric(value: Any) -> float | None:
    if isinstance(value, bool):
        return None
    if isinstance(value, (int, float)):
        return float(value) if value > 0 else None
    if isinstance(value, str):
        cleaned = value.strip().replace(",", "")
        match = re.search(r"\d+(?:\.\d+)?", cleaned)
        if match:
            parsed = float(match.group(0))
            return parsed if parsed > 0 else None
    if isinstance(value, dict):
        for key in ("frequency", "value", "rank", "count", "occurrences"):
            if key in value and (numeric := _numeric(value[key])) is not None:
                return numeric
    return None


def _load_observations(path: Path) -> tuple[list[tuple[str, float]], Literal["rank", "count"]]:
    suffix = path.suffix.lower()
    name_hint: Literal["rank", "count"] = "rank" if "rank" in path.stem.lower() else "count"
    if suffix == ".zip":
        return _load_yomitan_zip(path)
    if suffix == ".json":
        data = json.loads(path.read_text(encoding="utf-8-sig"))
        return list(_observations_from_json(data)), name_hint
    return _load_delimited(path, name_hint)


def _load_yomitan_zip(
    path: Path,
) -> tuple[list[tuple[str, float]], Literal["rank", "count"]]:
    observations: list[tuple[str, float]] = []
    hint: Literal["rank", "count"] = "count"
    with zipfile.ZipFile(path) as archive:
        names = archive.namelist()
        if "index.json" in names:
            index = json.loads(archive.read("index.json"))
            title = str(index.get("title", "")).lower()
            if "rank" in title:
                hint = "rank"
        for name in sorted(names):
            if not re.search(r"(?:term_meta_bank|term_meta)_\d+\.json$", name):
                continue
            rows = json.loads(archive.read(name))
            for row in rows:
                if not isinstance(row, list) or len(row) < 3 or row[1] != "freq":
                    continue
                term = _normalize(str(row[0]))
                value = _numeric(row[2])
                if term and value is not None:
                    observations.append((term, value))
    return observations, hint


def _observations_from_json(data: Any) -> Iterator[tuple[str, float]]:
    if isinstance(data, dict):
        for term, value in data.items():
            numeric = _numeric(value)
            if numeric is not None and isinstance(term, str):
                yield _normalize(term), numeric
            elif isinstance(value, (dict, list)):
                yield from _observations_from_json(value)
    elif isinstance(data, list):
        for index, item in enumerate(data, start=1):
            if isinstance(item, dict):
                lowered = {str(key).lower(): value for key, value in item.items()}
                term = next(
                    (
                        lowered[key]
                        for key in ("word", "term", "expression", "kanji", "japanese")
                        if isinstance(lowered.get(key), str)
                    ),
                    None,
                )
                value = next(
                    (
                        _numeric(lowered[key])
                        for key in ("rank", "frequency", "count", "occurrences", "value")
                        if _numeric(lowered.get(key)) is not None
                    ),
                    None,
                )
                if term and value is not None:
                    yield _normalize(term), value
                else:
                    yield from _observations_from_json(item)
            elif isinstance(item, list) and len(item) >= 2:
                term = str(item[0])
                value = _numeric(item[1])
                if value is not None:
                    yield _normalize(term), value
            elif isinstance(item, str):
                yield _normalize(item), float(index)


def _load_delimited(
    path: Path,
    name_hint: Literal["rank", "count"],
) -> tuple[list[tuple[str, float]], Literal["rank", "count"]]:
    content = path.read_text(encoding="utf-8-sig", errors="replace")
    if not content.strip():
        return [], name_hint
    delimiter = "\t" if path.suffix.lower() == ".tsv" else _detect_delimiter(content[:8_192])
    lines = content.splitlines()
    reader = csv.DictReader(lines, delimiter=delimiter)
    headers = {header.lower().strip(): header for header in (reader.fieldnames or []) if header}
    term_header = next(
        (
            headers[key]
            for key in ("word", "term", "expression", "kanji", "japanese")
            if key in headers
        ),
        None,
    )
    value_key = next(
        (key for key in ("rank", "frequency", "count", "occurrences", "value") if key in headers),
        None,
    )
    if term_header and value_key:
        hint: Literal["rank", "count"] = "rank" if value_key == "rank" else "count"
        observations = []
        for row in reader:
            term = _normalize(row.get(term_header, ""))
            value = _numeric(row.get(headers[value_key]))
            if term and value is not None:
                observations.append((term, value))
        return observations, hint

    observations = []
    for index, line in enumerate(lines, start=1):
        stripped = line.strip()
        if not stripped or stripped.startswith("#"):
            continue
        parts = re.split(r"[\t,|]", stripped)
        term = _normalize(parts[0])
        value = _numeric(parts[1]) if len(parts) > 1 else float(index)
        if term and value is not None:
            observations.append((term, value))
    return observations, name_hint


def _to_ranks(
    observations: Iterable[tuple[str, float]],
    mode: Literal["rank", "count"],
) -> dict[str, int]:
    consolidated: dict[str, float] = {}
    for term, value in observations:
        if not term:
            continue
        if mode == "rank":
            consolidated[term] = min(value, consolidated.get(term, value))
        else:
            consolidated[term] = max(value, consolidated.get(term, value))

    if mode == "rank":
        return {term: max(1, round(value)) for term, value in consolidated.items()}

    ordered = sorted(consolidated.items(), key=lambda item: (-item[1], item[0]))
    return {term: rank for rank, (term, _) in enumerate(ordered, start=1)}


def _detect_delimiter(sample: str) -> str:
    try:
        return csv.Sniffer().sniff(sample, delimiters=",\t|").delimiter
    except csv.Error:
        return "\t"
