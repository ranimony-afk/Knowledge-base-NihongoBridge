# NihongoBridge ETL

Production-oriented Python 3.11+ pipelines for importing Japanese-language knowledge data into the Phase 1 PostgreSQL schema.

Implemented pipelines:

- **JMdict** dictionary download, streaming XML parse, enrichment, and batch upsert
- **Tatoeba** multilingual sentence extraction, furigana, JLPT tagging, content linking, and seed export
- **Edge TTS** sentence/word audio generation with MinIO persistence

## Requirements

- Python 3.11+
- PostgreSQL 15+ with the `nihongobridge-knowledge` Phase 1 migration applied
- OpenJLPT-compatible N5-N1 vocabulary files
- Innocent Corpus data for JMdict frequency enrichment
- MinIO for TTS object storage
- FFmpeg only when generating multi-speaker dialogue files with `pydub`

## Installation

```bash
cd nihongobridge-etl
python3.11 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Apply the knowledge schema first:

```bash
cd ../nihongobridge-knowledge
npm run db:migrate
cd ../nihongobridge-etl
```

---

# JMdict pipeline

The JMdict pipeline:

1. Atomically downloads `JMdict_e.gz` from EDRDG.
2. Computes SHA-256 during transfer and optionally verifies a trusted digest.
3. Validates gzip CRC/truncation.
4. Parses entries using memory-bounded `lxml.iterparse`.
5. Normalizes JMdict POS, usage, field, dialect, and orthography entities.
6. Adds JLPT levels and Innocent Corpus frequency ranks.
7. Checks existing `(source, source_id)` records and runs transactional batch upserts.
8. Writes committed checkpoints and JSON validation reports.

Run:

```bash
python -m etl.pipelines.jmdict_pipeline
```

Development smoke test:

```bash
python -m etl.pipelines.jmdict_pipeline \
  --dry-run --limit 1000 --allow-missing-enrichment
```

Fetch a fresh upstream snapshot:

```bash
python -m etl.pipelines.jmdict_pipeline --force-download
```

## JMdict enrichment files

Place OpenJLPT-compatible `.csv`, `.tsv`, `.txt`, or `.json` files below:

```text
data/enrichment/openjlpt/
├── vocabulary-N5.csv
├── vocabulary-N4.csv
├── vocabulary-N3.csv
├── vocabulary-N2.csv
└── vocabulary-N1.csv
```

Set `INNOCENT_FREQUENCY_PATH` to a Yomitan/Yomichan frequency ZIP, JSON mapping/list, CSV, TSV, or two-column text file. Occurrence counts are converted to deterministic 1-based ranks. Set `FREQUENCY_VALUE_MODE=rank|count` to override automatic interpretation.

---

# Tatoeba sentence pipeline

Source archives:

```text
https://downloads.tatoeba.org/exports/sentences.tar.bz2
https://downloads.tatoeba.org/exports/links.tar.bz2
https://downloads.tatoeba.org/exports/tags.tar.bz2
```

The pipeline performs the following:

1. Downloads and atomically extracts `sentences.csv`, `links.csv`, and `tags.csv`.
2. Builds a disk-backed SQLite stage instead of loading the global exports into RAM.
3. Filters Japanese (`jpn`) sentences and direct English (`eng`), Tamil (`tam`), Hindi (`hin`), and Malayalam (`mal`) links.
4. Converts target language codes to `en`, `ta`, `hi`, and `ml`.
5. Generates escaped `<ruby>` furigana HTML using `fugashi` and `unidic-lite`.
6. Assigns the hardest JLPT level needed by all lexical tokens. Unknown lexical tokens produce `NONE` rather than an unsafe lower-level guess.
7. Resolves dictionary and grammar UUIDs using the Phase 1 content tables.
8. Deduplicates normalized Japanese text with SHA-256 locally and equality-index checks in PostgreSQL.
9. Batch-upserts `sentences` while preserving previously generated `audio_url` values.
10. Exports up to 1,000 ranked seed candidates for each N5-N1 level.

Run:

```bash
python -m etl.pipelines.tatoeba_pipeline
```

Small dry run without PostgreSQL writes:

```bash
python -m etl.pipelines.tatoeba_pipeline \
  --dry-run --limit 1000 --allow-missing-jlpt
