import 'dart:async';

import 'package:audioplayers/audioplayers.dart';
import 'package:flutter/material.dart';
import 'package:flutter_tts/flutter_tts.dart';

import '../../../core/db/models.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/ruby_text.dart';

final class DictionaryEntryTile extends StatefulWidget {
  const DictionaryEntryTile({required this.entry, super.key});

  final DictionaryEntry entry;

  @override
  State<DictionaryEntryTile> createState() => _DictionaryEntryTileState();
}

final class _DictionaryEntryTileState extends State<DictionaryEntryTile> {
  final AudioPlayer _audioPlayer = AudioPlayer();
  final FlutterTts _tts = FlutterTts();
  late final StreamSubscription<PlayerState> _playerStateSubscription;
  bool _playing = false;

  @override
  void initState() {
    super.initState();
    _playerStateSubscription =
        _audioPlayer.onPlayerStateChanged.listen((PlayerState state) {
      if (mounted) setState(() => _playing = state == PlayerState.playing);
    });
  }

  @override
  void dispose() {
    unawaited(_playerStateSubscription.cancel());
    unawaited(_audioPlayer.dispose());
    unawaited(_tts.stop());
    super.dispose();
  }

  String get _furiganaHtml {
    if (widget.entry.furigana.isEmpty) return widget.entry.word;
    return widget.entry.furigana.map<String>((JsonMap segment) {
      final String base = segment['base'] as String? ?? '';
      final String? reading = segment['ruby'] as String?;
      return reading == null || reading.isEmpty
          ? base
          : '<ruby>$base<rt>$reading</rt></ruby>';
    }).join();
  }

  Future<void> _pronounce() async {
    if (_playing) {
      await _audioPlayer.stop();
      return;
    }
    final String? audioUrl = widget.entry.audioUrl;
    if (audioUrl != null && audioUrl.isNotEmpty) {
      await _audioPlayer.play(UrlSource(audioUrl));
      return;
    }
    await _tts.setLanguage('ja-JP');
    await _tts.setSpeechRate(0.42);
    await _tts.speak(widget.entry.word);
  }

  @override
  Widget build(BuildContext context) => Card(
        child: InkWell(
          onTap: () {},
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: <Widget>[
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: <Widget>[
                      RubyText(
                        _furiganaHtml,
                        style:
                            Theme.of(context).textTheme.headlineSmall?.copyWith(
                                  fontWeight: FontWeight.w700,
                                ),
                      ),
                      if (widget.entry.kana != null)
                        Padding(
                          padding: const EdgeInsets.only(top: AppSpacing.xs),
                          child: Text(
                            <String>[
                              widget.entry.kana!,
                              if (widget.entry.romaji != null)
                                widget.entry.romaji!,
                            ].join(' · '),
                            style:
                                Theme.of(context).textTheme.bodySmall?.copyWith(
                                      color: Theme.of(context)
                                          .colorScheme
                                          .onSurfaceVariant,
                                    ),
                          ),
                        ),
                      const SizedBox(height: AppSpacing.sm),
                      Text(
                        widget.entry.displayMeaning,
                        style: Theme.of(context).textTheme.bodyMedium,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xxs,
                        children: <Widget>[
                          _Tag(label: widget.entry.jlptLevel, emphasized: true),
                          for (final String part
                              in widget.entry.partOfSpeech.take(2))
                            _Tag(label: part),
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: _pronounce,
                  tooltip: widget.entry.audioUrl == null
                      ? 'Pronounce with device speech'
                      : 'Play pronunciation',
                  icon: Icon(
                      _playing ? Icons.stop_rounded : Icons.volume_up_rounded),
                ),
              ],
            ),
          ),
        ),
      );
}

final class _Tag extends StatelessWidget {
  const _Tag({required this.label, this.emphasized = false});

  final String label;
  final bool emphasized;

  @override
  Widget build(BuildContext context) => DecoratedBox(
        decoration: BoxDecoration(
          color: emphasized
              ? Theme.of(context).colorScheme.primary
              : Theme.of(context).colorScheme.surfaceContainerLow,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 4),
          child: Text(
            label,
            style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: emphasized
                      ? Theme.of(context).colorScheme.onPrimary
                      : Theme.of(context).colorScheme.onSurfaceVariant,
                  fontWeight: FontWeight.w700,
                ),
          ),
        ),
      );
}
