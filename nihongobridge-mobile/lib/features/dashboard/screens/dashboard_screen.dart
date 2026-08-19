import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/sync/sync_providers.dart';
import '../../../core/sync/sync_service.dart';
import '../../../core/theme/app_theme.dart';

final class DashboardScreen extends ConsumerWidget {
  const DashboardScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<SyncState> sync = ref.watch(syncStateProvider);
    return Scaffold(
      appBar: AppBar(
        title: const Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text('こんにちは'),
            Text('Keep your bridge growing',
                style: TextStyle(fontSize: 12, fontWeight: FontWeight.w400)),
          ],
        ),
        actions: <Widget>[
          IconButton(
            onPressed: () => ref.read(syncServiceProvider).syncAll(),
            tooltip: 'Sync now',
            icon: sync.maybeWhen(
              data: (SyncState value) => value.phase == SyncPhase.syncing
                  ? const SizedBox.square(
                      dimension: 20,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : const Icon(Icons.sync_rounded),
              orElse: () => const Icon(Icons.sync_rounded),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
        ],
      ),
      body: ListView(
        padding: const EdgeInsets.fromLTRB(
          AppSpacing.md,
          AppSpacing.lg,
          AppSpacing.md,
          112,
        ),
        children: <Widget>[
          Card(
            child: Padding(
              padding: const EdgeInsets.all(AppSpacing.lg),
              child: Row(
                children: <Widget>[
                  Container(
                    width: 54,
                    height: 54,
                    alignment: Alignment.center,
                    decoration: BoxDecoration(
                      color: Theme.of(context).colorScheme.primary,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: Text(
                      '日',
                      style:
                          Theme.of(context).textTheme.headlineSmall?.copyWith(
                                color: Theme.of(context).colorScheme.onPrimary,
                                fontWeight: FontWeight.w800,
                              ),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.md),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: <Widget>[
                        Text('Today’s study',
                            style: Theme.of(context)
                                .textTheme
                                .titleLarge
                                ?.copyWith(fontWeight: FontWeight.w800)),
                        const SizedBox(height: 3),
                        Text('20 minutes · N4 focus',
                            style: Theme.of(context).textTheme.bodySmall),
                      ],
                    ),
                  ),
                  FilledButton(onPressed: () {}, child: const Text('Start')),
                ],
              ),
            ),
          ),
          const SizedBox(height: AppSpacing.lg),
          Text('Overview',
              style: Theme.of(context)
                  .textTheme
                  .titleMedium
                  ?.copyWith(fontWeight: FontWeight.w800)),
          const SizedBox(height: AppSpacing.sm),
          const Row(
            children: <Widget>[
              Expanded(
                  child: _Metric(
                      label: 'Streak',
                      value: '12',
                      unit: 'days',
                      icon: Icons.local_fire_department_rounded)),
              SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: _Metric(
                      label: 'Due',
                      value: '24',
                      unit: 'cards',
                      icon: Icons.style_rounded)),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          const Row(
            children: <Widget>[
              Expanded(
                  child: _Metric(
                      label: 'Accuracy',
                      value: '84',
                      unit: '%',
                      icon: Icons.track_changes_rounded)),
              SizedBox(width: AppSpacing.sm),
              Expanded(
                  child: _Metric(
                      label: 'Level',
                      value: 'N4',
                      unit: 'target',
                      icon: Icons.flag_rounded)),
            ],
          ),
          const SizedBox(height: AppSpacing.lg),
          sync.when(
            data: (SyncState value) => _SyncNotice(state: value),
            loading: () => const SizedBox.shrink(),
            error: (Object error, StackTrace stack) => const _SyncNotice(
              state: SyncState(
                  phase: SyncPhase.failed,
                  message: 'Sync status is unavailable.'),
            ),
          ),
        ],
      ),
    );
  }
}

final class _Metric extends StatelessWidget {
  const _Metric(
      {required this.label,
      required this.value,
      required this.unit,
      required this.icon});

  final String label;
  final String value;
  final String unit;
  final IconData icon;

  @override
  Widget build(BuildContext context) => Card(
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.md),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: <Widget>[
              Icon(icon, color: Theme.of(context).colorScheme.primary),
              const SizedBox(height: AppSpacing.sm),
              Text(value,
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800)),
              Text('$label · $unit',
                  style: Theme.of(context).textTheme.bodySmall),
            ],
          ),
        ),
      );
}

final class _SyncNotice extends StatelessWidget {
  const _SyncNotice({required this.state});

  final SyncState state;

  @override
  Widget build(BuildContext context) {
    if (state.phase == SyncPhase.idle || state.phase == SyncPhase.succeeded) {
      return const SizedBox.shrink();
    }
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.md),
        child: Row(
          children: <Widget>[
            Icon(state.phase == SyncPhase.offline
                ? Icons.cloud_off_outlined
                : Icons.info_outline_rounded),
            const SizedBox(width: AppSpacing.sm),
            Expanded(child: Text(state.message ?? 'Syncing your study data…')),
          ],
        ),
      ),
    );
  }
}
