import 'package:sqflite/sqflite.dart';

import '../local_db.dart';
import '../models.dart';

final class TestSessionDao {
  const TestSessionDao(this._localDb);

  final LocalDb _localDb;

  Future<void> upsert(TestSessionRecord session) async {
    final Database db = await _localDb.database;
    await db.insert(
      'test_sessions',
      session.toDb(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<TestSessionRecord?> getById(String id) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'test_sessions',
      where: 'id = ?',
      whereArgs: <Object?>[id],
      limit: 1,
    );
    return rows.isEmpty ? null : TestSessionRecord.fromDb(rows.first);
  }

  Future<List<TestSessionRecord>> history(String userId,
      {int limit = 50}) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'test_sessions',
      where: 'user_id = ?',
      whereArgs: <Object?>[userId],
      orderBy: 'started_at DESC',
      limit: limit.clamp(1, 100).toInt(),
    );
    return rows.map<TestSessionRecord>(TestSessionRecord.fromDb).toList();
  }

  Future<List<TestSessionRecord>> dirty(String userId) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'test_sessions',
      where: 'user_id = ? AND dirty = 1',
      whereArgs: <Object?>[userId],
      orderBy: 'updated_at ASC',
    );
    return rows.map<TestSessionRecord>(TestSessionRecord.fromDb).toList();
  }

  Future<void> markClean(String id) async {
    final Database db = await _localDb.database;
    await db.update(
      'test_sessions',
      <String, Object?>{'dirty': 0},
      where: 'id = ?',
      whereArgs: <Object?>[id],
    );
  }

  Future<int> delete(String id) async {
    final Database db = await _localDb.database;
    return db.delete(
      'test_sessions',
      where: 'id = ?',
      whereArgs: <Object?>[id],
    );
  }
}
