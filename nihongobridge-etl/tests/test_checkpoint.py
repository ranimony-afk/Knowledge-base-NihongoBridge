from __future__ import annotations

from pathlib import Path

from etl.pipelines.jmdict_pipeline import Checkpoint


def test_checkpoint_round_trip_is_atomic(tmp_path: Path) -> None:
    path = tmp_path / "jmdict.json"
    checkpoint = Checkpoint(
        status="running",
        source_sha256="a" * 64,
        last_source_id="12345",
        processed=500,
        updated_at="2026-08-18T00:00:00+00:00",
    )

    checkpoint.write(path)

    assert Checkpoint.load(path) == checkpoint
    assert not path.with_suffix(".json.tmp").exists()
