from __future__ import annotations

import json
import shutil
import sqlite3
import tarfile
from collections.abc import Iterator
from dataclasses import dataclass
from pathlib import Path

from tqdm.auto import tqdm

_LANGUAGE_MAP = {"eng": "en", "tam": "ta", "hin": "hi", "mal": "ml"}
_SQLITE_BATCH = 10_000


@dataclass(frozen=True, slots=True)
class StagedSentence:
    source_id: int
    japanese: str
    translations: list[dict[str, str]]
    tags: list[str]


@dataclass(frozen=True, slots=True)
class StageStats:
    japanese_sentences: int
    relevant_links: int
    translated_sentences: int
    tags: int


def extract_tatoeba_archive(archive: Path, output_directory: Path, filename: str) -> Path:
    """Safely extract one expected CSV member from a Tatoeba tar.bz2 archive."""
    output_directory.mkdir(parents=True, exist_ok=True)
    destination = output_directory / filename
    with tarfile.open(archive, mode="r:bz2") as bundle:
        member = next(
            (
                item
                for item in bundle.getmembers()
                if Path(item.name).name == filename and item.isfile()
            ),
            None,
        )
        if member is None:
            raise FileNotFoundError(f"{filename} was not found inside {archive}")
        source = bundle.extractfile(member)
        if source is None:
            raise OSError(f"Could not read {member.name} from {archive}")
        temporary = destination.with_suffix(destination.suffix + ".tmp")
        with temporary.open("wb") as output:
            shutil.copyfileobj(source, output, length=1024 * 1024)
        temporary.replace(destination)
    return destination


