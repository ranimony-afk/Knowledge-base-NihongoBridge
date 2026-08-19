import 'dart:convert';

import '../api/json_helpers.dart';

typedef JsonMap = Map<String, Object?>;

final class DictionaryEntry {
  const DictionaryEntry({
    required this.id,
    required this.word,
    required this.kana,
    required this.romaji,
    required this.furigana,
    required this.meanings,
    required this.jlptLevel,
    required this.partOfSpeech,
    required this.audioUrl,
    required this.tags,
    required this.source,
    required this.updatedAt,
  });

  factory DictionaryEntry.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'dictionary entry');
    return DictionaryEntry(
      id: map['id'] as String,
      word: map['word'] as String,
      kana: nullableString(map['kana']),
      romaji: nullableString(map['romaji']),
      furigana: _jsonMapList(map['furigana']),
      meanings: _jsonMapList(map['meanings']),
      jlptLevel: nullableString(map['jlpt_level']) ?? 'NONE',
      partOfSpeech: stringList(map['part_of_speech']),
      audioUrl: nullableString(map['audio_url']),
      tags: stringList(map['tags']),
      source: nullableString(map['source']) ?? 'unknown',
      updatedAt: _date(map['updated_at']) ?? DateTime.now().toUtc(),
    );
  }

  factory DictionaryEntry.fromDb(JsonMap map) => DictionaryEntry(
        id: map['id'] as String,
        word: map['word'] as String,
        kana: nullableString(map['kana']),
        romaji: nullableString(map['romaji']),
        furigana: _decodeMapList(map['furigana_json']),
        meanings: _decodeMapList(map['meanings_json']),
        jlptLevel: map['jlpt_level'] as String,
        partOfSpeech: _decodeStringList(map['part_of_speech_json']),
        audioUrl: nullableString(map['audio_url']),
        tags: _decodeStringList(map['tags_json']),
        source: map['source'] as String,
        updatedAt: DateTime.parse(map['updated_at'] as String).toUtc(),
      );

  final String id;
  final String word;
  final String? kana;
  final String? romaji;
  final List<JsonMap> furigana;
  final List<JsonMap> meanings;
  final String jlptLevel;
  final List<String> partOfSpeech;
  final String? audioUrl;
  final List<String> tags;
  final String source;
  final DateTime updatedAt;

  String get displayMeaning {
    for (final JsonMap meaning in meanings) {
      if (meaning['lang'] == 'en' && meaning['value'] is String) {
        return meaning['value']! as String;
      }
    }
    return meanings.firstOrNull?['value'] as String? ?? 'Meaning unavailable';
  }

  JsonMap toDb() => <String, Object?>{
        'id': id,
        'word': word,
        'kana': kana,
        'romaji': romaji,
        'furigana_json': jsonEncode(furigana),
        'meanings_json': jsonEncode(meanings),
        'jlpt_level': jlptLevel,
        'part_of_speech_json': jsonEncode(partOfSpeech),
        'audio_url': audioUrl,
        'tags_json': jsonEncode(tags),
        'source': source,
        'updated_at': updatedAt.toUtc().toIso8601String(),
      };
}

final class KanjiEntry {
  const KanjiEntry({
    required this.id,
    required this.character,
    required this.onyomi,
    required this.kunyomi,
    required this.meanings,
    required this.jlptLevel,
    required this.grade,
    required this.strokeCount,
    required this.radicals,
    required this.strokeOrderUrl,
    required this.source,
    required this.updatedAt,
  });

