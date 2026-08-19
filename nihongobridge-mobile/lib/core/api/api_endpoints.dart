abstract final class ApiEndpoints {
  static const String dictionarySearch = '/api/dictionary/search';
  static const String dictionaryBootstrap = '/api/mobile/bootstrap/dictionary';
  static const String kanjiSearch = '/api/kanji/search';
  static const String srsDue = '/api/srs/due';
  static const String srsReview = '/api/srs/review';
  static const String testStart = '/api/tests/start';
  static const String mobileSync = '/api/mobile/sync';
  static const String tutorChat = '/api/ai/tutor/chat';

  static String testSession(String sessionId) =>
      '/api/tests/session/${Uri.encodeComponent(sessionId)}';

  static String testAnswer(String sessionId) =>
      '${testSession(sessionId)}/answer';
}
