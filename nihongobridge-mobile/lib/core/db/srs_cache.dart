import 'package:hive_flutter/hive_flutter.dart';

import 'models.dart';

final class SrsCache {
  SrsCache._();

  static final SrsCache instance = SrsCache._();
  static const String _boxName = 'srs_cards_v1';

  Box<Object?>? _box;

  /// Cards use JSON-compatible maps, so generated Hive adapters are unnecessary.
  Future<void> initialize() async {
    _box ??= await Hive.openBox<Object?>(_boxName);
  }

  Box<Object?> get _openBox {
    final Box<Object?>? value = _box;
    if (value == null || !value.isOpen) {
      throw StateError('SrsCache.initialize() must be called before use.');
    }
    return value;
  }

  List<SrsCard> dueCards({required String userId, DateTime? now}) {
    final DateTime cutoff = (now ?? DateTime.now()).toUtc();
    final List<SrsCard> cards = _openBox.values
        .expand<SrsCard>((Object? value) {
      try {
        final SrsCard card = SrsCard.fromCache(value);
        return card.userId == userId && !card.nextReviewAt.isAfter(cutoff)
            ? <SrsCard>[card]
            : const <SrsCard>[];
      } on FormatException {
        return const <SrsCard>[];
      }
    }).toList()
      ..sort((SrsCard left, SrsCard right) =>
          left.nextReviewAt.compareTo(right.nextReviewAt));
    return cards;
  }

  Future<void> put(SrsCard card) => _openBox.put(card.id, card.toCache());

  Future<void> putAll(Iterable<SrsCard> cards) => _openBox.putAll(
        <String, Object?>{
          for (final SrsCard card in cards) card.id: card.toCache(),
        },
      );

  Future<void> delete(String id) => _openBox.delete(id);

  Future<void> clearForUser(String userId) async {
    final List<Object> keys = <Object>[];
    for (final Object key in _openBox.keys.cast<Object>()) {
      try {
        final SrsCard card = SrsCard.fromCache(_openBox.get(key));
        if (card.userId == userId) keys.add(key);
      } on FormatException {
        keys.add(key);
      }
    }
    await _openBox.deleteAll(keys);
  }
}