  factory KanjiEntry.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'kanji entry');
    return KanjiEntry(
      id: map['id'] as String,
      character: map['character'] as String,
      onyomi: stringList(map['onyomi']),
      kunyomi: stringList(map['kunyomi']),
      meanings: _jsonMapList(map['meanings']),
      jlptLevel: nullableString(map['jlpt_level']) ?? 'NONE',
      grade: nullableInt(map['grade']),
      strokeCount: nullableInt(map['stroke_count']),
      radicals: stringList(map['radicals']),
      strokeOrderUrl: nullableString(map['stroke_order_url']),
      source: nullableString(map['source']) ?? 'kanjidic2',
      updatedAt: _date(map['updated_at']) ?? DateTime.now().toUtc(),
    );
  }

  factory KanjiEntry.fromDb(JsonMap map) => KanjiEntry(
        id: map['id'] as String,
        character: map['character'] as String,
        onyomi: _decodeStringList(map['onyomi_json']),
        kunyomi: _decodeStringList(map['kunyomi_json']),
        meanings: _decodeMapList(map['meanings_json']),
        jlptLevel: map['jlpt_level'] as String,
        grade: nullableInt(map['grade']),
        strokeCount: nullableInt(map['stroke_count']),
        radicals: _decodeStringList(map['radicals_json']),
        strokeOrderUrl: nullableString(map['stroke_order_url']),
        source: map['source'] as String,
        updatedAt: DateTime.parse(map['updated_at'] as String).toUtc(),
      );

  final String id;
  final String character;
  final List<String> onyomi;
  final List<String> kunyomi;
  final List<JsonMap> meanings;
  final String jlptLevel;
  final int? grade;
  final int? strokeCount;
  final List<String> radicals;
  final String? strokeOrderUrl;
  final String source;
  final DateTime updatedAt;

  JsonMap toDb() => <String, Object?>{
        'id': id,
        'character': character,
        'onyomi_json': jsonEncode(onyomi),
        'kunyomi_json': jsonEncode(kunyomi),
        'meanings_json': jsonEncode(meanings),
        'jlpt_level': jlptLevel,
        'grade': grade,
        'stroke_count': strokeCount,
        'radicals_json': jsonEncode(radicals),
        'stroke_order_url': strokeOrderUrl,
        'source': source,
        'updated_at': updatedAt.toUtc().toIso8601String(),
      };
}

enum SrsConfidence { again, hard, good, easy }

final class SrsCard {
  const SrsCard({
    required this.id,
    required this.userId,
    required this.itemType,
    required this.itemId,
    required this.easeFactor,
    required this.intervalDays,
    required this.repetitions,
    required this.nextReviewAt,
    required this.lastReviewedAt,
    required this.totalReviews,
    required this.correctCount,
    required this.mistakeCount,
    required this.averageTimeMs,
    required this.confidence,
    required this.deckId,
    required this.content,
    required this.updatedAt,
    required this.pendingAction,
  });

