from __future__ import annotations

from collections.abc import Callable

from etl.generators.base import BaseQuestionGenerator
from etl.generators.helpers import (
    QuestionGenerationError,
    make_options,
    provenance,
    reading_similarity,
    shared_character_score,
)
from etl.generators.models import GeneratedQuestion, JlptLevel, SentenceItem, VocabularyItem

_DIFFICULTY = {"N5": 1, "N4": 2, "N3": 3, "N2": 4, "N1": 5}


class VocabularyQuestionGenerator(BaseQuestionGenerator):
    """Generate original reading, meaning, and contextual vocabulary questions."""

    section = "vocabulary"

    async def _build(self, level: JlptLevel, count: int) -> list[GeneratedQuestion]:
        vocabulary = await self.repository.load_vocabulary(level, limit=max(300, count * 40))
        sentences = await self.repository.load_sentences(level, limit=max(500, count * 50))
        if len(vocabulary) < 4:
            raise QuestionGenerationError(f"At least four {level} vocabulary entries are required")

        builders: tuple[Callable[[int], GeneratedQuestion], ...] = (
            lambda index: self._reading_question(vocabulary, level, index),
            lambda index: self._meaning_question(vocabulary, level, index),
            lambda index: self._blank_question(vocabulary, sentences, level, index),
        )
        questions: list[GeneratedQuestion] = []
        fingerprints: set[str] = set()
        attempts = 0
        while len(questions) < count and attempts < count * 30:
            builder = builders[attempts % len(builders)]
            try:
                question = builder(attempts)
            except QuestionGenerationError:
                attempts += 1
                continue
            if question.fingerprint not in fingerprints:
                questions.append(question)
                fingerprints.add(question.fingerprint)
            attempts += 1
        if len(questions) < count:
            raise QuestionGenerationError(
                f"Knowledge base supports only {len(questions)} unique vocabulary questions"
            )
        return questions

    def _reading_question(
        self,
        vocabulary: list[VocabularyItem],
        level: JlptLevel,
        index: int,
    ) -> GeneratedQuestion:
        eligible = [item for item in vocabulary if item.kana and item.kana != item.word]
        if not eligible:
            raise QuestionGenerationError("No kanji vocabulary with readings is available")
        item = eligible[index % len(eligible)]
        ranked = sorted(
            (
                candidate
                for candidate in eligible
                if candidate.id != item.id and candidate.kana != item.kana
            ),
            key=lambda candidate: (
                shared_character_score(item.word, candidate.word),
                reading_similarity(item.kana or "", candidate.kana or ""),
                -(candidate.frequency_rank or 2_147_483_647),
            ),
            reverse=True,
        )
        options, answer = make_options(
            item.kana or "",
            [candidate.kana or "" for candidate in ranked],
            self.rng,
        )
        return GeneratedQuestion(
            section_type="vocabulary",
            question_jp=f"「{item.word}」の読み方として最も適切なものを選んでください。",
            question_en=f"Choose the most appropriate reading of {item.word}.",
            stimulus={
                "generation_type": "vocabulary_reading",
                "word": item.word,
                "provenance": provenance(
                    [item.id, *(candidate.id for candidate in ranked[:8])],
                    method="reading-similarity",
                ),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"「{item.word}」は「{item.kana}」と読みます。",
            explanation_en=f"{item.word} is read {item.kana}.",
            vocabulary_ids=[item.id],
            grammar_ids=[],
            difficulty=_DIFFICULTY[level],
            jlpt_level=level,
            time_limit_seconds=30,
            tags=["generated", "original", "reading-selection"],
        )

    def _meaning_question(
        self,
        vocabulary: list[VocabularyItem],
        level: JlptLevel,
        index: int,
    ) -> GeneratedQuestion:
        tamil_available = [item for item in vocabulary if item.meaning("ta")]
        language = "ta" if tamil_available and index % 2 else "en"
        eligible = [item for item in vocabulary if item.meaning(language)]
        if len(eligible) < 4:
            language = "en"
            eligible = [item for item in vocabulary if item.meaning("en")]
        if len(eligible) < 4:
            raise QuestionGenerationError("Fewer than four vocabulary meanings are available")
        item = eligible[index % len(eligible)]
        correct = item.meaning(language)
        if not correct:
            raise QuestionGenerationError("Selected vocabulary entry has no target meaning")
        distractors = [
            meaning
            for candidate in eligible
            if candidate.id != item.id
            and (meaning := candidate.meaning(language))
            and meaning != correct
        ]
        options, answer = make_options(correct, distractors, self.rng)
        language_name = "Tamil" if language == "ta" else "English"
        return GeneratedQuestion(
            section_type="vocabulary",
            question_jp=f"「{item.word}」の{language_name}の意味として最も適切なものを選んでください。",
            question_en=f"Choose the best {language_name} meaning of {item.word}.",
            stimulus={
                "generation_type": "vocabulary_meaning",
                "word": item.word,
                "reading": item.kana,
                "target_language": language,
                "provenance": provenance(
                    [candidate.id for candidate in eligible[:20]], method="meaning-selection"
                ),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"「{item.word}」の意味は「{correct}」です。",
            explanation_en=f"The {language_name} meaning of {item.word} is “{correct}.”",
            vocabulary_ids=[item.id],
            grammar_ids=[],
            difficulty=_DIFFICULTY[level],
            jlpt_level=level,
            time_limit_seconds=35,
            tags=["generated", "original", "meaning-selection", f"language:{language}"],
        )

    def _blank_question(
        self,
        vocabulary: list[VocabularyItem],
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> GeneratedQuestion:
        vocabulary_by_id = {item.id: item for item in vocabulary}
        eligible: list[tuple[SentenceItem, VocabularyItem]] = []
        for sentence in sentences:
            for vocabulary_id in sentence.vocabulary_ids:
                item = vocabulary_by_id.get(vocabulary_id)
                if item and item.word in sentence.japanese:
                    eligible.append((sentence, item))
        if not eligible:
            raise QuestionGenerationError(
                "No level-tagged sentence contains a linked vocabulary word"
            )
        sentence, item = eligible[index % len(eligible)]
        prompt = sentence.japanese.replace(item.word, "\uff3f" * 3, 1)
        distractors = sorted(
            (candidate for candidate in vocabulary if candidate.id != item.id),
            key=lambda candidate: bool(set(candidate.part_of_speech) & set(item.part_of_speech)),
            reverse=True,
        )
        options, answer = make_options(
            item.word,
            [candidate.word for candidate in distractors],
            self.rng,
        )
        translation = sentence.translation("en") or ""
        return GeneratedQuestion(
            section_type="vocabulary",
            question_jp=f"文の意味に合う言葉を選んでください。\n{prompt}",
            question_en="Choose the word that best completes the sentence.",
            stimulus={
                "generation_type": "vocabulary_fill_blank",
                "sentence": prompt,
                "translation": translation,
                "provenance": provenance([sentence.id, item.id], method="linked-sentence-blank"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"元の文は「{sentence.japanese}」です。",
            explanation_en=(
                f"The original sentence is “{sentence.japanese}.”"
                + (f" It means “{translation}.”" if translation else "")
            ),
            vocabulary_ids=list(dict.fromkeys([item.id, *sentence.vocabulary_ids])),
            grammar_ids=sentence.grammar_ids,
            difficulty=min(5, _DIFFICULTY[level] + 1),
            jlpt_level=level,
            time_limit_seconds=45,
            tags=["generated", "original", "fill-in-the-blank"],
        )
