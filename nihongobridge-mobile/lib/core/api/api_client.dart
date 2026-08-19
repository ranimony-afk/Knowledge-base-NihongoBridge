import 'dart:async';
import 'dart:math' as math;

import 'package:dio/dio.dart';
import 'package:flutter/foundation.dart';

import 'api_exception.dart';
import 'auth_token_store.dart';

const String _configuredBaseUrl = String.fromEnvironment(
  'API_BASE_URL',
  defaultValue: 'http://10.0.2.2:3000',
);

final class ApiClient {
  ApiClient({
    required AuthTokenStore tokenStore,
    Dio? dio,
    String baseUrl = _configuredBaseUrl,
  }) : _dio = dio ?? Dio() {
    final Uri? uri = Uri.tryParse(baseUrl);
    if (uri == null ||
        !uri.hasScheme ||
        !const {'http', 'https'}.contains(uri.scheme)) {
      throw ArgumentError.value(baseUrl, 'baseUrl', 'Must be an HTTP(S) URL');
    }
    _dio.options = BaseOptions(
      baseUrl: baseUrl.replaceFirst(RegExp(r'/$'), ''),
      connectTimeout: const Duration(seconds: 15),
      receiveTimeout: const Duration(seconds: 30),
      sendTimeout: const Duration(seconds: 20),
      responseType: ResponseType.json,
      headers: const <String, Object>{
        Headers.acceptHeader: Headers.jsonContentType,
      },
    );
    _dio.interceptors.addAll(<Interceptor>[
      _AuthInterceptor(tokenStore),
      _RetryInterceptor(_dio),
      _ApiErrorInterceptor(),
      if (kDebugMode)
        LogInterceptor(
          requestHeader: false,
          requestBody: false,
          responseHeader: false,
          responseBody: false,
          logPrint: (Object message) => debugPrint('[api] $message'),
        ),
    ]);
  }

  final Dio _dio;

  Dio get raw => _dio;

  Future<Response<Object?>> get(
    String path, {
    Map<String, Object?>? queryParameters,
    CancelToken? cancelToken,
    Options? options,
  }) =>
      _request(
        () => _dio.get<Object?>(
          path,
          queryParameters: queryParameters,
          cancelToken: cancelToken,
          options: options,
        ),
      );

  Future<Response<Object?>> post(
    String path, {
    Object? data,
    Map<String, Object?>? queryParameters,
    CancelToken? cancelToken,
    Options? options,
  }) =>
      _request(
        () => _dio.post<Object?>(
          path,
          data: data,
          queryParameters: queryParameters,
          cancelToken: cancelToken,
          options: options,
        ),
      );

  Future<Response<Object?>> put(
    String path, {
    Object? data,
    CancelToken? cancelToken,
    Options? options,
  }) =>
      _request(
        () => _dio.put<Object?>(
          path,
          data: data,
          cancelToken: cancelToken,
          options: options,
        ),
      );

  Future<Response<Object?>> delete(
    String path, {
    Object? data,
    CancelToken? cancelToken,
  }) =>
      _request(
        () => _dio.delete<Object?>(
          path,
          data: data,
          cancelToken: cancelToken,
        ),
      );

  Future<Response<Object?>> _request(
    Future<Response<Object?>> Function() operation,
  ) async {
    try {
      return await operation();
    } on DioException catch (error) {
      throw ApiException.fromDio(error);
    }
  }

  void close() => _dio.close(force: true);
}

final class _AuthInterceptor extends QueuedInterceptor {
  _AuthInterceptor(this._tokenStore);

  final AuthTokenStore _tokenStore;

  @override
  Future<void> onRequest(
    RequestOptions options,
    RequestInterceptorHandler handler,
  ) async {
    final String? token = await _tokenStore.readAccessToken();
    if (token != null && token.isNotEmpty) {
      options.headers['Authorization'] = 'Bearer $token';
    }
    handler.next(options);
  }
}

final class _RetryInterceptor extends Interceptor {
  _RetryInterceptor(this._dio);

  static const int _maximumRetries = 3;
  static const Duration _baseDelay = Duration(milliseconds: 500);

  final Dio _dio;

  @override
  Future<void> onError(
    DioException error,
    ErrorInterceptorHandler handler,
  ) async {
    final RequestOptions request = error.requestOptions;
    final int attempt = (request.extra['retryAttempt'] as int?) ?? 0;
    if (attempt >= _maximumRetries || !_mayRetry(error)) {
      handler.next(error);
      return;
    }

    request.extra['retryAttempt'] = attempt + 1;
    final int exponentialMilliseconds =
        _baseDelay.inMilliseconds * math.pow(2, attempt).toInt();
    final int? retryAfterSeconds = int.tryParse(
      error.response?.headers.value('retry-after') ?? '',
    );
    final Duration delay = retryAfterSeconds == null
        ? Duration(milliseconds: exponentialMilliseconds)
        : Duration(seconds: retryAfterSeconds.clamp(1, 30).toInt());
    await Future<void>.delayed(delay);

    if (request.cancelToken?.isCancelled ?? false) {
      handler.next(error);
      return;
    }
    try {
      final Response<Object?> response = await _dio.fetch<Object?>(request);
      handler.resolve(response);
    } on DioException catch (retryError) {
      handler.next(retryError);
    }
  }

  bool _mayRetry(DioException error) {
    final String method = error.requestOptions.method.toUpperCase();
    final bool methodAllowsRetry =
        const <String>{'GET', 'HEAD', 'OPTIONS'}.contains(method) ||
            error.requestOptions.extra['allowRetry'] == true;
    if (!methodAllowsRetry) return false;
    if (error.type == DioExceptionType.connectionError ||
        error.type == DioExceptionType.connectionTimeout ||
        error.type == DioExceptionType.receiveTimeout ||
        error.type == DioExceptionType.sendTimeout) {
      return true;
    }
    return const <int>{408, 425, 429, 500, 502, 503, 504}
        .contains(error.response?.statusCode);
  }
}

final class _ApiErrorInterceptor extends Interceptor {
  @override
  void onError(DioException error, ErrorInterceptorHandler handler) {
    handler.reject(error.copyWith(error: ApiException.fromDio(error)));
  }
}