```

Refresh all Tatoeba archives:

```bash
python -m etl.pipelines.tatoeba_pipeline --force-download
```

Restart after intentionally changing source exports:

```bash
python -m etl.pipelines.tatoeba_pipeline --restart
```

Generated seeds:

```text
data/seeds/sentences/sentences-N5.json
data/seeds/sentences/sentences-N4.json
data/seeds/sentences/sentences-N3.json
data/seeds/sentences/sentences-N2.json
data/seeds/sentences/sentences-N1.json
```

Candidates are ranked by translation coverage, readable sentence length, and matched vocabulary/grammar coverage.

## Tatoeba staging and resume

`data/tatoeba/tatoeba-stage.sqlite3` contains only Japanese sentences, direct links, requested translations, Japanese tags, text hashes, and seed candidates. Source SHA-256 values form its identity. Extracted CSVs are reused only when their source-digest marker matches the archive.

`.checkpoints/tatoeba.json` advances only after both the PostgreSQL batch and SQLite transform state commit. If an incomplete checkpoint does not match the current export signature, the pipeline requires `--restart` rather than mixing source snapshots.

---

# Edge TTS audio pipeline

The TTS pipeline uses `edge-tts` without an API key and defaults to:

- Female: `ja-JP-NanamiNeural`
- Male: `ja-JP-KeitaNeural`
- Maximum start rate: 10 requests/second
- Concurrent requests: 4

Sentence audio is stored as:

```text
/audio/sentences/{sentence_uuid}.mp3
```

Dictionary pronunciation audio is stored as:

```text
/audio/dictionary/{dictionary_uuid}.mp3
```

Here `audio` is the MinIO bucket and `sentences/...` or `dictionary/...` is the object name. `MINIO_PUBLIC_READ=true` installs a read-only bucket policy so stored URLs can be played by clients; disable it when audio must remain private.

Generate missing sentence and dictionary audio:

```bash
python -m etl.pipelines.tts_pipeline --target all
```

Generate only sentences or a small sample:

```bash
python -m etl.pipelines.tts_pipeline --target sentences --limit 100
```

Regenerate and overwrite existing objects:

```bash
python -m etl.pipelines.tts_pipeline --target all --force
```

## TTS checkpoint behavior

The durable checkpoint is the database `audio_url` plus MinIO object existence:

- Rows with `audio_url` are excluded by default.
- If the object exists but the database update previously failed, the object is reused and the URL is repaired.
- Failed rows are retried from the beginning on the next run.
- `.checkpoints/tts.json` records operational progress and error context without accumulating millions of IDs.

## Dialogue generation

`EdgeTTSClient.synthesize_dialogue()` alternates Nanami and Keita by line, then combines clips in order with `pydub`. Install FFmpeg for this method:

```bash
# Debian/Ubuntu
sudo apt-get install ffmpeg
```

Single-speaker sentence and dictionary generation does not use FFmpeg.

---

# Original JLPT-style question generation

All generators synthesize new prompts exclusively from `dictionary_entries`, `grammar_patterns`, and `sentences`. They do not ingest, scrape, quote, or transform official JLPT papers. Every question stores knowledge-base source IDs, a synthesis method, and `copyrighted_exam_content: false` in `stimulus.provenance`; every inserted row uses `source='generated'`.

Implemented generators:

- `VocabularyQuestionGenerator`
  - kanji reading selection with reading/character-similar distractors
  - English or Tamil meaning selection when localized meanings exist
  - linked-sentence fill-in-the-blank
- `GrammarQuestionGenerator`
  - linked-pattern sentence completion
  - controlled particle-duplication error identification
  - four-part sentence ordering
- `ReadingQuestionGenerator`
  - 100-200 character short passages with two questions
  - 300-500 character medium passages with three questions
  - main idea, detail, vocabulary-in-context, and author-intent questions
  - information-retrieval notices
- `ListeningQuestionGenerator`
  - two-speaker alternating-voice dialogues
  - monologues
  - quick responses
  - review-only transcripts in `questions.stimulus`
  - Edge TTS audio under `audio/questions/{question_uuid}.mp3`

Generate standalone question-bank records:

```bash
python -m etl.pipelines.question_generation_pipeline generate \
  --level N3 --section vocabulary --count 40 --seed 2026
