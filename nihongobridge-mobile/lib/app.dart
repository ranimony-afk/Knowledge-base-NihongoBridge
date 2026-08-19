import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import 'core/sync/app_sync_lifecycle.dart';
import 'core/theme/app_theme.dart';
import 'features/ai_tutor/screens/ai_tutor_screen.dart';
import 'features/dashboard/screens/dashboard_screen.dart';
import 'features/dictionary/screens/dictionary_screen.dart';
import 'features/grammar/screens/grammar_screen.dart';
import 'features/kanji/screens/kanji_screen.dart';
import 'features/srs/screens/review_screen.dart';
import 'features/tests/screens/test_screen.dart';

final themeModeProvider =
    StateProvider<ThemeMode>((Ref ref) => ThemeMode.system);

final routerProvider = Provider<GoRouter>((Ref ref) {
  final GoRouter router = GoRouter(
    initialLocation: '/',
    routes: <RouteBase>[
      StatefulShellRoute.indexedStack(
        builder: (
          BuildContext context,
          GoRouterState state,
          StatefulNavigationShell navigationShell,
        ) =>
            _AppShell(navigationShell: navigationShell),
        branches: <StatefulShellBranch>[
          StatefulShellBranch(routes: <RouteBase>[
            GoRoute(path: '/', builder: (_, __) => const DashboardScreen()),
          ]),
          StatefulShellBranch(routes: <RouteBase>[
            GoRoute(
                path: '/dictionary',
                builder: (_, __) => const DictionaryScreen()),
          ]),
          StatefulShellBranch(routes: <RouteBase>[
            GoRoute(
                path: '/tests',
                builder: (_, __) => const TestScreen(sessionId: 'demo')),
          ]),
          StatefulShellBranch(routes: <RouteBase>[
            GoRoute(path: '/review', builder: (_, __) => const ReviewScreen()),
          ]),
        ],
      ),
      GoRoute(
          path: '/tests/:sessionId',
          builder: (_, GoRouterState state) =>
              TestScreen(sessionId: state.pathParameters['sessionId']!)),
      GoRoute(path: '/kanji', builder: (_, __) => const KanjiScreen()),
      GoRoute(path: '/grammar', builder: (_, __) => const GrammarScreen()),
      GoRoute(path: '/ai-tutor', builder: (_, __) => const AiTutorScreen()),
    ],
  );
  ref.onDispose(router.dispose);
  return router;
});

final class NihongoBridgeApp extends ConsumerWidget {
  const NihongoBridgeApp({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) => AppSyncLifecycle(
        child: MaterialApp.router(
          title: 'NihongoBridge',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.light,
          darkTheme: AppTheme.dark,
          themeMode: ref.watch(themeModeProvider),
          routerConfig: ref.watch(routerProvider),
        ),
      );
}

final class _AppShell extends StatelessWidget {
  const _AppShell({required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  Widget build(BuildContext context) => Scaffold(
        body: navigationShell,
        bottomNavigationBar: NavigationBar(
          selectedIndex: navigationShell.currentIndex,
          onDestinationSelected: (int index) => navigationShell.goBranch(
            index,
            initialLocation: index == navigationShell.currentIndex,
          ),
          destinations: const <NavigationDestination>[
            NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home'),
            NavigationDestination(
                icon: Icon(Icons.menu_book_outlined),
                selectedIcon: Icon(Icons.menu_book_rounded),
                label: 'Dictionary'),
            NavigationDestination(
                icon: Icon(Icons.fact_check_outlined),
                selectedIcon: Icon(Icons.fact_check_rounded),
                label: 'Tests'),
            NavigationDestination(
                icon: Icon(Icons.style_outlined),
                selectedIcon: Icon(Icons.style_rounded),
                label: 'Review'),
          ],
        ),
      );
}
