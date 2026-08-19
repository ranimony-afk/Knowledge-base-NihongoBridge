# NihongoBridge API — Dictionary and Kanji

Next.js 14 App Router route handlers for the NihongoBridge dictionary and kanji APIs. The service uses the canonical Drizzle schema from `nihongobridge-knowledge`, PostgreSQL, Redis, optional Meilisearch, and Zod request validation.

## Requirements

- Node.js 20+
- PostgreSQL 15+ with the Phase 1 migration applied
- Redis 7+ for distributed cache and rate limiting
- Optional Meilisearch
- Sibling repository layout:

```text
/home/user/
├── nihongobridge-api/
└── nihongobridge-knowledge/
```

## Setup

Build the shared schema package, then install and run the API:

```bash
cd ../nihongobridge-knowledge
npm install
npm run build:package

cd ../nihongobridge-api
cp .env.example .env.local
npm install
npm run dev
```

Production validation:

```bash
npm run typecheck
npm run test
npm run build
```

## Response contract

Every route returns:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "limit": 20,
    "total": 0
  }
}
```

The successful audio-stream route is the sole binary-response exception; its errors still use the JSON envelope. Errors preserve the same envelope:

```json
{
  "data": null,
  "meta": {
    "page": 1,
    "limit": 0,
    "total": 0
  },
  "error": "Request description"
}
```

## Routes

### Dictionary

| Method | Route | Description | Cache |
|---|---|---|---|
| GET | `/api/dictionary/search` | Japanese/English full-text search with level and POS filters | 1 hour |
| GET | `/api/dictionary/:id` | Entry, three sentences, kanji, and grammar | 24 hours |
| GET | `/api/dictionary/autocomplete` | Prefix suggestions by word/kana | 30 minutes |
| GET | `/api/dictionary/random` | Random active entries | No cache |
| POST | `/api/dictionary/bulk` | Fetch up to 100 UUIDs in request order | No cache |

### Kanji

| Method | Route | Description | Cache |
|---|---|---|---|
| GET | `/api/kanji/:character` | Kanji, stroke assets, five words, and similar kanji | 24 hours |
| GET | `/api/kanji/search` | Meaning, reading, radical, grade, stroke, and level search | 1 hour |
| GET | `/api/kanji/by-radical/:radical` | Paginated radical lookup | 1 hour |
| GET | `/api/kanji/level/:level` | Paginated JLPT-level lookup | 1 hour |
| GET | `/api/kanji/:character/quiz` | Reading, meaning, or combined quiz prompt | 24 hours |

Every route contains an OpenAPI 3.0 `@openapi` JSDoc block suitable for a source scanner such as `swagger-jsdoc`.

## Practice-test engine

### Test routes

| Method | Route | Description |
|---|---|---|
| POST | `/api/tests/start` | Find/assemble a test, create PostgreSQL and Redis session state |
| GET | `/api/tests/session/:sessionId` | Current public question, saved selections, and server timer |
| POST | `/api/tests/session/:sessionId/answer` | Atomically record/replace an answer without exposing correctness |
| POST | `/api/tests/session/:sessionId/complete` | Score, persist, award XP, update streak/progress |
| GET | `/api/tests/session/:sessionId/review` | Completed answer keys, explanations, mistakes, vocabulary, and grammar |
| GET | `/api/tests/history` | Paginated completed sessions with score deltas |
| GET | `/api/tests/:testId/questions` | Admin-only full question preview |
| GET | `/api/tests/analytics/:userId` | Accuracy, streak, weak types, and next-study recommendation |

### Listening routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/listening/:questionId/audio` | Stream MinIO/external MP3 with single-range support |
| POST | `/api/listening/generate` | Admin-only alternating Japanese Edge TTS generation |

### Session integrity

Active state is stored under `tests:session:{sessionId}` by default. Redis writes use short distributed locks so simultaneous answer requests cannot overwrite one another. Development can fall back to bounded process memory; production should set:

```dotenv
SESSION_REQUIRE_REDIS=true
```

PostgreSQL receives the durable session row when a test starts and the final answer array/scores when it completes. If Redis creation fails after the database insert, the start operation compensates by deleting the unstarted row. Completion uses a separate lock and a conditional database update to prevent duplicate XP awards.

All student-facing question serializers omit:

