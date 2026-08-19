from __future__ import annotations

import argparse
import asyncio
import hashlib
import json
import logging
import time
import unicodedata
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from tqdm.auto import tqdm

from etl.config import Settings, get_settings
from etl.enrichers.content_matcher import ContentMatcher, MatchResult
from etl.enrichers.furigana_enricher import FuriganaEnricher
from etl.enrichers.jlpt_tagger import JlptSentenceTagger
from etl.loaders.sentence_loader import SentenceLoader, SentenceLoadStats, SentenceRecord
from etl.parsers.tatoeba_stager import TatoebaStage, extract_tatoeba_archive
from etl.utils.db import Database
from etl.utils.downloader import Downloader, DownloadResult

LOGGER = logging.getLogger(__name__)
_LICENSE_TAG = "license:cc-by-2.0-fr"


@dataclass(slots=True)
class TatoebaCounters:
    scanned: int = 0
    with_translations: int = 0
    transformed: int = 0
    inserted: int = 0
    updated: int = 0
    duplicate_text: int = 0
    skipped_no_translation: int = 0
    errors: int = 0


@dataclass(slots=True)
class TatoebaReport:
    status: str = "running"
    started_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    finished_at: str | None = None
    duration_seconds: float | None = None
    source_files: dict[str, dict[str, Any]] = field(default_factory=dict)
    stage: dict[str, Any] = field(default_factory=dict)
    counters: TatoebaCounters = field(default_factory=TatoebaCounters)
    seed_files: dict[str, int] = field(default_factory=dict)
    jlpt: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    error_samples: list[dict[str, str]] = field(default_factory=list)
    resumed_from_source_id: int | None = None
    dry_run: bool = False


@dataclass(slots=True)
class TatoebaCheckpoint:
    status: str
    source_signature: str
    last_source_id: int
    processed: int
    updated_at: str

    @classmethod
    def load(cls, path: Path) -> TatoebaCheckpoint | None:
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            status=str(data["status"]),
            source_signature=str(data["source_signature"]),
            last_source_id=int(data.get("last_source_id", 0)),
            processed=int(data.get("processed", 0)),
            updated_at=str(data["updated_at"]),
        )

    def write(self, path: Path) -> None:
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(asdict(self), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)


