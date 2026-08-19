import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/db/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_error_view.dart';
import '../../../core/widgets/offline_banner.dart';
import '../data/review_controller.dart';
import '../widgets/flip_card.dart';

final class ReviewScreen extends ConsumerStatefulWidget {
  const ReviewScreen({super.key});

  @override
  ConsumerState<ReviewScreen> createState() => _ReviewScreenState();
}

final class _ReviewScreenState extends ConsumerState<ReviewScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(ref.read(reviewControllerProvider.notifier).load());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final ReviewState state = ref.watch(reviewControllerProvider);
    final ReviewController controller =
        ref.read(reviewControllerProvider.notifier);
    final SrsCard? card = state.current;
    final double progress =
        state.total == 0 ? 0 : state.completed / state.total;

    return Scaffold(
      appBar: AppBar(
        title: const Text('SRS review'),
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(state.offline ? 46 : 0),
          child: OfflineBanner(visible: state.offline),
        ),
      ),
      body: SafeArea(
        top: false,
        child: state.loading
            ? const Center(child: CircularProgressIndicator.adaptive())
            : state.message != null && card == null
                ? AsyncErrorView(
                    message: state.message!,
                    onRetry: () => controller.load(),
                  )
                : card == null
                    ? _ReviewComplete(completed: state.completed)
                    : Column(
                        children: <Widget>[
                          Padding(
                            padding: const EdgeInsets.fromLTRB(
                              AppSpacing.md,
                              AppSpacing.sm,
                              AppSpacing.md,
                              0,
                            ),
                            child: Column(
                              children: <Widget>[
                                Row(
                                  children: <Widget>[
                                    Text(
                                      '${state.completed + 1} / ${state.total}',
                                      style: Theme.of(context)
                                          .textTheme
                                          .labelLarge
                                          ?.copyWith(
                                              fontWeight: FontWeight.w800),
                                    ),
                                    const Spacer(),
                                    Text(
                                      '${state.cards.length} remaining',
                                      style:
                                          Theme.of(context).textTheme.bodySmall,
                                    ),
                                  ],
                                ),
                                const SizedBox(height: AppSpacing.xs),
                                ClipRRect(
                                  borderRadius: BorderRadius.circular(999),
                                  child: LinearProgressIndicator(
                                      value: progress.clamp(0, 1).toDouble(),
                                      minHeight: 6),
                                ),
                              ],
                            ),
                          ),
                          Expanded(
                            child: SingleChildScrollView(
                              padding: const EdgeInsets.all(AppSpacing.md),
                              child: Center(
                                child: ConstrainedBox(
                                  constraints:
                                      const BoxConstraints(maxWidth: 680),
                                  child: Column(
                                    children: <Widget>[
                                      Row(
                                        children: <Widget>[
                                          Chip(
                                              label: Text(
                                                  '${card.itemType} · ${card.intervalDays}d')),
                                          const Spacer(),
                                          Text('Tap card to flip',
                                              style: Theme.of(context)
                                                  .textTheme
                                                  .bodySmall),
                                        ],
                                      ),
                                      const SizedBox(height: AppSpacing.sm),
                                      FlipCard(
                                        key: ValueKey<String>(card.id),
                                        card: card,
                                        enabled: !state.submitting,
                                        onConfidence: (SrsConfidence value) =>
                                            unawaited(controller.rate(value)),
                                      ),
                                      const SizedBox(height: AppSpacing.md),
                                      _ConfidenceButtons(
                                        enabled: !state.submitting,
                                        onConfidence: (SrsConfidence value) {
                                          HapticFeedback.mediumImpact();
                                          unawaited(controller.rate(value));
                                        },
                                      ),
                                      if (state.message != null)
                                        Padding(
                                          padding: const EdgeInsets.only(
                                              top: AppSpacing.sm),
                                          child: Text(
                                            state.message!,
                                            style: TextStyle(
                                                color: Theme.of(context)
                                                    .colorScheme
                                                    .error),
                                          ),
                                        ),
                                    ],
                                  ),
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
      ),
    );
  }
}

final class _ConfidenceButtons extends StatelessWidget {
  const _ConfidenceButtons({required this.enabled, required this.onConfidence});

  final bool enabled;
  final ValueChanged<SrsConfidence> onConfidence;

  @override
  Widget build(BuildContext context) {
    const List<(SrsConfidence, String, IconData)> options =
        <(SrsConfidence, String, IconData)>[
      (SrsConfidence.again, 'Again', Icons.replay_rounded),
      (SrsConfidence.hard, 'Hard', Icons.trending_flat_rounded),
      (SrsConfidence.good, 'Good', Icons.check_rounded),
      (SrsConfidence.easy, 'Easy', Icons.bolt_rounded),
    ];
    return GridView.count(
      crossAxisCount: 4,
      shrinkWrap: true,
      physics: const NeverScrollableScrollPhysics(),
      mainAxisSpacing: AppSpacing.xs,
      crossAxisSpacing: AppSpacing.xs,
      childAspectRatio: 0.94,
      children: <Widget>[
        for (final (SrsConfidence value, String label, IconData icon)
            in options)
          OutlinedButton(
            onPressed: enabled ? () => onConfidence(value) : null,
            style: OutlinedButton.styleFrom(
                padding:
                    const EdgeInsets.symmetric(horizontal: 4, vertical: 8)),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: <Widget>[
                Icon(icon, size: 19),
                const SizedBox(height: 4),
                Text(label, style: const TextStyle(fontSize: 11)),
              ],
            ),
          ),
      ],
    );
  }
}

final class _ReviewComplete extends StatelessWidget {
  const _ReviewComplete({required this.completed});

  final int completed;

  @override
  Widget build(BuildContext context) => Center(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.xl),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.spa_rounded,
                  size: 64, color: Theme.of(context).colorScheme.secondary),
              const SizedBox(height: AppSpacing.lg),
              Text(
                completed == 0 ? 'You’re all caught up' : 'Session complete',
                style: Theme.of(context)
                    .textTheme
                    .headlineSmall
                    ?.copyWith(fontWeight: FontWeight.w800),
              ),
              const SizedBox(height: AppSpacing.xs),
              Text(completed == 0
                  ? 'No cards are due right now.'
                  : '$completed cards reviewed.'),
            ],
          ),
        ),
      );
}
