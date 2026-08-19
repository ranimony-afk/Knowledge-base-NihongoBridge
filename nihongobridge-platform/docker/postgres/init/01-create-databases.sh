#!/bin/sh
set -eu

create_database() {
  database="$1"
  exists="$(psql --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" --tuples-only --no-align \
    --command "SELECT 1 FROM pg_database WHERE datname = '$database'")"
  if [ "$exists" != "1" ]; then
    createdb --username "$POSTGRES_USER" --encoding UTF8 "$database"
    printf 'Created PostgreSQL database: %s\n' "$database"
  else
    printf 'PostgreSQL database already exists: %s\n' "$database"
  fi
}

create_database nihongobridge_dev
create_database nihongobridge_test

for database in nihongobridge_dev nihongobridge_test; do
  psql --username "$POSTGRES_USER" --dbname "$database" --set ON_ERROR_STOP=1 <<'SQL'
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS pgcrypto;
SQL
done
