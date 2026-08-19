import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_animate/flutter_animate.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_error_view.dart';
import '../../../core/widgets/ruby_text.dart';
import '../data/test_controller.dart';
import '../data/test_models.dart';
import '../widgets/countdown_timer.dart';
import '../widgets/listening_audio_player.dart';

final class TestScreen extends ConsumerStatefulWidget {
  const TestScreen({required this.sessionId, super.key});

  final String sessionId;

  @override
  ConsumerState<TestScreen> createState() => _TestScreenState();
}

final class _TestScreenState extends ConsumerState<TestScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(
          ref.read(testControllerProvider(widget.sessionId).notifier).load(),
        );
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final TestState state = ref.watch(testControllerProvider(widget.sessionId));
    if (state.loading) {
      return const Scaffold(
          body: Center(child: CircularProgressIndicator.adaptive()));
    }
    if (state.error != null && state.question == null) {
      return Scaffold(
        appBar: AppBar(title: const Text('Practice test')),
        body: AsyncErrorView(
          message: state.error!,
          onRetry: () => ref
              .read(testControllerProvider(widget.sessionId).notifier)
              .load(),
        ),
      );
    }
    if (state.complete) return const _TestComplete();
    final TestQuestion? question = state.question;
    if (question == null) {
      return const Scaffold(
          body: Center(child: Text('No question is available.')));
    }
    final TestController controller =
        ref.read(testControllerProvider(widget.sessionId).notifier);
    final double progress = state.total <= 0 ? 0 : state.current / state.total;

    return Scaffold(
      appBar: AppBar(
        leading: IconButton(
          onPressed: () => Navigator.of(context).maybePop(),
          icon: const Icon(Icons.close_rounded),
          tooltip: 'Exit test',
        ),
        title: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('${state.level} practice',
                style: Theme.of(context)
                    .textTheme
                    .titleMedium
                    ?.copyWith(fontWeight: FontWeight.w700)),
            Text(
              question.sectionType.toUpperCase(),
              style: Theme.of(context)
                  .textTheme
                  .labelSmall
                  ?.copyWith(letterSpacing: 1.3),
            ),
          ],
        ),
        actions: <Widget>[
          CountdownTimer(
            initialSeconds: state.timeRemaining,
            onTick: controller.updateTime,
            onExpired: () => unawaited(controller.submit()),
          ),
          const SizedBox(width: AppSpacing.md),
        ],
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(12),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.md),
            child: ClipRRect(
              borderRadius: BorderRadius.circular(99),
              child: LinearProgressIndicator(
                value: progress.clamp(0, 1).toDouble(),
                minHeight: 5,
                backgroundColor:
                    Theme.of(context).colorScheme.surfaceContainerLow,
              ),
            ),
          ),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: <Widget>[
            Expanded(
              child: SingleChildScrollView(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.lg,
                  AppSpacing.md,
                  AppSpacing.xl,
                ),
                child: Center(
                  child: ConstrainedBox(
                    constraints: const BoxConstraints(maxWidth: 720),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: <Widget>[
                        Row(
                          children: <Widget>[
                            Text(
                              'Question ${state.current} of ${state.total}',
                              style: Theme.of(context)
                                  .textTheme
                                  .labelLarge
                                  ?.copyWith(
                                    color:
                                        Theme.of(context).colorScheme.primary,
                                    fontWeight: FontWeight.w800,
                                  ),
                            ),
                            const Spacer(),
                            IconButton(
                              onPressed: () {},
                              tooltip: 'Flag question',
                              icon: const Icon(Icons.flag_outlined),
                            ),
                          ],
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        Card(
                          child: Padding(
                            padding: const EdgeInsets.all(AppSpacing.lg),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: <Widget>[
                                if (question.questionJp != null)
                                  RubyText(
                                    question.questionJp!,
                                    style: Theme.of(context)
                                        .textTheme
                                        .titleLarge
                                        ?.copyWith(
                                          fontWeight: FontWeight.w600,
                                          height: 1.8,
                                        ),
                                  ),
                                if (question.questionEn != null) ...<Widget>[
                                  const SizedBox(height: AppSpacing.sm),
                                  Text(
                                    question.questionEn!,
                                    style: Theme.of(context)
                                        .textTheme
                                        .bodyMedium
                                        ?.copyWith(
                                          color: Theme.of(context)
                                              .colorScheme
                                              .onSurfaceVariant,
                                        ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                        ),
                        if (question.sectionType == 'listening') ...<Widget>[
                          const SizedBox(height: AppSpacing.md),
                          ListeningAudioPlayer(
                            audioUrl: question.audioUrl,
                            fallbackText: question.questionJp ?? '',
                            replayLimit:
                                (question.stimulus?['replay_limit'] as num?)
                                        ?.toInt() ??
                                    2,
                          ),
                        ],
                        const SizedBox(height: AppSpacing.lg),
                        for (final TestOption option
                            in question.options) ...<Widget>[
                          _AnswerOption(
                            option: option,
                            selected: state.selected == option.id,
                            disabled: state.submitting,
                            onTap: () {
                              HapticFeedback.selectionClick();
                              controller.select(option.id);
                            },
                          )
                              .animate()
                              .fadeIn(duration: 180.ms)
                              .slideY(begin: 0.08),
                          const SizedBox(height: AppSpacing.sm),
                        ],
                        if (state.error != null)
                          Padding(
                            padding: const EdgeInsets.only(top: AppSpacing.sm),
                            child: Text(
                              state.error!,
                              style: TextStyle(
                                  color: Theme.of(context).colorScheme.error),
                            ),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
            DecoratedBox(
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface,
                border: Border(
                    top: BorderSide(
                        color: Theme.of(context).colorScheme.outlineVariant)),
              ),
              child: SafeArea(
                top: false,
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.md),
                  child: SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: state.selected == null || state.submitting
                          ? null
                          : controller.submit,
                      icon: state.submitting
                          ? const SizedBox.square(
                              dimension: 18,
                              child: CircularProgressIndicator(strokeWidth: 2),
                            )
                          : const Icon(Icons.arrow_forward_rounded),
                      label:
                          Text(state.submitting ? 'Saving…' : 'Next question'),
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

final class _AnswerOption extends StatelessWidget {
  const _AnswerOption({
    required this.option,
    required this.selected,
    required this.disabled,
    required this.onTap,
  });

  final TestOption option;
  final bool selected;
  final bool disabled;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) => Semantics(
        selected: selected,
        button: true,
        child: Material(
          color: selected
              ? Theme.of(context).colorScheme.primaryContainer
              : Theme.of(context).colorScheme.surface,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(AppRadii.md),
            side: BorderSide(
              color: selected
                  ? Theme.of(context).colorScheme.primary
                  : Theme.of(context).colorScheme.outlineVariant,
              width: selected ? 2 : 1,
            ),
          ),
          child: InkWell(
            onTap: disabled ? null : onTap,
            borderRadius: BorderRadius.circular(AppRadii.md),
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.md),
              child: Row(
                children: <Widget>[
                  CircleAvatar(
                    radius: 17,
                    backgroundColor: selected
                        ? Theme.of(context).colorScheme.primary
                        : Theme.of(context).colorScheme.surfaceContainerLow,
                    foregroundColor: selected
                        ? Theme.of(context).colorScheme.onPrimary
                        : Theme.of(context).colorScheme.onSurface,
                    child: Text(option.id,
                        style: const TextStyle(fontWeight: FontWeight.w800)),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        RubyText(option.textJp,
                            style: Theme.of(context).textTheme.bodyLarge),
                        if (option.textEn.isNotEmpty)
                          Padding(
                            padding: const EdgeInsets.only(top: 3),
                            child: Text(
                              option.textEn,
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(
                                    color: Theme.of(context)
                                        .colorScheme
                                        .onSurfaceVariant,
                                  ),
                            ),
                          ),
                      ],
                    ),
                  ),
                  if (selected)
                    Icon(Icons.check_circle_rounded,
                        color: Theme.of(context).colorScheme.primary),
                ],
              ),
            ),
          ),
        ),
      );
}

final class _TestComplete extends StatelessWidget {
  const _TestComplete();

  @override
  Widget build(BuildContext context) => Scaffold(
        body: SafeArea(
          child: Center(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.xl),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: <Widget>[
                  Icon(Icons.task_alt_rounded,
                      size: 64, color: Theme.of(context).colorScheme.secondary),
                  const SizedBox(height: AppSpacing.lg),
                  Text('Section complete',
                      style: Theme.of(context)
                          .textTheme
                          .headlineSmall
                          ?.copyWith(fontWeight: FontWeight.w800)),
                  const SizedBox(height: AppSpacing.sm),
                  const Text(
                      'Your answers were saved. Results will be ready next.'),
                  const SizedBox(height: AppSpacing.lg),
                  FilledButton(
                      onPressed: () => Navigator.of(context).maybePop(),
                      child: const Text('Continue')),
                ],
              ),
            ),
          ),
        ),
      );
}
