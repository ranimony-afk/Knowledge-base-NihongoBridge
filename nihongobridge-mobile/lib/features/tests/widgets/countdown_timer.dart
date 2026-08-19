import 'dart:async';

import 'package:flutter/material.dart';

final class CountdownTimer extends StatefulWidget {
  const CountdownTimer({
    required this.initialSeconds,
    required this.onTick,
    required this.onExpired,
    super.key,
  });

  final int initialSeconds;
  final ValueChanged<int> onTick;
  final VoidCallback onExpired;

  @override
  State<CountdownTimer> createState() => _CountdownTimerState();
}

final class _CountdownTimerState extends State<CountdownTimer> {
  Timer? _timer;
  late DateTime _deadline;
  late int _seconds;

  @override
  void initState() {
    super.initState();
    _restart(widget.initialSeconds);
  }

  @override
  void didUpdateWidget(CountdownTimer oldWidget) {
    super.didUpdateWidget(oldWidget);
    if ((oldWidget.initialSeconds - widget.initialSeconds).abs() > 2) {
      _restart(widget.initialSeconds);
    }
  }

  void _restart(int seconds) {
    _timer?.cancel();
    _seconds = seconds.clamp(0, 24 * 60 * 60).toInt();
    _deadline = DateTime.now().add(Duration(seconds: _seconds));
    _timer = Timer.periodic(const Duration(seconds: 1), (_) => _tick());
  }

  void _tick() {
    final int next =
        _deadline.difference(DateTime.now()).inSeconds.clamp(0, 86400).toInt();
    if (next == _seconds) return;
    if (mounted) setState(() => _seconds = next);
    widget.onTick(next);
    if (next == 0) {
      _timer?.cancel();
      widget.onExpired();
    }
  }

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final int minutes = _seconds ~/ 60;
    final int seconds = _seconds % 60;
    final bool urgent = _seconds <= 60;
    return Semantics(
      label: '$minutes minutes $seconds seconds remaining',
      liveRegion: urgent,
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: urgent
              ? Theme.of(context).colorScheme.errorContainer
              : Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 7),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: <Widget>[
              Icon(Icons.timer_outlined,
                  size: 17,
                  color: urgent ? Theme.of(context).colorScheme.error : null),
              const SizedBox(width: 6),
              Text(
                '$minutes:${seconds.toString().padLeft(2, '0')}',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  fontFeatures: const <FontFeature>[
                    FontFeature.tabularFigures()
                  ],
                  fontWeight: FontWeight.w800,
                  color: urgent ? Theme.of(context).colorScheme.error : null,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