```

Generate all four sections (`--count` applies to each section):

```bash
python -m etl.pipelines.question_generation_pipeline generate \
  --level N3 --section all --count 20
```

Preview generated structures without inserting them:

```bash
python -m etl.pipelines.question_generation_pipeline generate \
  --level N5 --section grammar --count 10 --no-persist
```

Listening generation still creates audio objects when `--no-persist` is used because audio validation is part of listening generation.

## Question quality checks

Before insertion, `QualityChecker` enforces:

- exactly four unique options and one valid answer ID;
- non-empty prompts and explanations;
- valid level, difficulty, time limit, and linked UUIDs;
- passage lengths for short and medium reading types;
- listening transcripts;
- knowledge-base provenance;
- rejection of official/past-exam markers;
- deterministic SHA-256 fingerprints used to suppress duplicate generated questions.

## Test assembly

`TestAssembler` reserves unused generated questions with `FOR UPDATE SKIP LOCKED`, balances difficulty, excludes IDs seen in the user's last 20 sessions, inserts a published `practice_tests` row, and assigns the selected questions in one PostgreSQL transaction.

The prompt-facing test type names map to the Phase 1 database enum:

```text
full_mock    -> mock_full
section_drill -> section_only
```

Assemble a full mock after generating enough items:

```bash
python -m etl.pipelines.question_generation_pipeline assemble \
  --level N3 --test-type full_mock \
  --user-id 00000000-0000-4000-8000-000000000001
```

Assemble a section drill:

```bash
python -m etl.pipelines.question_generation_pipeline assemble \
  --level N3 --test-type section_drill --section listening --count 20 \
  --user-id 00000000-0000-4000-8000-000000000001
```

Default full-mock allocation is 20 vocabulary, 15 grammar, 10 reading, and 15 listening questions. Assembly fails atomically when the unused, quality-approved pool is too small.

---

# Checksums

For strict JMdict verification:

```dotenv
JMDICT_SHA256=<64-character SHA-256>
REQUIRE_SOURCE_CHECKSUM=true
```

For strict Tatoeba verification:

```dotenv
TATOEBA_SENTENCES_SHA256=<digest>
TATOEBA_LINKS_SHA256=<digest>
TATOEBA_TAGS_SHA256=<digest>
TATOEBA_REQUIRE_CHECKSUMS=true
```

Without trusted checksums, downloads still receive SHA-256 and atomic local sidecars using trust-on-first-use. Reports explicitly mark these artifacts as not publisher verified. A forced refresh intentionally ignores an old trust-on-first-use digest and records the new source digest.

# Reports

Each pipeline writes timestamped JSON under `reports/` containing source digests, cache/checksum status, counters, match statistics, bounded error samples, timestamps, duration, and completion status.

# Development checks

```bash
pip install -r requirements-dev.txt
ruff format --check .
ruff check .
mypy etl
pytest
```

# Data attribution

- **JMdict / EDRDG:** requested CC BY-SA 3.0 attribution is embedded in each imported dictionary row.
- **Tatoeba:** `tatoeba: Tatoeba (CC BY 2.0 FR)` is embedded in each sentence source field, and `license:cc-by-2.0-fr` is retained as a tag.
- OpenJLPT and Innocent Corpus files are not redistributed; comply with the license of the specific distribution you obtain.

Keep the platform `/attributions` page and all required share-alike or per-sentence attribution notices when distributing derived data.
