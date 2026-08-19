from __future__ import annotations

import re
import unicodedata
from dataclasses import asdict, dataclass
from typing import Any, Final

from etl.parsers.jmdict_parser import JMdictEntry

JMDICT_SOURCE_ATTRIBUTION: Final = "jmdict: JMdict/EDRDG (CC BY-SA 3.0)"

POS_MAP: Final[dict[str, str]] = {
    "adj-f": "noun or verb acting prenominally",
    "adj-i": "i-adjective",
    "adj-ix": "irregular i-adjective",
    "adj-kari": "kari adjective",
    "adj-ku": "ku adjective",
    "adj-na": "na-adjective",
    "adj-nari": "nari adjective",
    "adj-no": "no-adjective",
    "adj-pn": "pre-noun adjectival",
    "adj-shiku": "shiku adjective",
    "adj-t": "taru adjective",
    "adv": "adverb",
    "adv-to": "adverb taking to",
    "aux": "auxiliary",
    "aux-adj": "auxiliary adjective",
    "aux-v": "auxiliary verb",
    "conj": "conjunction",
    "cop": "copula",
    "ctr": "counter",
    "exp": "expression",
    "int": "interjection",
    "n": "noun",
    "n-adv": "adverbial noun",
    "n-pr": "proper noun",
    "n-pref": "noun used as a prefix",
    "n-suf": "noun used as a suffix",
    "n-t": "temporal noun",
    "num": "numeric",
    "pn": "pronoun",
    "pref": "prefix",
    "prt": "particle",
    "suf": "suffix",
    "unc": "unclassified",
    "v-unspec": "verb (unspecified)",
    "v1": "ichidan verb",
    "v1-s": "ichidan verb (kureru special class)",
    "v2a-s": "nidan verb",
    "v2b-k": "nidan verb",
    "v2b-s": "nidan verb",
    "v2d-k": "nidan verb",
    "v2d-s": "nidan verb",
    "v2g-k": "nidan verb",
    "v2g-s": "nidan verb",
    "v2h-k": "nidan verb",
    "v2h-s": "nidan verb",
    "v2k-k": "nidan verb",
    "v2k-s": "nidan verb",
    "v2m-k": "nidan verb",
    "v2m-s": "nidan verb",
    "v2n-s": "nidan verb",
    "v2r-k": "nidan verb",
    "v2r-s": "nidan verb",
    "v2s-s": "nidan verb",
    "v2t-k": "nidan verb",
    "v2t-s": "nidan verb",
    "v2w-s": "nidan verb",
    "v2y-k": "nidan verb",
    "v2y-s": "nidan verb",
    "v2z": "nidan verb",
    "v4b": "yodan verb",
    "v4g": "yodan verb",
    "v4h": "yodan verb",
    "v4k": "yodan verb",
    "v4m": "yodan verb",
    "v4n": "yodan verb",
    "v4r": "yodan verb",
    "v4s": "yodan verb",
    "v4t": "yodan verb",
    "v5aru": "godan verb (aru special class)",
    "v5b": "godan verb ending in bu",
    "v5g": "godan verb ending in gu",
    "v5k": "godan verb ending in ku",
    "v5k-s": "godan verb (iku/yuku special class)",
    "v5m": "godan verb ending in mu",
    "v5n": "godan verb ending in nu",
    "v5r": "godan verb ending in ru",
    "v5r-i": "irregular godan verb ending in ru",
    "v5s": "godan verb ending in su",
    "v5t": "godan verb ending in tsu",
    "v5u": "godan verb ending in u",
    "v5u-s": "godan verb ending in u (special class)",
    "v5uru": "godan verb (uru old class)",
    "vi": "intransitive verb",
    "vk": "kuru verb",
    "vn": "irregular nu verb",
    "vr": "irregular ru verb",
    "vs": "suru verb",
    "vs-c": "su verb precursor to suru",
    "vs-i": "suru verb (included)",
    "vs-s": "suru verb (special class)",
    "vt": "transitive verb",
    "vz": "zuru verb",
}

