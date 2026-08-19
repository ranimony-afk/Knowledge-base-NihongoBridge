from __future__ import annotations

import argparse
import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Literal
from uuid import UUID

from sqlalchemy import text

from etl.config import Settings, get_settings
from etl.storage.minio_client import MinioStorage
from etl.utils.db import Database
from etl.utils.tts_client import EdgeTTSClient

LOGGER = logging.getLogger(__name__)
Target = Literal["sentences", "dictionary", "all"]


@dataclass(slots=True)
class TTSCounters:
    selected: int = 0
    generated: int = 0
    reused_from_storage: int = 0
    failed: int = 0


@dataclass(slots=True)
class TTSReport:
    status: str = "running"
    started_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    finished_at: str | None = None
    duration_seconds: float | None = None
    target: str = "all"
    voice_sentence: str = ""
    voice_dictionary: str = ""
    requests_per_second: float = 10
    counters: TTSCounters = field(default_factory=TTSCounters)
    error_samples: list[dict[str, str]] = field(default_factory=list)


@dataclass(frozen=True, slots=True)
class AudioItem:
    id: str
    text: str
    target: Literal["sentences", "dictionary"]

    @property
    def object_name(self) -> str:
        return f"{self.target}/{self.id}.mp3"


class TTSPipeline:
    """Generate missing sentence/word audio and persist it to MinIO."""

    def __init__(
        self,
        settings: Settings,
        *,
        target: Target = "all",
        force: bool = False,
        limit: int | None = None,
        report_path: Path | None = None,
    ) -> None:
        self.settings = settings
        self.target = target
        self.force = force
        self.limit = limit
        self.report_path = report_path
        self.report = TTSReport(
            target=target,
            voice_sentence=settings.edge_tts_female_voice,
            voice_dictionary=settings.edge_tts_female_voice,
            requests_per_second=settings.tts_requests_per_second,
        )
        self._started = time.monotonic()
        self._last_item_id: str | None = None
        self._current_target: str | None = None

    async def run(self) -> TTSReport:
        database = Database(self.settings)
        try:
            await database.ping()
            storage = MinioStorage(
                self.settings.minio_endpoint,
                self.settings.minio_access_key,
                self.settings.minio_secret_key,
                public_url=self.settings.minio_public_url,
            )
            await storage.ensure_bucket(
                self.settings.minio_audio_bucket,
                public_read=self.settings.minio_public_read,
            )
            tts = EdgeTTSClient(
                female_voice=self.settings.edge_tts_female_voice,
                male_voice=self.settings.edge_tts_male_voice,
                rate=self.settings.edge_tts_rate,
                volume=self.settings.edge_tts_volume,
                requests_per_second=self.settings.tts_requests_per_second,
                concurrency=self.settings.tts_concurrency,
                retries=self.settings.tts_retries,
            )

            targets: tuple[Literal["sentences", "dictionary"], ...]
            if self.target == "all":
                targets = ("sentences", "dictionary")
            else:
                targets = (self.target,)

            remaining = self.limit
            for current_target in targets:
                if remaining is not None and remaining <= 0:
                    break
                processed = await self._process_target(
                    database,
                    storage,
                    tts,
                    current_target,
                    remaining,
                )
                if remaining is not None:
                    remaining -= processed
            self.report.status = "completed"
            self._write_checkpoint("completed")
        except (Exception, asyncio.CancelledError) as exc:
            self.report.status = (
                "cancelled" if isinstance(exc, asyncio.CancelledError) else "failed"
            )
            self._record_error(self._last_item_id or "pipeline", exc)
            self._write_checkpoint(self.report.status)
            LOGGER.exception("TTS pipeline failed")
            raise
        finally:
            await database.dispose()
            self.report.finished_at = datetime.now(UTC).isoformat()
            self.report.duration_seconds = round(time.monotonic() - self._started, 3)
            self._write_report()
        return self.report

    async def _process_target(
        self,
        database: Database,
        storage: MinioStorage,
        tts: EdgeTTSClient,
        target: Literal["sentences", "dictionary"],
        limit: int | None,
    ) -> int:
        cursor = ""
        processed = 0
        self._current_target = target
        fetch_size = max(10, self.settings.tts_concurrency * 4)

        while limit is None or processed < limit:
            batch_limit = fetch_size if limit is None else min(fetch_size, limit - processed)
            items = await self._fetch_items(database, target, cursor, batch_limit)
            if not items:
                break
            self.report.counters.selected += len(items)
            await asyncio.gather(
                *(self._process_item(database, storage, tts, item) for item in items)
            )
            cursor = items[-1].id
            self._last_item_id = cursor
            processed += len(items)
            self._write_checkpoint("running")
        return processed

    async def _fetch_items(
        self,
        database: Database,
        target: Literal["sentences", "dictionary"],
        cursor: str,
        limit: int,
    ) -> list[AudioItem]:
        if target == "sentences":
            query = """
                SELECT id::text, japanese AS text_value
                FROM sentences
                WHERE id::text > :cursor
                  AND (:force OR audio_url IS NULL OR audio_url = '')
                ORDER BY id::text
                LIMIT :limit
            """
        else:
            query = """
                SELECT id::text, COALESCE(NULLIF(kana, ''), word) AS text_value
                FROM dictionary_entries
                WHERE id::text > :cursor
                  AND is_active = true
                  AND (:force OR audio_url IS NULL OR audio_url = '')
                ORDER BY id::text
                LIMIT :limit
            """
        async with database.engine.connect() as connection:
            rows = await connection.execute(
                text(query),
                {"cursor": cursor, "limit": limit, "force": self.force},
            )
            return [
                AudioItem(id=str(row[0]), text=str(row[1]), target=target) for row in rows if row[1]
            ]

    async def _process_item(
        self,
        database: Database,
        storage: MinioStorage,
        tts: EdgeTTSClient,
        item: AudioItem,
    ) -> None:
        local_path = self.settings.tts_temp_dir / item.target / f"{item.id}.mp3"
        try:
            if not self.force and await storage.object_exists(
                self.settings.minio_audio_bucket, item.object_name
            ):
                audio_url = storage.public_object_url(
                    self.settings.minio_audio_bucket,
                    item.object_name,
                )
                self.report.counters.reused_from_storage += 1
            else:
                await tts.synthesize(
                    item.text,
                    local_path,
                    voice=self.settings.edge_tts_female_voice,
                )
                audio_url = await storage.upload_file(
                    self.settings.minio_audio_bucket,
                    item.object_name,
                    local_path,
                    content_type="audio/mpeg",
                )
                self.report.counters.generated += 1
            await self._update_audio_url(database, item, audio_url)
        except Exception as exc:
            self.report.counters.failed += 1
            self._record_error(item.id, exc)
        finally:
            local_path.unlink(missing_ok=True)

    async def _update_audio_url(
        self,
        database: Database,
        item: AudioItem,
        audio_url: str,
    ) -> None:
        table = "sentences" if item.target == "sentences" else "dictionary_entries"
        async with database.transaction() as connection:
            await connection.execute(
                text(f"UPDATE {table} SET audio_url = :url, updated_at = now() WHERE id = :id"),
                {"url": audio_url, "id": UUID(item.id)},
            )

    def _write_checkpoint(self, status: str) -> None:
        payload = {
            "status": status,
            "target": self._current_target,
            "last_item_id": self._last_item_id,
            "counters": asdict(self.report.counters),
            "updated_at": datetime.now(UTC).isoformat(),
            "resume_strategy": "database audio_url plus MinIO object existence",
        }
        path = self.settings.tts_checkpoint_path
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)

    def _record_error(self, item_id: str, exc: BaseException) -> None:
        if len(self.report.error_samples) < self.settings.validation_error_sample_limit:
            self.report.error_samples.append(
                {"item_id": item_id, "type": type(exc).__name__, "message": str(exc)}
            )

    def _write_report(self) -> None:
        destination = self.report_path
        if destination is None:
            stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
            destination = self.settings.report_dir / f"tts-{stamp}.json"
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        temporary.write_text(
            json.dumps(asdict(self.report), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(destination)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Generate NihongoBridge Edge TTS audio")
    parser.add_argument(
        "--target",
        choices=("sentences", "dictionary", "all"),
        default="all",
    )
    parser.add_argument("--force", action="store_true", help="regenerate existing audio")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--report", type=Path)
    parser.add_argument(
        "--log-level",
        default="INFO",
        choices=("DEBUG", "INFO", "WARNING", "ERROR"),
    )
    return parser


async def _async_main(argv: list[str] | None = None) -> int:
    args = _build_parser().parse_args(argv)
    if args.limit is not None and args.limit < 1:
        raise SystemExit("--limit must be at least 1")
    logging.basicConfig(
        level=getattr(logging, args.log_level),
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    )
    report = await TTSPipeline(
        get_settings(),
        target=args.target,
        force=args.force,
        limit=args.limit,
        report_path=args.report,
    ).run()
    print(json.dumps(asdict(report), ensure_ascii=False, indent=2))
    return 0 if report.status == "completed" else 1


def main() -> None:
    try:
        raise SystemExit(asyncio.run(_async_main()))
    except KeyboardInterrupt:
        raise SystemExit(130) from None


if __name__ == "__main__":
    main()
