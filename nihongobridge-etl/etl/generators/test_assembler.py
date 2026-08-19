from __future__ import annotations

import math
from dataclasses import dataclass
from typing import Literal
from uuid import UUID, uuid4

from sqlalchemy import Boolean, Column, Float, Integer, MetaData, Table, Text, select, text, update
from sqlalchemy.dialects.postgresql import ARRAY, ENUM, JSONB, insert
from sqlalchemy.dialects.postgresql import UUID as PGUUID
from sqlalchemy.ext.asyncio import AsyncConnection

from etl.generators.models import JlptLevel
from etl.generators.repository import questions_table
from etl.utils.db import Database

AssemblerTestType = Literal["full_mock", "section_drill"]
AssemblerSection = Literal["vocabulary", "grammar", "reading", "listening"]

_DEFAULT_COUNTS: dict[AssemblerSection, int] = {
    "vocabulary": 20,
    "grammar": 15,
    "reading": 10,
    "listening": 15,
}
_SECTION_MINUTES: dict[AssemblerSection, int] = {
    "vocabulary": 25,
    "grammar": 20,
    "reading": 40,
    "listening": 30,
}
_DB_TEST_TYPES = {"full_mock": "mock_full", "section_drill": "section_only"}

metadata = MetaData()
_test_level_enum = ENUM("N5", "N4", "N3", "N2", "N1", name="jlpt_test_level", create_type=False)
_test_type_enum = ENUM(
    "mock_full",
    "section_only",
    "quick_drill",
    "adaptive",
    name="test_type",
    create_type=False,
)

practice_tests_table = Table(
    "practice_tests",
    metadata,
    Column("id", PGUUID(as_uuid=True), primary_key=True),
    Column("title", Text, nullable=False),
    Column("level", _test_level_enum, nullable=False),
    Column("test_type", _test_type_enum, nullable=False),
    Column("sections", JSONB, nullable=False),
    Column("total_time_minutes", Integer, nullable=False),
    Column("difficulty_score", Float, nullable=False),
    Column("tags", ARRAY(Text), nullable=False),
    Column("is_published", Boolean, nullable=False),
    Column("created_by", PGUUID(as_uuid=True), nullable=False),
)


@dataclass(frozen=True, slots=True)
class AssembledTest:
    test_id: str
    question_ids: list[str]
    sections: list[dict[str, object]]


