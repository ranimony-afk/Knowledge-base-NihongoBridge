# NihongoBridge Search

Self-hosted Meilisearch infrastructure, PostgreSQL synchronization, Japanese query normalization, faceted multi-index search, and a dedicated low-latency autocomplete service.

## Architecture

```text
PostgreSQL knowledge tables
        │
        ├── scheduled full/incremental sync
        └── LISTEN/NOTIFY change events
                    │
                    ▼
             Meilisearch :7700
        ┌───────────┼────────────┐
        │           │            │
 dictionary      kanji        grammar       sentences
        │
 autocomplete (lightweight)
        │
        ▼
 Fastify autocomplete/search service :7701
```

## Requirements

- Node.js 20+
- Docker Compose
- PostgreSQL with the `nihongobridge-knowledge` migrations applied
- Network access from the sync/service process to PostgreSQL and Meilisearch

## Quick start

```bash
cd nihongobridge-search
cp .env.example .env
npm install

docker compose up -d
npm run indexes:configure
npm run sync:full
npm run dev
```

Check:

```bash
curl http://localhost:7701/health
curl 'http://localhost:7701/autocomplete?q=みず&limit=10'
curl 'http://localhost:7701/search?q=water&types=dictionary,kanji&level=N5'
```

## Docker Compose

`docker-compose.yml` runs the requested self-hosted service:

```yaml
services:
  meilisearch:
    image: getmeili/meilisearch:latest
    environment:
      MEILI_MASTER_KEY: ${MEILI_MASTER_KEY}
    volumes:
      - ./meili_data:/meili_data
    ports:
      - "7700:7700"
```

It also disables telemetry and uses `restart: unless-stopped`. For reproducible production deployments, pin the image to an approved Meilisearch release or digest after compatibility testing.

Generate a strong master key before exposing the service:

```bash
openssl rand -hex 32
```

Never expose the master key to browser code. Browser autocomplete should call the Fastify endpoint or the NihongoBridge API.

## Indexes

Run:

```bash
npm run indexes:configure
```

`search/setup/configure-indexes.ts` idempotently creates and configures:

### `dictionary`

- Searchable: `word`, `kana`, `romaji`, `meanings`, normalized variants
- Filterable: `jlpt_level`, `part_of_speech`, `tags`, `has_audio`
- Sortable: `frequency_rank`
- Japanese-aware typo tolerance enabled

### `kanji`

- Searchable: `character`, `onyomi`, `kunyomi`, `meanings`, normalized variants
- Filterable: `jlpt_level`, `grade`, `stroke_count`
- Sortable: frequency and stroke count
- Exact character field excluded from typo expansion

### `grammar`

- Searchable: `pattern`, `pattern_plain`, `meaning`, normalized variants
- Filterable: `jlpt_level`

### `sentences`

- Searchable: `japanese`, `translations`, normalized variants
- Filterable: `jlpt_level`

### `autocomplete`

A lightweight index containing only:

- `id`
- `word`
- `kana`
- internal normalized text, hidden from responses

All task-producing configuration operations are awaited and fail the command if Meilisearch reports a task error.

## PostgreSQL synchronization

### Full synchronization

```bash
npm run sync:full
```

A full run:

1. reads all four source tables;
2. transforms rows into search documents;
3. pushes batches of 1,000 by default;
4. updates the autocomplete index with active dictionary rows;
5. removes inactive dictionary rows;
6. compares Meilisearch IDs with PostgreSQL IDs and deletes stale documents;
7. writes an atomic state file.

Change `SEARCH_BATCH_SIZE` from 100 to 5,000 when tuning memory and indexing throughput.

### Incremental synchronization

```bash
npm run sync:incremental
```

Incremental mode selects only rows where `updated_at` is newer than the saved source timestamp. Each source checkpoint is written only after all its Meilisearch tasks succeed.

State:

```text
state/last-sync.json
```

The sync uses an exclusive lock file so scheduled jobs cannot overlap:

```text
state/sync.lock
```

Locks older than one hour are considered stale and safely replaced.

