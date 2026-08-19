# NihongoBridge AI Tutor

Phase 7 adds **Hana-sensei**, a context-aware Japanese tutor powered by Anthropic Claude. This repository is a standalone Next.js 14 service and a reusable chat UI. It shares the existing NihongoBridge PostgreSQL knowledge schema through `@nihongobridge/knowledge`.

## Features

### Tutor chat

- `POST /api/ai/tutor/chat` streams Anthropic output as Server-Sent Events.
- `POST /api/ai/tutor` is a compatibility alias.
- Injects the current JLPT level, recent weak grammar/vocabulary IDs, and current grammar-page record.
- Restricts requests to the last 10 prior messages and 24,000 total history characters.
- Anthropic tool use calls the existing `/api/dictionary/search` API to verify words.
- Saves completed replies in `ai_explanations`; equivalent user/context requests can reuse the seven-day cache.
- Free accounts receive 20 tutor messages per fixed UTC hour. Premium accounts are unlimited.
- The system prompt requires concise explanations, reasons for corrections, an original example for each grammar point, a next-study suggestion, and `<ruby>` furigana for Japanese containing kanji.
- Tamil (`ta`), Malayalam (`ml`), Hindi (`hi`), and English (`en`) explanation preferences are supported.

Successful SSE frames retain the platform response envelope:

```text
event: token
data: {"data":{"text":"..."},"meta":{"page":1,"limit":1,"total":0}}

event: done
data: {"data":{"message":"...","model":"..."},"meta":{"page":1,"limit":1,"total":1}}
```

Validation/authentication failures return normal JSON:

```json
{
  "data": {},
  "meta": { "page": 1, "limit": 1, "total": 0 },
  "error": "Authentication required"
}
```

### Structured AI endpoints

| Method | Endpoint | Purpose |
|---|---|---|
| POST | `/api/ai/grammar-explain` | Generates and globally caches an original structured explanation plus exactly three examples. |
| POST | `/api/ai/translate` | Translates Japanese to/from English, Tamil, Malayalam, or Hindi; optionally includes a word and grammar breakdown. |
| POST | `/api/ai/generate-questions` | Content-editor endpoint that creates validated, inactive question drafts from knowledge-base grounding. |

Question generation is deliberately conservative:

- only `super_admin`, `content_editor`, or legacy `admin` roles can generate;
- the level/topic must match local grammar or vocabulary records;
- every question must cite supplied knowledge UUIDs;
- batches are checked for duplicate prompts and existing exact database duplicates;
- reading questions require an original passage and listening questions require an original transcript;
- inserted rows use `source = 'generated'` and `is_active = false` for human review;
- provenance records `kind = knowledge-base-synthesis` and `copyrighted_exam_content = false`;
- prompts explicitly prohibit reproducing or closely paraphrasing official/copyrighted JLPT papers.

### Chat UI

`components/ai/TutorChat.tsx` provides:

- a bottom-right floating launcher and responsive chat panel;
- a full-screen mobile dialog;
- safe Markdown + raw `<ruby>/<rt>` rendering (rehype sanitization removes unsafe HTML);
- incremental SSE rendering;
- current-topic label such as `Studying: 〜てから`;
- explain/example/quiz quick actions;
- `localStorage` history with a 50-message client cap;
- clear, close, abort, keyboard, focus, and screen-reader behavior.

The root page is a no-credentials visual demo. Its `demoMode` is explicitly local UI behavior; production calls the Anthropic-backed endpoint by default.

## Requirements

- Node.js 20+
- PostgreSQL with the Phase 1 NihongoBridge knowledge migrations applied
- Redis for production free-tier quota enforcement
- An Anthropic API key
- The Phase 3 dictionary API for model tool calls
- Supabase JWT secret or JWKS URL

## Setup

```bash
cp .env.example .env.local
npm install
npm run db:migrate
npm run dev
```

Required production values:

```dotenv
ANTHROPIC_API_KEY=...
ANTHROPIC_MODEL=claude-sonnet-4-5
DATABASE_URL=postgresql://...
REDIS_URL=redis://...
NIHONGOBRIDGE_API_URL=https://api.nihongobridge.example
SUPABASE_URL=https://your-project.supabase.co
```