class TestAssembler:
    """Atomically reserve generated questions and assemble an original practice test."""

    def __init__(self, database: Database) -> None:
        self.database = database

    async def assemble(
        self,
        *,
        level: JlptLevel,
        test_type: AssemblerTestType,
        user_id: str,
        section: AssemblerSection | None = None,
        section_count: int = 20,
        counts: dict[AssemblerSection, int] | None = None,
    ) -> AssembledTest:
        if test_type not in _DB_TEST_TYPES:
            raise ValueError("test_type must be full_mock or section_drill")
        if test_type == "section_drill" and section is None:
            raise ValueError("section is required for section_drill")
        if section_count < 1:
            raise ValueError("section_count must be positive")
        creator_id = UUID(user_id)
        requested: dict[AssemblerSection, int]
        if test_type == "full_mock":
            requested = dict(counts or _DEFAULT_COUNTS)
        else:
            if section is None:
                raise AssertionError("section was validated above")
            requested = {section: section_count}
        if not requested or any(value < 1 for value in requested.values()):
            raise ValueError("Every requested section count must be positive")

        test_id = uuid4()
        salt = str(uuid4())
        async with self.database.transaction() as connection:
            user_exists = await connection.scalar(
                text("SELECT EXISTS(SELECT 1 FROM users WHERE id = :user_id)"),
                {"user_id": creator_id},
            )
            if not user_exists:
                raise ValueError(f"Unknown user_id: {user_id}")

            recent_ids = await self._recent_question_ids(connection, creator_id)
            selected_by_section: dict[AssemblerSection, list[tuple[UUID, int]]] = {}
            for requested_section, required_count in requested.items():
                candidates = await self._lock_candidates(
                    connection,
                    level,
                    requested_section,
                    required_count,
                    recent_ids,
                    salt,
                )
                if len(candidates) < required_count:
                    raise RuntimeError(
                        f"Insufficient unused {level} {requested_section} questions: "
                        f"needed {required_count}, found {len(candidates)}"
                    )
                selected_by_section[requested_section] = candidates[:required_count]

            sections: list[dict[str, object]] = []
            total_time = 0
            for section_name, selected in selected_by_section.items():
                section_time = self._section_time(section_name, len(selected))
                total_time += section_time
                sections.append(
                    {
                        "type": section_name,
                        "time_minutes": section_time,
                        "question_ids": [str(question_id) for question_id, _ in selected],
                    }
                )
            all_selected = [item for selected in selected_by_section.values() for item in selected]
            question_ids = [question_id for question_id, _ in all_selected]
            difficulty_score = sum(difficulty for _, difficulty in all_selected) / len(all_selected)
            title_type = (
                "Mock Test"
                if test_type == "full_mock"
                else f"{section.title() if section else 'Section'} Drill"
            )

            await connection.execute(
                insert(practice_tests_table).values(
                    {
                        "id": test_id,
                        "title": f"{level} Original {title_type}",
                        "level": level,
                        "test_type": _DB_TEST_TYPES[test_type],
                        "sections": sections,
                        "total_time_minutes": total_time,
                        "difficulty_score": round(difficulty_score, 3),
                        "tags": ["generated", "original", "knowledge-base-only"],
                        "is_published": True,
                        "created_by": creator_id,
                    }
                )
            )
            result = await connection.execute(
                update(questions_table)
                .where(
                    questions_table.c.id.in_(question_ids),
                    questions_table.c.test_id.is_(None),
                )
                .values(test_id=test_id)
                .returning(questions_table.c.id)
            )
            reserved = {row.id for row in result}
            if reserved != set(question_ids):
                raise RuntimeError("Concurrent assembly changed the selected question pool")

        return AssembledTest(
            test_id=str(test_id),
            question_ids=[str(value) for value in question_ids],
            sections=sections,
        )

    async def _recent_question_ids(
        self,
        connection: AsyncConnection,
        user_id: UUID,
    ) -> list[UUID]:
        rows = await connection.execute(
            text(
                """
                SELECT DISTINCT answer->>'question_id' AS question_id
                FROM (
                  SELECT answers
                  FROM test_sessions
                  WHERE user_id = :user_id
                  ORDER BY started_at DESC
                  LIMIT 20
                ) AS recent
                CROSS JOIN LATERAL jsonb_array_elements(recent.answers) AS expanded(answer)
                WHERE answer ? 'question_id'
                """
            ),
            {"user_id": user_id},
        )
        output: list[UUID] = []
        for row in rows:
            try:
                output.append(UUID(str(row.question_id)))
            except ValueError:
                continue
        return output

    async def _lock_candidates(
        self,
        connection: AsyncConnection,
        level: JlptLevel,
        section: AssemblerSection,
        count: int,
        recent_ids: list[UUID],
        salt: str,
    ) -> list[tuple[UUID, int]]:
        statement = select(questions_table.c.id, questions_table.c.difficulty).where(
            questions_table.c.jlpt_level == level,
            questions_table.c.section_type == section,
            questions_table.c.source == "generated",
            questions_table.c.is_active.is_(True),
            questions_table.c.test_id.is_(None),
        )
        if recent_ids:
            statement = statement.where(questions_table.c.id.not_in(recent_ids))
        statement = (
            statement.order_by(
                text("md5(id::text || :salt)"),
                questions_table.c.difficulty,
            )
            .limit(max(count * 5, count))
            .with_for_update(skip_locked=True)
        )
        rows = await connection.execute(statement, {"salt": salt})
        candidates = [(row.id, int(row.difficulty)) for row in rows]
        return self._balanced(candidates, count)

    @staticmethod
    def _balanced(candidates: list[tuple[UUID, int]], count: int) -> list[tuple[UUID, int]]:
        buckets: dict[int, list[tuple[UUID, int]]] = {value: [] for value in range(1, 6)}
        for candidate in candidates:
            buckets[candidate[1]].append(candidate)
        output: list[tuple[UUID, int]] = []
        order = (2, 3, 1, 4, 5)
        while len(output) < count and any(buckets.values()):
            for difficulty in order:
                if buckets[difficulty] and len(output) < count:
                    output.append(buckets[difficulty].pop())
        return output

    @staticmethod
    def _section_time(section: AssemblerSection, count: int) -> int:
        baseline_count = _DEFAULT_COUNTS[section]
        return max(1, math.ceil(_SECTION_MINUTES[section] * count / baseline_count))
