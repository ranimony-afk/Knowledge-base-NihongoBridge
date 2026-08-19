import 'package:flutter_test/flutter_test.dart';
import 'package:nihongobridge_mobile/core/db/daos/dictionary_dao.dart';
import 'package:nihongobridge_mobile/core/db/daos/srs_card_dao.dart';
import 'package:nihongobridge_mobile/core/db/local_db.dart';
import 'package:nihongobridge_mobile/core/db/models.dart';
import 'package:sqflite_common_ffi/sqflite_ffi.dart';

void main() {
  sqfliteFfiInit();
  late LocalDb localDb;

  setUp(() {
    localDb = LocalDb.forTesting(
      factory: databaseFactoryFfi,
      databasePath: inMemoryDatabasePath,
    );
  });

  tearDown(() => localDb.close());

  test('creates versioned schema and searches dictionary offline', () async {
    final DictionaryDao dao = DictionaryDao(localDb);
    final DictionaryEntry entry = DictionaryEntry(
      id: 'word-1',
      word: '学校',
      kana: 'がっこう',
      romaji: 'gakkou',
      furigana: <JsonMap>[],
      meanings: <JsonMap>[
        <String, Object?>{'lang': 'en', 'value': 'school'},
      ],
      jlptLevel: 'N5',
      partOfSpeech: <String>['noun'],
      audioUrl: null,
      tags: <String>[],
      source: 'jmdict',
      updatedAt: DateTime.utc(2026, 8, 18),
    );
    await dao.upsert(entry);
    expect((await dao.search('がっこう')).single.id, 'word-1');
    expect((await dao.search('school')).single.word, '学校');
    expect(await dao.countByLevels(<String>['N5', 'N4']), 1);
    expect((await localDb.database).getVersion(),
        completion(LocalDb.schemaVersion));
  });

  test('stores due and pending SRS cards', () async {
    final SrsCardDao dao = SrsCardDao(localDb);
    final SrsCard card = SrsCard(
      id: 'card-1',
      userId: 'user-1',
      itemType: 'word',
      itemId: 'word-1',
      easeFactor: 2.5,
      intervalDays: 1,
      repetitions: 0,
      nextReviewAt: DateTime.utc(2026, 8, 17),
      lastReviewedAt: null,
      totalReviews: 0,
      correctCount: 0,
      mistakeCount: 0,
      averageTimeMs: 0,
      confidence: null,
      deckId: null,
      content: const <String, Object?>{'word': '水'},
      updatedAt: DateTime.utc(2026, 8, 18),
      pendingAction: const <String, Object?>{
        'card_id': 'card-1',
        'confidence': 'good',
      },
    );
    await dao.upsert(card);
    expect(
        (await dao.due(userId: 'user-1', now: DateTime.utc(2026, 8, 18)))
            .length,
        1);
    expect(
        (await dao.pendingReviews('user-1')).single.pendingAction, isNotNull);
    await dao.clearPendingAction('card-1');
    expect(await dao.pendingReviews('user-1'), isEmpty);
  });
}
