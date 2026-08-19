from __future__ import annotations

from dataclasses import dataclass, field
from uuid import UUID

from etl.generators.models import GeneratedQuestion

_PROHIBITED_MARKERS = (
    "official jlpt",
    "jlpt official",
    "公式jlpt",
    "日本語能力試験公式",
    "過去問",
)


@dataclass(frozen=True, slots=True)
class QualityIssue:
    code: str
    message: str


@dataclass(slots=True)
class QualityReport:
    issues: list[QualityIssue] = field(default_factory=list)

    @property
    def valid(self) -> bool:
        return not self.issues


class QuestionQualityError(ValueError):
    pass


class QualityChecker:
    """Reject structurally unsafe, duplicate, or non-original generated questions."""

    def validate(self, question: GeneratedQuestion) -> QualityReport:
        report = QualityReport()
        self._check(
            bool(question.question_jp.strip()), "question.empty", "Japanese prompt is empty", report
        )
        self._check(
            question.section_type in {"vocabulary", "grammar", "reading", "listening"},
            "section.invalid",
            "Section type is invalid",
            report,
        )
        self._check(
            question.jlpt_level in {"N5", "N4", "N3", "N2", "N1"},
            "level.invalid",
            "JLPT level is invalid",
            report,
        )
        self._check(
            1 <= question.difficulty <= 5,
            "difficulty.invalid",
            "Difficulty must be between 1 and 5",
            report,
        )
        self._check(
            question.time_limit_seconds > 0,
            "time.invalid",
            "Time limit must be positive",
            report,
        )
        self._check(
            len(question.options) == 4,
            "options.count",
            "Exactly four options are required",
            report,
        )

        option_ids = [option.id for option in question.options]
        option_texts = [option.text_jp.strip().casefold() for option in question.options]
        self._check(
            len(set(option_ids)) == len(option_ids),
            "options.ids_duplicate",
            "Option IDs must be unique",
            report,
        )
        self._check(
            all(option_texts) and len(set(option_texts)) == len(option_texts),
            "options.text_duplicate",
            "Option text must be non-empty and unique",
            report,
        )
        self._check(
            option_ids.count(question.correct_answer) == 1,
            "answer.missing",
            "Correct answer must identify exactly one option",
            report,
        )
        self._check(
            bool(question.explanation_en.strip()),
            "explanation.empty",
            "English explanation is required",
            report,
        )

        provenance = question.stimulus.get("provenance")
        self._check(
            isinstance(provenance, dict)
            and provenance.get("kind") == "knowledge-base-synthesis"
            and bool(provenance.get("source_ids"))
            and provenance.get("copyrighted_exam_content") is False,
            "originality.provenance",
            "Knowledge-base provenance is required and must reject exam content",
            report,
        )
        combined_text = " ".join(
            [
                question.question_jp,
                question.question_en,
                question.explanation_jp,
                question.explanation_en,
            ]
        ).casefold()
        self._check(
            not any(marker in combined_text for marker in _PROHIBITED_MARKERS),
            "originality.prohibited_marker",
            "Question references official or past exam material",
            report,
        )

        generation_type = question.generation_type
        passage = str(question.stimulus.get("passage", ""))
        if generation_type == "reading_short":
            self._check(
                100 <= len(passage) <= 200,
                "reading.short_length",
                "Short passage must be 100-200 characters",
                report,
            )
        elif generation_type == "reading_medium":
            self._check(
                300 <= len(passage) <= 500,
                "reading.medium_length",
                "Medium passage must be 300-500 characters",
                report,
            )
        if question.section_type == "listening":
            transcript = question.stimulus.get("transcript")
            self._check(
                isinstance(transcript, list) and bool(transcript),
                "listening.transcript",
                "Listening questions require a transcript",
                report,
            )

        for content_id in [*question.vocabulary_ids, *question.grammar_ids]:
            try:
                UUID(content_id)
            except ValueError:
                report.issues.append(
                    QualityIssue("content.invalid_uuid", f"Invalid content UUID: {content_id}")
                )
        return report

    def assert_valid(self, question: GeneratedQuestion) -> None:
        report = self.validate(question)
        if not report.valid:
            details = "; ".join(f"{issue.code}: {issue.message}" for issue in report.issues)
            raise QuestionQualityError(details)

    @staticmethod
    def _check(condition: bool, code: str, message: str, report: QualityReport) -> None:
        if not condition:
            report.issues.append(QualityIssue(code, message))
