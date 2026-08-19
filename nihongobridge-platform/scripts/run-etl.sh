#!/usr/bin/env bash
set -Eeuo pipefail

# shellcheck disable=SC1091
source "$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd)/lib.sh"
load_env

etl="$(component_path etl)"
python_bin="${PYTHON_BIN:-$etl/.venv/bin/python}"
[[ -x "$python_bin" ]] || python_bin="$(command -v python3 || true)"
[[ -n "$python_bin" ]] || fail "Python 3.11+ is required to run ETL pipelines."

pipelines="${ETL_PIPELINES:-all}"
if [[ "$pipelines" == "all" ]]; then
  pipelines="jmdict,tatoeba,tts,questions"
fi
pipelines="${pipelines// /}"
IFS=',' read -r -a selected_pipelines <<< "$pipelines"
for selected in "${selected_pipelines[@]}"; do
  case "$selected" in
    jmdict|tatoeba|tts|questions) ;;
    *) fail "Unknown ETL pipeline '$selected'. Use jmdict,tatoeba,tts,questions, or all." ;;
  esac
done
pipelines=",$pipelines,"

extra_source_args=()
if [[ "${ETL_ALLOW_MISSING_ENRICHMENT:-false}" == "true" ]]; then
  extra_source_args+=(--allow-missing-enrichment)
fi

run_pipeline() {
  local label="$1"
  shift
  log "Running ETL pipeline: $label"
  (cd "$etl" && "$python_bin" "$@")
}

if [[ "$pipelines" == *,jmdict,* ]]; then
  run_pipeline jmdict -m etl.pipelines.jmdict_pipeline "${extra_source_args[@]}"
fi

if [[ "$pipelines" == *,tatoeba,* ]]; then
  tatoeba_args=()
  if [[ "${ETL_ALLOW_MISSING_ENRICHMENT:-false}" == "true" ]]; then
    tatoeba_args+=(--allow-missing-jlpt)
  fi
  run_pipeline tatoeba -m etl.pipelines.tatoeba_pipeline "${tatoeba_args[@]}"
fi

if [[ "$pipelines" == *,tts,* ]]; then
  run_pipeline tts -m etl.pipelines.tts_pipeline --target all
fi

if [[ "$pipelines" == *,questions,* ]]; then
  run_pipeline questions -m etl.pipelines.question_generation_pipeline generate \
    --level "${QUESTION_LEVEL:-N5}" \
    --section "${QUESTION_SECTION:-all}" \
    --count "${QUESTION_COUNT:-20}"
fi

log "Requested ETL pipelines completed."
