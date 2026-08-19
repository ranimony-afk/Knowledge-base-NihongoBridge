import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:nihongobridge_mobile/core/widgets/ruby_text.dart';

void main() {
  testWidgets('renders base text and furigana from ruby HTML',
      (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(
          body: RubyText('<ruby>学校<rt>がっこう</rt></ruby>へ行きます。'),
        ),
      ),
    );
    expect(find.text('学校'), findsOneWidget);
    expect(find.text('がっこう'), findsOneWidget);
    expect(find.textContaining('へ行きます'), findsOneWidget);
  });

  testWidgets('strips unsupported HTML tags', (WidgetTester tester) async {
    await tester.pumpWidget(
      const MaterialApp(home: RubyText('<script>bad</script>日本語')),
    );
    expect(find.textContaining('script'), findsNothing);
    expect(find.textContaining('bad日本語'), findsOneWidget);
  });
}
