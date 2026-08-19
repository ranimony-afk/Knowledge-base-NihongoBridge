import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongobridge_mobile/core/db/models.dart';
import 'package:nihongobridge_mobile/features/srs/widgets/flip_card.dart';

void main() {
  final SrsCard card = SrsCard(
    id: 'card-1',
    userId: 'user-1',
    itemType: 'word',
    itemId: 'word-1',
    easeFactor: 2.5,
    intervalDays: 1,
    repetitions: 0,
    nextReviewAt: DateTime.utc(2026, 8, 18),
    lastReviewedAt: null,
    totalReviews: 0,
    correctCount: 0,
    mistakeCount: 0,
    averageTimeMs: 0,
    confidence: null,
    deckId: null,
    content: const <String, Object?>{
      'word': '水',
      'kana': 'みず',
      'meanings': <Object?>[
        <String, Object?>{'lang': 'en', 'value': 'water'},
      ],
    },
    updatedAt: DateTime.utc(2026, 8, 18),
    pendingAction: null,
  );

  testWidgets('flips and maps a right swipe to Good',
      (WidgetTester tester) async {
    SrsConfidence? result;
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          body: FlipCard(
            card: card,
            enabled: true,
            onConfidence: (SrsConfidence value) => result = value,
          ),
        ),
      ),
    );
    await tester.tap(find.byType(FlipCard));
    await tester.pumpAndSettle();
    expect(find.text('ANSWER'), findsOneWidget);
    await tester.drag(find.byType(FlipCard), const Offset(200, 0));
    await tester.pump();
    expect(result, SrsConfidence.good);
  });
}
