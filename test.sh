#!/usr/bin/env bash
set -euo pipefail

OUTPUT_PATH=""
MODE=""

while [[ $# -gt 0 ]]; do
  case "$1" in
    --output_path) OUTPUT_PATH="$2"; shift 2 ;;
    base|new)      MODE="$1"; shift ;;
    *) echo "Unknown argument: $1" >&2; exit 2 ;;
  esac
done

[[ -n "$OUTPUT_PATH" ]] || { echo "--output_path is required" >&2; exit 2; }
[[ -n "$MODE"        ]] || { echo "mode (base|new) is required" >&2; exit 2; }

case "$MODE" in
  base) TEST_PATTERN="src/__tests__/base" ;;
  new)  TEST_PATTERN="src/__tests__/new" ;;
esac

cd web-ui

export VITEST_JUNIT_OUTPUT="$OUTPUT_PATH"

npx vitest run "$TEST_PATTERN" --reporter=junit --outputFile="$OUTPUT_PATH"
