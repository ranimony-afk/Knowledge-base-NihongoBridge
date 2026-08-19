# NihongoBridge Platform

Development infrastructure, cross-repository automation, CI/CD, and deployment orchestration for NihongoBridge.

The platform is organized as a coordinated multi-repository workspace. Scripts support either sibling repositories beside this repository or component checkouts under `components/`. Set `COMPONENT_ROOT` explicitly when using another layout.

## Architecture

```text
                            ┌─────────────────────────────┐
                            │ Open linguistic data        │
                            │ JMdict · KANJIDIC2          │
                            │ KanjiVG · Tatoeba           │
                            └──────────────┬──────────────┘
                                           │
                                  Python ETL pipelines
                                           │
                                           ▼
┌──────────────────┐            ┌──────────────────────┐
│ Next.js web      │───────────▶│ Next.js API         │◀────────┐
│ Flutter mobile   │            │ Auth · tests · SRS   │         │
└──────────────────┘            └───────┬──────┬───────┘         │
                                        │      │                 │
┌──────────────────┐                    │      │       ┌─────────┴────────┐
│ Admin CMS        │────────────────────┘      └──────▶│ AI / Hana-sensei│
└──────────────────┘                                   └─────────┬────────┘
                                                                  │ tools
                                                                  ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│ Development infrastructure                                                 │
│                                                                             │
│ PostgreSQL 15       Redis 7       Meilisearch       MinIO                  │
│ knowledge/tests     cache/SRS     Japanese search   audio/images/SVGs      │
│                                                                             │
│ MailHog (email capture)                         Adminer (database GUI)       │
└─────────────────────────────────────────────────────────────────────────────┘
```

Search synchronization reads PostgreSQL and maintains the dictionary, kanji, grammar, sentence, and autocomplete indexes. The AI service uses the shared knowledge schema and can call the dictionary API. SRS/test state uses Redis where appropriate while PostgreSQL remains durable storage.

## Quick start

With all `nihongobridge-*` repositories cloned as siblings:

```bash
cp .env.example .env
./scripts/setup.sh
make test
```

`setup.sh` checks Node 20+, Python 3.11+, Docker Compose v2, and Flutter 3.x; installs project dependencies; starts infrastructure; applies migrations; inserts the N5 fixture; configures PostgreSQL notifications; and performs the initial Meilisearch sync.

After setup, start application development servers from their repositories. Suggested ports are recorded in `.env.example`:

```text
Web             http://localhost:3000
API             http://localhost:3001
Admin           http://localhost:3002
AI tutor        http://localhost:3003
Search API      http://localhost:7701
```

## Infrastructure URLs

| Service | URL / connection | Purpose |
|---|---|---|
| PostgreSQL | `localhost:5432` | `nihongobridge_dev` and `nihongobridge_test` |
| Redis | `redis://localhost:6379` | Cache, rate limits, active tests |
| Meilisearch | `http://localhost:7700` | Japanese full-text search |
| MinIO API | `http://localhost:9000` | S3-compatible media |
| MinIO console | `http://localhost:9001` | Media administration |
| MailHog SMTP | `localhost:1025` | Development mail sink |
| MailHog UI | `http://localhost:8025` | Email inspection |
| Adminer | `http://localhost:8080` | PostgreSQL GUI |

The MinIO initializer idempotently creates `audio`, `images`, and `svgs` buckets and grants download-only anonymous access for development assets. Do not reuse the development credentials or public bucket policy without a production review.

All stateful services use named volumes and health checks. Useful commands:

```bash
make dev       # start or reconcile services
make ps        # health/status
make logs      # follow logs
make down      # stop and retain data
make clean     # stop and delete development volumes
```

## Repository map