MISC_MAP: Final[dict[str, str]] = {
    "abbr": "usage:abbreviation",
    "arch": "usage:archaic",
    "char": "usage:character",
    "chn": "usage:children",
    "col": "usage:colloquial",
    "company": "name:company",
    "dated": "usage:dated",
    "derog": "usage:derogatory",
    "euph": "usage:euphemistic",
    "fam": "usage:familiar",
    "fem": "usage:feminine",
    "form": "usage:formal",
    "hist": "usage:historical",
    "hon": "usage:honorific",
    "hum": "usage:humble",
    "id": "usage:idiomatic",
    "joc": "usage:humorous",
    "m-sl": "usage:manga-slang",
    "male": "usage:male",
    "male-sl": "usage:male-slang",
    "net-sl": "usage:internet-slang",
    "obs": "usage:obsolete",
    "obsc": "usage:obscure",
    "on-mim": "usage:onomatopoeic",
    "poet": "usage:poetic",
    "pol": "usage:polite",
    "proverb": "usage:proverb",
    "rare": "usage:rare",
    "sens": "usage:sensitive",
    "sl": "usage:slang",
    "uk": "usage:usually-kana",
    "vulg": "usage:vulgar",
    "yoji": "usage:yojijukugo",
}

FIELD_MAP: Final[dict[str, str]] = {
    "anat": "field:anatomy",
    "archeol": "field:archaeology",
    "archit": "field:architecture",
    "art": "field:art",
    "astron": "field:astronomy",
    "audvid": "field:audiovisual",
    "aviat": "field:aviation",
    "baseb": "field:baseball",
    "biochem": "field:biochemistry",
    "biol": "field:biology",
    "bot": "field:botany",
    "bus": "field:business",
    "chem": "field:chemistry",
    "comp": "field:computing",
    "econ": "field:economics",
    "engr": "field:engineering",
    "finc": "field:finance",
    "food": "field:food",
    "geol": "field:geology",
    "law": "field:law",
    "ling": "field:linguistics",
    "mahj": "field:mahjong",
    "math": "field:mathematics",
    "med": "field:medicine",
    "mil": "field:military",
    "music": "field:music",
    "physics": "field:physics",
    "politics": "field:politics",
    "psych": "field:psychology",
    "relig": "field:religion",
    "sports": "field:sports",
    "sumo": "field:sumo",
    "zool": "field:zoology",
}

DIALECT_MAP: Final[dict[str, str]] = {
    "bra": "dialect:brazilian",
    "hob": "dialect:hokkaido",
    "ksb": "dialect:kansai",
    "ktb": "dialect:kantou",
    "kyb": "dialect:kyoto",
    "kyu": "dialect:kyushu",
    "nab": "dialect:nagano",
    "osb": "dialect:osaka",
    "rkb": "dialect:ryukyu",
    "thb": "dialect:tohoku",
    "tsb": "dialect:tosa",
    "tsug": "dialect:tsugaru",
}

KANJI_INFO_MAP: Final[dict[str, str]] = {
    "ateji": "orthography:ateji",
    "iK": "orthography:irregular-kanji",
    "ik": "orthography:irregular-kana",
    "io": "orthography:irregular-okurigana",
    "oK": "orthography:outdated-kanji",
    "ok": "orthography:outdated-kana",
    "rK": "orthography:rare-kanji",
    "sK": "orthography:search-only-kanji",
}

_SPACE_PATTERN: Final = re.compile(r"\s+")


@dataclass(slots=True)
class DictionaryRecord:
    word: str
    kana: str | None
    romaji: str | None
    furigana: list[dict[str, str]]
    meanings: list[dict[str, str]]
    jlpt_level: str
    part_of_speech: list[str]
    pitch_accent: dict[str, Any] | None
    frequency_rank: int | None
    kanji_ids: list[str]
    tags: list[str]
    source: str
    source_id: str
    is_active: bool = True

    def to_mapping(self) -> dict[str, Any]:
        return asdict(self)


@dataclass(frozen=True, slots=True)
class TransformResult:
    record: DictionaryRecord | None
    warnings: tuple[str, ...] = ()
    skip_reason: str | None = None


