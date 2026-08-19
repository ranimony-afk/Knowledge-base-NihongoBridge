from __future__ import annotations

import gzip
from collections.abc import Generator
from dataclasses import dataclass, field
from pathlib import Path
from typing import BinaryIO

from lxml import etree

_XML_LANG = "{http://www.w3.org/XML/1998/namespace}lang"


@dataclass(frozen=True, slots=True)
class JMdictKanjiElement:
    expression: str
    information: tuple[str, ...] = ()


@dataclass(frozen=True, slots=True)
class JMdictReadingElement:
    reading: str
    restrictions: tuple[str, ...] = ()
    no_kanji: bool = False


@dataclass(frozen=True, slots=True)
class JMdictGloss:
    language: str
    value: str


@dataclass(frozen=True, slots=True)
class JMdictSense:
    parts_of_speech: tuple[str, ...] = ()
    misc: tuple[str, ...] = ()
    fields: tuple[str, ...] = ()
    dialects: tuple[str, ...] = ()
    glosses: tuple[JMdictGloss, ...] = ()


@dataclass(frozen=True, slots=True)
class JMdictEntry:
    source_id: str
    kanji_elements: tuple[JMdictKanjiElement, ...] = ()
    reading_elements: tuple[JMdictReadingElement, ...] = ()
    senses: tuple[JMdictSense, ...] = ()


@dataclass(slots=True)
class ParserStats:
    entries_seen: int = 0
    entries_yielded: int = 0
    entries_skipped_for_resume: int = 0
    malformed_entries: int = 0
    warnings: list[str] = field(default_factory=list)


def _joined_text(element: etree._Element) -> str:
    return "".join(
        fragment.decode("utf-8") if isinstance(fragment, bytes) else fragment
        for fragment in element.itertext()
    )


def _element_value(element: etree._Element) -> str:
    """Return literal text or an unresolved JMdict entity name such as ``n``."""
    if element.text and element.text.strip():
        return str(element.text).strip()
    for child in element:
        if isinstance(child, etree._Entity):
            return str(child.name)
    return _joined_text(element).strip()


def _values(parent: etree._Element, tag: str) -> tuple[str, ...]:
    return tuple(value for node in parent.findall(tag) if (value := _element_value(node)))


def _open_source(path: Path) -> BinaryIO | gzip.GzipFile:
    if path.suffix.lower() == ".gz":
        return gzip.open(path, "rb")
    return path.open("rb")


class JMdictParser:
    """Memory-bounded JMdict XML parser based on lxml ``iterparse``."""

    def __init__(self) -> None:
        self.stats = ParserStats()

    def iter_entries(
        self,
        path: Path,
        *,
        start_after_source_id: str | None = None,
    ) -> Generator[JMdictEntry, None, None]:
        self.stats = ParserStats()
        resume_sequence = self._sequence_number(start_after_source_id)

        with _open_source(path) as source:
            context = etree.iterparse(
                source,
                events=("end",),
                tag="entry",
                load_dtd=True,
                resolve_entities=False,
                no_network=True,
                recover=False,
                huge_tree=True,
                remove_comments=True,
            )
            for _, element in context:
                self.stats.entries_seen += 1
                try:
                    entry = self._parse_entry(element)
                    if entry is None:
                        self.stats.malformed_entries += 1
                        continue
                    if resume_sequence is not None:
                        current_sequence = self._sequence_number(entry.source_id)
                        if current_sequence is not None and current_sequence <= resume_sequence:
                            self.stats.entries_skipped_for_resume += 1
                            continue
                    self.stats.entries_yielded += 1
                    yield entry
                finally:
                    parent = element.getparent()
                    element.clear(keep_tail=True)
                    if parent is not None:
                        while element.getprevious() is not None:
                            del parent[0]

    def _parse_entry(self, element: etree._Element) -> JMdictEntry | None:
        sequence_node = element.find("ent_seq")
        source_id = _element_value(sequence_node) if sequence_node is not None else ""
        if not source_id:
            self.stats.warnings.append("Skipped an entry without ent_seq")
            return None

        kanji_elements = tuple(
            JMdictKanjiElement(
                expression=expression,
                information=_values(node, "ke_inf"),
            )
            for node in element.findall("k_ele")
            if (expression := (node.findtext("keb") or "").strip())
        )

        reading_elements = tuple(
            JMdictReadingElement(
                reading=reading,
                restrictions=_values(node, "re_restr"),
                no_kanji=node.find("re_nokanji") is not None,
            )
            for node in element.findall("r_ele")
            if (reading := (node.findtext("reb") or "").strip())
        )

        senses: list[JMdictSense] = []
        for sense_node in element.findall("sense"):
            glosses = tuple(
                JMdictGloss(
                    language=gloss_node.get(_XML_LANG, "eng").strip().lower(),
                    value=value,
                )
                for gloss_node in sense_node.findall("gloss")
                if (value := _joined_text(gloss_node).strip())
            )
            senses.append(
                JMdictSense(
                    parts_of_speech=_values(sense_node, "pos"),
                    misc=_values(sense_node, "misc"),
                    fields=_values(sense_node, "field"),
                    dialects=_values(sense_node, "dial"),
                    glosses=glosses,
                )
            )

        return JMdictEntry(
            source_id=source_id,
            kanji_elements=kanji_elements,
            reading_elements=reading_elements,
            senses=tuple(senses),
        )

    @staticmethod
    def _sequence_number(value: str | None) -> int | None:
        if value is None:
            return None
        try:
            return int(value)
        except ValueError:
            return None
