import 'package:flutter/material.dart';

final class RubyText extends StatelessWidget {
  const RubyText(
    this.html, {
    this.style,
    this.readingStyle,
    this.textAlign = TextAlign.start,
    this.maxLines,
    this.overflow = TextOverflow.clip,
    super.key,
  });

  final String html;
  final TextStyle? style;
  final TextStyle? readingStyle;
  final TextAlign textAlign;
  final int? maxLines;
  final TextOverflow overflow;

  static final RegExp _rubyPattern = RegExp(
    r'<ruby>(.*?)<rt>(.*?)</rt></ruby>',
    caseSensitive: false,
    dotAll: true,
  );
  static final RegExp _tagPattern = RegExp(r'<[^>]*>');

  @override
  Widget build(BuildContext context) {
    final TextStyle baseStyle = style ?? DefaultTextStyle.of(context).style;
    final TextStyle rubyReadingStyle = readingStyle ??
        baseStyle.copyWith(
          fontSize: (baseStyle.fontSize ?? 16) * 0.52,
          height: 1,
          color: Theme.of(context).colorScheme.onSurfaceVariant,
          fontWeight: FontWeight.w500,
        );
    final List<InlineSpan> spans = <InlineSpan>[];
    int cursor = 0;
    for (final RegExpMatch match in _rubyPattern.allMatches(html)) {
      if (match.start > cursor) {
        spans.add(TextSpan(
          text: _plain(html.substring(cursor, match.start)),
          style: baseStyle,
        ));
      }
      final String base = _plain(match.group(1) ?? '');
      final String reading = _plain(match.group(2) ?? '');
      spans.add(WidgetSpan(
        alignment: PlaceholderAlignment.middle,
        child: Semantics(
          label: '$base, reading $reading',
          excludeSemantics: true,
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 1),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                Text(reading,
                    style: rubyReadingStyle, textScaler: TextScaler.noScaling),
                Text(base, style: baseStyle),
              ],
            ),
          ),
        ),
      ));
      cursor = match.end;
    }
    if (cursor < html.length) {
      spans.add(
          TextSpan(text: _plain(html.substring(cursor)), style: baseStyle));
    }

    return Text.rich(
      TextSpan(children: spans),
      textAlign: textAlign,
      maxLines: maxLines,
      overflow: overflow,
    );
  }

  static String _plain(String value) => value
      .replaceAll(_tagPattern, '')
      .replaceAll('&lt;', '<')
      .replaceAll('&gt;', '>')
      .replaceAll('&amp;', '&')
      .replaceAll('&quot;', '"')
      .replaceAll('&#39;', "'");
}