Apply `drizzle/0000_hana_sensei.sql` only after the knowledge schema exists. It adds `ai_explanations`, foreign keys to `grammar_patterns` and `users`, cache indexes, checks, and an `updated_at` trigger.

The service should normally be reverse-proxied under the same browser origin as NihongoBridge. If the component is hosted in another app, pass `apiBaseUrl` and configure the proxy/CORS policy at the gateway.

## Authentication and plans

All endpoints require a verified Supabase bearer token. The service accepts HS256 (`SUPABASE_JWT_SECRET`) or Supabase JWKS (`SUPABASE_URL`). Production never trusts raw user headers.

Premium status is read only from signed `app_metadata`:

```json
{ "subscription_tier": "premium" }
```

`plan: "premium"`, `plan: "pro"`, or `is_premium: true` are also recognized. In non-production only, local development can opt into:

```dotenv
ALLOW_INSECURE_USER_HEADER=true
```

and send `X-User-Id`, `X-User-Roles`, and `X-User-Tier`. Never enable this in production.

The Redis rate limiter fails closed in production unless `RATE_LIMIT_FAIL_OPEN=true`. Without Redis it uses an in-process development fallback, which is not suitable for multiple replicas.

## API examples

### Chat

```bash
curl -N http://localhost:3000/api/ai/tutor/chat \
  -H 'Authorization: Bearer YOUR_JWT' \
  -H 'Content-Type: application/json' \
  -d '{
    "message": "Why is this particle wrong?",
    "context": {
      "current_level": "N4",
      "recent_mistakes": ["00000000-0000-4000-8000-000000000000"],
      "current_topic": "00000000-0000-4000-8000-000000000001",
      "language_preference": "en"
    },
    "conversation_history": []
  }'
```

### Grammar explanation

```json
{
  "pattern_id": "00000000-0000-4000-8000-000000000001",
  "user_level": "N4",
  "example_sentence": "宿題をしてから、映画を見ます。"
}
```

### Translation

```json
{
  "text": "駅に着いてから電話してください。",
  "target_lang": "ta",
  "include_breakdown": true
}
```

### Admin question generation

```json
{
  "level": "N5",
  "topic": "food",
  "section": "vocabulary",
  "count": 10
}
```

A topic with no matching local knowledge records returns HTTP 422 instead of asking the model to invent ungrounded material.

## Component integration

```tsx
<TutorChat
  context={{
    current_level: "N4",
    recent_mistakes: mistakeIds,
    current_topic: grammarId,
    language_preference: "ta",
  }}
  topicLabel="〜てから"
  accessToken={supabaseAccessToken}
/>
```

Do not put privileged service tokens in `accessToken`; it is a browser-side user bearer token.

## Quality checks

```bash
npm run typecheck
npm test
npm run build
npm audit
```

The typecheck script includes strict TypeScript plus `noUnusedLocals` and `noUnusedParameters`.

## Operational notes

- `ai_explanations.request_context` can contain personalized weak-area IDs and conversation text. Apply the same retention, access-control, backup, and deletion policy as other user-learning data.
- Model output is validated, but AI can still be wrong. The UI displays an accuracy notice and generated question rows remain inactive until reviewed.
- Configure request/time limits at the reverse proxy without buffering `text/event-stream` responses.
- Monitor Anthropic failures, tool failures, cache persistence failures, and `persisted: false` done events.
- Run database cleanup for expired chat/translation cache rows according to the platform retention policy.

## Validation status in this workspace

Static tests and builds can run without external services. Live Anthropic, PostgreSQL, Redis, and dictionary-service integration requires credentials/services and is therefore not exercised by the local suite. The suite uses mocked Anthropic SSE and a mocked dictionary tool call.

Next.js is pinned to the latest requested Next.js 14 release (`14.2.35`). `npm audit` currently reports the known high-severity Next.js 14 advisory group; npm's automated remediation requires a breaking upgrade to Next.js 16. This is not silently upgraded here so the requested stack and cross-repository compatibility are preserved.
