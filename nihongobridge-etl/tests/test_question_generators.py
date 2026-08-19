from __future__ import annotations

import asyncio
from pathlib import Path
from typing import Any
from uuid import UUID

import pytest

from etl.generators.grammar_question_gen import GrammarQuestionGenerator
from etl.generators.listening_question_gen import ListeningQuestionGenerator
from etl.generators.models import GrammarItem, SentenceItem, VocabularyItem
from etl.generators.quality_checker import QualityChecker
from etl.generators.reading_question_gen import ReadingQuestionGenerator
from etl.generators.vocabulary_question_gen import VocabularyQuestionGenerator
from etl.utils.tts_client import DialogueLine


def _uuid(number: int) -> str:
    return str(UUID(int=number))


class StubRepository:
    def __init__(self) -> None:
        words = [
            ("学生", "がくせい", "student"),
            ("学校", "がっこう", "school"),
            ("先生", "せんせい", "teacher"),
            ("日本", "にほん", "Japan"),
            ("水", "みず", "water"),
            ("食事", "しょくじ", "meal"),
            ("時間", "じかん", "time"),
            ("電車", "でんしゃ", "train"),
        ]
        self.vocabulary = [
            VocabularyItem(
                id=_uuid(index + 1),
                word=word,
                kana=kana,
                meanings=[{"lang": "en", "value": meaning, "pos": "noun"}],
                part_of_speech=["noun"],
                frequency_rank=index + 1,
            )
            for index, (word, kana, meaning) in enumerate(words)
        ]
        self.grammar = [
            GrammarItem(
                _uuid(100), "〜ます", [{"lang": "en", "value": "polite verb"}], "stem + ます", []
            ),
            GrammarItem(
                _uuid(101), "〜です", [{"lang": "en", "value": "polite copula"}], "noun + です", []
            ),
            GrammarItem(
                _uuid(102),
                "〜てから",
                [{"lang": "en", "value": "after doing"}],
                "て-form + から",
                [],
            ),
            GrammarItem(
                _uuid(103), "〜ので", [{"lang": "en", "value": "because"}], "plain form + ので", []
            ),
        ]
        self.sentences = [
            SentenceItem(
                id=_uuid(1_000 + index),
                japanese=(
                    f"学生は学校の図書館で日本語の本を読みます。今日は{index + 1}回目の勉強です。"
                ),
                translations=[
                    {
                        "lang": "en",
                        "value": (
                            "A student studies Japanese in the school library, "
                            f"example {index + 1}."
                        ),
                    }
                ],
                grammar_ids=[self.grammar[0].id, self.grammar[1].id],
                vocabulary_ids=[self.vocabulary[0].id, self.vocabulary[1].id],
                tags=["school", "study"],
            )
            for index in range(24)
        ]
        self.inserted: list[Any] = []

    async def load_vocabulary(self, *_: Any, **__: Any) -> list[VocabularyItem]:
        return self.vocabulary

    async def load_sentences(self, *_: Any, **__: Any) -> list[SentenceItem]:
        return self.sentences

    async def load_grammar(self, *_: Any, **__: Any) -> list[GrammarItem]:
        return self.grammar

    async def insert_questions(self, questions: list[Any]) -> list[str]:
        self.inserted.extend(questions)
        return [str(question.id) for question in questions]


class FakeTTS:
    female_voice = "ja-JP-NanamiNeural"
    male_voice = "ja-JP-KeitaNeural"

    async def synthesize(self, text: str, path: Path, *, voice: str | None = None) -> Path:
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(path.write_bytes, f"{voice}:{text}".encode())
        return path

    async def synthesize_dialogue(self, lines: list[DialogueLine], path: Path) -> Path:
        await asyncio.to_thread(path.parent.mkdir, parents=True, exist_ok=True)
        await asyncio.to_thread(
            path.write_bytes,
            "|".join(line.text for line in lines).encode(),
        )
        return path


class FakeStorage:
    def __init__(self) -> None:
        self.objects: set[str] = set()

    async def upload_file(
        self,
        bucket: str,
        object_name: str,
        path: Path,
        *,
        content_type: str,
    ) -> str:
        assert bucket == "audio"
        assert content_type == "audio/mpeg"
        assert await asyncio.to_thread(path.exists)
        self.objects.add(object_name)
        return f"https://media.example/{bucket}/{object_name}"

    async def remove_object(self, _: str, object_name: str) -> None:
        self.objects.discard(object_name)


@pytest.mark.asyncio
async def test_vocabulary_and_grammar_generators_cover_all_requested_types() -> None:
    repository = StubRepository()

    vocabulary = await VocabularyQuestionGenerator(repository, seed=7).generate(  # type: ignore[arg-type]
        "N5", 3, persist=False
    )
    grammar = await GrammarQuestionGenerator(repository, seed=7).generate(  # type: ignore[arg-type]
        "N5", 3, persist=False
    )

    assert {question.generation_type for question in vocabulary.questions} == {
        "vocabulary_reading",
        "vocabulary_meaning",
        "vocabulary_fill_blank",
    }
    assert {question.generation_type for question in grammar.questions} == {
        "grammar_completion",
        "grammar_error_identification",
        "grammar_sentence_ordering",
    }
    for question in [*vocabulary.questions, *grammar.questions]:
        assert QualityChecker().validate(question).valid
        assert question.stimulus["provenance"]["copyrighted_exam_content"] is False


@pytest.mark.asyncio
async def test_reading_generator_builds_short_medium_and_information_questions() -> None:
    repository = StubRepository()

    result = await ReadingQuestionGenerator(repository, seed=3).generate(  # type: ignore[arg-type]
        "N5", 11, persist=False
    )

    types = [question.generation_type for question in result.questions]
    assert types.count("reading_short") == 4
    assert types.count("reading_medium") == 6
    assert types.count("reading_information_retrieval") == 1
    assert {question.stimulus["question_kind"] for question in result.questions} >= {
        "main_idea",
        "specific_detail",
        "vocabulary_in_context",
        "author_intent",
        "information_retrieval",
    }
    assert all(QualityChecker().validate(question).valid for question in result.questions)


@pytest.mark.asyncio
async def test_listening_generator_creates_audio_for_all_three_types(tmp_path: Path) -> None:
    repository = StubRepository()
    storage = FakeStorage()
    generator = ListeningQuestionGenerator(
        repository,  # type: ignore[arg-type]
        tts=FakeTTS(),  # type: ignore[arg-type]
        storage=storage,  # type: ignore[arg-type]
        bucket="audio",
        temp_directory=tmp_path,
        seed=11,
    )

    result = await generator.generate("N5", 3, persist=True)

    assert {question.generation_type for question in result.questions} == {
        "listening_dialogue",
        "listening_monologue",
        "listening_quick_response",
    }
    assert len(result.inserted_ids) == 3
    assert len(storage.objects) == 3
    assert all(question.audio_url for question in result.questions)
    assert all(QualityChecker().validate(question).valid for question in result.questions)
