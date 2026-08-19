#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
load_env

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required for migrations."

knowledge="$(component_path knowledge)"
admin="$(component_path admin)"
ai="$(component_path ai)"

run_npm_script "$knowledge" build:package
run_npm_script "$knowledge" db:migrate
run_npm_script "$admin" db:migrate
run_npm_script "$ai" db:migrate

log "Knowledge, admin, and AI migrations completed."
