from __future__ import annotations

from etl.enrichers.furigana_enricher import FuriganaEnricher, TokenInfo
from etl.enrichers.jlpt_enricher import JlptEnricher, JlptLoadStats
from etl.enrichers.jlpt_tagger import JlptSentenceTagger


def test_furigana_enricher_wraps_kanji_and_escapes_html() -> None:
    enricher = FuriganaEnricher()

    rendered = enricher.enrich("水を飲む。<")

    assert "<ruby>水" in rendered
    assert "<rt>みず</rt>" in rendered
    assert "<ruby>飲" in rendered
    assert "&lt;" in rendered


def test_jlpt_sentence_tagger_uses_hardest_known_lexical_token() -> None:
    vocabulary = JlptEnricher(
        {"水": "N5", "学生": "N5", "勉強": "N4"},
        JlptLoadStats(files_loaded=2, terms_by_level={"N5": 2, "N4": 1}, unique_terms=3),
    )
    tagger = JlptSentenceTagger(vocabulary)
    tokens = [
        TokenInfo("学生", "ガクセイ", "学生", "名詞"),
        TokenInfo("は", "ハ", "は", "助詞"),
        TokenInfo("勉強", "ベンキョウ", "勉強", "名詞"),
        TokenInfo("する", "スル", "為る", "動詞"),
    ]

    assert tagger.tag(tokens) == "NONE"  # lexical する/為る is not in the list

    tokens.pop()
    assert tagger.tag(tokens) == "N4"
