from __future__ import annotations

from collections.abc import Iterable
from pathlib import Path
from typing import Self

from etl.config import Settings
from etl.generators.base import BaseQuestionGenerator, GenerationResult
from etl.generators.helpers import QuestionGenerationError, make_options, provenance
from etl.generators.models import GeneratedQuestion, JlptLevel, SentenceItem
from etl.generators.quality_checker import QualityChecker
from etl.generators.repository import KnowledgeRepository
from etl.storage.minio_client import MinioStorage
from etl.utils.tts_client import DialogueLine, EdgeTTSClient

_DIFFICULTY = {"N5": 1, "N4": 2, "N3": 3, "N2": 4, "N1": 5}


class ListeningQuestionGenerator(BaseQuestionGenerator):
    """Generate original listening scripts, alternating-voice audio, and questions."""

    section = "listening"

    def __init__(
        self,
        repository: KnowledgeRepository,
        *,
        tts: EdgeTTSClient,
        storage: MinioStorage,
        bucket: str,
        temp_directory: Path,
        quality_checker: QualityChecker | None = None,
        seed: int | None = None,
    ) -> None:
        super().__init__(repository, quality_checker=quality_checker, seed=seed)
        self.tts = tts
        self.storage = storage
        self.bucket = bucket
        self.temp_directory = temp_directory
        self.temp_directory.mkdir(parents=True, exist_ok=True)

    @classmethod
    async def from_settings(
        cls,
        repository: KnowledgeRepository,
        settings: Settings,
        *,
        quality_checker: QualityChecker | None = None,
        seed: int | None = None,
    ) -> Self:
        storage = MinioStorage(
            settings.minio_endpoint,
            settings.minio_access_key,
            settings.minio_secret_key,
            public_url=settings.minio_public_url,
        )
        await storage.ensure_bucket(
            settings.minio_audio_bucket,
            public_read=settings.minio_public_read,
        )
        tts = EdgeTTSClient(
            female_voice=settings.edge_tts_female_voice,
            male_voice=settings.edge_tts_male_voice,
            rate=settings.edge_tts_rate,
            volume=settings.edge_tts_volume,
            requests_per_second=settings.tts_requests_per_second,
            concurrency=settings.tts_concurrency,
            retries=settings.tts_retries,
        )
        return cls(
            repository,
            tts=tts,
            storage=storage,
            bucket=settings.minio_audio_bucket,
            temp_directory=settings.tts_temp_dir / "questions",
            quality_checker=quality_checker,
            seed=seed,
        )

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
        for question in questions:
            self.quality_checker.assert_valid(question)
        uploaded = {str(question.id): f"questions/{question.id}.mp3" for question in questions}
        try:
            inserted_ids = await self.repository.insert_questions(questions) if persist else []
        except Exception:
            await self._remove_uploaded(uploaded.values())
            raise
        if persist:
            rejected_objects = [
                object_name
                for question_id, object_name in uploaded.items()
                if question_id not in set(inserted_ids)
            ]
            await self._remove_uploaded(rejected_objects)
        return GenerationResult(questions=questions, inserted_ids=inserted_ids)

    async def _build(self, level: JlptLevel, count: int) -> list[GeneratedQuestion]:
        sentences = await self.repository.load_sentences(level, limit=max(500, count * 60))
        if len(sentences) < 8:
            raise QuestionGenerationError("At least eight sentences are required for listening")

        output: list[GeneratedQuestion] = []
        attempts = 0
        while len(output) < count and attempts < count * 20:
            mode = attempts % 3
            if mode == 0:
                question, dialogue = self._dialogue(sentences, level, attempts)
                self.quality_checker.assert_valid(question)
                await self._attach_dialogue_audio(question, dialogue)
            elif mode == 1:
                question, script = self._monologue(sentences, level, attempts)
                self.quality_checker.assert_valid(question)
                await self._attach_single_audio(question, script, female=True)
            else:
                question, script = self._quick_response(sentences, level, attempts)
                self.quality_checker.assert_valid(question)
                await self._attach_single_audio(question, script, female=False)
            if all(existing.fingerprint != question.fingerprint for existing in output):
                output.append(question)
            else:
                await self.storage.remove_object(self.bucket, f"questions/{question.id}.mp3")
            attempts += 1
        if len(output) < count:
            await self._remove_uploaded(f"questions/{question.id}.mp3" for question in output)
            raise QuestionGenerationError(
                f"Knowledge base supports only {len(output)} unique listening questions"
            )
        return output

    def _dialogue(
        self,
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> tuple[GeneratedQuestion, list[DialogueLine]]:
        first = sentences[index % len(sentences)]
        second = sentences[(index + 1) % len(sentences)]
        if first.id == second.id:
            raise QuestionGenerationError("Dialogue requires two distinct sentences")
        dialogue = [
            DialogueLine(first.japanese, speaker="A"),
            DialogueLine(f"そうですね。{second.japanese}", speaker="B"),
        ]
        excluded = {first.id, second.id}
        distractors = [sentence for sentence in sentences if sentence.id not in excluded]
        options, answer = make_options(
            second.japanese,
            [sentence.japanese for sentence in distractors],
            self.rng,
        )
        question = GeneratedQuestion(
            section_type="listening",
            question_jp="二人目の人が伝えた内容として最も適切なものを選んでください。",
            question_en="Choose the statement that best matches what the second speaker says.",
            stimulus={
                "generation_type": "listening_dialogue",
                "transcript": [{"speaker": line.speaker, "text": line.text} for line in dialogue],
                "transcript_review_only": True,
                "voices": [self.tts.female_voice, self.tts.male_voice],
                "provenance": provenance(
                    [first.id, second.id], method="two-sentence-dialogue-synthesis"
                ),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"二人目の人は「{second.japanese}」と伝えています。",
            explanation_en=f"The second speaker says “{second.japanese}.”",
            vocabulary_ids=list(dict.fromkeys([*first.vocabulary_ids, *second.vocabulary_ids])),
            grammar_ids=list(dict.fromkeys([*first.grammar_ids, *second.grammar_ids])),
            difficulty=_DIFFICULTY[level],
            jlpt_level=level,
            time_limit_seconds=60,
            tags=["generated", "original", "listening-dialogue"],
        )
        return question, dialogue

    def _monologue(
        self,
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> tuple[GeneratedQuestion, str]:
        selected = [sentences[(index + offset) % len(sentences)] for offset in range(3)]
        script = "".join(sentence.japanese for sentence in selected)
        correct = selected[-1]
        selected_ids = {sentence.id for sentence in selected}
        distractors = [sentence for sentence in sentences if sentence.id not in selected_ids]
        options, answer = make_options(
            correct.japanese,
            [sentence.japanese for sentence in distractors],
            self.rng,
        )
        question = GeneratedQuestion(
            section_type="listening",
            question_jp="話の最後に述べられたことを選んでください。",
            question_en="Choose what was stated at the end of the monologue.",
            stimulus={
                "generation_type": "listening_monologue",
                "transcript": [{"speaker": "narrator", "text": script}],
                "transcript_review_only": True,
                "voices": [self.tts.female_voice],
                "provenance": provenance(
                    [sentence.id for sentence in selected],
                    method="three-sentence-monologue-synthesis",
                ),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"話の最後は「{correct.japanese}」です。",
            explanation_en=f"The monologue ends with “{correct.japanese}.”",
            vocabulary_ids=list(
                dict.fromkeys(value for sentence in selected for value in sentence.vocabulary_ids)
            ),
            grammar_ids=list(
                dict.fromkeys(value for sentence in selected for value in sentence.grammar_ids)
            ),
            difficulty=min(5, _DIFFICULTY[level] + 1),
            jlpt_level=level,
            time_limit_seconds=75,
            tags=["generated", "original", "listening-monologue"],
        )
        return question, script

    def _quick_response(
        self,
        sentences: list[SentenceItem],
        level: JlptLevel,
        index: int,
    ) -> tuple[GeneratedQuestion, str]:
        sentence = sentences[index % len(sentences)]
        script = sentence.japanese
        if "ありがとう" in script:
            correct = "どういたしまして。"
        elif script.rstrip().endswith(("か。", "か\uff1f", "か?")):
            correct = "はい、そうです。"
        else:
            correct = "そうですか。"
        replies = [
            "どういたしまして。",
            "はい、そうです。",
            "そうですか。",
            "すみません、わかりません。",
            "いいえ、ちがいます。",
        ]
        options, answer = make_options(
            correct,
            [reply for reply in replies if reply != correct],
            self.rng,
        )
        question = GeneratedQuestion(
            section_type="listening",
            question_jp="発話に対する最も自然な返事を選んでください。",
            question_en="Choose the most natural response to the utterance.",
            stimulus={
                "generation_type": "listening_quick_response",
                "transcript": [{"speaker": "A", "text": script}],
                "transcript_review_only": True,
                "voices": [self.tts.male_voice],
                "provenance": provenance([sentence.id], method="controlled-response-template"),
            },
            options=options,
            correct_answer=answer,
            explanation_jp=f"この発話への自然な返事は「{correct}」です。",
            explanation_en=f"A natural response is “{correct}.”",
            vocabulary_ids=sentence.vocabulary_ids,
            grammar_ids=sentence.grammar_ids,
            difficulty=_DIFFICULTY[level],
            jlpt_level=level,
            time_limit_seconds=30,
            tags=["generated", "original", "listening-quick-response"],
        )
        return question, script

    async def _attach_dialogue_audio(
        self,
        question: GeneratedQuestion,
        lines: list[DialogueLine],
    ) -> None:
        local_path = self.temp_directory / f"{question.id}.mp3"
        object_name = f"questions/{question.id}.mp3"
        try:
            await self.tts.synthesize_dialogue(lines, local_path)
            question.audio_url = await self.storage.upload_file(
                self.bucket,
                object_name,
                local_path,
                content_type="audio/mpeg",
            )
        finally:
            local_path.unlink(missing_ok=True)

    async def _attach_single_audio(
        self,
        question: GeneratedQuestion,
        script: str,
        *,
        female: bool,
    ) -> None:
        local_path = self.temp_directory / f"{question.id}.mp3"
        object_name = f"questions/{question.id}.mp3"
        voice = self.tts.female_voice if female else self.tts.male_voice
        try:
            await self.tts.synthesize(script, local_path, voice=voice)
            question.audio_url = await self.storage.upload_file(
                self.bucket,
                object_name,
                local_path,
                content_type="audio/mpeg",
            )
        finally:
            local_path.unlink(missing_ok=True)

    async def _remove_uploaded(self, object_names: Iterable[str]) -> None:
        for object_name in object_names:
            try:
                await self.storage.remove_object(self.bucket, str(object_name))
            except Exception:
                pass
