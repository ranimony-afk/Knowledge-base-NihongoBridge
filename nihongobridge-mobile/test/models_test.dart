import 'package:flutter_test/flutter_test.dart';
import 'package:nihongobridge_mobile/core/db/models.dart';

void main() {
  test('dictionary entries round-trip through SQLite maps', () {
    final DictionaryEntry entry = DictionaryEntry.fromApi(<String, Object?>{
      'id': 'word-1',
      'word': '水',
      'kana': 'みず',
      'romaji': 'mizu',
      'furigana': <Object?>[
        <String, Object?>{'base': '水', 'ruby': 'みず'},
      ],
      'meanings': <Object?>[
        <String, Object?>{'lang': 'en', 'value': 'water', 'pos': 'noun'},
      ],
      'jlpt_level': 'N5',
      'part_of_speech': <Object?>['noun'],
      'audio_url': null,
      'tags': <Object?>['basic'],
      'source': 'jmdict',
      'updated_at': '2026-08-18T10:00:00Z',
    });
    final DictionaryEntry restored = DictionaryEntry.fromDb(entry.toDb());
    expect(restored.word, '水');
    expect(restored.kana, 'みず');
    expect(restored.displayMeaning, 'water');
    expect(restored.furigana.single['ruby'], 'みず');
  });

  test('SRS cards expose review content safely', () {
    final SrsCard card = SrsCard.fromApi(<String, Object?>{
      'id': 'card-1',
      'user_id': 'user-1',
      'item_type': 'word',
      'item_id': 'word-1',
      'ease_factor': 2.5,
      'interval_days': 1,
      'repetitions': 0,
      'next_review_at': '2026-08-18T10:00:00Z',
      'last_reviewed_at': null,
      'total_reviews': 0,
      'correct_count': 0,
      'mistake_count': 0,
      'average_time_ms': 0,
      'confidence': null,
      'deck_id': null,
      'item': <String, Object?>{
        'word': '水',
        'kana': 'みず',
        'meanings': <Object?>[
          <String, Object?>{'lang': 'en', 'value': 'water'},
        ],
      },
    });
    expect(card.frontText, '水');
    expect(card.reading, 'みず');
    expect(card.displayMeanings, <String>['water']);
  });
}
