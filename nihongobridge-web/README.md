# NihongoBridge Web — Test Engine Core UI

Focused JLPT-style test-taking UI built with Next.js 14, TypeScript, Tailwind CSS, Zustand, local fonts, and the Phase 3 test-session API.

## Quick start

```bash
cd nihongobridge-web
cp .env.example .env.local
npm install
npm run dev
```

Open:

```text
http://localhost:3000/test/demo
```

The root route redirects to the dashboard. Dictionary, kanji, SRS, and test demos remain available from its navigation. All demos work without PostgreSQL, Redis, authentication, or the API service.

For a real session, set the server-side proxy destination:

```dotenv
API_ORIGIN=http://localhost:3001
NEXT_PUBLIC_DEMO_MODE=false
```

Browser calls remain relative (`/api/...`); Next.js rewrites them server-side to `API_ORIGIN`. This works in proxied preview/deployment environments without exposing browser-facing `localhost` URLs.

## Design system

- Washi near-white: `#FAFAF7`
- Sumi charcoal: `#1C1C1E`
- Hanko vermilion: `#C0392B`
- Local variable Inter and Noto Sans JP font files
- Restrained borders, paper shadows, and subtle fiber-like CSS texture
- Reduced-motion support
- Minimum 44px navigation and control targets

No external font, stylesheet, image, or script requests are required.

## Main route

```text
app/test/[sessionId]/page.tsx
```

`components/test/TestSession.tsx` provides:

- JLPT level badge and test title
- server-authoritative countdown timer
- current section and section breadcrumb
- animated section progress
- question and answer area
- previous, flag, next, and finish actions
- mobile fixed navigation and desktop sticky navigation
- loading, fatal-error, nonfatal-sync-error, and completing states

## Components

### TestTimer

- Green, amber, and red time states
- Red alert state at 20% remaining
- Accessible `role="timer"` output
- Pauses visually while listening audio is playing
- Uses the Zustand timer state restored from server/local storage

### QuestionDisplay

- Japanese-first typography
- Furigana show/hide support for ruby markup
- Optional English prompt and image
- DOMPurify allowlist before any HTML is rendered
- Plain, escaped server-rendered fallback to avoid SSR XSS/hydration issues

### AnswerOptions

- Four large radio-style answer cards
- Keyboard shortcuts 1-4
- Clear selected state
- Saving, saved, and failed-sync states
- Accessible radio labels and live status text

### ListeningQuestion

- Three-second automatic-play countdown
- Custom play/pause control with no native scrubber
- Seeking disabled until the first complete play
- Configurable replay limit; default two total plays for N3-N1
- Speaker indicators
- Test timer pause/resume during playback
- Browser autoplay recovery message
- Transcript controls rendered only in review mode

### ReadingPassage

- 60/40 passage/question layout from the 768px tablet breakpoint upward
- Collapsible bottom-sheet passage on 390px/mobile layouts
- Independent furigana control
- Text size from 16px to 26px
- 1.9 reading line height
- Persistent local phrase highlighting and clear action
- Scrollable passage panel without moving the answer area

### SectionNav, ProgressBar, FlagButton, TestHeader

These components provide accessible section navigation, completion state, local review flags, animated progress, the level stamp, timer, and question counters.

## Zustand session state

`stores/test-session-store.ts` tracks:

- `currentQuestion`
- all known questions and canonical question order
- answers map and per-answer sync state
- `flaggedQuestions` as a `Set`
- `timeElapsed`, `timeRemaining`, and audio-pause state
- session/test IDs, level, type, sections, loading, completion, and error state

Only public question fields returned by the test-session API are stored. Correct answers and explanations are not part of the active-test UI model.

## Recovery and API synchronization

`hooks/useSessionPersistence.ts`:

- restores a same-session snapshot after the API state loads;
- saves every 10 seconds;
- saves again on `pagehide` and component cleanup;
- rejects snapshots older than 24 hours;
- serializes the flag `Set` as an array.

`hooks/useTestSession.ts`:

- loads the session from `/api/tests/session/:id`;
- records response time per question;
- syncs every selected answer immediately;
- aborts stale requests when an answer changes quickly;
- adds the next sanitized question returned by the API;
- completes automatically at zero and manually on the final question;
- clears local recovery state after successful completion.

Server timing always wins when it is stricter than a local snapshot.

## Accessibility

- Semantic fieldsets/radio inputs
- Descriptive button labels and pressed/current states
- Visible keyboard focus
- Timer and sync live regions
- Keyboard answer shortcuts
- Focus moves to the new question after navigation
- Ruby fallback for browsers or SSR contexts
- Reduced animation when `prefers-reduced-motion` is active

## Responsive behavior

- **390px:** single-column question, compact controls, fixed navigation, passage bottom sheet
- **768px:** reading passage and question switch to a 60/40 split
- **1024px+:** expanded spacing, sticky contained navigation, centered test canvas

## Results UI

`app/test/[sessionId]/results/page.tsx` now renders the idempotent completion response together with completed review data. It includes:

- Framer Motion score count-up and progress animations
- pass/fail visuals and level-aware encouragement
- three section cards with scaled bars and minimum status
- time, accuracy, correct count, and XP metrics
- floating XP animation
- weak vocabulary/grammar detection for items missed at least twice
- links to mistake review and weak-area study actions
- a 1200×630 canvas-generated PNG share card
- Web Share API support with automatic download fallback

## Review UI

`app/test/[sessionId]/review/page.tsx` provides:

