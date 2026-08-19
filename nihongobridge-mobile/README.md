# NihongoBridge Mobile

Flutter 3 mobile foundation for the NihongoBridge Japanese-learning platform. The app uses feature-first Riverpod architecture, offline-first storage, reconnect synchronization, and the same washi/sumi/vermilion design language as the web application.

The Android and iOS projects were generated with:

```bash
flutter create . \
  --org com.nihongobridge \
  --platforms android,ios \
  --project-name nihongobridge_mobile
```

Identifiers:

- Android: `com.nihongobridge.nihongobridge_mobile`
- iOS: `com.nihongobridge.nihongobridgeMobile`

## Requirements

- Flutter `3.27+` and Dart `3.6+`
- Android SDK and Java 17 for Android builds
- Xcode/CocoaPods on macOS for iOS builds
- A reachable NihongoBridge API

The repository was validated with Flutter `3.47.0` and Dart `3.13.0`.

## Setup

```bash
flutter pub get
flutter analyze
flutter test
flutter run --dart-define=API_BASE_URL=https://api.nihongobridge.example
```

The development default is `http://10.0.2.2:3000`, which reaches the host machine from an Android emulator. For the iOS simulator, pass a local URL explicitly:

```bash
flutter run --dart-define=API_BASE_URL=http://127.0.0.1:3000
```

Use HTTPS in production. Cleartext traffic is enabled only in the Android debug manifest.

## Architecture

```text
lib/
├── app.dart
├── main.dart
├── core/
│   ├── api/
│   │   ├── api_client.dart
│   │   ├── api_endpoints.dart
│   │   ├── api_exception.dart
│   │   ├── api_providers.dart
│   │   ├── auth_token_store.dart
│   │   └── json_helpers.dart
│   ├── db/
│   │   ├── daos/
│   │   │   ├── dictionary_dao.dart
│   │   │   ├── kanji_dao.dart
│   │   │   ├── srs_card_dao.dart
│   │   │   └── test_session_dao.dart
│   │   ├── local_db.dart
│   │   ├── models.dart
│   │   └── srs_cache.dart
│   ├── sync/
│   │   ├── app_sync_lifecycle.dart
│   │   ├── sync_providers.dart
│   │   └── sync_service.dart
│   ├── theme/app_theme.dart
│   └── widgets/
│       ├── async_error_view.dart
│       ├── offline_banner.dart
│       └── ruby_text.dart
└── features/
    ├── auth/
    ├── dictionary/
    ├── kanji/
    ├── grammar/
    ├── tests/
    ├── srs/
    ├── dashboard/
    └── ai_tutor/
```

`go_router` uses a stateful indexed shell for Home, Dictionary, Tests, and Review. Additional routes are registered for kanji, grammar, AI tutor, and specific test-session IDs.

## API client

`core/api/api_client.dart` provides:

- `API_BASE_URL` compile-time configuration;
- JWT attachment from encrypted Android/iOS storage;
- typed `ApiException` mapping for the shared `{data, meta, error}` envelope;
- three retries with 500 ms, 1 s, and 2 s exponential delays;
- `Retry-After` support;
- retries only for idempotent methods unless explicitly opted in;
- debug-only metadata logging with authorization headers and bodies suppressed;
- request cancellation and fixed connection/send/receive timeouts.

Auth sessions should be written through `AuthRepository.persistSession`. Production never stores the JWT in Hive or SQLite.

## Offline database

`core/db/local_db.dart` opens SQLite with schema version `2`, foreign-key enforcement, and migrations. Local tables mirror the mobile subset of the server:

- `dictionary_entries`
- `kanji_entries`
- `srs_cards`
- `test_sessions`
- `sync_metadata`

DAOs provide typed upsert/read/search/delete operations, batch transactions, due-card queries, pending SRS review queries, and dirty test-session queries.

SRS cards are also represented as JSON-compatible maps in Hive. Hive is the fast review-session cache; SQLite remains the durable source for synchronization state and pending actions. No generated Hive adapters are required.

## Synchronization

`SyncService` is started after the first frame and observes both application lifecycle and `connectivity_plus` events.

Behavior:

