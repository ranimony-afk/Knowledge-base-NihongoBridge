import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/api_providers.dart';
import 'sync_service.dart';

final syncServiceProvider = Provider<SyncService>((Ref ref) {
  final SyncService service = SyncService(
    api: ref.watch(apiClientProvider),
    tokenStore: ref.watch(authTokenStoreProvider),
    localDb: ref.watch(localDbProvider),
    srsCache: ref.watch(srsCacheProvider),
  );
  ref.onDispose(() => service.dispose());
  return service;
});

final syncStateProvider = StreamProvider<SyncState>((Ref ref) {
  return ref.watch(syncServiceProvider).states;
});
