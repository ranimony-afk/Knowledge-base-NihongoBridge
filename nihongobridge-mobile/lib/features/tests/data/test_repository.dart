import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/api/api_exception.dart';
import 'test_models.dart';

final class TestRepository {
  const TestRepository(this._api);

  final ApiClient _api;

  Future<TestSessionStatus> getSession(String sessionId) async {
    final Response<Object?> response =
        await _api.get(ApiEndpoints.testSession(sessionId));
    return ApiEnvelope<TestSessionStatus>.fromJson(
      response.data,
      TestSessionStatus.fromApi,
    ).data;
  }

  Future<AnswerResult> answer({
    required String sessionId,
    required String questionId,
    required String selected,
    required int timeTakenMilliseconds,
  }) async {
    final Response<Object?> response = await _api.post(
      ApiEndpoints.testAnswer(sessionId),
      data: <String, Object?>{
        'question_id': questionId,
        'selected': selected,
        'time_taken_ms': timeTakenMilliseconds,
      },
    );
    return ApiEnvelope<AnswerResult>.fromJson(
      response.data,
      AnswerResult.fromApi,
    ).data;
  }
}
