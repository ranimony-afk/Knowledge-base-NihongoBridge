from __future__ import annotations

import re
import unicodedata
from collections import defaultdict
from dataclasses import dataclass

from sqlalchemy import text

from etl.enrichers.furigana_enricher import TokenInfo, katakana_to_hiragana
from etl.utils.db import Database

_WAVE_MARKERS = str.maketrans("", "", "\u301c\uff5e~\uff0a*")
_PLACEHOLDER = re.compile(r"\b(?:V|N|A|Adj|Verb|Noun)(?:-[A-Za-z]+)?\b", re.IGNORECASE)
_BRACKETED = re.compile(r"[\uff08(\[].*?[\uff09)\]]")


@dataclass(frozen=True, slots=True)
class MatchResult:
    vocabulary_ids: list[str]
    grammar_ids: list[str]


class ContentMatcher:
    """Match sentence tokens/text to canonical dictionary and grammar UUIDs."""

    def __init__(
        self,
        vocabulary: dict[str, str],
        compounds: dict[str, list[tuple[str, str]]],
        grammar_patterns: list[tuple[str, str]],
    ) -> None:
        self.vocabulary = vocabulary
        self.compounds = compounds
        self.grammar_patterns = grammar_patterns

    @classmethod
    async def load(cls, database: Database) -> ContentMatcher:
        vocabulary: dict[str, tuple[str, int]] = {}
        compound_groups: dict[str, list[tuple[str, str]]] = defaultdict(list)
        grammar_patterns: list[tuple[str, str]] = []

        async with database.engine.connect() as connection:
            rows = await connection.execute(
                text(
                    """
                    SELECT id::text, word, kana, COALESCE(frequency_rank, 2147483647) AS rank
                    FROM dictionary_entries
                    WHERE is_active = true
                    """
                )
            )
            for row in rows:
                entry_id, word, kana, frequency_rank = row
                for value in (word, kana):
                    if not value:
                        continue
                    normalized = _normalize(str(value))
                    existing = vocabulary.get(normalized)
                    rank = int(frequency_rank)
                    if existing is None or rank < existing[1]:
                        vocabulary[normalized] = (str(entry_id), rank)
                normalized_word = _normalize(str(word))
                if len(normalized_word) >= 2 and _contains_kanji(normalized_word):
                    compound_groups[normalized_word[0]].append((normalized_word, str(entry_id)))

            rows = await connection.execute(text("SELECT id::text, pattern FROM grammar_patterns"))
            for row in rows:
                pattern_id, pattern = row
                for literal in _grammar_literals(str(pattern)):
                    if len(literal) >= 2:
                        grammar_patterns.append((literal, str(pattern_id)))

        compounds = {
            initial: sorted(values, key=lambda item: len(item[0]), reverse=True)
            for initial, values in compound_groups.items()
        }
        grammar_patterns.sort(key=lambda item: len(item[0]), reverse=True)
        return cls(
            {term: entry[0] for term, entry in vocabulary.items()},
            compounds,
            grammar_patterns,
        )

    def match(self, japanese: str, tokens: list[TokenInfo]) -> MatchResult:
        vocabulary_ids: dict[str, None] = {}
        for token in tokens:
            for candidate in (token.surface, token.lemma, token.reading):
                if not candidate:
                    continue
                normalized = _normalize(candidate)
                for form in (normalized, katakana_to_hiragana(normalized)):
                    if entry_id := self.vocabulary.get(form):
                        vocabulary_ids.setdefault(entry_id, None)

        normalized_sentence = _normalize(japanese)
        for position, character in enumerate(normalized_sentence):
            for term, entry_id in self.compounds.get(character, ()):  # longest first
                if normalized_sentence.startswith(term, position):
                    vocabulary_ids.setdefault(entry_id, None)
                    break

        grammar_ids: dict[str, None] = {}
        for literal, pattern_id in self.grammar_patterns:
            if literal in normalized_sentence:
                grammar_ids.setdefault(pattern_id, None)

        return MatchResult(
            vocabulary_ids=list(vocabulary_ids)[:100],
            grammar_ids=list(grammar_ids)[:100],
        )


def _normalize(value: str) -> str:
    return unicodedata.normalize("NFKC", value).strip()


def _contains_kanji(value: str) -> bool:
    return any(
        0x3400 <= ord(character) <= 0x4DBF or 0x4E00 <= ord(character) <= 0x9FFF
        for character in value
    )


def _grammar_literals(pattern: str) -> list[str]:
    literals: list[str] = []
    for alternative in re.split(r"[/\uff0f\u30fb]", pattern):
        literal = _BRACKETED.sub("", alternative)
        literal = _PLACEHOLDER.sub("", literal)
        literal = literal.translate(_WAVE_MARKERS)
        literal = re.sub(r"\s+", "", literal)
        literal = _normalize(literal)
        if literal and literal not in literals:
            literals.append(literal)
    return literals
