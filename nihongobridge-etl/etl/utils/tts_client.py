from __future__ import annotations

import asyncio
import time
from dataclasses import dataclass
from pathlib import Path
from tempfile import TemporaryDirectory

import edge_tts


class TTSGenerationError(RuntimeError):
    """Raised after Edge TTS retries are exhausted."""


class AsyncRateLimiter:
    """Start-rate limiter that spaces requests evenly across each second."""

    def __init__(self, requests_per_second: float) -> None:
        if requests_per_second <= 0:
            raise ValueError("requests_per_second must be positive")
        self.interval = 1 / requests_per_second
        self._next_start = 0.0
        self._lock = asyncio.Lock()

    async def acquire(self) -> None:
        async with self._lock:
            now = time.monotonic()
            delay = self._next_start - now
            if delay > 0:
                await asyncio.sleep(delay)
            self._next_start = max(self._next_start, time.monotonic()) + self.interval


@dataclass(frozen=True, slots=True)
class DialogueLine:
    text: str
    speaker: str | None = None


class EdgeTTSClient:
    """Rate-limited, retrying Edge TTS client with atomic MP3 output."""

    def __init__(
        self,
        *,
        female_voice: str = "ja-JP-NanamiNeural",
        male_voice: str = "ja-JP-KeitaNeural",
        rate: str = "+0%",
        volume: str = "+0%",
        requests_per_second: float = 10,
        concurrency: int = 4,
        retries: int = 3,
    ) -> None:
        self.female_voice = female_voice
        self.male_voice = male_voice
        self.rate = rate
        self.volume = volume
        self.retries = retries
        self.rate_limiter = AsyncRateLimiter(requests_per_second)
        self.semaphore = asyncio.Semaphore(concurrency)

    async def synthesize(
        self,
        text: str,
        output_path: Path,
        *,
        voice: str | None = None,
    ) -> Path:
        normalized = text.strip()
        if not normalized:
            raise ValueError("TTS text cannot be empty")
        output_path.parent.mkdir(parents=True, exist_ok=True)
        temporary = output_path.with_suffix(".part.mp3")
        selected_voice = voice or self.female_voice
        last_error: Exception | None = None

        async with self.semaphore:
            for attempt in range(1, self.retries + 1):
                temporary.unlink(missing_ok=True)
                try:
                    await self.rate_limiter.acquire()
                    communicate = edge_tts.Communicate(
                        normalized,
                        selected_voice,
                        rate=self.rate,
                        volume=self.volume,
                    )
                    await communicate.save(str(temporary))
                    if not temporary.exists() or temporary.stat().st_size == 0:
                        raise TTSGenerationError("Edge TTS returned an empty audio file")
                    temporary.replace(output_path)
                    return output_path
                except Exception as exc:
                    last_error = exc
                    temporary.unlink(missing_ok=True)
                    if attempt < self.retries:
                        await asyncio.sleep(0.5 * (2 ** (attempt - 1)))

        raise TTSGenerationError(
            f"Edge TTS failed after {self.retries} attempts for voice {selected_voice}"
        ) from last_error

    async def synthesize_dialogue(
        self,
        lines: list[DialogueLine],
        output_path: Path,
        *,
        pause_ms: int = 250,
    ) -> Path:
        if not lines:
            raise ValueError("A dialogue must contain at least one line")
        output_path.parent.mkdir(parents=True, exist_ok=True)

        with TemporaryDirectory(prefix="nihongobridge-dialogue-") as directory:
            temp_dir = Path(directory)
            clips: list[Path] = []
            for index, line in enumerate(lines):
                voice = self.female_voice if index % 2 == 0 else self.male_voice
                clip = temp_dir / f"{index:04d}.mp3"
                await self.synthesize(line.text, clip, voice=voice)
                clips.append(clip)

            await asyncio.to_thread(
                self._combine_audio,
                clips,
                output_path,
                pause_ms,
            )
        return output_path

    @staticmethod
    def _combine_audio(clips: list[Path], output_path: Path, pause_ms: int) -> None:
        from pydub import AudioSegment  # type: ignore[import-untyped]

        combined = AudioSegment.empty()
        pause = AudioSegment.silent(duration=max(0, pause_ms))
        for index, clip in enumerate(clips):
            if index:
                combined += pause
            combined += AudioSegment.from_file(clip, format="mp3")
        temporary = output_path.with_suffix(".part.mp3")
        combined.export(temporary, format="mp3")
        temporary.replace(output_path)