```text
nihongobridge-platform/    Docker, workflows, setup, orchestration (this repo)
nihongobridge-knowledge/   Drizzle schema, migrations, relations, N5 fixture
nihongobridge-etl/         JMdict, Tatoeba, TTS, original question pipelines
nihongobridge-api/         Dictionary, kanji, tests, SRS, dashboard APIs
nihongobridge-web/         Learner web application and PWA
nihongobridge-admin/       Moderation, content, media, ETL, and blog CMS
nihongobridge-search/      Meilisearch setup, sync, query, autocomplete
nihongobridge-ai/          Anthropic-powered Hana-sensei APIs and chat UI
nihongobridge-mobile/      Flutter Android/iOS application
```

Local scripts locate components in this order:

1. this repository directory;
2. `./components`;
3. this repository's parent directory.

Override discovery with:

```bash
COMPONENT_ROOT=/path/to/repos make test
```

## Make targets

```text
make dev          Start Docker services and initialize MinIO buckets
make migrate      Apply knowledge, admin, and AI Drizzle migrations
make seed         Insert the idempotent N5 fixture
make etl          Run JMdict, Tatoeba, TTS, and original-question pipelines
make test         Run platform, Node, Python, and Flutter tests
make build        Build Node apps, ETL distributions, and Android debug APK
make sync-search  Configure indexes/triggers and perform a full sync
make setup        Perform the complete local bootstrap
```

Select ETL pipelines without editing scripts:

```bash
ETL_PIPELINES=jmdict,tatoeba make etl
ETL_PIPELINES=questions QUESTION_LEVEL=N4 QUESTION_COUNT=40 make etl
```

Question generation remains knowledge-base grounded and produces original material only. It must never ingest, reproduce, or closely paraphrase official JLPT papers.

## Environment configuration

`.env.example` documents local variables for PostgreSQL, Redis, Meilisearch, MinIO, MailHog, public URLs, Supabase, Anthropic, Edge TTS, ETL source verification, Vercel, and Slack.

Rules:

- Never commit `.env` or production secrets.
- Generate strong PostgreSQL, Meilisearch, MinIO, Supabase JWT, and service credentials.
- Keep `ALLOW_INSECURE_USER_HEADER=false` outside explicit local development.
- Keep MinIO and Meilisearch administrative keys server-side.
- Use publisher/operator-provided source checksums for scheduled ETL.
- Use managed secret stores or GitHub environment secrets in CI/CD.
- Use separate PostgreSQL credentials with the minimum permissions needed for runtime, migrations, and ETL.

The setup scripts source `.env` as Bash. Quote values containing spaces, parentheses, or shell-special characters, as shown in `.env.example`.

## Database lifecycle

The fresh PostgreSQL volume initializer:

1. creates `nihongobridge_dev`;
2. creates `nihongobridge_test`;
3. enables `pg_trgm` and `pgcrypto` in each database.

Migrations run in dependency order:

1. knowledge schema;
2. admin schema;
3. AI explanations schema.

```bash
make migrate
make seed
make sync-search
```

Back up PostgreSQL and MinIO before production migrations. Production migrations are forward-only and should first be exercised against a restored staging snapshot.

## CI/CD

### Pull-request CI

`.github/workflows/ci.yml` runs on pull requests to `main` and uses Node `20.x` matrices where applicable:

- **lint:** Node package lint hooks, Ruff formatting/lint, Dart formatting, platform/Compose validation;
- **typecheck:** strict TypeScript with unused checks, strict mypy, Flutter analyzer;
- **test:** all Node unit suites, 25 ETL tests, Flutter tests;
- **integration:** real PostgreSQL migrations/seed, Redis, MinIO, Meilisearch configuration, and full search sync;
- **build:** production Node builds, Python wheel/sdist, and Android debug APK.

Component repositories are checked out under `components/`. For private repositories, create a `PLATFORM_REPOS_TOKEN` secret with read access to all component repositories. The workflow falls back to `github.token` when organization policy permits cross-repository checkout.

### Weekly ETL

`.github/workflows/etl.yml` runs Sundays at **02:00 UTC** and supports manual dispatch. It:

- installs Python 3.11 dependencies;
- runs selected ETL pipelines;
- uploads JSON reports for 30 days;
- sends an incoming-webhook Slack notification on failure.