  factory SrsCard.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'SRS card');
    return SrsCard(
      id: map['id'] as String,
      userId: map['user_id'] as String,
      itemType: map['item_type'] as String,
      itemId: map['item_id'] as String,
      easeFactor: nullableDouble(map['ease_factor']) ?? 2.5,
      intervalDays: nullableInt(map['interval_days']) ?? 1,
      repetitions: nullableInt(map['repetitions']) ?? 0,
      nextReviewAt: _date(map['next_review_at']) ?? DateTime.now().toUtc(),
      lastReviewedAt: _date(map['last_reviewed_at']),
      totalReviews: nullableInt(map['total_reviews']) ?? 0,
      correctCount: nullableInt(map['correct_count']) ?? 0,
      mistakeCount: nullableInt(map['mistake_count']) ?? 0,
      averageTimeMs: nullableInt(map['average_time_ms']) ?? 0,
      confidence: _confidence(map['confidence']),
      deckId: nullableString(map['deck_id']),
      content: map['item'] is Map<Object?, Object?>
          ? jsonObject(map['item'], label: 'SRS item')
          : const <String, Object?>{},
      updatedAt: _date(map['updated_at']) ?? DateTime.now().toUtc(),
      pendingAction: null,
    );
  }

  factory SrsCard.fromDb(JsonMap map) => SrsCard(
        id: map['id'] as String,
        userId: map['user_id'] as String,
        itemType: map['item_type'] as String,
        itemId: map['item_id'] as String,
        easeFactor: (map['ease_factor'] as num).toDouble(),
        intervalDays: (map['interval_days'] as num).toInt(),
        repetitions: (map['repetitions'] as num).toInt(),
        nextReviewAt: DateTime.parse(map['next_review_at'] as String).toUtc(),
        lastReviewedAt: _date(map['last_reviewed_at']),
        totalReviews: (map['total_reviews'] as num).toInt(),
        correctCount: (map['correct_count'] as num).toInt(),
        mistakeCount: (map['mistake_count'] as num).toInt(),
        averageTimeMs: (map['average_time_ms'] as num).toInt(),
        confidence: _confidence(map['confidence']),
        deckId: nullableString(map['deck_id']),
        content: jsonObject(
          jsonDecode(map['content_json'] as String),
          label: 'stored SRS content',
        ),
        updatedAt: DateTime.parse(map['updated_at'] as String).toUtc(),
        pendingAction: _decodeNullableMap(map['pending_action_json']),
      );

  factory SrsCard.fromCache(Object? value) =>
      SrsCard.fromDb(jsonObject(value, label: 'cached SRS card'));

  final String id;
  final String userId;
  final String itemType;
  final String itemId;
  final double easeFactor;
  final int intervalDays;
  final int repetitions;
  final DateTime nextReviewAt;
  final DateTime? lastReviewedAt;
  final int totalReviews;
  final int correctCount;
  final int mistakeCount;
  final int averageTimeMs;
  final SrsConfidence? confidence;
  final String? deckId;
  final JsonMap content;
  final DateTime updatedAt;
  final JsonMap? pendingAction;

  String get frontText =>
      nullableString(content['word']) ??
      nullableString(content['character']) ??
      nullableString(content['pattern']) ??
      nullableString(content['japanese']) ??
      'Review';

  String? get reading =>
      nullableString(content['kana']) ?? nullableString(content['reading']);

  List<String> get displayMeanings {
    final Object? raw = content['meanings'];
    if (raw is! List<Object?>) return const <String>[];
    return raw.expand<String>((Object? item) {
      if (item is String) return <String>[item];
      if (item case final Map<Object?, Object?> map) {
        final Object? value = map['value'];
        if (value is String && (map['lang'] == 'en' || map['lang'] == null)) {
          return <String>[value];
        }
      }
      return const <String>[];
    }).toList(growable: false);
  }

  String? get example => nullableString(content['example']);

  SrsCard copyWith({
    double? easeFactor,
    int? intervalDays,
    int? repetitions,
    DateTime? nextReviewAt,
    DateTime? lastReviewedAt,
    int? totalReviews,
    int? correctCount,
    int? mistakeCount,
    int? averageTimeMs,
    SrsConfidence? confidence,
    DateTime? updatedAt,
    JsonMap? pendingAction,
    bool clearPendingAction = false,
  }) =>
      SrsCard(
        id: id,
        userId: userId,
        itemType: itemType,
        itemId: itemId,
        easeFactor: easeFactor ?? this.easeFactor,
        intervalDays: intervalDays ?? this.intervalDays,
        repetitions: repetitions ?? this.repetitions,
        nextReviewAt: nextReviewAt ?? this.nextReviewAt,
        lastReviewedAt: lastReviewedAt ?? this.lastReviewedAt,
        totalReviews: totalReviews ?? this.totalReviews,
        correctCount: correctCount ?? this.correctCount,
        mistakeCount: mistakeCount ?? this.mistakeCount,
        averageTimeMs: averageTimeMs ?? this.averageTimeMs,
        confidence: confidence ?? this.confidence,
        deckId: deckId,
        content: content,
        updatedAt: updatedAt ?? this.updatedAt,
        pendingAction:
            clearPendingAction ? null : pendingAction ?? this.pendingAction,
      );

  JsonMap toDb() => <String, Object?>{
        'id': id,
        'user_id': userId,
        'item_type': itemType,
        'item_id': itemId,
        'ease_factor': easeFactor,
        'interval_days': intervalDays,
        'repetitions': repetitions,
        'next_review_at': nextReviewAt.toUtc().toIso8601String(),
        'last_reviewed_at': lastReviewedAt?.toUtc().toIso8601String(),
        'total_reviews': totalReviews,
        'correct_count': correctCount,
        'mistake_count': mistakeCount,
        'average_time_ms': averageTimeMs,
        'confidence': confidence?.name,
        'deck_id': deckId,
        'content_json': jsonEncode(content),
        'updated_at': updatedAt.toUtc().toIso8601String(),
        'pending_action_json':
            pendingAction == null ? null : jsonEncode(pendingAction),
      };

  JsonMap toCache() => toDb();
}