def normalize_text(value: str) -> str:
    return _SPACE_PATTERN.sub(" ", unicodedata.normalize("NFKC", value).strip())


def _normalize_entity_code(value: str) -> str:
    return value.strip().strip("&;")


def _mapped_tag(code: str, mapping: dict[str, str], prefix: str) -> str:
    normalized = _normalize_entity_code(code)
    if normalized in mapping:
        return mapping[normalized]
    return f"{prefix}:{normalized.lower().replace('_', '-').replace(' ', '-')}"


def _is_kanji(character: str) -> bool:
    codepoint = ord(character)
    return (
        0x3400 <= codepoint <= 0x4DBF
        or 0x4E00 <= codepoint <= 0x9FFF
        or 0xF900 <= codepoint <= 0xFAFF
        or 0x20000 <= codepoint <= 0x3134F
    )


class JMdictTransformer:
    """Map parsed JMdict entries into the Phase 1 dictionary schema."""

    def __init__(self, source_attribution: str = JMDICT_SOURCE_ATTRIBUTION) -> None:
        self.source_attribution = source_attribution
        self.unknown_pos_codes: set[str] = set()

    def transform(self, entry: JMdictEntry) -> TransformResult:
        warnings: list[str] = []
        word = (
            entry.kanji_elements[0].expression
            if entry.kanji_elements
            else entry.reading_elements[0].reading
            if entry.reading_elements
            else ""
        )
        word = normalize_text(word)
        if not word:
            return TransformResult(None, skip_reason="entry has no written or reading form")

        kana = normalize_text(entry.reading_elements[0].reading) if entry.reading_elements else None

        inherited_pos: tuple[str, ...] = ()
        all_pos: list[str] = []
        meanings: list[dict[str, str]] = []
        tags: list[str] = []
        seen_meanings: set[tuple[str, str, str]] = set()

        for sense in entry.senses:
            if sense.parts_of_speech:
                inherited_pos = sense.parts_of_speech
            readable_pos = tuple(self._normalize_pos(code) for code in inherited_pos)
            for value in readable_pos:
                if value not in all_pos:
                    all_pos.append(value)
            meaning_pos = ", ".join(readable_pos) if readable_pos else "unspecified"

            for gloss in sense.glosses:
                if gloss.language not in {"eng", "en"}:
                    continue
                value = normalize_text(gloss.value)
                key = ("en", value, meaning_pos)
                if value and key not in seen_meanings:
                    meanings.append({"lang": "en", "value": value, "pos": meaning_pos})
                    seen_meanings.add(key)

            tags.extend(_mapped_tag(code, MISC_MAP, "usage") for code in sense.misc)
            tags.extend(_mapped_tag(code, FIELD_MAP, "field") for code in sense.fields)
            tags.extend(_mapped_tag(code, DIALECT_MAP, "dialect") for code in sense.dialects)

        for kanji_element in entry.kanji_elements:
            tags.extend(
                _mapped_tag(code, KANJI_INFO_MAP, "orthography")
                for code in kanji_element.information
            )

        if not meanings:
            return TransformResult(None, skip_reason="entry has no English gloss")
        if not all_pos:
            warnings.append(f"JMdict {entry.source_id} has no part-of-speech tag")

        unique_tags = list(dict.fromkeys(tag for tag in tags if tag and not tag.endswith(":")))
        kanji_ids = list(dict.fromkeys(character for character in word if _is_kanji(character)))

        return TransformResult(
            DictionaryRecord(
                word=word,
                kana=kana,
                romaji=None,
                furigana=[],
                meanings=meanings,
                jlpt_level="NONE",
                part_of_speech=all_pos,
                pitch_accent=None,
                frequency_rank=None,
                kanji_ids=kanji_ids,
                tags=unique_tags,
                source=self.source_attribution,
                source_id=entry.source_id,
            ),
            warnings=tuple(warnings),
        )

    def _normalize_pos(self, code: str) -> str:
        normalized = _normalize_entity_code(code)
        mapped = POS_MAP.get(normalized)
        if mapped:
            return mapped
        self.unknown_pos_codes.add(normalized)
        return normalized.replace("-", " ").replace("_", " ")
