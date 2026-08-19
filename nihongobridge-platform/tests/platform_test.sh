#!/usr/bin/env bash
set -Eeuo pipefail

platform_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

for script in "$platform_dir"/scripts/*.sh "$platform_dir"/tests/*.sh; do
  bash -n "$script"
done

required_env=(
  DATABASE_URL REDIS_URL MEILISEARCH_URL MEILISEARCH_KEY
  MINIO_ENDPOINT MINIO_ACCESS_KEY MINIO_SECRET_KEY
  NEXT_PUBLIC_API_URL SUPABASE_URL SUPABASE_ANON_KEY
  ANTHROPIC_API_KEY NEXT_PUBLIC_APP_URL EDGE_TTS_RATE EDGE_TTS_VOLUME
)
for key in "${required_env[@]}"; do
  grep -q "^${key}=" "$platform_dir/.env.example" || {
    printf 'Missing required .env.example key: %s\n' "$key" >&2
    exit 1
  }
done

for file in ci.yml etl.yml deploy-web.yml; do
  [[ -s "$platform_dir/.github/workflows/$file" ]] || {
    printf 'Missing workflow: %s\n' "$file" >&2
    exit 1
  }
done

if command -v docker >/dev/null 2>&1 && docker compose version >/dev/null 2>&1; then
  docker compose --env-file "$platform_dir/.env.example" \
    --file "$platform_dir/docker-compose.yml" config --quiet
else
  printf 'Docker Compose unavailable; static shell/env checks passed.\n'
fi

printf 'Platform infrastructure checks passed.\n'
