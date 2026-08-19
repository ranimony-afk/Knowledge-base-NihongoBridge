#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
load_env

run_npm_script "$(component_path knowledge)" build:package
for name in api web admin search ai; do
  run_npm_script "$(component_path "$name")" build
done

etl="$(component_path etl)"
python_bin="${PYTHON_BIN:-$etl/.venv/bin/python}"
[[ -x "$python_bin" ]] || fail "ETL virtualenv is missing. Run scripts/setup.sh first."
if ! "$python_bin" -c 'import build' >/dev/null 2>&1; then
  "$python_bin" -m pip install build
fi
log "nihongobridge-etl: build wheel and source distribution"
(cd "$etl" && "$python_bin" -m build)

require_command flutter "Install Flutter 3.x to build the Android app."
log "nihongobridge-mobile: build debug APK"
(cd "$(component_path mobile)" && flutter build apk --debug)

log "All services built successfully."