- All / Correct / Incorrect / Flagged filtering
- question-number jump navigation
- explicit correct and wrong-option highlighting
- per-question JP/EN explanation toggle
- per-question furigana control
- listening audio player and review transcript
- linked vocabulary and grammar chips
- animated definition drawer
- per-item bookmarks
- per-question and batch “Add to SRS” actions
- local flag recovery retained after test completion

## QuickDrillMode

`components/test/QuickDrillMode.tsx` accepts up to 20 cards and supports:

- 3D Framer Motion card flips
- tap or Space to reveal
- mobile drag/swipe left for wrong and right for correct
- ArrowLeft / ArrowRight keyboard rating
- progress display
- animated session summary and restart action

## Results and review hooks

- `useTestSession` — active-session loading, answer synchronization, completion
- `useTestResults` — score/review aggregation and weak-area detection
- `useTestReview` — completed review and local flagged-question recovery
- `useAudioPlayer` — review-mode play, pause, seek, duration, and errors
- `useSRSActions` — authenticated SRS and bookmark actions with idempotent duplicate handling

## Dictionary and kanji explorer

### DictionarySearch

`components/dictionary/DictionarySearch.tsx` provides:

- large Japanese/romaji/English search input
- IME composition awareness so partially composed Japanese is never submitted
- debounced autocomplete with ArrowUp/ArrowDown, Enter, and Escape navigation
- URL-synchronized `q`, `level`, `pos`, `audio`, and `page` filters
- N5-N1, part-of-speech, and has-audio chips
- paginated results, empty state, error state, and layout-matched skeletons
- dark-mode variants for every state

The Phase 3 dictionary API was extended with `has_audio=true` support in PostgreSQL and Meilisearch indexing/filter settings.

### DictionaryEntry

`components/dictionary/DictionaryEntry.tsx` renders structured furigana, kana/romaji, JLPT/POS tags, numbered meanings, example sentences, linked kanji/grammar, pronunciation controls, SRS, bookmark, and quiz actions. It includes loading and unselected states.

### KanjiCard and writing

- `components/kanji/KanjiCard.tsx`
- `components/kanji/StrokeOrderAnimation.tsx`
- `components/kanji/KanjiWritingQuiz.tsx`

Together these render a large kanji card, readings, meanings, grade/strokes, animated SVG path drawing, common words, radicals, similar kanji, mnemonics, SRS action, and an expandable writing canvas. The writing quiz supports mouse, pen, and touch pointer events, undo/clear, guide hints, stroke-by-stroke reference reveal, and a basic similarity score using stroke count and drawing coverage.

### SRSReviewCard

`components/srs/SRSReviewCard.tsx` includes a Framer Motion 3D flip, large Japanese front, full answer back, example/grammar context, Again/Hard/Good/Easy controls, color coding, interval previews, Space flip, and 1-4 keyboard rating.

### Explorer demos

- `/dictionary` — searchable dictionary and full 食べる entry
- `/kanji/水` — 水 card, animated strokes, and writing canvas
- `/srs/demo` — interactive word/kanji/grammar flashcards

The explorer header links all three and includes a persistent light/dark theme toggle. The root route opens `/dictionary` for this phase's live preview.

## Dashboard and progress tracking

`app/dashboard/page.tsx` and `components/dashboard/Dashboard.tsx` provide the mobile-first study home:

- time-aware Japanese greeting and streak badge
- due-card, daily goal/XP, and level-readiness summary cards
- resumable mock-test panel
- eight study-area shortcuts
- Recharts seven-day activity bars
- responsive single-column mobile and multi-column desktop layouts

### ProgressStats

`components/progress/ProgressStats.tsx` uses Recharts for:

- N5-N1 radial mastery rings for vocabulary, kanji, and grammar
- last-10-test score sparkline
- 30-day accuracy line
- 13-week contribution-style study heatmap

It also presents low-accuracy grammar/vocabulary as a weighted tag cloud.

### StreakCalendar

`components/progress/StreakCalendar.tsx` renders a monthly Sunday-Saturday grid with studied, missed, and future states, milestone fire markers, and current/longest streak metrics.

### LevelReadinessCheck

`components/progress/LevelReadiness.tsx` combines a Recharts readiness ring and horizontal breakdown chart for vocabulary, kanji, grammar, and test scores. It includes pace-based estimated days and a level-check CTA.

### StudyGoalSetter

`components/progress/StudyGoal.tsx` includes:

- 10 / 20 / 50 / 100 card goal slider
- exam date picker
- automatic cards-per-day requirement
- browser notification permission toggle
- PWA manifest and service-worker push/notification-click handlers
- confirmation notification after permission is granted
- React Query optimistic cache updates with rollback on failure
- local persistence until the profile-goal API is added

### Data fetching and demos

The root route opens `/dashboard`. `QueryProvider` configures React Query with a five-minute stale time. `useDashboard` uses the Phase 3 dashboard, SRS stats, and analytics routes for authenticated users; the live demo supplies a full 90-day model with mastery, tests, trends, streaks, readiness, goals, and weak areas.

Explorer and test demos remain available through the dashboard navigation.

## Commands

```bash
npm run typecheck
npm run test
npm run build
```

## Framework security note

The build remains pinned to the requested latest Next.js 14 release (`14.2.35`). `npm audit` reports the same upstream high-severity Next.js advisory group documented in `nihongobridge-api`; the available automated fix requires a major-version upgrade. Upgrade to a supported patched Next.js major before public production deployment.
