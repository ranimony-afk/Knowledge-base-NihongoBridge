import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

final class ListeningAudioPlayer extends StatefulWidget {
  const ListeningAudioPlayer({
    required this.audioUrl,
    required this.fallbackText,
    this.replayLimit = 2,
    super.key,
  });

  final String? audioUrl;
  final String fallbackText;
  final int replayLimit;

  @override
  State<ListeningAudioPlayer> createState() => _ListeningAudioPlayerState();
}

final class _ListeningAudioPlayerState extends State<ListeningAudioPlayer> {
  final AudioPlayer _player = AudioPlayer();
  final FlutterTts _tts = FlutterTts();
  final List<StreamSubscription<Object?>> _subscriptions =
      <StreamSubscription<Object?>>[];
  Duration _duration = Duration.zero;
  Duration _position = Duration.zero;
  bool _playing = false;
  int _plays = 0;

  @override
  void initState() {
    super.initState();
    _subscriptions.add(_player.onDurationChanged.listen((Duration value) {
      if (mounted) setState(() => _duration = value);
    }));
    _subscriptions.add(_player.onPositionChanged.listen((Duration value) {
      if (mounted) setState(() => _position = value);
    }));
    _subscriptions.add(_player.onPlayerStateChanged.listen((PlayerState value) {
      if (mounted) setState(() => _playing = value == PlayerState.playing);
    }));
  }

  Future<void> _toggle() async {
    if (_playing) {
      await _player.pause();
      return;
    }
    if (_plays >= widget.replayLimit) return;
    setState(() => _plays += 1);
    final String? audioUrl = widget.audioUrl;
    if (audioUrl != null && audioUrl.isNotEmpty) {
      if (_position >= _duration && _duration > Duration.zero) {
        await _player.seek(Duration.zero);
      }
      await _player.play(UrlSource(audioUrl));
    } else {
      await _tts.setLanguage('ja-JP');
      await _tts.setSpeechRate(0.42);
      await _tts.speak(widget.fallbackText);
    }
  }

  @override
  void dispose() {
    for (final StreamSubscription<Object?> subscription in _subscriptions) {
      unawaited(subscription.cancel());
    }
    unawaited(_player.dispose());
    unawaited(_tts.stop());
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final int maximum =
        _duration.inMilliseconds <= 0 ? 1 : _duration.inMilliseconds;
    final int current = _position.inMilliseconds.clamp(0, maximum).toInt();
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
        child: Column(
          children: <Widget>[
            Row(
              children: <Widget>[
                IconButton.filled(
                  onPressed: _plays >= widget.replayLimit && !_playing
                      ? null
                      : _toggle,
                  icon: Icon(_playing
                      ? Icons.pause_rounded
                      : Icons.play_arrow_rounded),
                  tooltip: _playing ? 'Pause audio' : 'Play audio',
                ),
                Expanded(
                  child: Slider(
                    value: current.toDouble(),
                    max: maximum.toDouble(),
                    onChanged: widget.audioUrl == null
                        ? null
                        : (double value) =>
                            _player.seek(Duration(milliseconds: value.round())),
                  ),
                ),
                Text(
                  '$_plays/${widget.replayLimit}',
                  style: Theme.of(context).textTheme.labelMedium,
                ),
              ],
            ),
            Align(
              alignment: Alignment.centerLeft,
              child: Text(
                widget.audioUrl == null
                    ? 'Using device Japanese voice fallback'
                    : '${widget.replayLimit - _plays} plays remaining',
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}
