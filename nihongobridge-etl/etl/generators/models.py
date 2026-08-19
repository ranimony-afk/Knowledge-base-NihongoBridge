from __future__ import annotations

import hashlib
import json
from dataclasses import asdict, dataclass, field
from typing import Any, Literal
from uuid import UUID, uuid4

JlptLevel = Literal["N5", "N4", "N3", "N2", "N1"]
SectionType = Literal["vocabulary", "grammar", "reading", "listening"]


@dataclass(frozen=True, slots=True)
class QuestionOption:
    id: str
    text_jp: str
    text_en: str = ""


@dataclass(slots=True)
class GeneratedQuestion:
    section_type: SectionType
    question_jp: str
    question_en: str
    stimulus: dict[str, Any]
    options: list[QuestionOption]
    correct_answer: str
    explanation_jp: str
    explanation_en: str
    vocabulary_ids: list[str]
    grammar_ids: list[str]
    difficulty: int
    jlpt_level: JlptLevel
    time_limit_seconds: int
    tags: list[str]
    audio_url: str | None = None
    image_url: str | None = None
    id: UUID = field(default_factory=uuid4)

    @property
    def generation_type(self) -> str:
        return str(self.stimulus.get("generation_type", "unknown"))

    @property
    def fingerprint(self) -> str:
        normalized = json.dumps(
            {
                "section": self.section_type,
                "type": self.generation_type,
                "question_jp": self.question_jp.strip(),
                "stimulus": self.stimulus,
                "options": [asdict(option) for option in self.options],
            },
            ensure_ascii=False,
            sort_keys=True,
            separators=(",", ":"),
        )
        return hashlib.sha256(normalized.encode("utf-8")).hexdigest()

    def to_mapping(self) -> dict[str, Any]:
        tags = list(dict.fromkeys([*self.tags, f"fingerprint:{self.fingerprint[:24]}"]))
        return {
            "id": self.id,
            "test_id": None,
            "section_type": self.section_type,
            "question_jp": self.question_jp,
            "question_en": self.question_en,
            "stimulus": self.stimulus,
            "options": [asdict(option) for option in self.options],
            "correct_answer": self.correct_answer,
            "explanation_jp": self.explanation_jp,
            "explanation_en": self.explanation_en,
            "vocabulary_ids": [UUID(value) for value in self.vocabulary_ids],
            "grammar_ids": [UUID(value) for value in self.grammar_ids],
            "audio_url": self.audio_url,
            "image_url": self.image_url,
            "difficulty": self.difficulty,
            "jlpt_level": self.jlpt_level,
            "time_limit_seconds": self.time_limit_seconds,
            "tags": tags,
            "source": "generated",
            "is_active": True,
        }


@dataclass(frozen=True, slots=True)
class VocabularyItem:
    id: str
    word: str
    kana: str | None
    meanings: list[dict[str, str]]
    part_of_speech: list[str]
    frequency_rank: int | None

    def meaning(self, language: str = "en") -> str | None:
        return next(
            (
                str(item["value"])
                for item in self.meanings
                if item.get("lang") in {language, "eng" if language == "en" else language}
                and item.get("value")
            ),
            None,
        )


@dataclass(frozen=True, slots=True)
class SentenceItem:
    id: str
    japanese: str
    translations: list[dict[str, str]]
    grammar_ids: list[str]
    vocabulary_ids: list[str]
    tags: list[str]

    def translation(self, language: str = "en") -> str | None:
        return next(
            (
                str(item["value"])
                for item in self.translations
                if item.get("lang") == language and item.get("value")
            ),
            None,
        )


@dataclass(frozen=True, slots=True)
class GrammarItem:
    id: str
    pattern: str
    meanings: list[dict[str, str]]
    formation: str | None
    examples: list[dict[str, Any]]

    def meaning(self, language: str = "en") -> str | None:
        return next(
            (
                str(item["value"])
                for item in self.meanings
                if item.get("lang") == language and item.get("value")
            ),
            None,
        )