Configure the `production-etl` environment with database, MinIO, checksum, enrichment, and Slack values. Keep concurrency at one to protect checkpoints and avoid overlapping source imports.

### Vercel deployment

`.github/workflows/deploy-web.yml` runs on pushes to `main`:

1. checks out shared schemas and the web app;
2. applies production Drizzle migrations;
3. pulls the Vercel production configuration;
4. builds and deploys with the Vercel CLI;
5. retries an HTTP health check against the deployed dashboard.

Required `production` environment secrets:

```text
DATABASE_URL
VERCEL_TOKEN
VERCEL_ORG_ID
VERCEL_PROJECT_ID
PLATFORM_REPOS_TOKEN       # when component repos are private
VERCEL_AUTOMATION_BYPASS_SECRET  # optional for deployment protection
```

Use GitHub environment approval rules to gate migrations and deployment. A failed health check fails the workflow but does not automatically roll back the database; use Vercel promotion/rollback procedures and a migration recovery plan.

## Contributing

1. Create a focused branch from `main`.
2. Keep changes within the owning repository unless an interface change genuinely spans repositories.
3. Update shared schemas before dependent API/UI code.
4. Add migrations rather than rewriting previously applied migration files.
5. Preserve the `{data, meta, error}` API response envelope.
6. Add tests for behavior and failure paths.
7. Run formatting, type checks, tests, and builds for each changed component.
8. Update `.env.example`, Docker configuration, API contracts, and attribution notes when applicable.
9. Open a pull request with migration, rollback, privacy, and licensing impact described.

Before submitting a platform change:

```bash
./tests/platform_test.sh
make test
make build
```

Do not commit generated caches, media, source archives, `.env`, Flutter build output, Node modules, Python virtual environments, or database/search volumes.

## Open-data licensing and attribution

NihongoBridge application code and imported linguistic data are separate works. Preserve row-level source fields, required notices, and share-alike obligations in exports, APIs, offline bundles, backups transferred to third parties, and user-facing attribution pages.

| Source | Project usage | Required license note |
|---|---|---|
| JMdict / EDRDG | Dictionary words, readings, senses | **CC BY-SA 3.0** as requested by the project specification; retain EDRDG/JMdict attribution and share-alike terms. |
| KANJIDIC2 / EDRDG | Kanji readings, meanings, grade/frequency metadata | **CC BY-SA 3.0** as requested; retain KANJIDIC2/EDRDG attribution and share-alike terms. |
| KanjiVG | Stroke-order SVGs and component paths | **CC BY-SA 3.0** as requested; retain KanjiVG attribution and share-alike terms for adapted assets. |
| Tatoeba | Japanese sentences and linked translations | **CC BY 2.0 FR**; retain sentence/contributor attribution where supplied and the French license reference. |
| OpenJLPT enrichment files | JLPT vocabulary enrichment | Files are not redistributed here. Verify and follow the license of the exact distribution used. |
| Innocent Corpus distribution | Frequency enrichment | Files are not redistributed here. Verify and follow the license of the exact distribution used. |
| UniDic Lite / Fugashi resources | Japanese tokenization and readings | Preserve the notices bundled with the installed packages and comply with their respective licenses. |

No official JLPT examination content is included. Generated practice questions must be original syntheses from NihongoBridge's licensed knowledge base, with provenance marking `copyrighted_exam_content: false`.

Before a public release, legal review should confirm the current upstream licenses rather than relying solely on this operational summary. Do not remove upstream copyright notices.

## Production notes

- Pin `latest` container images to reviewed versions or immutable digests before production deployment.
- Terminate TLS at a trusted proxy and do not expose PostgreSQL, Redis, Meilisearch, MinIO admin, Adminer, or MailHog publicly.
- Replace generated Android debug signing and configure an iOS development team for store builds.
- Define backup, restore, retention, deletion, and disaster-recovery procedures for user learning data and AI request context.
- Next.js 14 repositories retain the documented high-severity advisory group because the requested stack is pinned to `14.2.35`; remediation currently requires a coordinated breaking upgrade.
