from __future__ import annotations

import io
import tarfile
from pathlib import Path

from etl.parsers.tatoeba_stager import TatoebaStage, extract_tatoeba_archive


def _write_exports(root: Path) -> tuple[Path, Path, Path]:
    sentences = root / "sentences.csv"
    sentences.write_text(
        "1\tjpn\t水です。\n"
        "2\teng\tIt is water.\n"
        "3\ttam\tஇது தண்ணீர்.\n"
        "4\thin\tयह पानी है।\n"
        "5\tmal\tഇത് വെള്ളമാണ്.\n"
        "6\tfra\tC'est de l'eau.\n"
        "7\tjpn\t猫です。\n",
        encoding="utf-8",
    )
    links = root / "links.csv"
    links.write_text(
        "1\t2\n2\t1\n1\t3\n1\t4\n1\t5\n1\t6\n",
        encoding="utf-8",
    )
    tags = root / "tags.csv"
    tags.write_text("1\tOK\n1\tcolloquial\n", encoding="utf-8")
    return sentences, links, tags


def test_tatoeba_stage_filters_languages_and_deduplicates_reciprocal_links(
    tmp_path: Path,
) -> None:
    sentences, links, tags = _write_exports(tmp_path)
    with TatoebaStage(tmp_path / "stage.sqlite3") as stage:
        stats = stage.build(sentences, links, tags, signature="fixture")
        batches = list(stage.iter_sentences(batch_size=10))

    assert stats.japanese_sentences == 2
    first = batches[0][0]
    assert first.source_id == 1
    assert [translation["lang"] for translation in first.translations] == [
        "en",
        "ta",
        "hi",
        "ml",
    ]
    assert first.tags == ["OK", "colloquial"]
    assert batches[0][1].translations == []


def test_safe_archive_extracts_only_named_csv(tmp_path: Path) -> None:
    archive = tmp_path / "sentences.tar.bz2"
    content = b"1\tjpn\tfixture\n"
    with tarfile.open(archive, "w:bz2") as bundle:
        info = tarfile.TarInfo("exports/sentences.csv")
        info.size = len(content)
        bundle.addfile(info, io.BytesIO(content))

    extracted = extract_tatoeba_archive(archive, tmp_path / "out", "sentences.csv")

    assert extracted.read_bytes() == content
