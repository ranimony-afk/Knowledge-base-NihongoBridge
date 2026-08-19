import 'package:dio/dio.dart';

enum ApiExceptionKind {
  cancelled,
  network,
  timeout,
  unauthorized,
  forbidden,
  notFound,
  conflict,
  validation,
  rateLimited,
  server,
  unknown,
}

final class ApiException implements Exception {
  const ApiException({
    required this.kind,
    required this.message,
    this.statusCode,
    this.retryAfter,
    this.details,
  });

  final ApiExceptionKind kind;
  final String message;
  final int? statusCode;
  final Duration? retryAfter;
  final Object? details;

  bool get isOffline => kind == ApiExceptionKind.network;
  bool get isRetryable => switch (kind) {
        ApiExceptionKind.network ||
        ApiExceptionKind.timeout ||
        ApiExceptionKind.rateLimited ||
        ApiExceptionKind.server =>
          true,
        _ => false,
      };

  factory ApiException.fromDio(DioException error) {
    if (error.error case final ApiException parsed) return parsed;
    if (error.type == DioExceptionType.cancel) {
      return const ApiException(
        kind: ApiExceptionKind.cancelled,
        message: 'The request was cancelled.',
      );
    }
    if (error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.sendTimeout ||
        error.type == DioExceptionType.receiveTimeout) {
      return const ApiException(
        kind: ApiExceptionKind.timeout,
        message: 'The server took too long to respond.',
      );
    }
    if (error.type == DioExceptionType.connectionError) {
      return const ApiException(
        kind: ApiExceptionKind.network,
        message: 'You appear to be offline.',
      );
    }
    return ApiException.fromResponse(error.response);
  }

  factory ApiException.fromResponse(Response<Object?>? response) {
    final int? status = response?.statusCode;
    final Object? body = response?.data;
    String message = 'Something went wrong.';
    Object? details;
    if (body case final Map<Object?, Object?> map) {
      final Object? rawError = map['error'];
      if (rawError is String && rawError.trim().isNotEmpty) {
        message = rawError;
      }
      details = map['data'];
    }
    final ApiExceptionKind kind = switch (status) {
      400 || 422 => ApiExceptionKind.validation,
      401 => ApiExceptionKind.unauthorized,
      403 => ApiExceptionKind.forbidden,
      404 => ApiExceptionKind.notFound,
      409 => ApiExceptionKind.conflict,
      429 => ApiExceptionKind.rateLimited,
      final int code when code >= 500 => ApiExceptionKind.server,
      _ => ApiExceptionKind.unknown,
    };
    final String? retryAfterHeader = response?.headers.value('retry-after');
    final int? retrySeconds = int.tryParse(retryAfterHeader ?? '');
    return ApiException(
      kind: kind,
      message: message,
      statusCode: status,
      retryAfter: retrySeconds == null ? null : Duration(seconds: retrySeconds),
      details: details,
    );
  }

  @override
  String toString() => 'ApiException($kind, $statusCode): $message';
}

final class ApiMeta {
  const ApiMeta({required this.page, required this.limit, required this.total});

  factory ApiMeta.fromJson(Object? value) {
    final Map<Object?, Object?> map =
        value is Map<Object?, Object?> ? value : const <Object?, Object?>{};
    return ApiMeta(
      page: (map['page'] as num?)?.toInt() ?? 1,
      limit: (map['limit'] as num?)?.toInt() ?? 0,
      total: (map['total'] as num?)?.toInt() ?? 0,
    );
  }

  final int page;
  final int limit;
  final int total;
}

final class ApiEnvelope<T> {
  const ApiEnvelope({required this.data, required this.meta});

  factory ApiEnvelope.fromJson(
    Object? value,
    T Function(Object? value) decodeData,
  ) {
    if (value is! Map<Object?, Object?>) {
      throw const FormatException('Expected an API response object.');
    }
    final Object? error = value['error'];
    if (error is String && error.isNotEmpty) {
      throw ApiException(
        kind: ApiExceptionKind.unknown,
        message: error,
        details: value['data'],
      );
    }
    return ApiEnvelope<T>(
      data: decodeData(value['data']),
      meta: ApiMeta.fromJson(value['meta']),
    );
  }

  final T data;
  final ApiMeta meta;
}
