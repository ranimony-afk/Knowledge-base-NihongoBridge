import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';

final class KanjiScreen extends StatelessWidget {
  const KanjiScreen({super.key});

  @override
  Widget build(BuildContext context) => Scaffold(
        appBar: AppBar(title: const Text('Kanji')),
        body: ListView(
          padding: const EdgeInsets.all(AppSpacing.md),
          children: <Widget>[
            TextField(
              decoration: const InputDecoration(
                prefixIcon: Icon(Icons.search_rounded),
                hintText: 'Search kanji, reading, or meaning',
              ),
              textInputAction: TextInputAction.search,
            ),
            const SizedBox(height: AppSpacing.lg),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.lg),
                child: Column(
                  children: <Widget>[
                    Text('水',
                        style: Theme.of(context)
                            .textTheme
                            .displayLarge
                            ?.copyWith(fontWeight: FontWeight.w500)),
                    const SizedBox(height: AppSpacing.sm),
                    const Text('スイ · みず   —   water'),
                    const SizedBox(height: AppSpacing.lg),
                    const _OptionalStrokeImage(url: null),
                  ],
                ),
              ),
            ),
          ],
        ),
      );
}

final class _OptionalStrokeImage extends StatelessWidget {
  const _OptionalStrokeImage({required this.url});

  final String? url;

  @override
  Widget build(BuildContext context) {
    if (url == null) {
      return Text('Stroke animation downloads when available.',
          style: Theme.of(context).textTheme.bodySmall);
    }
    return CachedNetworkImage(
      imageUrl: url!,
      height: 180,
      placeholder: (_, __) =>
          const Center(child: CircularProgressIndicator.adaptive()),
      errorWidget: (_, __, ___) => const Icon(Icons.broken_image_outlined),
    );
  }
}
