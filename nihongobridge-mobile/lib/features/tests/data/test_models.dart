import '../../../core/api/json_helpers.dart';
import '../../../core/db/models.dart';

final class TestOption {
  const TestOption(
      {required this.id, required this.textJp, required this.textEn});

  factory TestOption.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'test option');
    return TestOption(
      id: map['id'] as String,
      textJp: nullableString(map['text_jp']) ?? '',
      textEn: nullableString(map['text_en']) ?? '',
    );
  }

  final String id;
  final String textJp;
  final String textEn;
}

final class TestQuestion {
  const TestQuestion({
    required this.id,
    required this.sectionType,
    required this.questionJp,
    required this.questionEn,
    required this.stimulus,
    required this.options,
    required this.audioUrl,
    required this.jlptLevel,
    required this.timeLimitSeconds,
  });

  factory TestQuestion.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'test question');
    final Object? rawStimulus = map['stimulus'];
    return TestQuestion(
      id: map['id'] as String,
      sectionType: map['section_type'] as String,
      questionJp: nullableString(map['question_jp']),
      questionEn: nullableString(map['question_en']),
      stimulus: rawStimulus is Map<Object?, Object?>
          ? jsonObject(rawStimulus, label: 'question stimulus')
          : null,
      options: jsonList(map['options'], label: 'question options')
          .map<TestOption>(TestOption.fromApi)
          .toList(growable: false),
      audioUrl: nullableString(map['audio_url']) ??
          (rawStimulus is Map<Object?, Object?>
              ? nullableString(rawStimulus['audio_url'])
              : null),
      jlptLevel: nullableString(map['jlpt_level']) ?? 'N5',
      timeLimitSeconds: nullableInt(map['time_limit_seconds']),
    );
  }

  final String id;
  final String sectionType;
  final String? questionJp;
  final String? questionEn;
  final JsonMap? stimulus;
  final List<TestOption> options;
  final String? audioUrl;
  final String jlptLevel;
  final int? timeLimitSeconds;
}

final class TestSessionStatus {
  const TestSessionStatus({
    required this.sessionId,
    required this.level,
    required this.question,
    required this.currentQuestionNumber,
    required this.totalQuestions,
    required this.timeRemaining,
    required this.complete,
  });

  factory TestSessionStatus.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'test session');
    final Object? rawQuestion = map['current_question'];
    return TestSessionStatus(
      sessionId: map['session_id'] as String,
      level: nullableString(map['level']) ?? 'N5',
      question: rawQuestion == null ? null : TestQuestion.fromApi(rawQuestion),
      currentQuestionNumber: nullableInt(map['current_question_number']) ?? 1,
      totalQuestions: nullableInt(map['total_questions']) ?? 1,
      timeRemaining: nullableInt(map['time_remaining']) ?? 0,
      complete: map['status'] == 'completed',
    );
  }

  final String sessionId;
  final String level;
  final TestQuestion? question;
  final int currentQuestionNumber;
  final int totalQuestions;
  final int timeRemaining;
  final bool complete;
}

final class AnswerResult {
  const AnswerResult({
    required this.nextQuestion,
    required this.testComplete,
    required this.timeRemaining,
  });

  factory AnswerResult.fromApi(Object? value) {
    final JsonMap map = jsonObject(value, label: 'answer result');
    return AnswerResult(
      nextQuestion: map['next_question'] == null
          ? null
          : TestQuestion.fromApi(map['next_question']),
      testComplete: map['test_complete'] == true,
      timeRemaining: nullableInt(map['time_remaining']) ?? 0,
    );
  }

  final TestQuestion? nextQuestion;
  final bool testComplete;
  final int timeRemaining;
}
