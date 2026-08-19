from __future__ import annotations

from uuid import UUID

from etl.generators.models import GeneratedQuestion, QuestionOption
from etl.generators.quality_checker import QualityChecker
from etl.generators.test_assembler import TestAssembler as Assembler


def _valid_question() -> GeneratedQuestion:
    return GeneratedQuestion(
        section_type="vocabulary",
        question_jp="正しい読み方を選んでください。",
        question_en="Choose the correct reading.",
        stimulus={
            "generation_type": "vocabulary_reading",
            "provenance": {
                "kind": "knowledge-base-synthesis",
                "method": "fixture",
                "source_ids": [str(UUID(int=1))],
                "copyrighted_exam_content": False,
            },
        },
        options=[
            QuestionOption("a", "みず"),
            QuestionOption("b", "ひ"),
            QuestionOption("c", "き"),
            QuestionOption("d", "ほん"),
        ],
        correct_answer="a",
        explanation_jp="水はみずと読みます。",
        explanation_en="水 is read みず.",
        vocabulary_ids=[str(UUID(int=1))],
        grammar_ids=[],
        difficulty=1,
        jlpt_level="N5",
        time_limit_seconds=30,
        tags=["generated", "original"],
    )


def test_quality_checker_rejects_duplicate_options_and_exam_provenance() -> None:
    question = _valid_question()
    question.options[1] = QuestionOption("b", "みず")
    question.stimulus["provenance"]["copyrighted_exam_content"] = True

    report = QualityChecker().validate(question)

    assert not report.valid
    assert {issue.code for issue in report.issues} >= {
        "options.text_duplicate",
        "originality.provenance",
    }


def test_test_assembler_balances_difficulty_and_scales_section_time() -> None:
    candidates = [
        (UUID(int=index), difficulty) for index, difficulty in enumerate([1, 1, 2, 3, 4, 5], 1)
    ]

    selected = Assembler._balanced(candidates, 5)

    assert len(selected) == 5
    assert {difficulty for _, difficulty in selected} >= {1, 2, 3, 4}
    assert Assembler._section_time("vocabulary", 10) == 13
    assert Assembler._section_time("reading", 10) == 40
