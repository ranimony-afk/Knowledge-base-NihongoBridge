import 'dart:math' as math;

import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/auth_token_store.dart';
import '../../../core/api/json_helpers.dart';
import '../../../core/db/daos/srs_card_dao.dart';
import '../../../core/db/models.dart';
import '../../../core/db/srs_cache.dart';

final class SrsRepository {
  const SrsRepository({
    required ApiClient api,
    required AuthTokenStore tokenStore,
    required SrsCardDao dao,
    required SrsCache cache,
  })  : _api = api,
        _tokenStore = tokenStore,
        _dao = dao,
        _cache = cache;

  final ApiClient _api;
  final AuthTokenStore _tokenStore;
  final SrsCardDao _dao;
  final SrsCache _cache;

  Future<String?> userId() => _tokenStore.readUserId();

  Future<List<SrsCard>> dueCards(String userId) async {
    final List<SrsCard> cached = _cache.dueCards(userId: userId);
    if (cached.isNotEmpty) return cached;
    return _dao.due(userId: userId);
  }

  Future<List<SrsCard>> refresh(String userId) async {
    try {
      final Response<Object?> response = await _api.get(
        ApiEndpoints.srsDue,
        queryParameters: <String, Object?>{'user_id': userId, 'limit': 100},
      );
      final List<SrsCard> cards = ApiEnvelope<List<SrsCard>>.fromJson(
        response.data,
        (Object? data) => jsonList(data, label: 'SRS cards')
            .map<SrsCard>(SrsCard.fromApi)
            .toList(growable: false),
      ).data;
      await _dao.upsertAll(cards);
      await _cache.putAll(cards);
      return cards;
    } on ApiException catch (error) {
      final List<SrsCard> local = await dueCards(userId);
      if (local.isNotEmpty && error.isRetryable) return local;
      rethrow;
    }
  }

  Future<SrsCard> review({
    required SrsCard card,
    required SrsConfidence confidence,
    required int timeTakenMilliseconds,
  }) async {
    final DateTime reviewedAt = DateTime.now().toUtc();
    final SrsCard updated = _schedule(
      card,
      confidence,
      timeTakenMilliseconds,
      reviewedAt,
    );
    await _dao.upsert(updated);
    await _cache.put(updated);

    try {
      await _api.post(
        ApiEndpoints.srsReview,
        data: <String, Object?>{
          'card_id': card.id,
          'confidence': confidence.name,
          'time_taken_ms': timeTakenMilliseconds,
        },
        options: Options(headers: <String, Object?>{
          'X-Idempotency-Key': '${card.id}:${reviewedAt.toIso8601String()}',
        }),
      );
      final SrsCard clean = updated.copyWith(clearPendingAction: true);
      await _dao.upsert(clean);
      await _cache.put(clean);
      return clean;
    } on ApiException catch (error) {
      if (error.kind == ApiExceptionKind.unauthorized ||
          error.kind == ApiExceptionKind.forbidden ||
          error.kind == ApiExceptionKind.validation) {
        rethrow;
      }
      return updated;
    }
  }

  SrsCard _schedule(
    SrsCard card,
    SrsConfidence confidence,
    int timeTakenMilliseconds,
    DateTime reviewedAt,
  ) {
    double ease = card.easeFactor;
    int repetitions = card.repetitions;
    int interval;
    final bool correct = confidence != SrsConfidence.again;
    switch (confidence) {
      case SrsConfidence.again:
        ease = math.max(1.3, ease - 0.2);
        repetitions = 0;
        interval = 1;
        break;
      case SrsConfidence.hard:
        ease = math.max(1.3, ease - 0.15);
        repetitions += 1;
        interval = math.max(1, (card.intervalDays * 1.2).round());
        break;
      case SrsConfidence.good:
        interval = repetitions == 0
            ? 1
            : repetitions == 1
                ? 6
                : math.max(1, (card.intervalDays * ease).round());
        repetitions += 1;
        break;
      case SrsConfidence.easy:
        interval = math.max(2, (card.intervalDays * ease * 1.3).round());
        repetitions += 1;
        break;
    }
    final int totalReviews = card.totalReviews + 1;
    final int averageTime =
        ((card.averageTimeMs * card.totalReviews) + timeTakenMilliseconds) ~/
            totalReviews;
    final JsonMap pendingAction = <String, Object?>{
      'card_id': card.id,
      'confidence': confidence.name,
      'time_taken_ms': timeTakenMilliseconds,
      'reviewed_at': reviewedAt.toIso8601String(),
    };
    return card.copyWith(
      easeFactor: ease,
      intervalDays: interval,
      repetitions: repetitions,
      nextReviewAt: reviewedAt.add(Duration(days: interval)),
      lastReviewedAt: reviewedAt,
      totalReviews: totalReviews,
      correctCount: card.correctCount + (correct ? 1 : 0),
      mistakeCount: card.mistakeCount + (correct ? 0 : 1),
      averageTimeMs: averageTime,
      confidence: confidence,
      updatedAt: reviewedAt,
      pendingAction: pendingAction,
    );
  }
}