- `correct_answer`
- Japanese/English explanations
- listening transcripts/scripts

Those fields become available only through the completed review route. Admin preview requires an authenticated admin/content-editor role.

### Scoring

Full mocks scale each group independently:

- Vocabulary: 60 points
- Grammar + Reading: 60 points
- Listening: 60 points
- Total: 180 points

A full mock passes at 90 points only when every group also reaches 19/60. A section drill is scored out of 60 and passes at 30 while still enforcing the 19-point minimum.

Completion awards 10 XP plus 2 XP per correct answer. Streak updates and polymorphic vocabulary/grammar progress upserts occur in the same PostgreSQL transaction as final scoring.

### Test assembly

`lib/testAssembler.ts` first reuses an eligible published test not previously taken by the user. If none exists, it atomically reserves standalone generated questions using `FOR UPDATE SKIP LOCKED`, excludes IDs seen in the last 20 sessions, balances difficulty, creates `practice_tests`, and assigns all question rows. Prompt-facing `full_mock`/`section_drill` values map to the Phase 1 `mock_full`/`section_only` enum values.

### Authentication

Protected test routes verify Supabase JWTs using either:

- `SUPABASE_JWT_SECRET` for HS256 projects; or
- the Supabase JWKS endpoint derived from `SUPABASE_URL`.

Session, history, review, and analytics routes compare the verified JWT subject with the requested user. The local `X-User-Id` fallback is available only outside production and only when `ALLOW_INSECURE_USER_HEADER=true`.

### Listening storage and TTS

The audio endpoint forwards valid `Range` headers to MinIO/S3 and returns `206`, `Content-Range`, `Content-Length`, `Accept-Ranges`, ETag, and a one-day public cache policy when available. If a configured object is absent, it can proxy the canonical `audio_url` only when its host appears in `AUDIO_PROXY_ALLOWED_HOSTS` (or matches the configured MinIO endpoint), preventing database-driven SSRF.

The admin generation route accepts up to 50 lines/5,000 characters, restricts voices to Japanese neural voice identifiers, alternates female/male voices, enforces 10 synthesis starts per second, retries transient failures, concatenates MP3 clips, and uploads the result to the configured audio bucket. The bucket is created when absent; `MINIO_PUBLIC_READ=true` applies a read-only object policy for browser playback.

## SRS, grammar, user, and global search APIs

### SRS routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/srs/due` | Overdue-first cards with fully hydrated content |
| POST | `/api/srs/review` | Transactional SM-2 update and immutable review event |
| POST | `/api/srs/add` | Validate and add a unique content item/deck assignment |
| GET | `/api/srs/stats/:userId` | Due/studied/mastered/streak and exact 30-day accuracy |

`lib/srs.ts` implements the requested formulas and clamps ease to 1.3-2.5. Integer day intervals use nearest-day rounding with a one-day minimum. Card updates, review logs, and user-progress updates occur in one row-locked transaction. The knowledge schema now includes `srs_review_logs` through migration `0001_narrow_apocalypse.sql`, allowing exact daily and 30-day statistics instead of approximating from lifetime card totals.

### Grammar routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/grammar/search` | Pattern/meaning full-text search |
| GET | `/api/grammar/:id` | Complete examples, formation, notes, and related patterns |
| GET | `/api/grammar/level/:level` | Paginated JLPT-level list |
| GET | `/api/grammar/:id/quiz` | Random four-sentence linked-content quiz |

Grammar search uses the Phase 1 weighted `simple`/`english` GIN expression and trigram ranking. Quiz generation selects a sentence linked through `sentence_grammar_links` (falling back to the denormalized UUID array) and three same-level distractors.

### User routes

| Method | Route | Description |
|---|---|---|
| GET | `/api/user/:userId/dashboard` | Streak, XP, levels, due cards, scores, bookmarks, seven-day activity, recommendation |
| POST | `/api/user/:userId/bookmark` | Idempotently add a validated content bookmark |
| DELETE | `/api/user/:userId/bookmark/:bookmarkId` | Delete a user-owned bookmark |
| GET | `/api/user/:userId/bookmarks` | Filtered bookmarks with hydrated content |

All user and SRS routes require a verified owner/admin identity. Polymorphic word, kanji, grammar, and sentence references are validated before writes and hydrated in bulk to avoid per-card/per-bookmark database queries.

