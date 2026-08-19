import 'package:sqflite/sqflite.dart';

import '../local_db.dart';
import '../models.dart';

final class DictionaryDao {
  const DictionaryDao(this._localDb);

  final LocalDb _localDb;

  Future<void> upsert(DictionaryEntry entry) async {
    final Database db = await _localDb.database;
    await db.insert(
      'dictionary_entries',
      entry.toDb(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> upsertAll(Iterable<DictionaryEntry> entries) async {
    final Database db = await _localDb.database;
    await db.transaction((Transaction txn) async {
      final Batch batch = txn.batch();
      for (final DictionaryEntry entry in entries) {
        batch.insert(
          'dictionary_entries',
          entry.toDb(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await batch.commit(noResult: true);
    });
  }

  Future<DictionaryEntry?> getById(String id) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'dictionary_entries',
      where: 'id = ?',
      whereArgs: <Object?>[id],
      limit: 1,
    );
    return rows.isEmpty ? null : DictionaryEntry.fromDb(rows.first);
  }

  Future<List<DictionaryEntry>> search(
    String query, {
    String? level,
    int limit = 50,
  }) async {
    final Database db = await _localDb.database;
    final String normalized = query.trim().toLowerCase();
    final String escaped = normalized
        .replaceAll(r'\', r'\\')
        .replaceAll('%', r'\%')
        .replaceAll('_', r'\_');
    final List<Object?> arguments = <Object?>[];
    final List<String> clauses = <String>[];
    if (normalized.isNotEmpty) {
      clauses.add('''
        (word LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR kana LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR romaji LIKE ? ESCAPE '\\' COLLATE NOCASE
         OR meanings_json LIKE ? ESCAPE '\\' COLLATE NOCASE)
      ''');
      arguments.addAll(List<Object?>.filled(4, '%$escaped%'));
    }
    if (level != null) {
      clauses.add('jlpt_level = ?');
      arguments.add(level);
    }
    final List<Map<String, Object?>> rows = await db.query(
      'dictionary_entries',
      where: clauses.isEmpty ? null : clauses.join(' AND '),
      whereArgs: arguments.isEmpty ? null : arguments,
      orderBy:
          'CASE jlpt_level WHEN \'N5\' THEN 1 WHEN \'N4\' THEN 2 ELSE 3 END, word',
      limit: limit.clamp(1, 100).toInt(),
    );
    return rows.map<DictionaryEntry>(DictionaryEntry.fromDb).toList();
  }

  Future<int> delete(String id) async {
    final Database db = await _localDb.database;
    return db.delete(
      'dictionary_entries',
      where: 'id = ?',
      whereArgs: <Object?>[id],
    );
  }

  Future<int> countByLevels(Iterable<String> levels) async {
    final List<String> values = levels.toSet().toList(growable: false);
    if (values.isEmpty) return 0;
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.rawQuery(
      'SELECT COUNT(*) AS count FROM dictionary_entries '
      'WHERE jlpt_level IN (${List<String>.filled(values.length, '?').join(',')})',
      values,
    );
    return (rows.first['count'] as num?)?.toInt() ?? 0;
  }
}
