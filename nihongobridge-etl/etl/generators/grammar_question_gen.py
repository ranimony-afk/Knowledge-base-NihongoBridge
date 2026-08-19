from __future__ import annotations

import re
from collections.abc import Callable

from etl.enrichers.furigana_enricher import FuriganaEnricher
from etl.generators.base import BaseQuestionGenerator
from etl.generators.helpers import (
    QuestionGenerationError,
    literal_grammar_pattern,
    make_options,
    provenance,
)
from etl.generators.models import GeneratedQuestion, GrammarItem, JlptLevel, SentenceItem
from etl.generators.quality_checker import QualityChecker
from etl.generators.repository import KnowledgeRepository

_DIFFICULTY = {"N5": 1, "N4": 2, "N3": 3, "N2": 4, "N1": 5}
_PARTICLES = ("を", "は", "が", "に", "で", "と")


class GrammarQuestionGenerator(BaseQuestionGenerator):
    """Generate completion, error-identification, and sentence-order questions."""

    section = "grammar"

    def __init__(
        self,
        repository: KnowledgeRepository,
        *,
        furigana: FuriganaEnricher | None = None,
        quality_checker: QualityChecker | None = None,
        seed: int | None = None,
    ) -> None:
        super().__init__(repository, quality_checker=quality_checker, seed=seed)
        self.furigana = furigana or FuriganaEnricher()

    async def _build(self, level: JlptLevel, count: int) -> list[GeneratedQuestion]:
        grammar = await self.repository.load_grammar(level, limit=max(100, count * 20))
        sentences = await self.repository.load_sentences(level, limit=max(500, count * 50))
        if len(grammar) < 4 or len(sentences) < 4:
            raise QuestionGenerationError(
                f"At least four {level} grammar patterns and sentences are required"
            )

        builders: tuple[Callable[[int], GeneratedQuestion], ...] = (
            lambda index: self._completion(grammar, sentences, level, index),
            lambda index: self._error_identification(sentences, level, index),
            lambda index: self._sentence_ordering(sentences, level, index),
        )
        output: list[GeneratedQuestion] = []
        fingerprints: set[str] = set()
        attempts = 0
        while len(output) < count and attempts < count * 40:
            try:
                question = builders[attempts % len(builders)](attempts)
            except QuestionGenerationError:
                attempts += 1
                continue
            if question.fingerprint not in fingerprints:
                output.append(question)
                fingerprints.add(question.fingerprint)
            attempts += 1
        if len(output) < count:
            raise QuestionGenerationError(
                f"Knowledge base supports only {len(output)} unique grammar questions"
            )
        return output

    def _completion(
        self,
        grammar: list[GrammarItem],
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> GeneratedQuestion:
        grammar_by_id = {item.id: item for item in grammar}
        eligible: list[tuple[SentenceItem, GrammarItem, str]] = []
        for sentence in sentences:
            for grammar_id in sentence.grammar_ids:
                item = grammar_by_id.get(grammar_id)
                if not item:
                    continue
                literal = literal_grammar_pattern(item.pattern)
                if literal and literal in sentence.japanese:
                    eligible.append((sentence, item, literal))
        if not eligible:
            raise QuestionGenerationError("No linked sentence contains its literal grammar pattern")
        sentence, item, literal = eligible[index % len(eligible)]
        prompt = sentence.japanese.replace(literal, "\uff3f" * 3, 1)
        options, answer = make_options(
            item.pattern,
            [candidate.pattern for candidate in grammar if candidate.id != item.id],
            self.rng,
        )
        meaning = item.meaning("en") or "the target grammar meaning"
        return GeneratedQuestion(
            section_type="grammar",
            question_jp=f"文に入る最も適切な文法表現を選んでください。\n{prompt}",
            question_en="Choose the grammar expression that best completes the sentence.",
            stimulus={
                "generation_type": "grammar_completion",
                "sentence": prompt,
                "provenance": provenance([sentence.id, item.id], method="linked-grammar-blank"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"元の文では「{item.pattern}」を使います。{item.formation or ''}",
            explanation_en=f"The sentence uses {item.pattern}, meaning “{meaning}.”",
            vocabulary_ids=sentence.vocabulary_ids,
            grammar_ids=[item.id],
            difficulty=_DIFFICULTY[level],
            jlpt_level=level,
            time_limit_seconds=45,
            tags=["generated", "original", "grammar-completion"],
        )

    def _error_identification(
        self,
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> GeneratedQuestion:
        start = index % len(sentences)
        selected = [sentences[(start + offset) % len(sentences)] for offset in range(4)]
        if len({sentence.id for sentence in selected}) < 4:
            raise QuestionGenerationError("Four distinct sentences are required")
        invalid_source = selected[index % 4]
        invalid_sentence, error = self._duplicate_particle(invalid_source.japanese)
        valid_sentences = [
            sentence.japanese for sentence in selected if sentence.id != invalid_source.id
        ]
        options, answer = make_options(invalid_sentence, valid_sentences, self.rng)
        return GeneratedQuestion(
            section_type="grammar",
            question_jp="次の中から、文法的に誤っている文を一つ選んでください。",
            question_en="Choose the one sentence that is grammatically incorrect.",
            stimulus={
                "generation_type": "grammar_error_identification",
                "provenance": provenance(
                    [sentence.id for sentence in selected],
                    method="controlled-particle-duplication",
                ),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"誤りの文では助詞「{error}」が重複しています。",
            explanation_en=f"The incorrect sentence duplicates the particle {error}.",
            vocabulary_ids=list(
                dict.fromkeys(
                    vocabulary_id
                    for sentence in selected
                    for vocabulary_id in sentence.vocabulary_ids
                )
            ),
            grammar_ids=list(
                dict.fromkeys(
                    grammar_id for sentence in selected for grammar_id in sentence.grammar_ids
                )
            ),
            difficulty=min(5, _DIFFICULTY[level] + 1),
            jlpt_level=level,
            time_limit_seconds=60,
            tags=["generated", "original", "error-identification"],
        )

    def _sentence_ordering(
        self,
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> GeneratedQuestion:
        sentence = sentences[index % len(sentences)]
        surfaces = [
            token.surface for token in self.furigana.tokenize(sentence.japanese) if token.surface
        ]
        if len(surfaces) < 4:
            raise QuestionGenerationError("Sentence has fewer than four tokens")
        parts = self._four_chunks(surfaces)
        correct = " / ".join(parts)
        distractors: list[str] = []
        attempts = 0
        while len(distractors) < 3 and attempts < 30:
            shuffled = parts.copy()
            self.rng.shuffle(shuffled)
            candidate = " / ".join(shuffled)
            if candidate != correct and candidate not in distractors:
                distractors.append(candidate)
            attempts += 1
        options, answer = make_options(correct, distractors, self.rng)
        jumbled = parts.copy()
        for _ in range(20):
            self.rng.shuffle(jumbled)
            if jumbled != parts:
                break
        if jumbled == parts:
            raise QuestionGenerationError("Sentence parts cannot be visibly jumbled")
        return GeneratedQuestion(
            section_type="grammar",
            question_jp="語句を正しい順番に並べたものを選んでください。",
            question_en="Choose the option that arranges the parts in the correct order.",
            stimulus={
                "generation_type": "grammar_sentence_ordering",
                "jumbled_parts": jumbled,
                "provenance": provenance([sentence.id], method="token-order-permutation"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"正しい文は「{sentence.japanese}」です。",
            explanation_en=f"The correct sentence is “{sentence.japanese}.”",
            vocabulary_ids=sentence.vocabulary_ids,
            grammar_ids=sentence.grammar_ids,
            difficulty=min(5, _DIFFICULTY[level] + 1),
            jlpt_level=level,
            time_limit_seconds=60,
            tags=["generated", "original", "sentence-ordering"],
        )

    @staticmethod
    def _duplicate_particle(sentence: str) -> tuple[str, str]:
        for particle in _PARTICLES:
            if particle in sentence:
                return sentence.replace(particle, particle * 2, 1), particle
        punctuation = re.search(r"[。\uff01\uff1f!?]$", sentence)
        if punctuation:
            return f"{sentence[:-1]}をを{sentence[-1]}", "を"
        return f"{sentence}をを", "を"

    @staticmethod
    def _four_chunks(surfaces: list[str]) -> list[str]:
        boundaries = [round(len(surfaces) * index / 4) for index in range(5)]
        return ["".join(surfaces[boundaries[index] : boundaries[index + 1]]) for index in range(4)]
