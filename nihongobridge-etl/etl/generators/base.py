from __future__ import annotations

import random
from dataclasses import dataclass

from etl.generators.models import GeneratedQuestion, JlptLevel
from etl.generators.quality_checker import QualityChecker
from etl.generators.repository import KnowledgeRepository


@dataclass(frozen=True, slots=True)
class GenerationResult:
    questions: list[GeneratedQuestion]
    inserted_ids: list[str]


class BaseQuestionGenerator:
    section: str

    def __init__(
        self,
        repository: KnowledgeRepository,
        *,
        quality_checker: QualityChecker | None = None,
        seed: int | None = None,
    ) -> None:
        self.repository = repository
        self.quality_checker = quality_checker or QualityChecker()
        self.rng = random.Random(seed)

    async def generate(
        self,
        level: JlptLevel,
        count: int,
        *,
        persist: bool = True,
    ) -> GenerationResult:
        if count < 1:
            raise ValueError("count must be at least 1")
        questions = await self._build(level, count)
        if len(questions) != count:
            raise RuntimeError(
                f"{type(self).__name__} produced {len(questions)} of {count} requested questions"
            )
        for question in questions:
            self.quality_checker.assert_valid(question)
        inserted_ids = await self.repository.insert_questions(questions) if persist else []
        return GenerationResult(questions=questions, inserted_ids=inserted_ids)

    async def _build(self, level: JlptLevel, count: int) -> list[GeneratedQuestion]:
        raise NotImplementedError
