from __future__ import annotations

import hashlib
from collections.abc import Iterable
from dataclasses import asdict, dataclass
from typing import Any

from sqlalchemy import Column, DateTime, MetaData, Table, Text, func, select, text
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, UUID, insert

from etl.utils.db import Database

metadata = MetaData()
_jlpt_enum = ENUM("N5", "N4", "N3", "N2", "N1", "NONE", name="jlpt_level", create_type=False)

sentences = Table(
    "sentences",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("japanese", Text, nullable=False),
    Column("furigana_html", Text),
    Column("translations", JSONB, nullable=False),
    Column("jlpt_level", _jlpt_enum, nullable=False),
    Column("grammar_ids", ARRAY(UUID(as_uuid=False)), nullable=False),
    Column("vocabulary_ids", ARRAY(UUID(as_uuid=False)), nullable=False),
    Column("tags", ARRAY(Text), nullable=False),
    Column("source", Text, nullable=False),
    Column("source_id", Text),
    Column("updated_at", DateTime(timezone=True)),
)


@dataclass(slots=True)
class SentenceRecord:
    japanese: str
    furigana_html: str
    translations: list[dict[str, str]]
    jlpt_level: str
    grammar_ids: list[str]
    vocabulary_ids: list[str]
    tags: list[str]
    source: str
    source_id: str

    @property
    def text_hash(self) -> str:
        return hashlib.sha256(self.japanese.encode("utf-8")).hexdigest()

    def to_mapping(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class SentenceLoadStats:
    attempted: int = 0
    inserted: int = 0
    updated: int = 0
    duplicate_text: int = 0
    duplicate_batch: int = 0


class SentenceLoader:
    """Batch-upsert Tatoeba sentences while rejecting duplicate Japanese text."""

    def __init__(self, database: Database) -> None:
        self.database = database

    async def validate_schema(self) -> None:
        async with self.database.engine.connect() as connection:
            exists = await connection.scalar(text("SELECT to_regclass('public.sentences')"))
            if exists is None:
                raise RuntimeError(
                    "sentences does not exist; apply the nihongobridge-knowledge migrations first"
                )

    async def upsert_batch(self, records: Iterable[SentenceRecord]) -> SentenceLoadStats:
        attempted = 0
        deduplicated: dict[str, SentenceRecord] = {}
        for record in records:
            attempted += 1
            deduplicated.setdefault(record.text_hash, record)
        batch = list(deduplicated.values())
        if not batch:
            return SentenceLoadStats()

        mappings = [record.to_mapping() for record in batch]
        source_ids = [record.source_id for record in batch]
        japanese_texts = [record.japanese for record in batch]
        source = batch[0].source

        async with self.database.transaction() as connection:
            existing_source_rows = await connection.execute(
                select(sentences.c.source_id).where(
                    sentences.c.source == source,
                    sentences.c.source_id.in_(source_ids),
                )
            )
            existing_source_ids = {
                str(row.source_id) for row in existing_source_rows if row.source_id is not None
            }

            existing_text_rows = await connection.execute(
                select(sentences.c.japanese, sentences.c.source, sentences.c.source_id).where(
                    sentences.c.japanese.in_(japanese_texts)
                )
            )
            existing_texts: dict[str, tuple[str, str | None]] = {
                str(row.japanese): (str(row.source), str(row.source_id) if row.source_id else None)
                for row in existing_text_rows
            }

            accepted: list[dict[str, Any]] = []
            duplicate_text = 0
            for mapping in mappings:
                source_id = str(mapping["source_id"])
                japanese = str(mapping["japanese"])
                owner = existing_texts.get(japanese)
                if source_id not in existing_source_ids and owner is not None:
                    duplicate_text += 1
                    continue
                accepted.append(mapping)

            if accepted:
                statement = insert(sentences).values(accepted)
                statement = statement.on_conflict_do_update(
                    index_elements=[sentences.c.source, sentences.c.source_id],
                    index_where=sentences.c.source_id.is_not(None),
                    set_={
                        "japanese": statement.excluded.japanese,
                        "furigana_html": statement.excluded.furigana_html,
                        "translations": statement.excluded.translations,
                        "jlpt_level": statement.excluded.jlpt_level,
                        "grammar_ids": statement.excluded.grammar_ids,
                        "vocabulary_ids": statement.excluded.vocabulary_ids,
                        "tags": statement.excluded.tags,
                        "updated_at": func.now(),
                    },
                )
                await connection.execute(statement)

        updated = sum(record.source_id in existing_source_ids for record in batch)
        inserted = len(accepted) - updated
        return SentenceLoadStats(
            attempted=attempted,
            inserted=inserted,
            updated=updated,
            duplicate_text=duplicate_text,
            duplicate_batch=attempted - len(batch),
        )
