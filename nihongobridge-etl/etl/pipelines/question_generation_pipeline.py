from __future__ import annotations

import argparse
import asyncio
import json
import logging
from dataclasses import asdict

from etl.config import get_settings
from etl.generators.base import BaseQuestionGenerator
from etl.generators.grammar_question_gen import GrammarQuestionGenerator
from etl.generators.listening_question_gen import ListeningQuestionGenerator
from etl.generators.quality_checker import QualityChecker
from etl.generators.reading_question_gen import ReadingQuestionGenerator
from etl.generators.repository import KnowledgeRepository
from etl.generators.test_assembler import TestAssembler
from etl.generators.vocabulary_question_gen import VocabularyQuestionGenerator
from etl.utils.db import Database

LOGGER = logging.getLogger(__name__)
_SECTIONS = ("vocabulary", "grammar", "reading", "listening")
_LEVELS = ("N5", "N4", "N3", "N2", "N1")


async def _generate(args: argparse.Namespace) -> dict[str, object]:
    settings = get_settings()
    database = Database(settings)
    try:
        await database.ping()
        repository = KnowledgeRepository(database)
        await repository.validate_schema()
        checker = QualityChecker()
        requested_sections = _SECTIONS if args.section == "all" else (args.section,)
        output: dict[str, object] = {}
        for section in requested_sections:
            generator: BaseQuestionGenerator
            if section == "vocabulary":
                generator = VocabularyQuestionGenerator(
                    repository,
                    quality_checker=checker,
                    seed=args.seed,
                )
            elif section == "grammar":
                generator = GrammarQuestionGenerator(
                    repository,
                    quality_checker=checker,
                    seed=args.seed,
                )
            elif section == "reading":
                generator = ReadingQuestionGenerator(
                    repository,
                    quality_checker=checker,
                    seed=args.seed,
                )
            else:
                generator = await ListeningQuestionGenerator.from_settings(
                    repository,
                    settings,
                    quality_checker=checker,
                    seed=args.seed,
                )
            result = await generator.generate(
                args.level,
                args.count,
                persist=not args.no_persist,
            )
            output[section] = {
                "generated": len(result.questions),
                "inserted": len(result.inserted_ids),
                "question_ids": result.inserted_ids,
                "generation_types": [question.generation_type for question in result.questions],
            }
        return {"level": args.level, "sections": output}
    finally:
        await database.dispose()


async def _assemble(args: argparse.Namespace) -> dict[str, object]:
    settings = get_settings()
    database = Database(settings)
    try:
        await database.ping()
        assembled = await TestAssembler(database).assemble(
            level=args.level,
            test_type=args.test_type,
            user_id=args.user_id,
            section=args.section,
            section_count=args.count,
        )
        return asdict(assembled)
    finally:
        await database.dispose()


def _parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate original NihongoBridge questions/tests")
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
    )
    commands = parser.add_subparsers(dest="command", required=True)

    generate = commands.add_parser("generate", help="generate standalone question-bank items")
    generate.add_argument("--level", choices=_LEVELS, required=True)
    generate.add_argument("--section", choices=(*_SECTIONS, "all"), required=True)
    generate.add_argument("--count", type=int, required=True)
    generate.add_argument("--seed", type=int)
    generate.add_argument("--no-persist", action="store_true")

    assemble = commands.add_parser("assemble", help="assemble generated questions into a test")
    assemble.add_argument("--level", choices=_LEVELS, required=True)
    assemble.add_argument(
        "--test-type",
        choices=("full_mock", "section_drill"),
        required=True,
    )
    assemble.add_argument("--user-id", required=True)
    assemble.add_argument("--section", choices=_SECTIONS)
    assemble.add_argument("--count", type=int, default=20)
    return parser


async def _async_main(argv: list[str] | None = None) -> int:
    args = _parser().parse_args(argv)
    if getattr(args, "count", 1) < 1:
        raise SystemExit("--count must be at least 1")
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    if args.command == "generate":
        result = await _generate(args)
    else:
        result = await _assemble(args)
    print(json.dumps(result, ensure_ascii=False, indent=2))
    return 0


def main() -> None:
    try:
        raise SystemExit(asyncio.run(_async_main()))
    except KeyboardInterrupt:
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
