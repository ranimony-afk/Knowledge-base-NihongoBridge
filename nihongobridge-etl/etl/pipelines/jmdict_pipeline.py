from __future__ import annotations

import argparse
import asyncio
import json
import logging
import time
from dataclasses import asdict, dataclass, field
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from lxml import etree
from tqdm.auto import tqdm

from etl.config import Settings, get_settings
from etl.enrichers.frequency_enricher import FrequencyEnricher
from etl.enrichers.jlpt_enricher import JlptEnricher
from etl.loaders.dictionary_loader import DictionaryLoader, LoadStats
from etl.parsers.jmdict_parser import JMdictParser
from etl.transformers.jmdict_transformer import DictionaryRecord, JMdictTransformer
from etl.utils.db import Database
from etl.utils.downloader import Downloader, DownloadResult

LOGGER = logging.getLogger(__name__)


@dataclass(slots=True)
class PipelineCounters:
    parsed: int = 0
    transformed: int = 0
    inserted: int = 0
    updated: int = 0
    skipped: int = 0
    errors: int = 0
    duplicate_source_ids_in_batch: int = 0


@dataclass(slots=True)
class ValidationReport:
    pipeline: str = "jmdict"
    status: str = "running"
    started_at: str = field(default_factory=lambda: datetime.now(UTC).isoformat())
    finished_at: str | None = None
    duration_seconds: float | None = None
    source_url: str = ""
    source_path: str = ""
    source_sha256: str = ""
    source_size_bytes: int = 0
    source_used_cache: bool = False
    checksum_verified: bool = False
    checksum_verification_source: str = ""
    resumed_from_source_id: str | None = None
    dry_run: bool = False
    counters: PipelineCounters = field(default_factory=PipelineCounters)
    enrichment: dict[str, Any] = field(default_factory=dict)
    warnings: list[str] = field(default_factory=list)
    error_samples: list[dict[str, str]] = field(default_factory=list)

    def to_mapping(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(slots=True)
class Checkpoint:
    status: str
    source_sha256: str
    last_source_id: str | None
    processed: int
    updated_at: str

    @classmethod
    def load(cls, path: Path) -> Checkpoint | None:
        if not path.exists():
            return None
        data = json.loads(path.read_text(encoding="utf-8"))
        return cls(
            status=str(data["status"]),
            source_sha256=str(data["source_sha256"]),
            last_source_id=data.get("last_source_id"),
            processed=int(data.get("processed", 0)),
            updated_at=str(data["updated_at"]),
        )

    def write(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(asdict(self), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)


class JMdictPipeline:
    def __init__(
        self,
        settings: Settings,
        *,
        force_download: bool = False,
        restart: bool = False,
        dry_run: bool = False,
        limit: int | None = None,
        allow_missing_enrichment: bool = False,
        report_path: Path | None = None,
    ) -> None:
        self.settings = settings
        self.force_download = force_download
        self.restart = restart
        self.dry_run = dry_run
        self.limit = limit
        self.allow_missing_enrichment = allow_missing_enrichment
        self.report_path = report_path
        self.report = ValidationReport(
            source_url=settings.jmdict_url,
            source_path=str(settings.jmdict_path),
            dry_run=dry_run,
        )
        self._started_monotonic = time.monotonic()
        self._last_committed_source_id: str | None = None
        self._base_processed = 0
        self._committed_this_run = 0

    async def run(self) -> ValidationReport:
        checkpoint_path = self.settings.jmdict_checkpoint_path
        if self.restart:
            checkpoint_path.unlink(missing_ok=True)

        database: Database | None = None
        loader: DictionaryLoader | None = None

        try:
            download = await self._download_source()
            self._record_download(download)
            checkpoint = self._resume_checkpoint(download)
            jlpt_enricher = self._load_jlpt_enricher()
            frequency_enricher = self._load_frequency_enricher()

            if not self.dry_run:
                database = Database(self.settings)
                await database.ping()
                loader = DictionaryLoader(database)
                await loader.validate_schema()

            await self._process_entries(
                download,
                checkpoint,
                loader,
                jlpt_enricher,
                frequency_enricher,
            )
            self._finalize_enrichment(jlpt_enricher, frequency_enricher)
            self.report.status = "completed"
            if not self.dry_run:
                self._write_checkpoint("completed", download.sha256)
        except (Exception, asyncio.CancelledError) as exc:
            self.report.status = (
                "cancelled" if isinstance(exc, asyncio.CancelledError) else "failed"
            )
            self._record_error(self._last_committed_source_id or "pipeline", exc)
            if self.report.source_sha256 and not self.dry_run:
                self._write_checkpoint(self.report.status, self.report.source_sha256)
            LOGGER.exception("JMdict pipeline failed")
            raise
        finally:
            if database is not None:
                await database.dispose()
            self.report.finished_at = datetime.now(UTC).isoformat()
            self.report.duration_seconds = round(time.monotonic() - self._started_monotonic, 3)
            self._write_report()

        return self.report

    async def _download_source(self) -> DownloadResult:
        async with Downloader(
            timeout_seconds=self.settings.http_timeout_seconds,
            connect_timeout_seconds=self.settings.http_connect_timeout_seconds,
            retries=self.settings.download_retries,
            backoff_seconds=self.settings.download_backoff_seconds,
            user_agent=self.settings.http_user_agent,
        ) as downloader:
            return await downloader.download(
                self.settings.jmdict_url,
                self.settings.jmdict_path,
                expected_sha256=self.settings.jmdict_sha256,
                checksum_url=self.settings.jmdict_checksum_url,
                require_checksum=self.settings.require_source_checksum,
                force=self.force_download,
                validate_gzip=self.settings.validate_gzip,
            )

    def _record_download(self, result: DownloadResult) -> None:
        self.report.source_path = str(result.path)
        self.report.source_sha256 = result.sha256
        self.report.source_size_bytes = result.size_bytes
        self.report.source_used_cache = result.used_cache
        self.report.checksum_verified = result.checksum_verified
        self.report.checksum_verification_source = result.verification_source
        if not result.checksum_verified:
            self.report.warnings.append(
                "The source has a recorded SHA-256 digest but was not verified against a "
                "publisher-supplied checksum. Set JMDICT_SHA256 for strict verification."
            )

    def _resume_checkpoint(self, download: DownloadResult) -> Checkpoint | None:
        checkpoint = Checkpoint.load(self.settings.jmdict_checkpoint_path)
        if checkpoint is None or checkpoint.status == "completed":
            return None
        if checkpoint.source_sha256 != download.sha256:
            raise RuntimeError(
                "JMdict source changed since the incomplete checkpoint. Re-run with --restart "
                "to intentionally process the new source from the beginning."
            )
        self.report.resumed_from_source_id = checkpoint.last_source_id
        self._last_committed_source_id = checkpoint.last_source_id
        self._base_processed = checkpoint.processed
        return checkpoint

    def _load_jlpt_enricher(self) -> JlptEnricher | None:
        try:
            enricher = JlptEnricher.from_directory(self.settings.jlpt_vocab_dir)
            self.report.enrichment["jlpt_source"] = asdict(enricher.stats)
            return enricher
        except (FileNotFoundError, ValueError) as exc:
            required = self.settings.require_jlpt_data and not self.allow_missing_enrichment
            if required:
                raise
            self.report.warnings.append(str(exc))
            return None

    def _load_frequency_enricher(self) -> FrequencyEnricher | None:
        try:
            enricher = FrequencyEnricher.from_path(
                self.settings.innocent_frequency_path,
                mode=self.settings.frequency_value_mode,  # type: ignore[arg-type]
            )
            self.report.enrichment["frequency_source"] = asdict(enricher.stats)
            return enricher
        except (FileNotFoundError, ValueError) as exc:
            required = self.settings.require_frequency_data and not self.allow_missing_enrichment
            if required:
                raise
            self.report.warnings.append(str(exc))
            return None

    async def _process_entries(
        self,
        download: DownloadResult,
        checkpoint: Checkpoint | None,
        loader: DictionaryLoader | None,
        jlpt_enricher: JlptEnricher | None,
        frequency_enricher: FrequencyEnricher | None,
    ) -> None:
        parser = JMdictParser()
        transformer = JMdictTransformer(self.settings.jmdict_source_attribution)
        pending_records: list[DictionaryRecord] = []
        entries_since_flush = 0
        batches_since_checkpoint = 0
        last_seen_source_id = checkpoint.last_source_id if checkpoint else None

        total = max(self.settings.jmdict_estimated_entries, self._base_processed + 1)
        with tqdm(
            total=total,
            initial=self._base_processed,
            unit="entries",
            desc="Importing JMdict",
            dynamic_ncols=True,
        ) as progress:
            iterator = parser.iter_entries(
                download.path,
                start_after_source_id=checkpoint.last_source_id if checkpoint else None,
            )
            try:
                for entry in iterator:
                    if self.limit is not None and self.report.counters.parsed >= self.limit:
                        break
                    self.report.counters.parsed += 1
                    entries_since_flush += 1
                    last_seen_source_id = entry.source_id
                    progress.update(1)

                    try:
                        result = transformer.transform(entry)
                        if result.record is None:
                            self.report.counters.skipped += 1
                            if result.skip_reason:
                                self._record_warning(
                                    f"Skipped JMdict {entry.source_id}: {result.skip_reason}"
                                )
                        else:
                            record = result.record
                            if jlpt_enricher:
                                jlpt_enricher.enrich(record)
                            if frequency_enricher:
                                frequency_enricher.enrich(record)
                            pending_records.append(record)
                            self.report.counters.transformed += 1
                        for warning in result.warnings:
                            self._record_warning(warning)
                    except Exception as exc:  # isolate bad source records
                        self.report.counters.errors += 1
                        self._record_error(entry.source_id, exc)

                    if entries_since_flush >= self.settings.batch_size:
                        stats = await self._flush(pending_records, loader)
                        self._apply_load_stats(stats)
                        pending_records.clear()
                        entries_since_flush = 0
                        batches_since_checkpoint += 1
                        self._last_committed_source_id = last_seen_source_id
                        self._committed_this_run = self.report.counters.parsed
                        if (
                            not self.dry_run
                            and batches_since_checkpoint >= self.settings.checkpoint_every_batches
                        ):
                            self._write_checkpoint("running", download.sha256)
                            batches_since_checkpoint = 0
                        progress.set_postfix(
                            inserted=self.report.counters.inserted,
                            updated=self.report.counters.updated,
                            skipped=self.report.counters.skipped,
                            errors=self.report.counters.errors,
                            refresh=False,
                        )
            finally:
                iterator.close()

            if entries_since_flush:
                stats = await self._flush(pending_records, loader)
                self._apply_load_stats(stats)
                self._last_committed_source_id = last_seen_source_id
                self._committed_this_run = self.report.counters.parsed

        if parser.stats.malformed_entries:
            self.report.counters.errors += parser.stats.malformed_entries
        for warning in parser.stats.warnings:
            self._record_warning(warning)
        if transformer.unknown_pos_codes:
            self._record_warning(
                "Unmapped JMdict POS codes were preserved verbatim: "
                + ", ".join(sorted(transformer.unknown_pos_codes))
            )

    async def _flush(
        self,
        records: list[DictionaryRecord],
        loader: DictionaryLoader | None,
    ) -> LoadStats:
        if not records or self.dry_run:
            return LoadStats(attempted=len(records))
        if loader is None:
            raise RuntimeError("Database loader is unavailable")
        return await loader.upsert_batch(records)

    def _apply_load_stats(self, stats: LoadStats) -> None:
        self.report.counters.inserted += stats.inserted
        self.report.counters.updated += stats.updated
        self.report.counters.duplicate_source_ids_in_batch += stats.duplicate_source_ids_in_batch

    def _finalize_enrichment(
        self,
        jlpt_enricher: JlptEnricher | None,
        frequency_enricher: FrequencyEnricher | None,
    ) -> None:
        if jlpt_enricher:
            total = jlpt_enricher.matches + jlpt_enricher.misses
            self.report.enrichment["jlpt_matches"] = jlpt_enricher.matches
            self.report.enrichment["jlpt_misses"] = jlpt_enricher.misses
            self.report.enrichment["jlpt_match_rate"] = (
                round(jlpt_enricher.matches / total, 6) if total else 0
            )
        if frequency_enricher:
            total = frequency_enricher.matches + frequency_enricher.misses
            self.report.enrichment["frequency_matches"] = frequency_enricher.matches
            self.report.enrichment["frequency_misses"] = frequency_enricher.misses
            self.report.enrichment["frequency_match_rate"] = (
                round(frequency_enricher.matches / total, 6) if total else 0
            )

    def _write_checkpoint(self, status: str, source_sha256: str) -> None:
        Checkpoint(
            status=status,
            source_sha256=source_sha256,
            last_source_id=self._last_committed_source_id,
            processed=self._base_processed + self._committed_this_run,
            updated_at=datetime.now(UTC).isoformat(),
        ).write(self.settings.jmdict_checkpoint_path)

    def _record_warning(self, message: str) -> None:
        if len(self.report.warnings) < self.settings.validation_error_sample_limit:
            self.report.warnings.append(message)

    def _record_error(self, source_id: str, exc: BaseException) -> None:
        if len(self.report.error_samples) < self.settings.validation_error_sample_limit:
            self.report.error_samples.append(
                {
                    "source_id": source_id,
                    "type": type(exc).__name__,
                    "message": str(exc),
                }
            )

    def _write_report(self) -> None:
        path = self.report_path
        if path is None:
            timestamp = datetime.now(UTC).strftime("%Y%m%dT%H%M%SZ")
            path = self.settings.report_dir / f"jmdict-{timestamp}.json"
        path.parent.mkdir(parents=True, exist_ok=True)
        temporary = path.with_suffix(path.suffix + ".tmp")
        temporary.write_text(
            json.dumps(self.report.to_mapping(), ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )
        temporary.replace(path)
        LOGGER.info("Validation report written to %s", path)


def _build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Import JMdict into NihongoBridge PostgreSQL")
    parser.add_argument("--force-download", action="store_true", help="download even if cached")
    parser.add_argument("--restart", action="store_true", help="discard an incomplete checkpoint")
    parser.add_argument(
        "--dry-run", action="store_true", help="parse and validate without PostgreSQL"
    )
    parser.add_argument("--limit", type=int, help="process at most this many entries")
    parser.add_argument(
        "--allow-missing-enrichment",
        action="store_true",
        help="continue if JLPT/frequency source files are absent",
    )
    parser.add_argument("--report", type=Path, help="write the JSON report to this path")
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
    pipeline = JMdictPipeline(
        get_settings(),
        force_download=args.force_download,
        restart=args.restart,
        dry_run=args.dry_run,
        limit=args.limit,
        allow_missing_enrichment=args.allow_missing_enrichment,
        report_path=args.report,
    )
    report = await pipeline.run()
    print(json.dumps(report.to_mapping(), ensure_ascii=False, indent=2))
    return 0 if report.status == "completed" else 1


def main() -> None:
    try:
        raise SystemExit(asyncio.run(_async_main()))
    except KeyboardInterrupt:
        raise SystemExit(130) from None
    except etree.XMLSyntaxError as exc:
        LOGGER.error("JMdict XML is malformed: %s", exc)
        raise SystemExit(1) from exc


if __name__ == "__main__":
    main()