Example cron:

```cron
*/10 * * * * cd /srv/nihongobridge-search && npm run sync:incremental
0 4 * * 0 cd /srv/nihongobridge-search && npm run sync:full
```

Scheduled full reconciliation is still recommended because a timestamp-only incremental feed cannot infer rows deleted while the listener was offline.

## Real-time LISTEN/NOTIFY

Install idempotent database triggers:

```bash
npm run notify:setup
```

This applies `search/sql/notify-triggers.sql` to dictionary, kanji, grammar, and sentence tables. Payloads contain:

```json
{
  "table": "dictionary",
  "id": "uuid",
  "operation": "UPDATE",
  "changed_at": "2026-08-18T00:00:00Z"
}
```

Start the listener:

```bash
npm run sync:watch
```

Events are debounced by content ID, inserted/updated rows are re-read from PostgreSQL, and DELETE/inactive events remove canonical and autocomplete documents. `postgres.js` keeps a dedicated reconnecting LISTEN connection.

## Japanese query normalization

`search/lib/japanese.ts` performs:

- Unicode NFKC normalization;
- fullwidth Latin/digit conversion;
- halfwidth katakana conversion;
- katakana → hiragana normalization;
- hiragana/katakana variant generation for indexed documents;
- whitespace normalization.

For example:

```text
ﾐｽﾞ → ミズ → みず
Ｔａｂｅｒｕ → Taberu
```

Canonical and kana-equivalent terms are stored in hidden `search_normalized` attributes. Queries normalize to hiragana while original searchable fields remain available for ranking and highlighting.

## Multi-index query builder

`search/lib/query.ts`:

- validates URL parameters with Zod;
- sends all requested indexes through one Meilisearch multi-search request;
- builds index-specific facet filters;
- safely JSON-escapes string filter values;
- enables `<mark>` highlighting;
- returns grouped results and facet distributions.

Supported parameters:

```text
q
  required search text
types
  dictionary,kanji,grammar,sentences
level
  N5,N4,N3,N2,N1,NONE
pos
  dictionary part of speech
tags
  comma-separated dictionary tags
has_audio
  true or false
grade
  kanji grade
stroke_min, stroke_max
  kanji stroke range
limit, offset
  pagination
```

Example:

```ts
import { multiIndexSearch } from "./search/lib/query.js";

const result = await multiIndexSearch(
  new URLSearchParams({
    q: "water",
    types: "dictionary,kanji,sentences",
    level: "N5",
    limit: "10",
  }),
);
```

## Autocomplete service

Run:

```bash
npm run dev
# or after npm run build
npm start
```

Endpoints:

- `GET /health`
- `GET /autocomplete?q=...&limit=10`
- `GET /search?...`

Autocomplete characteristics:

- separate lightweight index;
- maximum 20 suggestions;
- Japanese width/kana normalization;
- 5-minute bounded LRU cache by default;
- in-flight work limited to one Meilisearch request;
- `Server-Timing` and `X-Cache` headers;
- response metadata reports whether total local latency met the 50ms target;
- configurable CORS allowlist.

Benchmark warm-cache p95:

```bash
npm run benchmark:autocomplete
```

The command performs warmups and 100 measured requests, prints min/p50/p95/p99/max, and exits nonzero when p95 is 50ms or greater.

Actual latency depends on host proximity, Meilisearch load, index size, and container storage. The endpoint is designed for the sub-50ms target, but the benchmark must be run in the deployment environment before declaring the SLO met.

## Scripts

```text
npm run indexes:configure
npm run notify:setup
npm run sync:full
npm run sync:incremental
npm run sync:watch
npm run dev
npm run build
npm start
npm run benchmark:autocomplete
npm run typecheck
npm run test
```

## Validation

The test suite covers:

- width and kana normalization;
- normalized document generation;
- index-specific filters and escaping;
- invalid filter/range rejection;
- highlighting configuration;
- TTL/LRU behavior.

Run all static validation:

```bash
npm run typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run test
npm run build
npm audit --omit=dev
```
