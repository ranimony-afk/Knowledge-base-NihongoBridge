from __future__ import annotations

from sqlalchemy import func
from sqlalchemy.dialects import postgresql
from sqlalchemy.dialects.postgresql import insert

from etl.loaders.dictionary_loader import _UPSERT_COLUMNS, dictionary_entries


def test_postgresql_upsert_targets_partial_source_index() -> None:
    record = {
        "word": "水",
        "kana": "みず",
        "romaji": None,
        "furigana": [],
        "meanings": [{"lang": "en", "value": "water", "pos": "noun"}],
        "jlpt_level": "N5",
        "part_of_speech": ["noun"],
        "pitch_accent": None,
        "frequency_rank": 1,
        "kanji_ids": ["水"],
        "tags": [],
        "source": "jmdict: JMdict/EDRDG (CC BY-SA 3.0)",
        "source_id": "1",
        "is_active": True,
    }
    statement = insert(dictionary_entries).values([record])
    statement = statement.on_conflict_do_update(
        index_elements=[dictionary_entries.c.source, dictionary_entries.c.source_id],
        index_where=dictionary_entries.c.source_id.is_not(None),
        set_={column: getattr(statement.excluded, column) for column in _UPSERT_COLUMNS}
        | {"updated_at": func.now()},
    )

    compiled = str(statement.compile(dialect=postgresql.dialect()))

    assert "ON CONFLICT (source, source_id) WHERE source_id IS NOT NULL" in compiled
    assert compiled.startswith("INSERT INTO dictionary_entries (word, kana")
