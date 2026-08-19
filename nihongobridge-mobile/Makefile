.PHONY: get analyze test format run

get:
	flutter pub get

analyze:
	flutter analyze

test:
	flutter test

format:
	dart format --set-exit-if-changed lib test

run:
	flutter run --dart-define=API_BASE_URL=$${API_BASE_URL}
