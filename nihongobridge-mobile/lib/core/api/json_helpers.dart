Map<String, Object?> jsonObject(Object? value, {String label = 'object'}) {
  if (value is! Map<Object?, Object?>) {
    throw FormatException('Expected $label to be a JSON object.');
  }
  return value.map<String, Object?>(
    (Object? key, Object? item) =>
        MapEntry<String, Object?>(key.toString(), item),
  );
}

List<Object?> jsonList(Object? value, {String label = 'list'}) {
  if (value is! List<Object?>) {
    throw FormatException('Expected $label to be a JSON array.');
  }
  return value;
}

List<String> stringList(Object? value) =>
    jsonList(value).whereType<String>().toList(growable: false);

String? nullableString(Object? value) => value is String ? value : null;
int? nullableInt(Object? value) => value is num ? value.toInt() : null;
double? nullableDouble(Object? value) => value is num ? value.toDouble() : null;
