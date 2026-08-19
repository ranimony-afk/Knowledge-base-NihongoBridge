from __future__ import annotations

import gzip
from pathlib import Path

from etl.parsers.jmdict_parser import JMdictParser
from etl.transformers.jmdict_transformer import JMdictTransformer

_FIXTURE = """<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE JMdict [
<!ENTITY n "noun (common) (futsuumeishi)">
<!ENTITY adj-na "adjectival nouns or quasi-adjectives (keiyodoshi)">
<!ENTITY uk "word usually written using kana alone">
<!ENTITY comp "computing">
<!ENTITY ksb "Kansai-ben">
<!ENTITY iK "word containing irregular kanji usage">
]>
<JMdict>
  <entry>
    <ent_seq>1000010</ent_seq>
    <k_ele><keb>水</keb><ke_inf>&iK;</ke_inf></k_ele>
    <r_ele><reb>みず</reb></r_ele>
    <sense>
      <pos>&n;</pos><misc>&uk;</misc><field>&comp;</field><dial>&ksb;</dial>
      <gloss>water</gloss><gloss xml:lang="ger">Wasser</gloss>
    </sense>
    <sense><gloss>fluid</gloss></sense>
  </entry>
  <entry>
    <ent_seq>1000020</ent_seq>
    <r_ele><reb>きれい</reb><re_nokanji/></r_ele>
    <sense><pos>&adj-na;</pos><gloss>pretty</gloss></sense>
  </entry>
</JMdict>
"""


def _write_fixture(path: Path) -> None:
    with gzip.open(path, "wb") as output:
        output.write(_FIXTURE.encode())


def test_streaming_parser_preserves_entity_codes(tmp_path: Path) -> None:
    source = tmp_path / "JMdict_e.xml.gz"
    _write_fixture(source)

    parser = JMdictParser()
    entries = list(parser.iter_entries(source))

    assert [entry.source_id for entry in entries] == ["1000010", "1000020"]
    assert entries[0].senses[0].parts_of_speech == ("n",)
    assert entries[0].senses[0].misc == ("uk",)
    assert entries[0].kanji_elements[0].information == ("iK",)
    assert parser.stats.entries_seen == 2
    assert parser.stats.entries_yielded == 2


def test_resume_skips_committed_sequence_ids(tmp_path: Path) -> None:
    source = tmp_path / "JMdict_e.xml.gz"
    _write_fixture(source)

    parser = JMdictParser()
    entries = list(parser.iter_entries(source, start_after_source_id="1000010"))

    assert [entry.source_id for entry in entries] == ["1000020"]
    assert parser.stats.entries_skipped_for_resume == 1


def test_transformer_maps_schema_and_inherits_pos(tmp_path: Path) -> None:
    source = tmp_path / "JMdict_e.xml.gz"
    _write_fixture(source)
    entry = next(JMdictParser().iter_entries(source))

    result = JMdictTransformer().transform(entry)

    assert result.record is not None
    record = result.record
    assert record.word == "水"
    assert record.kana == "みず"
    assert record.part_of_speech == ["noun"]
    assert record.kanji_ids == ["水"]
    assert record.meanings == [
        {"lang": "en", "value": "water", "pos": "noun"},
        {"lang": "en", "value": "fluid", "pos": "noun"},
    ]
    assert "usage:usually-kana" in record.tags
    assert "field:computing" in record.tags
    assert "dialect:kansai" in record.tags
    assert "orthography:irregular-kanji" in record.tags
    assert "CC BY-SA 3.0" in record.source