final class TestSessionRecord {
  const TestSessionRecord({
    required this.id,
    required this.testId,
    required this.userId,
    required this.status,
    required this.startedAt,
    required this.completedAt,
    required this.timeRemainingSeconds,
    required this.answers,
    required this.snapshot,
    required this.updatedAt,
    required this.dirty,
  });

  factory TestSessionRecord.fromDb(JsonMap map) => TestSessionRecord(
        id: map['id'] as String,
        testId: map['test_id'] as String,
        userId: map['user_id'] as String,
        status: map['status'] as String,
        startedAt: DateTime.parse(map['started_at'] as String).toUtc(),
        completedAt: _date(map['completed_at']),
        timeRemainingSeconds: (map['time_remaining_seconds'] as num).toInt(),
        answers: _decodeMapList(map['answers_json']),
        snapshot: jsonObject(
          jsonDecode(map['snapshot_json'] as String),
          label: 'test snapshot',
        ),
        updatedAt: DateTime.parse(map['updated_at'] as String).toUtc(),
        dirty: map['dirty'] == 1,
      );

  final String id;
  final String testId;
  final String userId;
  final String status;
  final DateTime startedAt;
  final DateTime? completedAt;
  final int timeRemainingSeconds;
  final List<JsonMap> answers;
  final JsonMap snapshot;
  final DateTime updatedAt;
  final bool dirty;

  JsonMap toDb() => <String, Object?>{
        'id': id,
        'test_id': testId,
        'user_id': userId,
        'status': status,
        'started_at': startedAt.toUtc().toIso8601String(),
        'completed_at': completedAt?.toUtc().toIso8601String(),
        'time_remaining_seconds': timeRemainingSeconds,
        'answers_json': jsonEncode(answers),
        'snapshot_json': jsonEncode(snapshot),
        'updated_at': updatedAt.toUtc().toIso8601String(),
        'dirty': dirty ? 1 : 0,
      };
}

List<JsonMap> _jsonMapList(Object? value) => jsonList(value)
    .whereType<Map<Object?, Object?>>()
    .map<JsonMap>(jsonObject)
    .toList(growable: false);

List<JsonMap> _decodeMapList(Object? value) {
  if (value is! String) return const <JsonMap>[];
  return _jsonMapList(jsonDecode(value));
}

List<String> _decodeStringList(Object? value) {
  if (value is! String) return const <String>[];
  return stringList(jsonDecode(value));
}

JsonMap? _decodeNullableMap(Object? value) {
  if (value is! String || value.isEmpty) return null;
  return jsonObject(jsonDecode(value));
}

DateTime? _date(Object? value) =>
    value is String ? DateTime.tryParse(value)?.toUtc() : null;

SrsConfidence? _confidence(Object? value) => switch (value) {
      'again' => SrsConfidence.again,
      'hard' => SrsConfidence.hard,
      'good' => SrsConfidence.good,
      'easy' => SrsConfidence.easy,
      _ => null,
    };
