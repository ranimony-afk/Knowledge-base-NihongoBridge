#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"

on_error() {
  warn "Setup failed. Current Docker service status:"
  docker compose --project-directory "$PLATFORM_DIR" ps 2>/dev/null || true
}
trap on_error ERR

log "Checking prerequisites"
require_node_20
require_python_311
require_command npm
require_command docker "Install Docker Engine/Desktop with Compose v2."
docker compose version >/dev/null 2>&1 || fail "Docker Compose v2 is required."
require_command flutter "Install Flutter 3.x and add it to PATH."

root="$(component_root)"
for name in knowledge etl api web admin search ai mobile; do
  [[ -d "$root/nihongobridge-$name" ]] || fail "Missing $root/nihongobridge-$name"
done

if [[ ! -f "$PLATFORM_DIR/.env" ]]; then
  cp "$PLATFORM_DIR/.env.example" "$PLATFORM_DIR/.env"
  log "Created .env from .env.example"
else
  log "Keeping existing .env"
fi
load_env

log "Installing Node dependencies"
for name in knowledge api web admin search ai; do
  ensure_node_dependencies "$(component_path "$name")"
done
run_npm_script "$(component_path knowledge)" build:package

etl="$(component_path etl)"
if [[ ! -x "$etl/.venv/bin/python" ]]; then
  log "Creating ETL Python virtual environment"
  python3 -m venv "$etl/.venv"
fi
"$etl/.venv/bin/python" -m pip install --upgrade pip
"$etl/.venv/bin/python" -m pip install -r "$etl/requirements-dev.txt"

log "Resolving Flutter dependencies"
(cd "$(component_path mobile)" && flutter pub get)

log "Starting development infrastructure"
docker compose --project-directory "$PLATFORM_DIR" up -d --wait --wait-timeout 180 \
  postgres redis meilisearch minio mailhog adminer
docker compose --project-directory "$PLATFORM_DIR" run --rm minio-init

"$PLATFORM_DIR/scripts/run-migrations.sh"
"$PLATFORM_DIR/scripts/run-seed.sh"
"$PLATFORM_DIR/scripts/sync-search.sh"

cat <<EOF

NihongoBridge local infrastructure is ready.

  PostgreSQL:      localhost:${POSTGRES_PORT:-5432} (nihongobridge_dev / nihongobridge_test)
  Redis:           redis://localhost:${REDIS_PORT:-6379}
  Meilisearch:     http://localhost:${MEILISEARCH_PORT:-7700}
  MinIO API:       http://localhost:${MINIO_API_PORT:-9000}
  MinIO console:   http://localhost:${MINIO_CONSOLE_PORT:-9001}
  MailHog:         http://localhost:${MAILHOG_HTTP_PORT:-8025}
  Adminer:         http://localhost:${ADMINER_PORT:-8080}

Next: start application repositories with their npm run dev commands.
EOF
