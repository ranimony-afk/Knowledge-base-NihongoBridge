#!/usr/bin/env bash

set -Eeuo pipefail

PLATFORM_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"

log() {
  printf '\033[1;34m[nihongobridge]\033[0m %s\n' "$*"
}

warn() {
  printf '\033[1;33m[nihongobridge]\033[0m %s\n' "$*" >&2
}

fail() {
  printf '\033[1;31m[nihongobridge]\033[0m %s\n' "$*" >&2
  exit 1
}

load_env() {
  local env_file="${ENV_FILE:-$PLATFORM_DIR/.env}"
  if [[ -f "$env_file" ]]; then
    set -a
    # shellcheck disable=SC1090
    source "$env_file"
    set +a
  fi
}

component_root() {
  local candidate
  if [[ -n "${COMPONENT_ROOT:-}" ]]; then
    printf '%s\n' "$(cd -- "$COMPONENT_ROOT" && pwd)"
    return
  fi
  for candidate in "$PLATFORM_DIR" "$PLATFORM_DIR/components" "$PLATFORM_DIR/.."; do
    if [[ -d "$candidate/nihongobridge-knowledge" ]]; then
      printf '%s\n' "$(cd -- "$candidate" && pwd)"
      return
    fi
  done
  fail "Could not locate component repositories. Set COMPONENT_ROOT to their parent directory."
}

component_path() {
  local name="$1"
  local root
  root="$(component_root)"
  local path="$root/nihongobridge-$name"
  [[ -d "$path" ]] || fail "Missing component repository: $path"
  printf '%s\n' "$path"
}

require_command() {
  local command_name="$1"
  local help_text="${2:-Install $command_name and ensure it is on PATH.}"
  command -v "$command_name" >/dev/null 2>&1 || fail "$command_name is required. $help_text"
}

require_node_20() {
  require_command node "Install Node.js 20 or newer."
  local major
  major="$(node -p 'process.versions.node.split(".")[0]')"
  (( major >= 20 )) || fail "Node.js 20+ is required; found $(node --version)."
}

require_python_311() {
  require_command python3 "Install Python 3.11 or newer."
  python3 - <<'PY' || fail "Python 3.11 or newer is required."
import sys
raise SystemExit(0 if sys.version_info >= (3, 11) else 1)
PY
}

ensure_node_dependencies() {
  local repository="$1"
  if [[ ! -d "$repository/node_modules" ]]; then
    log "Installing Node dependencies in $(basename "$repository")"
    (cd "$repository" && npm ci)
  fi
}

run_npm_script() {
  local repository="$1"
  local script="$2"
  ensure_node_dependencies "$repository"
  log "$(basename "$repository"): npm run $script"
  (cd "$repository" && npm run "$script")
}
