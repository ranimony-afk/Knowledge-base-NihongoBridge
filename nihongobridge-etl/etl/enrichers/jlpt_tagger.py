from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from pathlib import Path

from etl.enrichers.furigana_enricher import TokenInfo, katakana_to_hiragana
from etl.enrichers.jlpt_enricher import JlptEnricher

_LEVEL_RANK = {"N5": 1, "N4": 2, "N3": 3, "N2": 4, "N1": 5}
_IGNORED_POS = {"助詞", "助動詞", "補助記号", "記号", "空白"}
_NON_LEXICAL = re.compile(r"^[\W\d_]+$", re.UNICODE)


@dataclass(slots=True)
class JlptTaggerStats:
    sentences_tagged: int = 0
    sentences_unclassified: int = 0
    vocabulary_tokens_matched: int = 0
    vocabulary_tokens_unknown: int = 0


class JlptSentenceTagger:
    """Assign the hardest JLPT level required by all lexical sentence tokens."""

    def __init__(self, vocabulary: JlptEnricher) -> None:
        self.vocabulary = vocabulary
        self.stats = JlptTaggerStats()

    @classmethod
    def from_directory(cls, directory: Path) -> JlptSentenceTagger:
        return cls(JlptEnricher.from_directory(directory))

    def tag(self, tokens: list[TokenInfo]) -> str:
        levels: list[str] = []
        unknown_lexical_token = False

        for token in tokens:
            if self._ignore(token):
                continue
            level = self._lookup_token(token)
            if level:
                levels.append(level)
                self.stats.vocabulary_tokens_matched += 1
            else:
                unknown_lexical_token = True
                self.stats.vocabulary_tokens_unknown += 1

        if not levels or unknown_lexical_token:
            self.stats.sentences_unclassified += 1
            return "NONE"

        self.stats.sentences_tagged += 1
        return max(levels, key=_LEVEL_RANK.__getitem__)

    def _lookup_token(self, token: TokenInfo) -> str | None:
        candidates = [token.surface, token.lemma, token.reading]
        for candidate in candidates:
            if not candidate:
                continue
            normalized = unicodedata.normalize("NFKC", candidate).strip()
            if normalized.endswith("-代名詞") or normalized.endswith("-補助記号"):
                normalized = normalized.rsplit("-", 1)[0]
            for form in (normalized, katakana_to_hiragana(normalized)):
                if level := self.vocabulary.term_levels.get(form):
                    return level
        return None

    @staticmethod
    def _ignore(token: TokenInfo) -> bool:
        if token.pos in _IGNORED_POS:
            return True
        normalized = unicodedata.normalize("NFKC", token.surface).strip()
        return not normalized or bool(_NON_LEXICAL.fullmatch(normalized))
