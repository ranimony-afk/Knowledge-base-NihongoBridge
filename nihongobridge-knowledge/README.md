# NihongoBridge Knowledge Schema — Phase 1

Production-oriented PostgreSQL schema for the NihongoBridge knowledge, JLPT testing, SRS, progress, and media domains. It uses Drizzle ORM with PostgreSQL-native JSONB, arrays, full-text search, integrity constraints, and normalized relations.

## Requirements

- Node.js 20+
- PostgreSQL 15+
- A database user allowed to install `pgcrypto` and `pg_trgm` during the initial migration

## Setup

```bash
cp .env.example .env
npm install
npm run typecheck
npm run db:migrate
npm run seed:n5
```

Generate a future migration after changing the schema:

```bash
npm run db:generate
```

## Schema modules

### Core knowledge

- `schema/dictionary.ts` — multilingual dictionary entries
- `schema/kanji.ts` — readings, meanings, radicals, strokes, and mnemonics
- `schema/grammar.ts` — grammar formations, examples, and related patterns
- `schema/sentences.ts` — multilingual example sentences

### Learning platform

- `schema/tests.ts` — practice tests, question bank, and test sessions
- `schema/srs.ts` — SRS decks, cards, and immutable review logs with SM-2-compatible fields
- `schema/users.ts` — users, progress, and bookmarks
- `schema/media.ts` — audio, image, SVG, PDF, and video assets

### Shared infrastructure

- `schema/enums.ts` — PostgreSQL enums and matching TypeScript unions
- `schema/relations.ts` — normalized bridge tables and all Drizzle relations
- `schema/types.ts` — strongly typed JSONB structures
- `schema/index.ts` — complete schema and inferred select/insert type exports
- `drizzle/` — complete drizzle-kit migration and metadata
- `seeds/n5.ts` — idempotent N5 fixture template
- `scripts/seed-n5.ts` — executable N5 seed command

## N5 seed fixture

`npm run seed:n5` inserts fixed, repeatable development data:

- 5 words: 食べる, 飲む, 水, 学生, 日本
- 5 kanji: 日, 本, 水, 食, 学
- 3 grammar patterns: 〜です, 〜ます, 〜てください
- 2 original questions: one vocabulary and one grammar question
- Normalized word–kanji and question–content links

The fixture uses stable UUIDs and `ON CONFLICT DO NOTHING`, so it can safely run more than once.

## Relation strategy

Several requested fields use UUID/text arrays or polymorphic `(item_type, item_id)` pairs. PostgreSQL cannot attach an element-level foreign key to an array, and Drizzle cannot infer a discriminated relation from a polymorphic UUID.

This implementation therefore uses:

1. **Normalized bridge tables** as the integrity-enforced source of truth for dictionary, kanji, grammar, sentence, and question relationships.
2. **Requested array fields** as denormalized ETL/read projections, updated in the same transaction as bridge rows.
3. **Real foreign keys** for users, tests, sessions, decks, and cards.
4. **Application-level content resolution** for SRS cards, progress, bookmarks, and media polymorphic references.

The composite SRS deck foreign key guarantees that a card cannot be assigned to another user's deck. A database trigger maintains `srs_decks.card_count` atomically when cards are added, removed, or moved.

## Integrity and lifecycle behavior

- Case-insensitive unique email addresses and usernames
- Unique SRS item per user
- Unique progress/bookmark records per user and content item
- JSONB shape checks for arrays and objects
- Range checks for scores, accuracy, difficulty, SRS factors, time, and counts
- Source-ID deduplication for imported dictionary and sentence data
- Cascading deletion for user-owned progress/SRS records
- Restricted deletion for tests with completed or active sessions
- Automatic database-side `updated_at` triggers

## Search strategy

- B-tree indexes support equality, level, grade, ownership, due-date, and frequency filters.
- `pg_trgm` GIN indexes support fast Japanese substring and autocomplete searches.
- JSONB and array GIN indexes support containment and tag queries.
- Expression GIN indexes use PostgreSQL `simple` tokenization for Japanese text and `english` tokenization for translations and explanations.

For morphological Japanese ranking at larger scale, later phases can add PGroonga or Meilisearch without changing the canonical records.

## Validation

The repository is checked with:

```bash
npm run typecheck
DATABASE_URL=postgresql://... npx drizzle-kit check
npm audit --audit-level=high
```

The migrations include extension setup, all 23 tables, indexes, constraints, foreign keys, timestamp triggers, the SRS deck-count trigger, and immutable `srs_review_logs` events for daily/30-day analytics.
