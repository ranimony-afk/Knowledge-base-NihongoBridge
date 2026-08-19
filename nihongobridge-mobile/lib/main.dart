import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:hive_flutter/hive_flutter.dart';

import 'app.dart';
import 'core/db/local_db.dart';
import 'core/db/srs_cache.dart';

Future<void> main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Hive.initFlutter();
  await SrsCache.instance.initialize();
  await LocalDb.instance.database;
  runApp(const ProviderScope(child: NihongoBridgeApp()));
}
