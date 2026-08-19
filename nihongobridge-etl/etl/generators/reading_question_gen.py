from __future__ import annotations

import hashlib

from etl.generators.base import BaseQuestionGenerator
from etl.generators.helpers import QuestionGenerationError, make_options, provenance
from etl.generators.models import GeneratedQuestion, JlptLevel, SentenceItem, VocabularyItem

_DIFFICULTY = {"N5": 1, "N4": 2, "N3": 3, "N2": 4, "N1": 5}


class ReadingQuestionGenerator(BaseQuestionGenerator):
    """Build original short, medium, and notice passages from knowledge-base sentences."""

    section = "reading"

    async def _build(self, level: JlptLevel, count: int) -> list[GeneratedQuestion]:
        sentences = await self.repository.load_sentences(level, limit=max(1_000, count * 100))
        vocabulary = await self.repository.load_vocabulary(level, limit=max(500, count * 30))
        if len(sentences) < 12:
            raise QuestionGenerationError("At least twelve level-tagged sentences are required")

        output: list[GeneratedQuestion] = []
        group_index = 0
        attempts = 0
        while len(output) < count and attempts < count * 15:
            mode = group_index % 3
            try:
                if mode == 0:
                    passage_sentences = self._passage(sentences, group_index, 100, 200)
                    generated = [
                        self._statement_question(
                            passage_sentences,
                            sentences,
                            level,
                            generation_type="reading_short",
                            question_kind="main_idea",
                            correct_index=0,
                        ),
                        self._statement_question(
                            passage_sentences,
                            sentences,
                            level,
                            generation_type="reading_short",
                            question_kind="specific_detail",
                            correct_index=-1,
                        ),
                    ]
                elif mode == 1:
                    passage_sentences = self._passage(sentences, group_index, 300, 500)
                    try:
                        third_question = (
                            self._vocabulary_context_question(
                                passage_sentences,
                                vocabulary,
                                level,
                            )
                            if group_index % 2
                            else self._author_intent_question(
                                passage_sentences,
                                sentences,
                                level,
                            )
                        )
                    except QuestionGenerationError:
                        third_question = self._author_intent_question(
                            passage_sentences,
                            sentences,
                            level,
                        )
                    generated = [
                        self._statement_question(
                            passage_sentences,
                            sentences,
                            level,
                            generation_type="reading_medium",
                            question_kind="main_idea",
                            correct_index=0,
                        ),
                        self._statement_question(
                            passage_sentences,
                            sentences,
                            level,
                            generation_type="reading_medium",
                            question_kind="specific_detail",
                            correct_index=len(passage_sentences) // 2,
                        ),
                        third_question,
                    ]
                else:
                    passage_sentences = self._passage(sentences, group_index, 60, 220)
                    generated = [
                        self._information_retrieval_question(
                            passage_sentences,
                            sentences,
                            level,
                        )
                    ]
                for question in generated:
                    if len(output) < count and all(
                        existing.fingerprint != question.fingerprint for existing in output
                    ):
                        output.append(question)
            except QuestionGenerationError:
                pass
            group_index += 1
            attempts += 1
        if len(output) < count:
            raise QuestionGenerationError(
                f"Knowledge base supports only {len(output)} unique reading questions"
            )
        return output

    def _passage(
        self,
        sentences: list[SentenceItem],
        seed_index: int,
        minimum: int,
        maximum: int,
    ) -> list[SentenceItem]:
        anchor = sentences[seed_index % len(sentences)]
        shared_tags = set(anchor.tags)
        related = [
            sentence
            for sentence in sentences
            if sentence.id != anchor.id and shared_tags.intersection(sentence.tags)
        ]
        remaining = [
            sentence
            for sentence in sentences
            if sentence.id != anchor.id and sentence not in related
        ]
        candidates = [anchor, *related, *remaining]
        selected: list[SentenceItem] = []
        length = 0
        for sentence in candidates:
            sentence_length = len(sentence.japanese)
            if length + sentence_length > maximum:
                continue
            selected.append(sentence)
            length += sentence_length
            if length >= minimum:
                break
        if not minimum <= length <= maximum:
            raise QuestionGenerationError(
                f"Could not assemble a {minimum}-{maximum} character passage"
            )
        return selected

    def _statement_question(
        self,
        passage_sentences: list[SentenceItem],
        all_sentences: list[SentenceItem],
        level: JlptLevel,
        *,
        generation_type: str,
        question_kind: str,
        correct_index: int,
    ) -> GeneratedQuestion:
        passage = "".join(sentence.japanese for sentence in passage_sentences)
        correct_sentence = passage_sentences[correct_index]
        passage_ids = [sentence.id for sentence in passage_sentences]
        passage_id_set = set(passage_ids)
        distractor_items = [
            sentence for sentence in all_sentences if sentence.id not in passage_id_set
        ]
        english_labels = {
            sentence.japanese: sentence.translation("en") or ""
            for sentence in [correct_sentence, *distractor_items[:20]]
        }
        options, answer = make_options(
            correct_sentence.japanese,
            [sentence.japanese for sentence in distractor_items],
            self.rng,
            english_labels=english_labels,
        )
        prompt_jp = (
            "本文の中心となる内容として最も適切なものを選んでください。"
            if question_kind == "main_idea"
            else "本文の内容と合っているものを選んでください。"
        )
        prompt_en = (
            "Choose the statement that best represents the passage's main idea."
            if question_kind == "main_idea"
            else "Choose the statement that agrees with a specific detail in the passage."
        )
        return GeneratedQuestion(
            section_type="reading",
            question_jp=prompt_jp,
            question_en=prompt_en,
            stimulus={
                "generation_type": generation_type,
                "question_kind": question_kind,
                "passage": passage,
                "passage_id": hashlib.sha256(passage.encode()).hexdigest()[:16],
                "provenance": provenance(passage_ids, method="related-sentence-combination"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"本文には「{correct_sentence.japanese}」と書かれています。",
            explanation_en=(
                f"The passage explicitly contains “{correct_sentence.japanese}.”"
                + (
                    f" It means “{correct_sentence.translation('en')}.”"
                    if correct_sentence.translation("en")
                    else ""
                )
            ),
            vocabulary_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.vocabulary_ids
                )
            ),
            grammar_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.grammar_ids
                )
            ),
            difficulty=min(
                5, _DIFFICULTY[level] + (1 if generation_type == "reading_medium" else 0)
            ),
            jlpt_level=level,
            time_limit_seconds=180 if generation_type == "reading_short" else 300,
            tags=["generated", "original", generation_type, question_kind],
        )

    def _vocabulary_context_question(
        self,
        passage_sentences: list[SentenceItem],
        vocabulary: list[VocabularyItem],
        level: JlptLevel,
    ) -> GeneratedQuestion:
        vocabulary_by_id = {item.id: item for item in vocabulary}
        linked = [
            vocabulary_by_id[vocabulary_id]
            for sentence in passage_sentences
            for vocabulary_id in sentence.vocabulary_ids
            if vocabulary_id in vocabulary_by_id
            and vocabulary_by_id[vocabulary_id].word in sentence.japanese
            and vocabulary_by_id[vocabulary_id].meaning("en")
        ]
        if not linked:
            raise QuestionGenerationError("Passage has no linked vocabulary meaning")
        item = linked[0]
        meaning = item.meaning("en")
        if not meaning:
            raise QuestionGenerationError("Vocabulary meaning is unavailable")
        distractors = [
            candidate.meaning("en")
            for candidate in vocabulary
            if candidate.id != item.id and candidate.meaning("en")
        ]
        options, answer = make_options(meaning, [value for value in distractors if value], self.rng)
        passage = "".join(sentence.japanese for sentence in passage_sentences)
        source_ids = [sentence.id for sentence in passage_sentences]
        return GeneratedQuestion(
            section_type="reading",
            question_jp=f"本文の中の「{item.word}」は、どのような意味ですか。",
            question_en=f"What does {item.word} mean in this passage?",
            stimulus={
                "generation_type": "reading_medium",
                "question_kind": "vocabulary_in_context",
                "passage": passage,
                "passage_id": hashlib.sha256(passage.encode()).hexdigest()[:16],
                "provenance": provenance([*source_ids, item.id], method="context-vocabulary-link"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"「{item.word}」の意味は「{meaning}」です。",
            explanation_en=f"In this context, {item.word} means “{meaning}.”",
            vocabulary_ids=list(
                dict.fromkeys(
                    [
                        item.id,
                        *(
                            value
                            for sentence in passage_sentences
                            for value in sentence.vocabulary_ids
                        ),
                    ]
                )
            ),
            grammar_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.grammar_ids
                )
            ),
            difficulty=min(5, _DIFFICULTY[level] + 1),
            jlpt_level=level,
            time_limit_seconds=300,
            tags=["generated", "original", "reading_medium", "vocabulary-in-context"],
        )

    def _author_intent_question(
        self,
        passage_sentences: list[SentenceItem],
        all_sentences: list[SentenceItem],
        level: JlptLevel,
    ) -> GeneratedQuestion:
        passage = "".join(sentence.japanese for sentence in passage_sentences)
        conclusion = passage_sentences[-1]
        passage_ids = [sentence.id for sentence in passage_sentences]
        passage_id_set = set(passage_ids)
        distractors = [sentence for sentence in all_sentences if sentence.id not in passage_id_set]
        options, answer = make_options(
            conclusion.japanese,
            [sentence.japanese for sentence in distractors],
            self.rng,
        )
        return GeneratedQuestion(
            section_type="reading",
            question_jp="筆者が最後に最も伝えたいことは何ですか。",
            question_en="What does the writer most want to communicate at the end?",
            stimulus={
                "generation_type": "reading_medium",
                "question_kind": "author_intent",
                "passage": passage,
                "passage_id": hashlib.sha256(passage.encode()).hexdigest()[:16],
                "provenance": provenance(passage_ids, method="conclusion-intent-synthesis"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"文章の結びは「{conclusion.japanese}」で、これが最後の主張です。",
            explanation_en=(
                f"The passage concludes with “{conclusion.japanese},” "
                "which expresses its final intent."
            ),
            vocabulary_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.vocabulary_ids
                )
            ),
            grammar_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.grammar_ids
                )
            ),
            difficulty=min(5, _DIFFICULTY[level] + 1),
            jlpt_level=level,
            time_limit_seconds=300,
            tags=["generated", "original", "reading_medium", "author-intent"],
        )

    def _information_retrieval_question(
        self,
        passage_sentences: list[SentenceItem],
        all_sentences: list[SentenceItem],
        level: JlptLevel,
    ) -> GeneratedQuestion:
        notice = "【お知らせ】" + "".join(sentence.japanese for sentence in passage_sentences)
        correct_sentence = passage_sentences[-1]
        source_ids = [sentence.id for sentence in passage_sentences]
        source_id_set = set(source_ids)
        distractors = [sentence for sentence in all_sentences if sentence.id not in source_id_set]
        options, answer = make_options(
            correct_sentence.japanese,
            [sentence.japanese for sentence in distractors],
            self.rng,
        )
        return GeneratedQuestion(
            section_type="reading",
            question_jp="このお知らせに書かれていることを選んでください。",
            question_en="Choose the information stated in this notice.",
            stimulus={
                "generation_type": "reading_information_retrieval",
                "question_kind": "information_retrieval",
                "passage": notice,
                "provenance": provenance(source_ids, method="notice-sentence-combination"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"お知らせには「{correct_sentence.japanese}」とあります。",
            explanation_en=f"The notice states “{correct_sentence.japanese}.”",
            vocabulary_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.vocabulary_ids
                )
            ),
            grammar_ids=list(
                dict.fromkeys(
                    value for sentence in passage_sentences for value in sentence.grammar_ids
                )
            ),
            difficulty=_DIFFICULTY[level],
            jlpt_level=level,
            time_limit_seconds=180,
            tags=["generated", "original", "information-retrieval", "notice"],
        )