class TatoebaPipeline:
    def __init__(
        self,
        settings: Settings,
        *,
        force_download: bool = False,
        restart: bool = False,
        dry_run: bool = False,
        limit: int | None = None,
        allow_missing_jlpt: bool = False,
        report_path: Path | None = None,
    ) -> None:
        self.settings = settings
        self.force_download = force_download
        self.restart = restart
        self.dry_run = dry_run
        self.limit = limit
        self.allow_missing_jlpt = allow_missing_jlpt
        self.report_path = report_path
        self.report = TatoebaReport(dry_run=dry_run)
        self._started = time.monotonic()
        self._last_committed_id = 0
        self._processed_base = 0
        self._processed_current = 0
        self._committed_current = 0

    async def run(self) -> TatoebaReport:
        database: Database | None = None
        signature = ""
        try:
            sources, downloads = await self._prepare_sources()
            signature = self._source_signature(downloads)
            self._record_downloads(downloads)

            with TatoebaStage(self.settings.tatoeba_stage_path) as stage:
                stage_is_current = stage.is_current(signature)
                checkpoint = self._resolve_checkpoint(signature, stage_is_current)
                if not stage_is_current:
                    stage_stats = stage.build(
                        sources["sentences"],
                        sources["links"],
                        sources["tags"],
                        signature=signature,
                    )
                else:
                    stage_stats = stage.stats()
                self.report.stage = asdict(stage_stats)

                if checkpoint is None:
                    stage.reset_transform_state()
                else:
                    self._last_committed_id = checkpoint.last_source_id
                    self._processed_base = checkpoint.processed
                    self.report.resumed_from_source_id = checkpoint.last_source_id

                furigana = FuriganaEnricher()
                jlpt_tagger = self._load_jlpt_tagger()
                matcher: ContentMatcher | None = None
                loader: SentenceLoader | None = None
                if not self.dry_run:
                    database = Database(self.settings)
                    await database.ping()
                    loader = SentenceLoader(database)
                    await loader.validate_schema()
                    matcher = await ContentMatcher.load(database)

                await self._import_stage(
                    stage,
                    signature,
                    furigana,
                    jlpt_tagger,
                    matcher,
                    loader,
                )
                self.report.seed_files = stage.export_seed_files(
                    self.settings.sentence_seed_dir,
                    self.settings.tatoeba_seed_limit_per_level,
                )
                if jlpt_tagger:
                    self.report.jlpt = asdict(jlpt_tagger.stats)
                self.report.status = "completed"
                if not self.dry_run:
                    self._write_checkpoint("completed", signature)
        except (Exception, asyncio.CancelledError) as exc:
            self.report.status = (
                "cancelled" if isinstance(exc, asyncio.CancelledError) else "failed"
            )
            self._record_error(str(self._last_committed_id or "pipeline"), exc)
            if signature and not self.dry_run:
                self._write_checkpoint(self.report.status, signature)
            LOGGER.exception("Tatoeba pipeline failed")
            raise
        finally:
            if database is not None:
                await database.dispose()
            self.report.finished_at = datetime.now(UTC).isoformat()
            self.report.duration_seconds = round(time.monotonic() - self._started, 3)
            self._write_report()
        return self.report

    async def _prepare_sources(
        self,
    ) -> tuple[dict[str, Path], dict[str, DownloadResult]]:
        archive_configuration = {
            "sentences": (
                self.settings.tatoeba_sentences_archive,
                self.settings.tatoeba_sentences_sha256,
                "sentences.csv",
            ),
            "links": (
                self.settings.tatoeba_links_archive,
                self.settings.tatoeba_links_sha256,
                "links.csv",
            ),
            "tags": (
                self.settings.tatoeba_tags_archive,
                self.settings.tatoeba_tags_sha256,
                "tags.csv",
            ),
        }
        downloads: dict[str, DownloadResult] = {}
        extracted: dict[str, Path] = {}
        async with Downloader(
            timeout_seconds=self.settings.http_timeout_seconds,
            connect_timeout_seconds=self.settings.http_connect_timeout_seconds,
            retries=self.settings.download_retries,
            backoff_seconds=self.settings.download_backoff_seconds,
            user_agent=self.settings.http_user_agent,
        ) as downloader:
            for name, (archive_name, checksum, csv_name) in archive_configuration.items():
                url = f"{self.settings.tatoeba_base_url.rstrip('/')}/{archive_name}"
                archive_path = self.settings.tatoeba_data_dir / archive_name
                result = await downloader.download(
                    url,
                    archive_path,
                    expected_sha256=checksum,
                    require_checksum=self.settings.tatoeba_require_checksums,
                    force=self.force_download,
                )
                downloads[name] = result
                csv_path = self.settings.tatoeba_data_dir / csv_name
                marker = csv_path.with_suffix(csv_path.suffix + ".source-sha256")
                marker_digest = (
                    marker.read_text(encoding="utf-8").strip() if marker.exists() else ""
                )
                if not csv_path.exists() or marker_digest != result.sha256:
                    extracted_path = await asyncio.to_thread(
                        extract_tatoeba_archive,
                        archive_path,
                        self.settings.tatoeba_data_dir,
                        csv_name,
                    )
                    marker.write_text(result.sha256 + "\n", encoding="utf-8")
                else:
                    extracted_path = csv_path
                extracted[name] = extracted_path
        return extracted, downloads

    def _resolve_checkpoint(
        self,
        signature: str,
        stage_is_current: bool,
    ) -> TatoebaCheckpoint | None:
        path = self.settings.tatoeba_checkpoint_path
        if self.restart:
            path.unlink(missing_ok=True)
            return None
        checkpoint = TatoebaCheckpoint.load(path)
        if checkpoint is None or checkpoint.status == "completed":
            return None
        if checkpoint.source_signature != signature:
            raise RuntimeError(
                "Tatoeba exports changed after an incomplete run; pass --restart to rebuild safely"
            )
        if not stage_is_current:
            raise RuntimeError(
                "The Tatoeba staging index is missing or stale for an incomplete checkpoint; "
                "pass --restart"
            )
        return checkpoint

    def _load_jlpt_tagger(self) -> JlptSentenceTagger | None:
        try:
            return JlptSentenceTagger.from_directory(self.settings.jlpt_vocab_dir)
        except (FileNotFoundError, ValueError) as exc:
            if self.settings.require_jlpt_data and not self.allow_missing_jlpt:
                raise
            self._record_warning(str(exc))
            return None

    async def _import_stage(
        self,
        stage: TatoebaStage,
        signature: str,
        furigana: FuriganaEnricher,
        jlpt_tagger: JlptSentenceTagger | None,
        matcher: ContentMatcher | None,
        loader: SentenceLoader | None,
    ) -> None:
        after_id = self._last_committed_id
        total = max(self.settings.tatoeba_estimated_japanese_sentences, self._processed_base + 1)
        with tqdm(
            total=total,
            initial=self._processed_base,
            unit="sentences",
            desc="Importing Tatoeba",
            dynamic_ncols=True,
        ) as progress:
            for staged_batch in stage.iter_sentences(
                after_source_id=after_id,
                batch_size=self.settings.tatoeba_batch_size,
            ):
                records: list[SentenceRecord] = []
                batch_last_id = after_id
                for staged in staged_batch:
                    if self.limit is not None and self.report.counters.scanned >= self.limit:
                        break
                    batch_last_id = staged.source_id
                    self.report.counters.scanned += 1
                    self._processed_current += 1
                    progress.update(1)

                    if not staged.translations:
                        self.report.counters.skipped_no_translation += 1
                        continue
                    self.report.counters.with_translations += 1
                    japanese = unicodedata.normalize("NFKC", staged.japanese).strip()
                    digest = hashlib.sha256(japanese.encode("utf-8")).hexdigest()
                    if not stage.claim_text_hash(digest, staged.source_id):
                        self.report.counters.duplicate_text += 1
                        continue

                    try:
                        tokens = furigana.tokenize(japanese)
                        furigana_html = furigana.enrich_tokens(japanese, tokens)
                        level = jlpt_tagger.tag(tokens) if jlpt_tagger else "NONE"
                        matches = (
                            matcher.match(japanese, tokens) if matcher else MatchResult([], [])
                        )
                        tags = list(
                            dict.fromkeys(
                                [tag.strip() for tag in staged.tags if tag.strip()] + [_LICENSE_TAG]
                            )
                        )
                        record = SentenceRecord(
                            japanese=japanese,
                            furigana_html=furigana_html,
                            translations=staged.translations,
                            jlpt_level=level,
                            grammar_ids=matches.grammar_ids,
                            vocabulary_ids=matches.vocabulary_ids,
                            tags=tags,
                            source=self.settings.tatoeba_source_attribution,
                            source_id=str(staged.source_id),
                        )
                        records.append(record)
                        self.report.counters.transformed += 1
                        if level != "NONE":
                            stage.add_seed_candidate(
                                source_id=staged.source_id,
                                level=level,
                                score=self._seed_score(record),
                                payload=record.to_mapping(),
                            )
                    except Exception as exc:
                        stage.release_text_hash(digest, staged.source_id)
                        self.report.counters.errors += 1
                        self._record_error(str(staged.source_id), exc)

                load_stats = await self._flush(records, loader)
                self._apply_load_stats(load_stats)
                stage.commit_transform_state()
                self._last_committed_id = batch_last_id
                self._committed_current = self._processed_current
                if not self.dry_run:
                    self._write_checkpoint("running", signature)
                progress.set_postfix(
                    inserted=self.report.counters.inserted,
                    updated=self.report.counters.updated,
                    duplicates=self.report.counters.duplicate_text,
                    errors=self.report.counters.errors,
                    refresh=False,
                )
                after_id = batch_last_id
                if self.limit is not None and self.report.counters.scanned >= self.limit:
                    break

    async def _flush(
        self,
        records: list[SentenceRecord],
        loader: SentenceLoader | None,
    ) -> SentenceLoadStats:
        if not records or self.dry_run:
            return SentenceLoadStats(attempted=len(records))
        if loader is None:
            raise RuntimeError("Sentence loader is unavailable")
        return await loader.upsert_batch(records)

    def _apply_load_stats(self, stats: SentenceLoadStats) -> None:
        self.report.counters.inserted += stats.inserted
        self.report.counters.updated += stats.updated
        self.report.counters.duplicate_text += stats.duplicate_text + stats.duplicate_batch

    @staticmethod
    def _seed_score(record: SentenceRecord) -> int:
        translation_score = len(record.translations) * 100
        length_score = max(0, 80 - abs(len(record.japanese) - 30))
        content_score = min(50, len(record.vocabulary_ids) * 5 + len(record.grammar_ids) * 10)
        return translation_score + length_score + content_score

    def _source_signature(self, downloads: dict[str, DownloadResult]) -> str:
        combined = "|".join(downloads[name].sha256 for name in sorted(downloads))
        return hashlib.sha256(combined.encode()).hexdigest()

    def _record_downloads(self, downloads: dict[str, DownloadResult]) -> None:
        for name, result in downloads.items():
            self.report.source_files[name] = {
                "path": str(result.path),
                "sha256": result.sha256,
                "size_bytes": result.size_bytes,
                "used_cache": result.used_cache,
                "checksum_verified": result.checksum_verified,
                "verification_source": result.verification_source,
            }
            if not result.checksum_verified:
                self._record_warning(
                    f"{name} uses a local SHA-256 sidecar, not a publisher-supplied checksum"
                )

    def _write_checkpoint(self, status: str, signature: str) -> None:
        TatoebaCheckpoint(
            status=status,
            source_signature=signature,
            last_source_id=self._last_committed_id,
            processed=self._processed_base + self._committed_current,
            updated_at=datetime.now(UTC).isoformat(),
        ).write(self.settings.tatoeba_checkpoint_path)

    def _record_warning(self, message: str) -> None:
        if len(self.report.warnings) < self.settings.validation_error_sample_limit:
            self.report.warnings.append(message)

    def _record_error(self, source_id: str, exc: BaseException) -> None:
        if len(self.report.error_samples) < self.settings.validation_error_sample_limit:
            self.report.error_samples.append(
                {"source_id": source_id, "type": type(exc).__name__, "message": str(exc)}
            )

    def _write_report(self) -> None:
        destination = self.report_path
        if destination is None:
            stamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
            destination = self.settings.report_dir / f"tatoeba-{stamp}.json"
        destination.parent.mkdir(parents=True, exist_ok=True)
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        temporary.write_text(
            json.dumps(asdict(self.report), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(destination)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import Tatoeba sentences into NihongoBridge")
    parser.add_argument("--force-download", action="store_true")
    parser.add_argument("--restart", action="store_true")
    parser.add_argument("--dry-run", action="store_true")
    parser.add_argument("--limit", type=int)
    parser.add_argument("--allow-missing-jlpt", action="store_true")
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
    report = await TatoebaPipeline(
        get_settings(),
        force_download=args.force_download,
        restart=args.restart,
        dry_run=args.dry_run,
        limit=args.limit,
        allow_missing_jlpt=args.allow_missing_jlpt,
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
