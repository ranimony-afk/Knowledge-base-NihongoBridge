import 'package:path/path.dart' as path;
import 'package:sqflite/sqflite.dart';

final class LocalDb {
  LocalDb._({DatabaseFactory? factory, String? databasePath})
      : _factory = factory ?? databaseFactory,
        _databasePath = databasePath;

  factory LocalDb.forTesting({
    required DatabaseFactory factory,
    required String databasePath,
  }) =>
      LocalDb._(factory: factory, databasePath: databasePath);

  static final LocalDb instance = LocalDb._();
  static const int schemaVersion = 2;

  final DatabaseFactory _factory;
  final String? _databasePath;
  Database? _database;

  Future<Database> get database async {
    final Database? existing = _database;
    if (existing != null && existing.isOpen) return existing;
    final String dbPath = _databasePath ??
        path.join(await _factory.getDatabasesPath(), 'nihongobridge.db');
    _database = await _factory.openDatabase(
      dbPath,
      options: OpenDatabaseOptions(
        version: schemaVersion,
        onConfigure: (Database db) async {
          await db.execute('PRAGMA foreign_keys = ON');
        },
        onCreate: _createSchema,
        onUpgrade: _migrate,
      ),
    );
    return _database!;
  }

  Future<void> close() async {
    await _database?.close();
    _database = null;
  }

  Future<void> _createSchema(Database db, int version) async {
    await db.transaction((Transaction txn) async {
      await txn.execute('''
        CREATE TABLE dictionary_entries (
          id TEXT PRIMARY KEY NOT NULL,
          word TEXT NOT NULL,
          kana TEXT,
          romaji TEXT,
          furigana_json TEXT NOT NULL DEFAULT '[]',
          meanings_json TEXT NOT NULL DEFAULT '[]',
          jlpt_level TEXT NOT NULL DEFAULT 'NONE',
          part_of_speech_json TEXT NOT NULL DEFAULT '[]',
          audio_url TEXT,
          tags_json TEXT NOT NULL DEFAULT '[]',
          source TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      ''');
      await txn.execute(
        'CREATE INDEX dictionary_search_idx ON dictionary_entries(word, kana, romaji)',
      );
      await txn.execute(
        'CREATE INDEX dictionary_level_updated_idx ON dictionary_entries(jlpt_level, updated_at)',
      );

      await txn.execute('''
        CREATE TABLE kanji_entries (
          id TEXT PRIMARY KEY NOT NULL,
          character TEXT NOT NULL UNIQUE,
          onyomi_json TEXT NOT NULL DEFAULT '[]',
          kunyomi_json TEXT NOT NULL DEFAULT '[]',
          meanings_json TEXT NOT NULL DEFAULT '[]',
          jlpt_level TEXT NOT NULL DEFAULT 'NONE',
          grade INTEGER,
          stroke_count INTEGER,
          radicals_json TEXT NOT NULL DEFAULT '[]',
          stroke_order_url TEXT,
          source TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      ''');
      await txn.execute(
        'CREATE INDEX kanji_level_idx ON kanji_entries(jlpt_level, character)',
      );

      await txn.execute('''
        CREATE TABLE srs_cards (
          id TEXT PRIMARY KEY NOT NULL,
          user_id TEXT NOT NULL,
          item_type TEXT NOT NULL,
          item_id TEXT NOT NULL,
          ease_factor REAL NOT NULL DEFAULT 2.5,
          interval_days INTEGER NOT NULL DEFAULT 1,
          repetitions INTEGER NOT NULL DEFAULT 0,
          next_review_at TEXT NOT NULL,
          last_reviewed_at TEXT,
          total_reviews INTEGER NOT NULL DEFAULT 0,
          correct_count INTEGER NOT NULL DEFAULT 0,
          mistake_count INTEGER NOT NULL DEFAULT 0,
          average_time_ms INTEGER NOT NULL DEFAULT 0,
          confidence TEXT,
          deck_id TEXT,
          content_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL,
          pending_action_json TEXT,
          UNIQUE(user_id, item_type, item_id)
        )
      ''');
      await txn.execute(
        'CREATE INDEX srs_due_idx ON srs_cards(user_id, next_review_at)',
      );
      await txn.execute(
        'CREATE INDEX srs_pending_idx ON srs_cards(user_id, pending_action_json)',
      );

      await txn.execute('''
        CREATE TABLE test_sessions (
          id TEXT PRIMARY KEY NOT NULL,
          test_id TEXT NOT NULL,
          user_id TEXT NOT NULL,
          status TEXT NOT NULL,
          started_at TEXT NOT NULL,
          completed_at TEXT,
          time_remaining_seconds INTEGER NOT NULL DEFAULT 0,
          answers_json TEXT NOT NULL DEFAULT '[]',
          snapshot_json TEXT NOT NULL DEFAULT '{}',
          updated_at TEXT NOT NULL,
          dirty INTEGER NOT NULL DEFAULT 0
        )
      ''');
      await txn.execute(
        'CREATE INDEX test_sessions_user_updated_idx ON test_sessions(user_id, updated_at DESC)',
      );
      await txn.execute(
        'CREATE INDEX test_sessions_dirty_idx ON test_sessions(user_id, dirty)',
      );

      await txn.execute('''
        CREATE TABLE sync_metadata (
          key TEXT PRIMARY KEY NOT NULL,
          value TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      ''');
    });
  }

  Future<void> _migrate(Database db, int oldVersion, int newVersion) async {
    if (oldVersion < 2 && newVersion >= 2) {
      await db.transaction((Transaction txn) async {
        await txn.execute(
          'ALTER TABLE srs_cards ADD COLUMN pending_action_json TEXT',
        );
        await txn.execute(
          'CREATE INDEX srs_pending_idx ON srs_cards(user_id, pending_action_json)',
        );
        await txn.execute(
          'ALTER TABLE test_sessions ADD COLUMN dirty INTEGER NOT NULL DEFAULT 0',
        );
        await txn.execute(
          'CREATE INDEX test_sessions_dirty_idx ON test_sessions(user_id, dirty)',
        );
      });
    }
  }

  Future<String?> readMetadata(String key) async {
    final Database db = await database;
    final List<Map<String, Object?>> rows = await db.query(
      'sync_metadata',
      columns: <String>['value'],
      where: 'key = ?',
      whereArgs: <Object?>[key],
      limit: 1,
    );
    return rows.firstOrNull?['value'] as String?;
  }

  Future<void> writeMetadata(String key, String value) async {
    final Database db = await database;
    await db.insert(
      'sync_metadata',
      <String, Object?>{
        'key': key,
        'value': value,
        'updated_at': DateTime.now().toUtc().toIso8601String(),
      },
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }
}
