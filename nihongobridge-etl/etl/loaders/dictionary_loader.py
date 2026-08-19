from __future__ import annotations

import asyncio
from collections.abc import Iterable, Sequence
from dataclasses import dataclass
from typing import Any

from sqlalchemy import (
    Boolean,
    Column,
    DateTime,
    Integer,
    MetaData,
    Table,
    Text,
    func,
    select,
    text,
)
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, UUID, insert
from sqlalchemy.exc import DBAPIError
from sqlalchemy.ext.asyncio import AsyncConnection

from etl.transformers.jmdict_transformer import DictionaryRecord
from etl.utils.db import Database

metadata = MetaData()
_jlpt_enum = ENUM("N5", "N4", "N3", "N2", "N1", "NONE", name="jlpt_level", create_type=False)

dictionary_entries = Table(
    "dictionary_entries",
    metadata,
    Column(
        "id",
        UUID(as_uuid=True),
        primary_key=True,
        server_default=text("gen_random_uuid()"),
    ),
    Column("word", Text, nullable=False),
    Column("kana", Text),
    Column("romaji", Text),
    Column("furigana", JSONB, nullable=False),
    Column("meanings", JSONB, nullable=False),
    Column("jlpt_level", _jlpt_enum, nullable=False),
    Column("part_of_speech", ARRAY(Text), nullable=False),
    Column("pitch_accent", JSONB),
    Column("frequency_rank", Integer),
    Column("kanji_ids", ARRAY(Text), nullable=False),
    Column("tags", ARRAY(Text), nullable=False),
    Column("source", Text, nullable=False),
    Column("source_id", Text),
    Column("is_active", Boolean, nullable=False),
    Column("updated_at", DateTime(timezone=True)),
)

_UPSERT_COLUMNS = (
    "word",
    "kana",
    "romaji",
    "furigana",
    "meanings",
    "jlpt_level",
    "part_of_speech",
    "pitch_accent",
    "frequency_rank",
    "kanji_ids",
    "tags",
    "is_active",
)
_EXPECTED_COLUMNS = frozenset(
    {
        "id",
        "word",
        "kana",
        "romaji",
        "furigana",
        "meanings",
        "jlpt_level",
        "part_of_speech",
        "pitch_accent",
        "frequency_rank",
        "kanji_ids",
        "tags",
        "source",
        "source_id",
        "is_active",
        "created_at",
        "updated_at",
    }
)
_RETRYABLE_SQLSTATES = {"40001", "40P01", "53300", "57P03"}


@dataclass(frozen=True, slots=True)
class LoadStats:
    attempted: int = 0
    inserted: int = 0
    updated: int = 0
    duplicate_source_ids_in_batch: int = 0


class DictionaryLoader:
    """Transactional PostgreSQL batch upsert for JMdict-owned columns."""

    def __init__(self, database: Database, *, retries: int = 3) -> None:
        self.database = database
        self.retries = retries

    async def validate_schema(self) -> None:
        async with self.database.engine.connect() as connection:
            exists = await connection.scalar(
                text("SELECT to_regclass('public.dictionary_entries')")
            )
            if exists is None:
                raise RuntimeError(
                    "dictionary_entries does not exist; apply the "
                    "nihongobridge-knowledge migrations first"
                )
            result = await connection.execute(
                text(
                    """
                    SELECT column_name
                    FROM information_schema.columns
                    WHERE table_schema = 'public' AND table_name = 'dictionary_entries'
                    """
                )
            )
            actual = {row[0] for row in result}
            missing = _EXPECTED_COLUMNS - actual
            if missing:
                raise RuntimeError(
                    "dictionary_entries is missing required columns: " + ", ".join(sorted(missing))
                )

    async def existing_source_ids(
        self,
        connection: AsyncConnection,
        records: Sequence[dict[str, Any]],
    ) -> set[tuple[str, str]]:
        existing: set[tuple[str, str]] = set()
        by_source: dict[str, list[str]] = {}
        for record in records:
            by_source.setdefault(str(record["source"]), []).append(str(record["source_id"]))

        for source, source_ids in by_source.items():
            statement = select(
                dictionary_entries.c.source,
                dictionary_entries.c.source_id,
            ).where(
                dictionary_entries.c.source == source,
                dictionary_entries.c.source_id.in_(source_ids),
            )
            result = await connection.execute(statement)
            existing.update((row.source, row.source_id) for row in result if row.source_id)
        return existing

    async def upsert_batch(self, records: Iterable[DictionaryRecord]) -> LoadStats:
        deduplicated: dict[tuple[str, str], dict[str, Any]] = {}
        attempted = 0
        for record in records:
            attempted += 1
            mapping = record.to_mapping()
            key = (record.source, record.source_id)
            deduplicated[key] = mapping

        values = list(deduplicated.values())
        if not values:
            return LoadStats()

        duplicate_count = attempted - len(values)
        for attempt in range(1, self.retries + 1):
            try:
                async with self.database.transaction() as connection:
                    existing = await self.existing_source_ids(connection, values)
                    statement = insert(dictionary_entries).values(values)
                    statement = statement.on_conflict_do_update(
                        index_elements=[
                            dictionary_entries.c.source,
                            dictionary_entries.c.source_id,
                        ],
                        index_where=dictionary_entries.c.source_id.is_not(None),
                        set_={
                            column: getattr(statement.excluded, column)
                            for column in _UPSERT_COLUMNS
                        }
                        | {"updated_at": func.now()},
                    )
                    await connection.execute(statement)
                return LoadStats(
                    attempted=attempted,
                    inserted=len(values) - len(existing),
                    updated=len(existing),
                    duplicate_source_ids_in_batch=duplicate_count,
                )
            except DBAPIError as exc:
                sqlstate = getattr(exc.orig, "sqlstate", None)
                if sqlstate not in _RETRYABLE_SQLSTATES or attempt == self.retries:
                    raise
                await asyncio.sleep(0.5 * (2 ** (attempt - 1)))

        raise AssertionError("unreachable")
