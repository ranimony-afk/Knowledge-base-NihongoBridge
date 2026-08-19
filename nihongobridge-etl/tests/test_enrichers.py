from __future__ import annotations

import json
import zipfile
from pathlib import Path

from etl.enrichers.frequency_enricher import FrequencyEnricher
from etl.enrichers.jlpt_enricher import JlptEnricher
from etl.transformers.jmdict_transformer import DictionaryRecord


def _record(word: str, kana: str | None = None) -> DictionaryRecord:
    return DictionaryRecord(
        word=word,
        kana=kana,
        romaji=None,
        furigana=[],
        meanings=[{"lang": "en", "value": "fixture", "pos": "noun"}],
        jlpt_level="NONE",
        part_of_speech=["noun"],
        pitch_accent=None,
        frequency_rank=None,
        kanji_ids=[],
        tags=[],
        source="test",
        source_id="1",
    )


def test_jlpt_enricher_supports_csv_json_and_easiest_precedence(tmp_path: Path) -> None:
    (tmp_path / "openjlpt-N5.csv").write_text(
        "expression,reading,meaning\n水,みず,water\n日本,にほん,Japan\n",
        encoding="utf-8",
    )
    (tmp_path / "openjlpt-N4.json").write_text(
        json.dumps([{"word": "水", "reading": "みず"}, {"word": "会社"}], ensure_ascii=False),
        encoding="utf-8",
    )

    enricher = JlptEnricher.from_directory(tmp_path)

    assert enricher.lookup("水") == "N5"
    assert enricher.lookup("会社") == "N4"
    assert enricher.lookup("未知") == "NONE"
    assert enricher.stats.files_loaded == 2


def test_frequency_enricher_converts_occurrence_counts_to_rank(tmp_path: Path) -> None:
    path = tmp_path / "innocent.tsv"
    path.write_text("word\tcount\n水\t1000\n日本\t5000\n学生\t500\n", encoding="utf-8")

    enricher = FrequencyEnricher.from_path(path)
    record = _record("日本", "にほん")
    enricher.enrich(record)

    assert record.frequency_rank == 1
    assert enricher.lookup("水") == 2
    assert enricher.stats.interpreted_as == "count"


def test_frequency_enricher_reads_ranked_yomitan_zip(tmp_path: Path) -> None:
    path = tmp_path / "innocent-ranked.zip"
    with zipfile.ZipFile(path, "w") as archive:
        archive.writestr("index.json", json.dumps({"title": "Innocent Ranked"}))
        archive.writestr(
            "term_meta_bank_1.json",
            json.dumps([["日本", "freq", 3], ["水", "freq", 10]], ensure_ascii=False),
        )

    enricher = FrequencyEnricher.from_path(path)

    assert enricher.lookup("日本") == 3
    assert enricher.lookup("水") == 10
    assert enricher.stats.interpreted_as == "rank"
