import 'package:flutter_secure_storage/flutter_secure_storage.dart';

abstract interface class AuthTokenStore {
  Future<String?> readAccessToken();
  Future<String?> readUserId();
  Future<void> saveSession(
      {required String accessToken, required String userId});
  Future<void> clear();
}

final class SecureAuthTokenStore implements AuthTokenStore {
  SecureAuthTokenStore({FlutterSecureStorage? storage})
      : _storage = storage ??
            const FlutterSecureStorage(
              aOptions: AndroidOptions(encryptedSharedPreferences: true),
              iOptions: IOSOptions(
                accessibility: KeychainAccessibility.first_unlock_this_device,
              ),
            );

  static const String _accessTokenKey = 'auth.access_token';
  static const String _userIdKey = 'auth.user_id';

  final FlutterSecureStorage _storage;

  @override
  Future<String?> readAccessToken() => _storage.read(key: _accessTokenKey);

  @override
  Future<String?> readUserId() => _storage.read(key: _userIdKey);

  @override
  Future<void> saveSession({
    required String accessToken,
    required String userId,
  }) async {
    await _storage.write(key: _accessTokenKey, value: accessToken);
    await _storage.write(key: _userIdKey, value: userId);
  }

  @override
  Future<void> clear() => _storage.deleteAll();
}

final class MemoryAuthTokenStore implements AuthTokenStore {
  String? _accessToken;
  String? _userId;

  @override
  Future<void> clear() async {
    _accessToken = null;
    _userId = null;
  }

  @override
  Future<String?> readAccessToken() async => _accessToken;

  @override
  Future<String?> readUserId() async => _userId;

  @override
  Future<void> saveSession({
    required String accessToken,
    required String userId,
  }) async {
    _accessToken = accessToken;
    _userId = userId;
  }
}
