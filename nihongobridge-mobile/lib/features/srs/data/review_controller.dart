import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/db/daos/srs_card_dao.dart';
import '../../../core/db/models.dart';
import 'srs_repository.dart';

final class ReviewState {
  const ReviewState({
    required this.loading,
    required this.submitting,
    required this.cards,
    required this.completed,
    required this.startedAt,
    required this.offline,
    this.message,
  });

  const ReviewState.initial()
      : this(
          loading: true,
          submitting: false,
          cards: const <SrsCard>[],
          completed: 0,
          startedAt: null,
          offline: false,
        );

  final bool loading;
  final bool submitting;
  final List<SrsCard> cards;
  final int completed;
  final DateTime? startedAt;
  final bool offline;
  final String? message;

  SrsCard? get current => cards.firstOrNull;
  int get total => completed + cards.length;

  ReviewState copyWith({
    bool? loading,
    bool? submitting,
    List<SrsCard>? cards,
    int? completed,
    DateTime? startedAt,
    bool? offline,
    String? message,
    bool clearMessage = false,
  }) =>
      ReviewState(
        loading: loading ?? this.loading,
        submitting: submitting ?? this.submitting,
        cards: cards ?? this.cards,
        completed: completed ?? this.completed,
        startedAt: startedAt ?? this.startedAt,
        offline: offline ?? this.offline,
        message: clearMessage ? null : message ?? this.message,
      );
}

final class ReviewController extends StateNotifier<ReviewState> {
  ReviewController(this._repository) : super(const ReviewState.initial());

  final SrsRepository _repository;

  Future<void> load({bool refresh = true}) async {
    state = state.copyWith(loading: true, clearMessage: true);
    final String? userId = await _repository.userId();
    if (userId == null) {
      state = state.copyWith(
        loading: false,
        cards: const <SrsCard>[],
        message: 'Sign in to review your SRS cards.',
      );
      return;
    }
    try {
      final List<SrsCard> cards = refresh
          ? await _repository.refresh(userId)
          : await _repository.dueCards(userId);
      state = ReviewState(
        loading: false,
        submitting: false,
        cards: cards,
        completed: 0,
        startedAt: cards.isEmpty ? null : DateTime.now(),
        offline: false,
      );
    } on ApiException catch (error) {
      final List<SrsCard> local = await _repository.dueCards(userId);
      state = ReviewState(
        loading: false,
        submitting: false,
        cards: local,
        completed: 0,
        startedAt: local.isEmpty ? null : DateTime.now(),
        offline: true,
        message: local.isEmpty ? error.message : null,
      );
    }
  }

  Future<void> rate(SrsConfidence confidence) async {
    final SrsCard? card = state.current;
    if (card == null || state.submitting) return;
    state = state.copyWith(submitting: true, clearMessage: true);
    final int elapsed = DateTime.now()
        .difference(state.startedAt ?? DateTime.now())
        .inMilliseconds
        .clamp(0, 3_600_000)
        .toInt();
    try {
      final SrsCard saved = await _repository.review(
        card: card,
        confidence: confidence,
        timeTakenMilliseconds: elapsed,
      );
      final List<SrsCard> remaining =
          state.cards.skip(1).toList(growable: false);
      state = state.copyWith(
        submitting: false,
        cards: remaining,
        completed: state.completed + 1,
        startedAt: remaining.isEmpty ? state.startedAt : DateTime.now(),
        offline: state.offline || saved.pendingAction != null,
      );
    } on ApiException catch (error) {
      state = state.copyWith(submitting: false, message: error.message);
    }
  }
}

final srsRepositoryProvider = Provider<SrsRepository>((Ref ref) {
  final localDb = ref.watch(localDbProvider);
  return SrsRepository(
    api: ref.watch(apiClientProvider),
    tokenStore: ref.watch(authTokenStoreProvider),
    dao: SrsCardDao(localDb),
    cache: ref.watch(srsCacheProvider),
  );
});

final reviewControllerProvider =
    StateNotifierProvider<ReviewController, ReviewState>((Ref ref) {
  return ReviewController(ref.watch(srsRepositoryProvider));
});
