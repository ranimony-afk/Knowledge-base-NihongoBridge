import 'package:dio/dio.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongobridge_mobile/core/api/api_exception.dart';

void main() {
  test('parses the shared API error envelope', () {
    final Response<Object?> response = Response<Object?>(
      requestOptions: RequestOptions(path: '/api/example'),
      statusCode: 422,
      data: <String, Object?>{
        'data': <String, Object?>{'field': 'message'},
        'meta': <String, Object?>{'page': 1, 'limit': 0, 'total': 0},
        'error': 'Invalid message',
      },
    );
    final ApiException error = ApiException.fromResponse(response);
    expect(error.kind, ApiExceptionKind.validation);
    expect(error.message, 'Invalid message');
    expect(error.statusCode, 422);
  });

  test('decodes successful API envelopes', () {
    final ApiEnvelope<List<String>> result = ApiEnvelope<List<String>>.fromJson(
      <String, Object?>{
        'data': <Object?>['水', '火'],
        'meta': <String, Object?>{'page': 1, 'limit': 20, 'total': 2},
      },
      (Object? value) => (value! as List<Object?>).cast<String>(),
    );
    expect(result.data, <String>['水', '火']);
    expect(result.meta.total, 2);
  });
}
