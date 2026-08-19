import 'dart:async';
import 'dart:math' as math;

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../../core/db/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/ruby_text.dart';

final class FlipCard extends StatefulWidget {
  const FlipCard({
    required this.card,
    required this.enabled,
    required this.onConfidence,
    super.key,
  });

  final SrsCard card;
  final bool enabled;
  final ValueChanged<SrsConfidence> onConfidence;

  @override
  State<FlipCard> createState() => _FlipCardState();
}

final class _FlipCardState extends State<FlipCard>
    with SingleTickerProviderStateMixin {
  late final AnimationController _controller = AnimationController(
    vsync: this,
    duration: const Duration(milliseconds: 420),
  );
  double _dragX = 0;
  double _dragY = 0;

  bool get _flipped => _controller.value >= 0.5;

  @override
  void didUpdateWidget(FlipCard oldWidget) {
    super.didUpdateWidget(oldWidget);
    if (oldWidget.card.id != widget.card.id) _controller.value = 0;
  }

  Future<void> _toggle() async {
    if (_controller.isAnimating) return;
    if (_flipped) {
      await _controller.reverse();
    } else {
      await _controller.forward();
    }
    unawaited(HapticFeedback.selectionClick());
  }

  void _finishGesture(DragEndDetails details) {
    if (!widget.enabled || !_flipped) {
      _dragX = 0;
      _dragY = 0;
      return;
    }
    final double velocityX = details.velocity.pixelsPerSecond.dx;
    final double velocityY = details.velocity.pixelsPerSecond.dy;
    final double x = velocityX.abs() > 550 ? velocityX : _dragX;
    final double y = velocityY.abs() > 550 ? velocityY : _dragY;
    SrsConfidence? confidence;
    if (x.abs() > y.abs() && x.abs() > 70) {
      confidence = x > 0 ? SrsConfidence.good : SrsConfidence.again;
    } else if (y.abs() > 70) {
      confidence = y < 0 ? SrsConfidence.easy : SrsConfidence.hard;
    }
    _dragX = 0;
    _dragY = 0;
    if (confidence != null) {
      HapticFeedback.mediumImpact();
      widget.onConfidence(confidence);
    }
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) => Semantics(
        button: true,
        label: _flipped
            ? 'Flashcard answer. Swipe to rate.'
            : 'Flashcard front. Tap to reveal.',
        child: GestureDetector(
          onTap: _toggle,
          onPanUpdate: (DragUpdateDetails details) {
            _dragX += details.delta.dx;
            _dragY += details.delta.dy;
          },
          onPanEnd: _finishGesture,
          child: AnimatedBuilder(
            animation: _controller,
            builder: (BuildContext context, Widget? child) {
              final double angle = _controller.value * math.pi;
              final bool showBack = angle > math.pi / 2;
              final Matrix4 transform = Matrix4.identity()
                ..setEntry(3, 2, 0.0012)
                ..rotateY(angle);
              return Transform(
                alignment: Alignment.center,
                transform: transform,
                child: showBack
                    ? Transform(
                        alignment: Alignment.center,
                        transform: Matrix4.rotationY(math.pi),
                        child: _Back(card: widget.card),
                      )
                    : _Front(card: widget.card),
              );
            },
          ),
        ),
      );
}

final class _Front extends StatelessWidget {
  const _Front({required this.card});

  final SrsCard card;

  @override
  Widget build(BuildContext context) => _Surface(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          children: <Widget>[
            RubyText(
              card.frontText,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.displayMedium?.copyWith(
                    fontWeight: FontWeight.w600,
                    height: 1.55,
                  ),
            ),
            const SizedBox(height: AppSpacing.xl),
            Row(
              mainAxisSize: MainAxisSize.min,
              children: <Widget>[
                const Icon(Icons.touch_app_outlined, size: 17),
                const SizedBox(width: AppSpacing.xs),
                Text('Tap to reveal',
                    style: Theme.of(context).textTheme.labelMedium),
              ],
            ),
          ],
        ),
      );
}

final class _Back extends StatelessWidget {
  const _Back({required this.card});

  final SrsCard card;

  @override
  Widget build(BuildContext context) => _Surface(
        child: Column(
          mainAxisAlignment: MainAxisAlignment.center,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text(
              'ANSWER',
              style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: Theme.of(context).colorScheme.primary,
                    fontWeight: FontWeight.w800,
                    letterSpacing: 1.4,
                  ),
            ),
            const SizedBox(height: AppSpacing.sm),
            RubyText(
              card.frontText,
              style: Theme.of(context)
                  .textTheme
                  .headlineMedium
                  ?.copyWith(fontWeight: FontWeight.w700),
            ),
            if (card.reading != null)
              Padding(
                padding: const EdgeInsets.only(top: AppSpacing.xs),
                child: Text(card.reading!,
                    style: Theme.of(context).textTheme.bodyMedium),
              ),
            const SizedBox(height: AppSpacing.lg),
            for (final (int index, String meaning)
                in card.displayMeanings.indexed)
              Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                child: Text('${index + 1}. $meaning'),
              ),
            if (card.example != null) ...<Widget>[
              const SizedBox(height: AppSpacing.lg),
              DecoratedBox(
                decoration: BoxDecoration(
                  color: Theme.of(context).colorScheme.surfaceContainerLow,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  border: Border(
                      left: BorderSide(
                          color: Theme.of(context).colorScheme.primary,
                          width: 3)),
                ),
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.sm),
                  child: RubyText(card.example!),
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.xl),
            Center(
              child: Text(
                '← Again  ·  ↓ Hard  ·  → Good  ·  ↑ Easy',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurfaceVariant,
                    ),
              ),
            ),
          ],
        ),
      );
}

final class _Surface extends StatelessWidget {
  const _Surface({required this.child});

  final Widget child;

  @override
  Widget build(BuildContext context) => Container(
        constraints: const BoxConstraints(minHeight: 410),
        padding: const EdgeInsets.all(AppSpacing.xl),
        decoration: BoxDecoration(
          color: Theme.of(context).cardTheme.color,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border:
              Border.all(color: Theme.of(context).colorScheme.outlineVariant),
          boxShadow: <BoxShadow>[
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.06),
              blurRadius: 30,
              offset: const Offset(0, 12),
            ),
          ],
        ),
        child: child,
      );
}
