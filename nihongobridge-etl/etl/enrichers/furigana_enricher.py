from __future__ import annotations

import html
import unicodedata
from dataclasses import dataclass
from typing import Any

from fugashi import Tagger  # type: ignore[import-untyped]


@dataclass(frozen=True, slots=True)
class TokenInfo:
    surface: str
    reading: str | None
    lemma: str | None
    pos: str | None


def katakana_to_hiragana(value: str) -> str:
    converted: list[str] = []
    for character in unicodedata.normalize("NFKC", value):
        codepoint = ord(character)
        if 0x30A1 <= codepoint <= 0x30F6:
            converted.append(chr(codepoint - 0x60))
        else:
            converted.append(character)
    return "".join(converted)


def contains_kanji(value: str) -> bool:
    return any(
        0x3400 <= ord(character) <= 0x4DBF
        or 0x4E00 <= ord(character) <= 0x9FFF
        or 0xF900 <= ord(character) <= 0xFAFF
        or 0x20000 <= ord(character) <= 0x3134F
        for character in value
    )


def _feature_value(feature: Any, *names: str) -> str | None:
    for name in names:
        value = getattr(feature, name, None)
        if isinstance(value, str) and value and value != "*":
            return value
    return None


class FuriganaEnricher:
    """Tokenize Japanese with fugashi/UniDic and render safe ruby HTML."""

    def __init__(self, tagger: Tagger | None = None) -> None:
        self.tagger = tagger or Tagger()

    def tokenize(self, japanese: str) -> list[TokenInfo]:
        tokens: list[TokenInfo] = []
        for token in self.tagger(japanese):
            feature = token.feature
            tokens.append(
                TokenInfo(
                    surface=str(token.surface),
                    reading=_feature_value(feature, "kana", "pron", "reading"),
                    lemma=_feature_value(feature, "lemma", "orthBase", "base_form"),
                    pos=_feature_value(feature, "pos1", "pos"),
                )
            )
        return tokens

    def enrich(self, japanese: str) -> str:
        return self.enrich_tokens(japanese, self.tokenize(japanese))

    def enrich_tokens(self, japanese: str, tokens: list[TokenInfo]) -> str:
        if not japanese:
            return ""
        cursor = 0
        output: list[str] = []
        for token in tokens:
            position = japanese.find(token.surface, cursor)
            if position < 0:
                position = cursor
            if position > cursor:
                output.append(html.escape(japanese[cursor:position]))
            output.append(self._render_token(token))
            cursor = position + len(token.surface)
        if cursor < len(japanese):
            output.append(html.escape(japanese[cursor:]))
        return "".join(output)

    def _render_token(self, token: TokenInfo) -> str:
        surface = token.surface
        if not contains_kanji(surface) or not token.reading:
            return html.escape(surface)

        reading = katakana_to_hiragana(token.reading)
        normalized_surface = katakana_to_hiragana(surface)
        first_kanji = next(index for index, char in enumerate(surface) if contains_kanji(char))
        last_kanji = max(index for index, char in enumerate(surface) if contains_kanji(char))
        prefix = normalized_surface[:first_kanji]
        suffix = normalized_surface[last_kanji + 1 :]

        reading_start = len(prefix) if prefix and reading.startswith(prefix) else 0
        reading_end = (
            len(reading) - len(suffix) if suffix and reading.endswith(suffix) else len(reading)
        )
        ruby_reading = reading[reading_start:reading_end] or reading
        ruby_base_start = first_kanji if reading_start else 0
        ruby_base_end = last_kanji + 1 if reading_end < len(reading) else len(surface)

        before = html.escape(surface[:ruby_base_start])
        base = html.escape(surface[ruby_base_start:ruby_base_end])
        after = html.escape(surface[ruby_base_end:])
        reading_html = html.escape(ruby_reading)
        return f"{before}<ruby>{base}<rp>(</rp><rt>{reading_html}</rt><rp>)</rp></ruby>{after}"
