#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
load_env

[[ -n "${DATABASE_URL:-}" ]] || fail "DATABASE_URL is required for search synchronization."
[[ -n "${MEILISEARCH_URL:-}" ]] || fail "MEILISEARCH_URL is required."
export MEILI_MASTER_KEY="${MEILI_MASTER_KEY:-${MEILISEARCH_KEY:-}}"
[[ -n "$MEILI_MASTER_KEY" ]] || fail "MEILI_MASTER_KEY or MEILISEARCH_KEY is required."

search="$(component_path search)"
run_npm_script "$search" indexes:configure
run_npm_script "$search" notify:setup
run_npm_script "$search" sync:full
log "PostgreSQL content is synchronized to Meilisearch."
