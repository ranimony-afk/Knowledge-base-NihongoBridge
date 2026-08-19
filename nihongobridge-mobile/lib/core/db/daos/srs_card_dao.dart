import 'package:sqflite/sqflite.dart';

import '../local_db.dart';
import '../models.dart';

final class SrsCardDao {
  const SrsCardDao(this._localDb);

  final LocalDb _localDb;

  Future<void> upsert(SrsCard card) async {
    final Database db = await _localDb.database;
    await db.insert(
      'srs_cards',
      card.toDb(),
      conflictAlgorithm: ConflictAlgorithm.replace,
    );
  }

  Future<void> upsertAll(Iterable<SrsCard> cards) async {
    final Database db = await _localDb.database;
    await db.transaction((Transaction txn) async {
      final Batch batch = txn.batch();
      for (final SrsCard card in cards) {
        batch.insert(
          'srs_cards',
          card.toDb(),
          conflictAlgorithm: ConflictAlgorithm.replace,
        );
      }
      await batch.commit(noResult: true);
    });
  }

  Future<SrsCard?> getById(String id) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'srs_cards',
      where: 'id = ?',
      whereArgs: <Object?>[id],
      limit: 1,
    );
    return rows.isEmpty ? null : SrsCard.fromDb(rows.first);
  }

  Future<List<SrsCard>> due({
    required String userId,
    DateTime? now,
    int limit = 100,
  }) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'srs_cards',
      where: 'user_id = ? AND next_review_at <= ?',
      whereArgs: <Object?>[
        userId,
        (now ?? DateTime.now()).toUtc().toIso8601String(),
      ],
      orderBy: 'next_review_at ASC, ease_factor ASC',
      limit: limit.clamp(1, 200).toInt(),
    );
    return rows.map<SrsCard>(SrsCard.fromDb).toList();
  }

  Future<List<SrsCard>> pendingReviews(String userId) async {
    final Database db = await _localDb.database;
    final List<Map<String, Object?>> rows = await db.query(
      'srs_cards',
      where: 'user_id = ? AND pending_action_json IS NOT NULL',
      whereArgs: <Object?>[userId],
      orderBy: 'updated_at ASC',
    );
    return rows.map<SrsCard>(SrsCard.fromDb).toList();
  }

  Future<void> clearPendingAction(String cardId) async {
    final Database db = await _localDb.database;
    await db.update(
      'srs_cards',
      <String, Object?>{'pending_action_json': null},
      where: 'id = ?',
      whereArgs: <Object?>[cardId],
    );
  }

  Future<int> delete(String id) async {
    final Database db = await _localDb.database;
    return db.delete('srs_cards', where: 'id = ?', whereArgs: <Object?>[id]);
  }
}
