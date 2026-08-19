import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/async_error_view.dart';
import '../../../core/widgets/offline_banner.dart';
import '../data/dictionary_controller.dart';
import '../widgets/dictionary_entry_tile.dart';

final class DictionaryScreen extends ConsumerStatefulWidget {
  const DictionaryScreen({super.key});

  @override
  ConsumerState<DictionaryScreen> createState() => _DictionaryScreenState();
}

final class _DictionaryScreenState extends ConsumerState<DictionaryScreen> {
  final TextEditingController _searchController = TextEditingController();
  final FocusNode _searchFocus = FocusNode();
  Timer? _debounce;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        unawaited(ref.read(dictionaryControllerProvider.notifier).initialize());
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    _searchFocus.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 300), () {
      ref.read(dictionaryControllerProvider.notifier).search(value);
    });
  }

  @override
  Widget build(BuildContext context) {
    final DictionaryState state = ref.watch(dictionaryControllerProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Text('Dictionary'),
        actions: <Widget>[
          IconButton(
            onPressed: () {},
            tooltip: 'Saved words',
            icon: const Icon(Icons.bookmark_border_rounded),
          ),
        ],
        bottom: PreferredSize(
          preferredSize: Size.fromHeight(state.offline ? 48 : 0),
          child: OfflineBanner(visible: state.offline),
        ),
      ),
      body: SafeArea(
        top: false,
        child: Column(
          children: <Widget>[
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                AppSpacing.sm,
              ),
              child: SearchBar(
                controller: _searchController,
                focusNode: _searchFocus,
                hintText: '日本語・かな・romaji・meaning',
                keyboardType: TextInputType.text,
                textInputAction: TextInputAction.search,
                textCapitalization: TextCapitalization.none,
                autoFocus: false,
                leading: const Icon(Icons.search_rounded),
                trailing: <Widget>[
                  if (_searchController.text.isNotEmpty)
                    IconButton(
                      onPressed: () {
                        _searchController.clear();
                        _onQueryChanged('');
                        setState(() {});
                      },
                      icon: const Icon(Icons.close_rounded),
                      tooltip: 'Clear search',
                    ),
                ],
                onChanged: (String value) {
                  _onQueryChanged(value);
                  setState(() {});
                },
                onSubmitted: (String value) {
                  _debounce?.cancel();
                  unawaited(ref
                      .read(dictionaryControllerProvider.notifier)
                      .search(value));
                },
                onTapOutside: (_) => _searchFocus.unfocus(),
              ),
            ),
            Expanded(child: _body(state)),
          ],
        ),
      ),
    );
  }

  Widget _body(DictionaryState state) {
    if (state.loading && state.entries.isEmpty) {
      return const Center(child: CircularProgressIndicator.adaptive());
    }
    if (state.message != null && state.entries.isEmpty) {
      return AsyncErrorView(
        message: state.message!,
        onRetry: () =>
            ref.read(dictionaryControllerProvider.notifier).search(state.query),
      );
    }
    return RefreshIndicator.adaptive(
      onRefresh: () => ref
          .read(dictionaryControllerProvider.notifier)
          .search(state.query, refresh: true),
      child: state.entries.isEmpty
          ? ListView(
              physics: const AlwaysScrollableScrollPhysics(),
              children: const <Widget>[
                SizedBox(height: 160),
                Icon(Icons.manage_search_rounded, size: 48),
                SizedBox(height: 12),
                Center(child: Text('No matching words found.')),
              ],
            )
          : ListView.separated(
              physics: const AlwaysScrollableScrollPhysics(),
              keyboardDismissBehavior: ScrollViewKeyboardDismissBehavior.onDrag,
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.xs,
                AppSpacing.md,
                112,
              ),
              itemCount: state.entries.length,
              separatorBuilder: (_, __) =>
                  const SizedBox(height: AppSpacing.sm),
              itemBuilder: (BuildContext context, int index) =>
                  DictionaryEntryTile(entry: state.entries[index]),
            ),
    );
  }
}
