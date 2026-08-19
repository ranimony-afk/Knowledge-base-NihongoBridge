import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/api_exception.dart';
import '../../../core/api/api_providers.dart';
import '../../../core/db/daos/dictionary_dao.dart';
import '../../../core/db/models.dart';
import 'dictionary_repository.dart';

final class DictionaryState {
  const DictionaryState({
    required this.query,
    required this.entries,
    required this.loading,
    required this.refreshing,
    required this.offline,
    this.message,
  });

  const DictionaryState.initial()
      : this(
          query: '',
          entries: const <DictionaryEntry>[],
          loading: true,
          refreshing: false,
          offline: false,
        );

  final String query;
  final List<DictionaryEntry> entries;
  final bool loading;
  final bool refreshing;
  final bool offline;
  final String? message;

  DictionaryState copyWith({
    String? query,
    List<DictionaryEntry>? entries,
    bool? loading,
    bool? refreshing,
    bool? offline,
    String? message,
    bool clearMessage = false,
  }) =>
      DictionaryState(
        query: query ?? this.query,
        entries: entries ?? this.entries,
        loading: loading ?? this.loading,
        refreshing: refreshing ?? this.refreshing,
        offline: offline ?? this.offline,
        message: clearMessage ? null : message ?? this.message,
      );
}

final class DictionaryController extends StateNotifier<DictionaryState> {
  DictionaryController(this._repository)
      : super(const DictionaryState.initial());

  final DictionaryRepository _repository;
  CancelToken? _cancelToken;

  Future<void> initialize() => search('');

  Future<void> search(String query, {bool refresh = false}) async {
    _cancelToken?.cancel('Superseded by a newer dictionary search.');
    final CancelToken token = CancelToken();
    _cancelToken = token;
    state = state.copyWith(
      query: query,
      loading: !refresh,
      refreshing: refresh,
      clearMessage: true,
    );
    try {
      final List<DictionaryEntry> entries =
          await _repository.searchRemote(query, cancelToken: token);
      if (token.isCancelled) return;
      state = state.copyWith(
        entries: entries,
        loading: false,
        refreshing: false,
        offline: false,
        clearMessage: true,
      );
    } on ApiException catch (error) {
      if (error.kind == ApiExceptionKind.cancelled || token.isCancelled) return;
      final List<DictionaryEntry> local =
          await _repository.searchOffline(query);
      state = state.copyWith(
        entries: local,
        loading: false,
        refreshing: false,
        offline: true,
        message: local.isEmpty ? error.message : null,
        clearMessage: local.isNotEmpty,
      );
    }
  }

  @override
  void dispose() {
    _cancelToken?.cancel('Dictionary controller disposed.');
    super.dispose();
  }
}

final dictionaryRepositoryProvider = Provider<DictionaryRepository>((Ref ref) {
  final localDb = ref.watch(localDbProvider);
  return DictionaryRepository(
    api: ref.watch(apiClientProvider),
    local: DictionaryDao(localDb),
  );
});

final dictionaryControllerProvider =
    StateNotifierProvider<DictionaryController, DictionaryState>((Ref ref) {
  return DictionaryController(ref.watch(dictionaryRepositoryProvider));
});
