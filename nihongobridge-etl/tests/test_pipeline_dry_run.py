from __future__ import annotations

import gzip
import hashlib
from pathlib import Path

import pytest

from etl.config import Settings
from etl.pipelines.jmdict_pipeline import JMdictPipeline
from etl.utils.downloader import DownloadResult


@pytest.mark.asyncio
async def test_pipeline_dry_run_writes_validation_report(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        report_dir=tmp_path / "reports",
        checkpoint_dir=tmp_path / "checkpoints",
        require_jlpt_data=False,
        require_frequency_data=False,
        validate_gzip=False,
        batch_size=1,
        jmdict_estimated_entries=1,
    )
    source = settings.jmdict_path
    payload = """<JMdict><entry><ent_seq>1</ent_seq><r_ele><reb>ありがとう</reb></r_ele>
    <sense><pos>exp</pos><gloss>thank you</gloss></sense></entry></JMdict>"""
    with gzip.open(source, "wb") as output:
        output.write(payload.encode("utf-8"))
    digest = hashlib.sha256(source.read_bytes()).hexdigest()

    async def fake_download(_: JMdictPipeline) -> DownloadResult:
        return DownloadResult(
            path=source,
            sha256=digest,
            size_bytes=source.stat().st_size,
            used_cache=True,
            checksum_verified=False,
            verification_source="test fixture",
        )

    monkeypatch.setattr(JMdictPipeline, "_download_source", fake_download)
    report_path = tmp_path / "report.json"
    pipeline = JMdictPipeline(
        settings,
        dry_run=True,
        allow_missing_enrichment=True,
        report_path=report_path,
    )

    report = await pipeline.run()

    assert report.status == "completed"
    assert report.counters.parsed == 1
    assert report.counters.transformed == 1
    assert report.counters.inserted == 0
    assert report_path.exists()
    assert not settings.jmdict_checkpoint_path.exists()