class TatoebaStage:
    """Disk-backed index that avoids loading global Tatoeba exports into RAM."""

    def __init__(self, path: Path) -> None:
        path.parent.mkdir(parents=True, exist_ok=True)
        self.path = path
        self.connection = sqlite3.connect(path)
        self.connection.execute("PRAGMA journal_mode=WAL")
        self.connection.execute("PRAGMA synchronous=NORMAL")
        self.connection.execute("PRAGMA temp_store=MEMORY")
        self.connection.execute("PRAGMA foreign_keys=ON")
        self._create_schema()

    def close(self) -> None:
        self.connection.close()

    def __enter__(self) -> TatoebaStage:
        return self

    def __exit__(self, *_: object) -> None:
        self.close()

    def is_current(self, signature: str) -> bool:
        row = self.connection.execute(
            "SELECT value FROM metadata WHERE key = 'source_signature'"
        ).fetchone()
        completed = self.connection.execute(
            "SELECT value FROM metadata WHERE key = 'stage_complete'"
        ).fetchone()
        return bool(row and completed and row[0] == signature and completed[0] == "1")

    def build(
        self,
        sentences_path: Path,
        links_path: Path,
        tags_path: Path,
        *,
        signature: str,
    ) -> StageStats:
        self._reset_source_tables()
        japanese_rows: list[tuple[int, str]] = []
        with sentences_path.open("r", encoding="utf-8", errors="replace") as source:
            for line in tqdm(source, desc="Indexing Japanese sentences", unit="rows"):
                parsed = _parse_sentence_line(line)
                if parsed is None:
                    continue
                sentence_id, language, sentence = parsed
                if language == "jpn":
                    japanese_rows.append((sentence_id, sentence))
                    if len(japanese_rows) >= _SQLITE_BATCH:
                        self.connection.executemany(
                            "INSERT OR REPLACE INTO japanese(id, text) VALUES (?, ?)",
                            japanese_rows,
                        )
                        japanese_rows.clear()
        if japanese_rows:
            self.connection.executemany(
                "INSERT OR REPLACE INTO japanese(id, text) VALUES (?, ?)", japanese_rows
            )
        self.connection.commit()

        japanese_ids = {int(row[0]) for row in self.connection.execute("SELECT id FROM japanese")}
        link_rows: list[tuple[int, int]] = []
        with links_path.open("r", encoding="utf-8", errors="replace") as source:
            for line in tqdm(source, desc="Indexing translation links", unit="rows"):
                parts = line.rstrip("\r\n").split("\t", 1)
                if len(parts) != 2:
                    continue
                try:
                    left, right = int(parts[0]), int(parts[1])
                except ValueError:
                    continue
                if left in japanese_ids:
                    link_rows.append((left, right))
                if right in japanese_ids:
                    link_rows.append((right, left))
                if len(link_rows) >= _SQLITE_BATCH:
                    self.connection.executemany(
                        "INSERT OR IGNORE INTO links(japanese_id, target_id) VALUES (?, ?)",
                        link_rows,
                    )
                    link_rows.clear()
        if link_rows:
            self.connection.executemany(
                "INSERT OR IGNORE INTO links(japanese_id, target_id) VALUES (?, ?)", link_rows
            )
        self.connection.commit()

        target_ids = {int(row[0]) for row in self.connection.execute("SELECT target_id FROM links")}
        translation_rows: list[tuple[int, str, str]] = []
        with sentences_path.open("r", encoding="utf-8", errors="replace") as source:
            for line in tqdm(source, desc="Indexing linked translations", unit="rows"):
                parsed = _parse_sentence_line(line)
                if parsed is None:
                    continue
                sentence_id, language, sentence = parsed
                normalized_language = _LANGUAGE_MAP.get(language)
                if sentence_id in target_ids and normalized_language:
                    translation_rows.append((sentence_id, normalized_language, sentence))
                    if len(translation_rows) >= _SQLITE_BATCH:
                        self.connection.executemany(
                            "INSERT OR REPLACE INTO translations(id, lang, text) VALUES (?, ?, ?)",
                            translation_rows,
                        )
                        translation_rows.clear()
        if translation_rows:
            self.connection.executemany(
                "INSERT OR REPLACE INTO translations(id, lang, text) VALUES (?, ?, ?)",
                translation_rows,
            )
        self.connection.commit()

        tag_rows: list[tuple[int, str]] = []
        with tags_path.open("r", encoding="utf-8", errors="replace") as source:
            for line in tqdm(source, desc="Indexing Japanese tags", unit="rows"):
                parts = line.rstrip("\r\n").split("\t", 1)
                if len(parts) != 2:
                    continue
                try:
                    sentence_id = int(parts[0])
                except ValueError:
                    continue
                tag = parts[1].strip()
                if sentence_id in japanese_ids and tag:
                    tag_rows.append((sentence_id, tag))
                    if len(tag_rows) >= _SQLITE_BATCH:
                        self.connection.executemany(
                            "INSERT OR IGNORE INTO tags(japanese_id, tag) VALUES (?, ?)", tag_rows
                        )
                        tag_rows.clear()
        if tag_rows:
            self.connection.executemany(
                "INSERT OR IGNORE INTO tags(japanese_id, tag) VALUES (?, ?)", tag_rows
            )

        self.connection.executemany(
            "INSERT OR REPLACE INTO metadata(key, value) VALUES (?, ?)",
            (("source_signature", signature), ("stage_complete", "1")),
        )
        self.connection.commit()
        return self.stats()

    def stats(self) -> StageStats:
        japanese = int(self.connection.execute("SELECT count(*) FROM japanese").fetchone()[0])
        links = int(self.connection.execute("SELECT count(*) FROM links").fetchone()[0])
        translations = int(
            self.connection.execute("SELECT count(*) FROM translations").fetchone()[0]
        )
        tags = int(self.connection.execute("SELECT count(*) FROM tags").fetchone()[0])
        return StageStats(japanese, links, translations, tags)

    def reset_transform_state(self) -> None:
        self.connection.execute("DELETE FROM seen_hashes")
        self.connection.execute("DELETE FROM seed_candidates")
        self.connection.commit()

    def iter_sentences(
        self,
        *,
        after_source_id: int = 0,
        batch_size: int = 250,
    ) -> Iterator[list[StagedSentence]]:
        cursor = after_source_id
        while True:
            japanese_rows = self.connection.execute(
                "SELECT id, text FROM japanese WHERE id > ? ORDER BY id LIMIT ?",
                (cursor, batch_size),
            ).fetchall()
            if not japanese_rows:
                break
            ids = [int(row[0]) for row in japanese_rows]
            placeholders = ",".join("?" for _ in ids)
            translation_rows = self.connection.execute(
                f"""
                SELECT l.japanese_id, t.lang, t.text
                FROM links AS l
                JOIN translations AS t ON t.id = l.target_id
                WHERE l.japanese_id IN ({placeholders})
                ORDER BY l.japanese_id,
                  CASE t.lang WHEN 'en' THEN 1 WHEN 'ta' THEN 2 WHEN 'hi' THEN 3 ELSE 4 END,
                  t.id
                """,
                ids,
            ).fetchall()
            tag_rows = self.connection.execute(
                f"SELECT japanese_id, tag FROM tags WHERE japanese_id IN ({placeholders})",
                ids,
            ).fetchall()

            translations: dict[int, list[dict[str, str]]] = {}
            seen_translation: set[tuple[int, str, str]] = set()
            for japanese_id, language, text_value in translation_rows:
                key = (int(japanese_id), str(language), str(text_value))
                if key in seen_translation:
                    continue
                seen_translation.add(key)
                translations.setdefault(int(japanese_id), []).append(
                    {"lang": str(language), "value": str(text_value)}
                )
            tags: dict[int, list[str]] = {}
            for japanese_id, tag in tag_rows:
                tags.setdefault(int(japanese_id), []).append(str(tag))

            batch = [
                StagedSentence(
                    source_id=int(sentence_id),
                    japanese=str(japanese),
                    translations=translations.get(int(sentence_id), []),
                    tags=tags.get(int(sentence_id), []),
                )
                for sentence_id, japanese in japanese_rows
            ]
            cursor = ids[-1]
            yield batch

    def claim_text_hash(self, digest: str, source_id: int) -> bool:
        cursor = self.connection.execute(
            "INSERT OR IGNORE INTO seen_hashes(hash, source_id) VALUES (?, ?)",
            (digest, source_id),
        )
        return cursor.rowcount == 1

    def release_text_hash(self, digest: str, source_id: int) -> None:
        self.connection.execute(
            "DELETE FROM seen_hashes WHERE hash = ? AND source_id = ?",
            (digest, source_id),
        )

    def add_seed_candidate(
        self,
        *,
        source_id: int,
        level: str,
        score: int,
        payload: dict[str, object],
    ) -> None:
        self.connection.execute(
            """
            INSERT INTO seed_candidates(source_id, level, score, payload)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(source_id) DO UPDATE SET
              level = excluded.level,
              score = excluded.score,
              payload = excluded.payload
            """,
            (source_id, level, score, json.dumps(payload, ensure_ascii=False)),
        )

    def commit_transform_state(self) -> None:
        self.connection.commit()

    def export_seed_files(self, output_directory: Path, limit_per_level: int) -> dict[str, int]:
        output_directory.mkdir(parents=True, exist_ok=True)
        counts: dict[str, int] = {}
        for level in ("N5", "N4", "N3", "N2", "N1"):
            rows = self.connection.execute(
                """
                SELECT payload FROM seed_candidates
                WHERE level = ?
                ORDER BY score DESC, source_id
                LIMIT ?
                """,
                (level, limit_per_level),
            ).fetchall()
            payloads = [json.loads(str(row[0])) for row in rows]
            destination = output_directory / f"sentences-{level}.json"
            temporary = destination.with_suffix(".json.tmp")
            temporary.write_text(
                json.dumps(payloads, ensure_ascii=False, indent=2) + "\n",
                encoding="utf-8",
            )
            temporary.replace(destination)
            counts[level] = len(payloads)
        return counts

    def _create_schema(self) -> None:
        self.connection.executescript(
            """
            CREATE TABLE IF NOT EXISTS metadata (
              key TEXT PRIMARY KEY,
              value TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS japanese (
              id INTEGER PRIMARY KEY,
              text TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS links (
              japanese_id INTEGER NOT NULL,
              target_id INTEGER NOT NULL,
              PRIMARY KEY (japanese_id, target_id)
            ) WITHOUT ROWID;
            CREATE INDEX IF NOT EXISTS links_target_idx ON links(target_id);
            CREATE TABLE IF NOT EXISTS translations (
              id INTEGER PRIMARY KEY,
              lang TEXT NOT NULL,
              text TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS tags (
              japanese_id INTEGER NOT NULL,
              tag TEXT NOT NULL,
              PRIMARY KEY (japanese_id, tag)
            ) WITHOUT ROWID;
            CREATE TABLE IF NOT EXISTS seen_hashes (
              hash TEXT PRIMARY KEY,
              source_id INTEGER NOT NULL
            );
            CREATE TABLE IF NOT EXISTS seed_candidates (
              source_id INTEGER PRIMARY KEY,
              level TEXT NOT NULL,
              score INTEGER NOT NULL,
              payload TEXT NOT NULL
            );
            CREATE INDEX IF NOT EXISTS seed_candidates_level_score_idx
              ON seed_candidates(level, score DESC);
            """
        )
        self.connection.commit()

    def _reset_source_tables(self) -> None:
        self.connection.executescript(
            """
            DELETE FROM metadata;
            DELETE FROM japanese;
            DELETE FROM links;
            DELETE FROM translations;
            DELETE FROM tags;
            DELETE FROM seen_hashes;
            DELETE FROM seed_candidates;
            """
        )
        self.connection.commit()


def _parse_sentence_line(line: str) -> tuple[int, str, str] | None:
    parts = line.rstrip("\r\n").split("\t", 2)
    if len(parts) != 3:
        return None
    try:
        sentence_id = int(parts[0])
    except ValueError:
        return None
    language = parts[1].strip()
    sentence = parts[2].strip()
    if not language or not sentence:
        return None
    return sentence_id, language, sentence
