#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
load_env

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required for seeding."
run_npm_script "$(component_path knowledge)" seed:n5