### Unified search

`GET /api/search` accepts `q`, comma-separated `types`, `level`, and `limit`. `lib/search-index.ts` provides Meilisearch index configuration, batch indexing, deletion, and multi-index query functions for dictionary, kanji, grammar, and sentences. Results are hydrated from PostgreSQL in Meilisearch rank order. A PostgreSQL full-text fallback remains available if Meilisearch is unavailable.

Responses are grouped as:

```json
{
  "words": [],
  "kanji": [],
  "grammar": [],
  "sentences": []
}
```

## Dictionary search

When `MEILISEARCH_URL` is present, the API searches the configured dictionary index and hydrates ranked IDs from PostgreSQL. If Meilisearch times out or rejects the query, it falls back to PostgreSQL automatically.

The PostgreSQL fallback uses the expression GIN indexes created by the knowledge migration:

- PostgreSQL `simple` tokenization for Japanese word, kana, and romaji fields
- PostgreSQL `english` tokenization for translated JSONB meanings
- trigram similarity and safe substring fallback
- GIN array filtering for parts of speech

Responses include:

```text
X-Cache: HIT | MISS
X-Search-Engine: meilisearch | postgresql
```

The Meilisearch index should contain active entries only. PostgreSQL hydration also excludes inactive entries.

## Cache behavior

`middleware/cache.ts` provides:

- SHA-256 parameter-based keys
- Redis JSON cache with explicit TTLs
- bounded in-memory development/failure fallback
- in-flight request coalescing to prevent cache stampedes
- namespace isolation through `CACHE_NAMESPACE`

The random and bulk endpoints intentionally bypass shared content caching.

## Rate limiting

All routes enforce a fixed 60-second window:

- Anonymous/IP: 100 requests per minute
- Authenticated: 1,000 requests per minute

The authenticated tier is only activated when already-verified authentication middleware passes `authenticatedUserId` to `rateLimit()`. Raw client headers never grant the larger quota. Phase 3.3 can connect Supabase JWT verification to this argument.

Rate-limit headers:

```text
X-RateLimit-Limit
X-RateLimit-Remaining
X-RateLimit-Reset
Retry-After
```

Redis uses an atomic Lua increment/expiry operation. If Redis is unavailable, the default behavior uses a bounded per-process fallback. Set `RATE_LIMIT_FAIL_OPEN=false` to reject requests instead. Deploy behind a trusted proxy that overwrites `X-Forwarded-For`; do not forward a client-supplied value unchanged.

## Data integrity behavior

- All query/body/path inputs pass through Zod.
- UUID and maximum-batch constraints are enforced before database access.
- SQL expressions use Drizzle parameter binding; user input is never interpolated into SQL text.
- Detail routes use normalized Phase 1 bridge tables first and denormalized ID arrays as a compatibility fallback.
- Bulk and Meilisearch hydration preserve request/ranking order.
- Quiz routes omit hidden answers from the network response.

## Tests

The Vitest suite covers:

- pagination and Zod coercion;
- Unicode kanji validation;
- bulk UUID limits and deduplication;
- cache HIT/MISS, negative-cache policy, and request coalescing;
- anonymous and authenticated rate tiers;
- route validation envelopes and cached search headers;
- Redis-session memory fallback and atomic answer updates;
- non-disclosure of answer keys during a test;
- 180-point scoring, section minimums, and section drills;
- all four SM-2 confidence formulas and ease/interval clamps;
- unified-search type parsing and Japanese-only TTS validation;
- byte-range rejection and admin-only TTS authorization.

## Framework security note

The requested runtime is pinned to the latest Next.js 14 release (`14.2.35`). As of this build, `npm audit` reports one high-severity advisory group against all Next.js versions through 15.5.20, with the automated fix requiring Next.js 16. The API does not configure image optimization, rewrites, middleware redirects, CSP nonces, or Server Actions, reducing exposure to several listed advisories, but package-level risk remains.

Before public production deployment, either:

1. approve an upgrade to a currently supported patched Next.js major; or
2. place the API behind a request-limiting reverse proxy/WAF and apply the relevant upstream mitigations.

This exception is documented rather than hidden; all other installed dependencies currently pass `npm audit`.
