#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
load_env

"$PLATFORM_DIR/tests/platform_test.sh"

for name in api web admin search ai; do
  run_npm_script "$(component_path "$name")" test
done

etl="$(component_path etl)"
python_bin="${PYTHON_BIN:-$etl/.venv/bin/python}"
[[ -x "$python_bin" ]] || fail "ETL virtualenv is missing. Run scripts/setup.sh first."
log "nihongobridge-etl: pytest"
(cd "$etl" && "$python_bin" -m pytest)

require_command flutter "Install Flutter 3.x to run mobile tests."
mobile="$(component_path mobile)"
log "nihongobridge-mobile: flutter test"
(cd "$mobile" && flutter test)

log "All platform test suites passed."
