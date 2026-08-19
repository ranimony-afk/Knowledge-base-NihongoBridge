import 'package:dio/dio.dart';

import '../../../core/api/api_client.dart';
import '../../../core/api/api_endpoints.dart';
import '../../../core/api/api_exception.dart';
import '../../../core/api/json_helpers.dart';
import '../../../core/db/daos/dictionary_dao.dart';
import '../../../core/db/models.dart';

final class DictionaryRepository {
  const DictionaryRepository({
    required ApiClient api,
    required DictionaryDao local,
  })  : _api = api,
        _local = local;

  final ApiClient _api;
  final DictionaryDao _local;

  Future<List<DictionaryEntry>> searchRemote(
    String query, {
    CancelToken? cancelToken,
  }) async {
    if (query.trim().isEmpty) return _local.search('', limit: 50);
    final Response<Object?> response = await _api.get(
      ApiEndpoints.dictionarySearch,
      queryParameters: <String, Object?>{
        'q': query.trim(),
        'page': 1,
        'limit': 50,
      },
      cancelToken: cancelToken,
    );
    final ApiEnvelope<List<DictionaryEntry>> envelope =
        ApiEnvelope<List<DictionaryEntry>>.fromJson(
      response.data,
      (Object? data) => jsonList(data, label: 'dictionary results')
          .map<DictionaryEntry>(DictionaryEntry.fromApi)
          .toList(growable: false),
    );
    await _local.upsertAll(envelope.data);
    return envelope.data;
  }

  Future<List<DictionaryEntry>> searchOffline(String query) =>
      _local.search(query, limit: 50);
}
