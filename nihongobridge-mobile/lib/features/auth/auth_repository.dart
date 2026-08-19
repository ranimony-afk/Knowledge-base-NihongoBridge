import '../../core/api/auth_token_store.dart';

final class AuthRepository {
  const AuthRepository(this._tokenStore);

  final AuthTokenStore _tokenStore;

  Future<bool> get isSignedIn async {
    final String? token = await _tokenStore.readAccessToken();
    return token != null && token.isNotEmpty;
  }

  Future<void> persistSession({
    required String accessToken,
    required String userId,
  }) =>
      _tokenStore.saveSession(accessToken: accessToken, userId: userId);

  Future<void> signOut() => _tokenStore.clear();
}
