# NihongoBridge Admin CMS

Role-protected Next.js 14 administration workspace for knowledge content, kanji media, practice tests, generated-question review, ETL operations, media, and blog publishing.

## Quick start

```bash
cd nihongobridge-knowledge
npm install
npm run build:package

cd ../nihongobridge-admin
cp .env.example .env.local
npm install
npm run dev
```

Open `http://localhost:3000/admin`.

Local development automatically uses a `super_admin` demo identity unless `ADMIN_DEMO_MODE=false`. Production never trusts this fallback.

## Roles and route protection

`middleware.ts` protects `/admin/*` and `/api/admin/*` with Supabase JWT verification through either:

- `SUPABASE_JWT_SECRET` for HS256 projects; or
- the Supabase JWKS endpoint derived from `SUPABASE_URL`.

Supported roles:

| Role | Permissions |
|---|---|
| `super_admin` | All content, deletes, role operations, ETL execution, publishing |
| `content_editor` | Content/test/media/blog edits, publishing, review decisions |
| `reviewer` | Read access plus review decisions |

Verified identity and role are forwarded to route handlers through protected internal request headers. API writes also enforce permission checks server-side.

## Shared admin layout

`components/admin/AdminShell.tsx` provides:

- fixed desktop sidebar and mobile slide-out navigation;
- breadcrumbs generated from the active route;
- role/identity display;
- dashboard, dictionary, kanji, tests, questions, media, ETL, and blog navigation;
- audit-log anchor;
- responsive content canvas.

All client actions use the shared animated toast system.

## Pages

### `/admin`

- Word, kanji, grammar, sentence, test, and question counts
- Seven-day content activity chart
- Recent additions
- Pending review count
- Latest ETL status and imported/error totals
- Quick actions for ETL, question generation, and publishing
- Recent in-session audit records

### `/admin/dictionary`

- Search and pagination
- JLPT/source filters
- Inline word, reading, and level edits
- Full modal editor
- JSONB editors for meanings, furigana, pitch accent, POS, tags, and relations
- Bulk level, tag, delete, and CSV export
- CSV/JSON import with source-field mapping and preview
- AI draft generation with mandatory pending-review status

### `/admin/kanji`

- Grid/table switch
- Level, grade, SVG, and audio filters
- Readings, meanings, mnemonics, and similar-kanji editing
- Individual SVG replacement
- Multi-file KanjiVG SVG matching/import
- Review and media-coverage indicators

### `/admin/tests`

- Published/draft test list
- Create/edit settings with React Hook Form and Zod
- Publish/unpublish
- Drag-and-drop question ordering with DnD Kit
- Searchable question bank and add/remove actions
- Student preview with hidden answers
- Completion, average score, and attempt analytics

### `/admin/questions`

- Section, level, source, difficulty, and text filters
- Full options/answer/explanation editor
- Confidence and review status
- Low-confidence human-review flags
- Bulk level, tags, and approval
- AI original-question draft generation

### `/admin/media`

- Audio/image/SVG/PDF/video grid
- Search/type filters and bulk selection
- Upload with content association
- Unused-media cleanup
- TTS draft generation with Nanami/Keita voices
- File size, relation, voice, and usage metadata

### `/admin/etl`

- JMdict, KANJIDIC2, KanjiVG, Tatoeba, TTS, and question pipelines
- Run controls and simulated live output in demo mode
- SSE-compatible production log endpoint
- Cron schedule editor
- Imported/error counters
- Report history table and export action

### `/admin/blog`

- Tiptap rich-text editor
- Draft, published, and scheduled states
- Date/time scheduling
- Tags and categories
- SEO title/description
- Related word/kanji/grammar/sentence links
- Create, update, and delete auditing

## Forms and validation

All modal and page forms use React Hook Form with Zod resolvers, including transformed numeric fields. Invalid JSONB, malformed cron expressions, invalid slugs, missing scheduled dates, and quality form errors are blocked before mutation.

## Audit trail

Every create, update, and delete action in the interactive CMS creates an audit record with:

- actor and role;
- action;
- entity type and ID;
- before/after diff and changed fields;
- timestamp;
- IP and user agent for server writes.

Production API mutations can insert audit rows in the same Drizzle transaction as the domain write through `auditValues()`.

## Admin database schema

`schema/admin.ts` defines:

- `admin_user_roles`
- `admin_audit_logs`
- `content_reviews`
- `etl_pipeline_runs`
- `etl_schedules`
- `blog_posts`

Migration:

```text
drizzle/0000_polite_shockwave.sql
```

The migration includes enums, constraints, JSONB/GIN indexes, operational indexes, and database-side `updated_at` triggers. It is independent from—but intended to run after—the `nihongobridge-knowledge` migrations.

Apply it with:

```bash
DATABASE_URL=postgresql://... npm run db:migrate
```

## AI generation

`POST /api/admin/ai/generate` supports an internal `AI_GENERATION_URL` or the Anthropic Messages API when both `ANTHROPIC_API_KEY` and `ANTHROPIC_MODEL` are configured. The system instruction prohibits reproduction of official JLPT content and requires strict JSON. Generated items remain drafts requiring human review.

## ETL live logs

- `POST /api/admin/etl/run` creates and audits a queued run.
- `GET /api/admin/etl/stream?run_id=...` streams log/progress/done events as Server-Sent Events.
- `ETL_CONTROL_URL` can forward accepted runs to the Python ETL controller.

## Validation

```bash
npm run typecheck
npx tsc --noEmit --noUnusedLocals --noUnusedParameters
npm run test
npm run build
DATABASE_URL=postgresql://... npx drizzle-kit check
```

The Vitest suite checks audit creation, bulk deletion, dictionary filtering/full editing, and low-confidence question flags.

## Framework security note

The project is pinned to the requested latest Next.js 14 release (`14.2.35`). `npm audit` reports the same upstream high-severity advisory group documented in the API/web repositories; the automated fix requires a major-version upgrade. Upgrade to a supported patched Next.js major before public deployment.
