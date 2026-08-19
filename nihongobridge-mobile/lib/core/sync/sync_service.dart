import 'dart:async';

import 'package:connectivity_plus/connectivity_plus.dart';
import 'package:dio/dio.dart';

import '../api/api_client.dart';
import '../api/api_endpoints.dart';
import '../api/api_exception.dart';
import '../api/auth_token_store.dart';
import '../api/json_helpers.dart';
import '../db/daos/dictionary_dao.dart';
import '../db/daos/kanji_dao.dart';
import '../db/daos/srs_card_dao.dart';
import '../db/local_db.dart';
import '../db/models.dart';
import '../db/srs_cache.dart';

enum SyncReason { appOpen, reconnect, appResume, manual }

enum SyncPhase { idle, syncing, succeeded, offline, failed }

final class SyncState {
  const SyncState({
    required this.phase,
    this.reason,
    this.completedAt,
    this.message,
  });

  const SyncState.idle() : this(phase: SyncPhase.idle);

  final SyncPhase phase;
  final SyncReason? reason;
  final DateTime? completedAt;
  final String? message;
}

final class SyncService {
  SyncService({
    required ApiClient api,
    required AuthTokenStore tokenStore,
    required LocalDb localDb,
    required SrsCache srsCache,
    Connectivity? connectivity,
  })  : _api = api,
        _tokenStore = tokenStore,
        _localDb = localDb,
        _srsCache = srsCache,
        _connectivity = connectivity ?? Connectivity(),
        _dictionaryDao = DictionaryDao(localDb),
        _kanjiDao = KanjiDao(localDb),
        _srsDao = SrsCardDao(localDb);

  static const String _lastSyncKey = 'sync.last_server_timestamp';
  static const String _dictionaryBootstrapKey =
      'sync.dictionary_n5_n4_complete';

  final ApiClient _api;
  final AuthTokenStore _tokenStore;
  final LocalDb _localDb;
  final SrsCache _srsCache;
  final Connectivity _connectivity;
  final DictionaryDao _dictionaryDao;
  final KanjiDao _kanjiDao;
  final SrsCardDao _srsDao;
  final StreamController<SyncState> _states =
      StreamController<SyncState>.broadcast();

  StreamSubscription<List<ConnectivityResult>>? _connectivitySubscription;
  Future<void>? _activeSync;
  bool _started = false;

  Stream<SyncState> get states => _states.stream;

  Future<void> start() async {
    if (_started) return;
    _started = true;
    _connectivitySubscription = _connectivity.onConnectivityChanged.listen(
      (List<ConnectivityResult> results) {
        if (_hasConnection(results)) {
          unawaited(syncAll(reason: SyncReason.reconnect));
        }
      },
    );
    await syncAll(reason: SyncReason.appOpen);
  }

  Future<void> onAppResumed() => syncAll(reason: SyncReason.appResume);

  Future<void> syncAll({SyncReason reason = SyncReason.manual}) {
    final Future<void>? current = _activeSync;
    if (current != null) return current;
    late final Future<void> operation;
    operation = _performSync(reason).whenComplete(() {
      if (identical(_activeSync, operation)) _activeSync = null;
    });
    _activeSync = operation;
    return operation;
  }

  Future<void> _performSync(SyncReason reason) async {
    final List<ConnectivityResult> connectivity =
        await _connectivity.checkConnectivity();
    if (!_hasConnection(connectivity)) {
      _states.add(SyncState(
        phase: SyncPhase.offline,
        reason: reason,
        message: 'Offline data is available.',
      ));
      return;
    }

    _states.add(SyncState(phase: SyncPhase.syncing, reason: reason));
    try {
      final String? userId = await _tokenStore.readUserId();
      if (userId != null) await _syncSrs(userId);
      await _bootstrapDictionaryIfNeeded();
      await _pullChanges(userId: userId);
      _states.add(SyncState(
        phase: SyncPhase.succeeded,
        reason: reason,
        completedAt: DateTime.now().toUtc(),
      ));
    } on ApiException catch (error) {
      _states.add(SyncState(
        phase: error.isOffline ? SyncPhase.offline : SyncPhase.failed,
        reason: reason,
        message: error.message,
      ));
    } on FormatException catch (error) {
      _states.add(SyncState(
        phase: SyncPhase.failed,
        reason: reason,
        message: 'The sync response was invalid: ${error.message}',
      ));
    } on Object {
      _states.add(SyncState(
        phase: SyncPhase.failed,
        reason: reason,
        message: 'Background sync could not be completed.',
      ));
    }
  }

