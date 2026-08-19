import 'package:sqflite/sqflite.dart';

import '../local_db.dart';
import '../models.dart';

final class KanjiDao {
  const KanjiDao(this._localDb);

  final LocalDb _localDb;

  Future<void> upsertAll(Iterable<KanjiEntry> entries) async {
    final Database db = await _localDb.database;
    await db.transaction((Transaction txn) async {
      final Batch batch = txn.batch();
      for (final KanjiEntry entry in entries) {
        batch.insert(
          'kanji_entries',
          entry.toDb(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await batch.commit(noResult: true);
    });
  }

  Future<KanjiEntry?> getById(String id) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'kanji_entries',
      where: 'id = ?',
      whereArgs: <Object?>[id],
      limit: 1,
    );
    return rows.isEmpty ? null : KanjiEntry.fromDb(rows.first);
  }

  Future<KanjiEntry?> getByCharacter(String character) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'kanji_entries',
      where: 'character = ?',
      whereArgs: <Object?>[character],
      limit: 1,
    );
    return rows.isEmpty ? null : KanjiEntry.fromDb(rows.first);
  }

  Future<List<KanjiEntry>> search(
    String query, {
    String? level,
    int limit = 50,
  }) async {
    final Database db = await _localDb.database;
    final List<String> clauses = <String>[];
    final List<Object?> arguments = <Object?>[];
    if (query.trim().isNotEmpty) {
      clauses.add(
        '(character = ? OR onyomi_json LIKE ? OR kunyomi_json LIKE ? OR meanings_json LIKE ?)',
      );
      arguments.addAll(<Object?>[
        query.trim(),
        '%${query.trim()}%',
        '%${query.trim()}%',
        '%${query.trim()}%',
      ]);
    }
    if (level != null) {
      clauses.add('jlpt_level = ?');
      arguments.add(level);
    }
    final List<Map<String, Object?>> rows = await db.query(
      'kanji_entries',
      where: clauses.isEmpty ? null : clauses.join(' AND '),
      whereArgs: arguments.isEmpty ? null : arguments,
      orderBy: 'character',
      limit: limit.clamp(1, 100).toInt(),
    );
    return rows.map<KanjiEntry>(KanjiEntry.fromDb).toList();
  }

  Future<int> delete(String id) async {
    final Database db = await _localDb.database;
    return db.delete(
      'kanji_entries',
      where: 'id = ?',
      whereArgs: <Object?>[id],
    );
  }
}
