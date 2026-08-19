from __future__ import annotations

from collections.abc import Sequence
from typing import Any

from sqlalchemy import Boolean, Column, Integer, MetaData, Table, Text, select, text
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, UUID, insert

from etl.generators.models import (
    GeneratedQuestion,
    GrammarItem,
    JlptLevel,
    SentenceItem,
    VocabularyItem,
)
from etl.utils.db import Database

metadata = MetaData()
_jlpt_enum = ENUM("N5", "N4", "N3", "N2", "N1", "NONE", name="jlpt_level", create_type=False)
_section_enum = ENUM(
    "vocabulary",
    "grammar",
    "reading",
    "listening",
    name="question_section_type",
    create_type=False,
)

questions_table = Table(
    "questions",
    metadata,
    Column("id", UUID(as_uuid=True), primary_key=True),
    Column("test_id", UUID(as_uuid=True)),
    Column("section_type", _section_enum, nullable=False),
    Column("question_jp", Text),
    Column("question_en", Text),
    Column("stimulus", JSONB),
    Column("options", JSONB, nullable=False),
    Column("correct_answer", Text, nullable=False),
    Column("explanation_jp", Text),
    Column("explanation_en", Text),
    Column("vocabulary_ids", ARRAY(UUID(as_uuid=True)), nullable=False),
    Column("grammar_ids", ARRAY(UUID(as_uuid=True)), nullable=False),
    Column("audio_url", Text),
    Column("image_url", Text),
    Column("difficulty", Integer, nullable=False),
    Column("jlpt_level", _jlpt_enum, nullable=False),
    Column("time_limit_seconds", Integer),
    Column("tags", ARRAY(Text), nullable=False),
    Column("source", Text, nullable=False),
    Column("is_active", Boolean, nullable=False),
)


class KnowledgeRepository:
    """Read generation inputs and persist quality-approved generated questions."""

    def __init__(self, database: Database) -> None:
        self.database = database

    async def validate_schema(self) -> None:
        required = ("dictionary_entries", "grammar_patterns", "sentences", "questions")
        async with self.database.engine.connect() as connection:
            for table_name in required:
                exists = await connection.scalar(
                    text("SELECT to_regclass(:table_name)"),
                    {"table_name": f"public.{table_name}"},
                )
                if exists is None:
                    raise RuntimeError(f"Required table does not exist: {table_name}")

    async def load_vocabulary(
        self,
        level: JlptLevel,
        *,
        limit: int = 2_000,
    ) -> list[VocabularyItem]:
        async with self.database.engine.connect() as connection:
            rows = await connection.execute(
                text(
                    """
                    SELECT id::text, word, kana, meanings, part_of_speech, frequency_rank
                    FROM dictionary_entries
                    WHERE jlpt_level = :level AND is_active = true
                    ORDER BY frequency_rank NULLS LAST, id
                    LIMIT :limit
                    """
                ),
                {"level": level, "limit": limit},
            )
            return [
                VocabularyItem(
                    id=str(row[0]),
                    word=str(row[1]),
                    kana=str(row[2]) if row[2] else None,
                    meanings=list(row[3] or []),
                    part_of_speech=list(row[4] or []),
                    frequency_rank=int(row[5]) if row[5] is not None else None,
                )
                for row in rows
            ]

    async def load_sentences(
        self,
        level: JlptLevel,
        *,
        limit: int = 4_000,
    ) -> list[SentenceItem]:
        async with self.database.engine.connect() as connection:
            rows = await connection.execute(
                text(
                    """
                    SELECT id::text, japanese, translations, grammar_ids, vocabulary_ids, tags
                    FROM sentences
                    WHERE jlpt_level = :level
                    ORDER BY id
                    LIMIT :limit
                    """
                ),
                {"level": level, "limit": limit},
            )
            return [
                SentenceItem(
                    id=str(row[0]),
                    japanese=str(row[1]),
                    translations=list(row[2] or []),
                    grammar_ids=[str(value) for value in (row[3] or [])],
                    vocabulary_ids=[str(value) for value in (row[4] or [])],
                    tags=list(row[5] or []),
                )
                for row in rows
            ]

    async def load_grammar(
        self,
        level: JlptLevel,
        *,
        limit: int = 1_000,
    ) -> list[GrammarItem]:
        async with self.database.engine.connect() as connection:
            rows = await connection.execute(
                text(
                    """
                    SELECT id::text, pattern, meaning, formation, examples
                    FROM grammar_patterns
                    WHERE jlpt_level = :level
                    ORDER BY pattern, id
                    LIMIT :limit
                    """
                ),
                {"level": level, "limit": limit},
            )
            return [
                GrammarItem(
                    id=str(row[0]),
                    pattern=str(row[1]),
                    meanings=list(row[2] or []),
                    formation=str(row[3]) if row[3] else None,
                    examples=list(row[4] or []),
                )
                for row in rows
            ]

    async def insert_questions(
        self,
        questions: Sequence[GeneratedQuestion],
    ) -> list[str]:
        if not questions:
            return []
        fingerprint_tags = [f"fingerprint:{question.fingerprint[:24]}" for question in questions]
        async with self.database.transaction() as connection:
            existing_rows = await connection.execute(
                select(questions_table.c.tags).where(
                    questions_table.c.tags.overlap(fingerprint_tags)
                )
            )
            existing = {
                tag
                for row in existing_rows
                for tag in (row.tags or [])
                if str(tag).startswith("fingerprint:")
            }
            accepted = [
                question
                for question in questions
                if f"fingerprint:{question.fingerprint[:24]}" not in existing
            ]
            if not accepted:
                return []
            mappings: list[dict[str, Any]] = [question.to_mapping() for question in accepted]
            await connection.execute(insert(questions_table).values(mappings))
        return [str(question.id) for question in accepted]
