import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/api_providers.dart';
import 'test_models.dart';
import 'test_repository.dart';

final class TestState {
  const TestState({
    required this.loading,
    required this.submitting,
    required this.complete,
    required this.level,
    required this.question,
    required this.current,
    required this.total,
    required this.timeRemaining,
    required this.selected,
    required this.questionStartedAt,
    this.error,
  });

  const TestState.loading()
      : this(
          loading: true,
          submitting: false,
          complete: false,
          level: 'N5',
          question: null,
          current: 1,
          total: 1,
          timeRemaining: 0,
          selected: null,
          questionStartedAt: null,
        );

  final bool loading;
  final bool submitting;
  final bool complete;
  final String level;
  final TestQuestion? question;
  final int current;
  final int total;
  final int timeRemaining;
  final String? selected;
  final DateTime? questionStartedAt;
  final String? error;

  TestState copyWith({
    bool? loading,
    bool? submitting,
    bool? complete,
    String? level,
    TestQuestion? question,
    int? current,
    int? total,
    int? timeRemaining,
    String? selected,
    bool clearSelection = false,
    DateTime? questionStartedAt,
    String? error,
    bool clearError = false,
  }) =>
      TestState(
        loading: loading ?? this.loading,
        submitting: submitting ?? this.submitting,
        complete: complete ?? this.complete,
        level: level ?? this.level,
        question: question ?? this.question,
        current: current ?? this.current,
        total: total ?? this.total,
        timeRemaining: timeRemaining ?? this.timeRemaining,
        selected: clearSelection ? null : selected ?? this.selected,
        questionStartedAt: questionStartedAt ?? this.questionStartedAt,
        error: clearError ? null : error ?? this.error,
      );
}

final class TestController extends StateNotifier<TestState> {
  TestController(
      {required String sessionId, required TestRepository repository})
      : _sessionId = sessionId,
        _repository = repository,
        super(const TestState.loading());

  final String _sessionId;
  final TestRepository _repository;

  Future<void> load() async {
    state = const TestState.loading();
    if (_sessionId == 'demo') {
      state = TestState(
        loading: false,
        submitting: false,
        complete: false,
        level: 'N4',
        question: _demoQuestion,
        current: 3,
        total: 20,
        timeRemaining: 19 * 60 + 42,
        selected: null,
        questionStartedAt: DateTime.now(),
      );
      return;
    }
    try {
      final TestSessionStatus session =
          await _repository.getSession(_sessionId);
      state = TestState(
        loading: false,
        submitting: false,
        complete: session.complete,
        level: session.level,
        question: session.question,
        current: session.currentQuestionNumber,
        total: session.totalQuestions,
        timeRemaining: session.timeRemaining,
        selected: null,
        questionStartedAt: DateTime.now(),
      );
    } on ApiException catch (error) {
      state = state.copyWith(loading: false, error: error.message);
    }
  }

  void select(String optionId) {
    if (state.submitting) return;
    state = state.copyWith(selected: optionId, clearError: true);
  }

  Future<void> submit() async {
    final TestQuestion? question = state.question;
    final String? selected = state.selected;
    if (question == null || selected == null || state.submitting) return;
    if (_sessionId == 'demo') {
      state = state.copyWith(
        complete: true,
        submitting: false,
        clearSelection: true,
      );
      return;
    }
    state = state.copyWith(submitting: true, clearError: true);
    final int elapsed = DateTime.now()
        .difference(state.questionStartedAt ?? DateTime.now())
        .inMilliseconds
        .clamp(0, 3_600_000)
        .toInt();
    try {
      final AnswerResult result = await _repository.answer(
        sessionId: _sessionId,
        questionId: question.id,
        selected: selected,
        timeTakenMilliseconds: elapsed,
      );
      state = state.copyWith(
        submitting: false,
        complete: result.testComplete,
        question: result.nextQuestion,
        current: result.testComplete ? state.current : state.current + 1,
        timeRemaining: result.timeRemaining,
        clearSelection: true,
        questionStartedAt: DateTime.now(),
      );
    } on ApiException catch (error) {
      state = state.copyWith(submitting: false, error: error.message);
    }
  }

  void updateTime(int seconds) {
    state = state.copyWith(timeRemaining: seconds);
  }
}

final testRepositoryProvider = Provider<TestRepository>(
  (Ref ref) => TestRepository(ref.watch(apiClientProvider)),
);

final testControllerProvider = StateNotifierProvider.autoDispose
    .family<TestController, TestState, String>((Ref ref, String sessionId) {
  return TestController(
    sessionId: sessionId,
    repository: ref.watch(testRepositoryProvider),
  );
});

const TestQuestion _demoQuestion = TestQuestion(
  id: 'demo-question',
  sectionType: 'listening',
  questionJp: '<ruby>田中<rt>たなか</rt></ruby>さんは、まず何をしますか。',
  questionEn: 'What will Tanaka do first?',
  stimulus: <String, Object?>{},
  options: <TestOption>[
    TestOption(id: 'A', textJp: '切符を買います', textEn: 'Buy a ticket'),
    TestOption(id: 'B', textJp: '友だちに電話します', textEn: 'Call a friend'),
    TestOption(id: 'C', textJp: '昼ご飯を食べます', textEn: 'Eat lunch'),
    TestOption(id: 'D', textJp: '家に帰ります', textEn: 'Go home'),
  ],
  audioUrl: null,
  jlptLevel: 'N4',
  timeLimitSeconds: 60,
);