  Future<void> _syncSrs(String userId) async {
    final List<SrsCard> pending = await _srsDao.pendingReviews(userId);
    for (final SrsCard card in pending) {
      final JsonMap? action = card.pendingAction;
      if (action == null) continue;
      await _api.post(
        ApiEndpoints.srsReview,
        data: action,
        options: Options(headers: <String, Object?>{
          'X-Idempotency-Key': '${card.id}:${action['reviewed_at']}',
        }),
      );
      await _srsDao.clearPendingAction(card.id);
      await _srsCache.put(card.copyWith(clearPendingAction: true));
    }

    final Response<Object?> response = await _api.get(
      ApiEndpoints.srsDue,
      queryParameters: <String, Object?>{'user_id': userId, 'limit': 100},
    );
    final ApiEnvelope<List<SrsCard>> envelope =
        ApiEnvelope<List<SrsCard>>.fromJson(
      response.data,
      (Object? data) => jsonList(data, label: 'SRS cards')
          .map<SrsCard>(SrsCard.fromApi)
          .toList(growable: false),
    );
    await _srsDao.upsertAll(envelope.data);
    await _srsCache.putAll(envelope.data);
  }

  Future<void> _bootstrapDictionaryIfNeeded() async {
    if (await _localDb.readMetadata(_dictionaryBootstrapKey) == 'true') return;
    String? cursor;
    do {
      final Response<Object?> response = await _api.get(
        ApiEndpoints.dictionaryBootstrap,
        queryParameters: <String, Object?>{
          'levels': 'N5,N4',
          'limit': 500,
          if (cursor != null) 'cursor': cursor,
        },
      );
      final ApiEnvelope<JsonMap> envelope = ApiEnvelope<JsonMap>.fromJson(
        response.data,
        (Object? data) => jsonObject(data, label: 'dictionary bootstrap'),
      );
      final List<DictionaryEntry> entries = jsonList(
        envelope.data['items'],
        label: 'dictionary bootstrap items',
      ).map<DictionaryEntry>(DictionaryEntry.fromApi).toList(growable: false);
      await _dictionaryDao.upsertAll(entries);
      cursor = nullableString(envelope.data['next_cursor']);
    } while (cursor != null && cursor.isNotEmpty);
    await _localDb.writeMetadata(_dictionaryBootstrapKey, 'true');
  }

  Future<void> _pullChanges({required String? userId}) async {
    final String? since = await _localDb.readMetadata(_lastSyncKey);
    final Response<Object?> response = await _api.get(
      ApiEndpoints.mobileSync,
      queryParameters: <String, Object?>{
        if (since != null) 'updated_since': since,
        if (userId != null) 'user_id': userId,
        'limit': 1000,
      },
    );
    final ApiEnvelope<JsonMap> envelope = ApiEnvelope<JsonMap>.fromJson(
      response.data,
      (Object? data) => jsonObject(data, label: 'mobile sync'),
    );
    final List<DictionaryEntry> dictionary = jsonList(
      envelope.data['dictionary_entries'] ?? const <Object?>[],
    ).map<DictionaryEntry>(DictionaryEntry.fromApi).toList(growable: false);
    final List<KanjiEntry> kanji = jsonList(
      envelope.data['kanji_entries'] ?? const <Object?>[],
    ).map<KanjiEntry>(KanjiEntry.fromApi).toList(growable: false);
    final List<SrsCard> cards = jsonList(
      envelope.data['srs_cards'] ?? const <Object?>[],
    ).map<SrsCard>(SrsCard.fromApi).toList(growable: false);

    await _dictionaryDao.upsertAll(dictionary);
    await _kanjiDao.upsertAll(kanji);
    if (cards.isNotEmpty) {
      await _srsDao.upsertAll(cards);
      await _srsCache.putAll(cards);
    }
    await _applyDeletes(envelope.data['deleted']);

    final String serverTimestamp =
        nullableString(envelope.data['server_timestamp']) ??
            DateTime.now().toUtc().toIso8601String();
    await _localDb.writeMetadata(_lastSyncKey, serverTimestamp);
  }

  Future<void> _applyDeletes(Object? value) async {
    for (final Object? raw in jsonList(value ?? const <Object?>[])) {
      final JsonMap item = jsonObject(raw, label: 'deleted sync item');
      final String? id = nullableString(item['id']);
      if (id == null) continue;
      switch (item['type']) {
        case 'dictionary_entry':
          await _dictionaryDao.delete(id);
          break;
        case 'kanji_entry':
          await _kanjiDao.delete(id);
          break;
        case 'srs_card':
          await _srsDao.delete(id);
          await _srsCache.delete(id);
          break;
      }
    }
  }

  bool _hasConnection(List<ConnectivityResult> results) => results
      .any((ConnectivityResult result) => result != ConnectivityResult.none);

  Future<void> dispose() async {
    await _connectivitySubscription?.cancel();
    await _states.close();
  }
}
