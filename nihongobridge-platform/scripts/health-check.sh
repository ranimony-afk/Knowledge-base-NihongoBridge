#!/usr/bin/env bash
set -Eeuo pipefail

url="${1:-}"
[[ -n "$url" ]] || {
  printf 'Usage: %s <url>\n' "$0" >&2
  exit 2
}

attempts="${DEPLOY_HEALTH_ATTEMPTS:-12}"
delay="${DEPLOY_HEALTH_DELAY_SECONDS:-5}"

curl_headers=()
if [[ -n "${VERCEL_AUTOMATION_BYPASS_SECRET:-}" ]]; then
  curl_headers+=(--header "x-vercel-protection-bypass: ${VERCEL_AUTOMATION_BYPASS_SECRET}")
fi

for ((attempt = 1; attempt <= attempts; attempt += 1)); do
  status="$(curl --silent --show-error --location --output /dev/null \
    "${curl_headers[@]}" --write-out '%{http_code}' --max-time 15 "$url" || true)"
  if [[ "$status" =~ ^[23][0-9]{2}$ ]]; then
    printf 'Health check passed (%s): %s\n' "$status" "$url"
    exit 0
  fi
  printf 'Health check attempt %d/%d returned %s; retrying in %ss...\n' \
    "$attempt" "$attempts" "${status:-connection-error}" "$delay" >&2
  sleep "$delay"
done

printf 'Health check failed after %d attempts: %s\n' "$attempts" "$url" >&2
exit 1
