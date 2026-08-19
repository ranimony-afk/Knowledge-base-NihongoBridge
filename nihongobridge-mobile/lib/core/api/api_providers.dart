import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../db/local_db.dart';
import '../db/srs_cache.dart';
import 'api_client.dart';
import 'auth_token_store.dart';

final authTokenStoreProvider = Provider<AuthTokenStore>(
  (Ref ref) => SecureAuthTokenStore(),
);

final apiClientProvider = Provider<ApiClient>((Ref ref) {
  final ApiClient client =
      ApiClient(tokenStore: ref.watch(authTokenStoreProvider));
  ref.onDispose(client.close);
  return client;
});

final localDbProvider = Provider<LocalDb>((Ref ref) => LocalDb.instance);
final srsCacheProvider = Provider<SrsCache>((Ref ref) => SrsCache.instance);
