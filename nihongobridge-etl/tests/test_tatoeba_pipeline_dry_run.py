from __future__ import annotations

import hashlib
from pathlib import Path

import pytest

from etl.config import Settings
from etl.pipelines.tatoeba_pipeline import TatoebaPipeline
from etl.utils.downloader import DownloadResult


def _download(path: Path) -> DownloadResult:
    payload = path.read_bytes()
    return DownloadResult(
        path=path,
        sha256=hashlib.sha256(payload).hexdigest(),
        size_bytes=len(payload),
        used_cache=True,
        checksum_verified=False,
        verification_source="fixture",
    )


@pytest.mark.asyncio
async def test_tatoeba_pipeline_end_to_end_dry_run(
    tmp_path: Path,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = Settings(
        _env_file=None,
        data_dir=tmp_path / "data",
        report_dir=tmp_path / "reports",
        checkpoint_dir=tmp_path / "checkpoints",
        jlpt_vocab_dir=tmp_path / "jlpt",
        sentence_seed_dir=tmp_path / "seeds",
        require_jlpt_data=True,
        tatoeba_batch_size=10,
        tatoeba_estimated_japanese_sentences=2,
    )
    settings.jlpt_vocab_dir.mkdir(parents=True)
    (settings.jlpt_vocab_dir / "words-N5.csv").write_text(
        "word,reading\n水,みず\n",
        encoding="utf-8",
    )
    source_dir = tmp_path / "exports"
    source_dir.mkdir()
    sentences = source_dir / "sentences.csv"
    sentences.write_text("1\tjpn\t水です。\n2\teng\tIt is water.\n", encoding="utf-8")
    links = source_dir / "links.csv"
    links.write_text("1\t2\n", encoding="utf-8")
    tags = source_dir / "tags.csv"
    tags.write_text("1\tOK\n", encoding="utf-8")

    async def fake_prepare(
        _: TatoebaPipeline,
    ) -> tuple[dict[str, Path], dict[str, DownloadResult]]:
        paths = {"sentences": sentences, "links": links, "tags": tags}
        return paths, {name: _download(path) for name, path in paths.items()}

    monkeypatch.setattr(TatoebaPipeline, "_prepare_sources", fake_prepare)
    report_path = tmp_path / "tatoeba-report.json"
    pipeline = TatoebaPipeline(settings, dry_run=True, report_path=report_path)

    report = await pipeline.run()

    assert report.status == "completed"
    assert report.counters.scanned == 1
    assert report.counters.transformed == 1
    assert report.seed_files["N5"] == 1
    assert (settings.sentence_seed_dir / "sentences-N5.json").exists()
    assert report_path.exists()