1. On every app open, queued SRS reviews are pushed and due cards are pulled.
2. On first launch, all N5 and N4 dictionary pages are downloaded in 500-entry batches.
3. Incremental dictionary, kanji, and SRS changes are pulled using the last committed server timestamp.
4. Deletes are applied locally.
5. The new timestamp is committed only after local writes finish.
6. Reconnect and app-resume events trigger another serialized sync.
7. Failed review writes remain in SQLite/Hive with an idempotency key for replay.

### Required mobile sync API contract

The Phase 3 API already provides `/api/srs/due` and `/api/srs/review`. Full bootstrap/incremental synchronization additionally expects these server routes:

```text
GET /api/mobile/bootstrap/dictionary?levels=N5,N4&limit=500&cursor=...
GET /api/mobile/sync?updated_since=<ISO-8601>&user_id=<uuid>&limit=1000
```

Bootstrap response data:

```json
{
  "items": [],
  "next_cursor": null
}
```

Incremental response data:

```json
{
  "dictionary_entries": [],
  "kanji_entries": [],
  "srs_cards": [],
  "deleted": [{ "type": "dictionary_entry", "id": "uuid" }],
  "server_timestamp": "2026-08-18T12:00:00Z"
}
```

Both use the standard NihongoBridge `{data, meta, error}` envelope. Those two server routes are an explicit integration dependency; they do not yet exist in the Phase 3 API repository.

For safe offline replay, `/api/srs/review` should honor `X-Idempotency-Key`. The client sends the header and never automatically retries review POSTs, but server-side idempotency is still required to cover a connection loss after commit.

## Screens

### Dictionary

- Japanese-compatible text input and search action
- 300 ms cancellation-aware debounce
- remote API search with SQLite fallback
- result persistence for later offline use
- pull-to-refresh
- furigana, meanings, JLPT/POS tags
- server audio with `flutter_tts` Japanese fallback
- clear offline-state banner

### Test session

- compact web-consistent header, section label, progress, and sticky next action
- drift-resistant `CountdownTimer` based on a deadline rather than decrement-only ticks
- custom sanitized `RubyText` renderer
- listening player with duration, seeking, replay limits, and TTS fallback
- haptic answer selection
- secure server advancement without answer-key exposure
- demo session at `/tests`; real sessions use `/tests/:sessionId`

### SRS review

- animated `FlipCard`
- confidence buttons
- swipe alternatives after reveal:
  - left: Again
  - down: Hard
  - right: Good
  - up: Easy
- haptic feedback
- session progress and remaining count
- optimistic local scheduling and queued offline review actions

### Theme

- light and dark modes
- washi `#FAFAF7`
- sumi `#1C1C1E`
- vermilion `#C0392B`
- moss and amber supporting colors
- Noto Sans JP through `google_fonts`
- shared 4/8/12/16/24/32/48 spacing rhythm
- Material 3 accessible control sizes and semantic labels

## Dependencies

The requested packages are configured in `pubspec.yaml`: Dio, Riverpod, go_router, sqflite, Hive, audioplayers, flutter_tts, cached_network_image, google_fonts, flutter_animate, and flutter_markdown. `connectivity_plus`, `flutter_secure_storage`, and `path` are included for reconnect monitoring, credential protection, and database paths.

`flutter_markdown` is currently marked discontinued upstream in favor of `flutter_markdown_plus`; it is retained because this phase explicitly requested `flutter_markdown`. Revisit this choice before a future major dependency upgrade.

## Verification

```bash
dart format --set-exit-if-changed lib test
flutter analyze
flutter test
```

Current result:

- formatting check: passed
- Flutter analyzer: no issues
- 10 tests passed
- SQLite schema/DAO integration tested with in-memory `sqflite_common_ffi`
- ruby, flip/swipe, models, API envelopes, and design tokens covered

A native APK/IPA was not produced in the build workspace because no Android SDK or Xcode installation was available. Dart/Flutter compilation is covered by analyzer and widget/unit test execution. Release builds also require replacing Android's generated debug signing configuration and selecting an iOS development team.

## Data and security notes

- Local learning data and cached dictionary content are not secret, but user JWTs remain in Keychain/Encrypted Shared Preferences only.
- Clear local data and Hive boxes during account deletion/sign-out according to the platform privacy policy.
- Test answer keys are never stored in active-session models.
- Treat server timestamps as authoritative and keep server sync pages ordered deterministically.
- Mobile sync should be monitored for replay conflicts, malformed records, and clock skew.
