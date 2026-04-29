#!/bin/bash
set -e

MODE=${1:-all}

cd "$(dirname "$0")/web-ui"

if [ "$MODE" = "base" ]; then
  npx vitest run "src/__tests__/base" --reporter=verbose
elif [ "$MODE" = "new" ]; then
  npx vitest run "src/__tests__/new" --reporter=verbose
else
  npx vitest run "src/__tests__" --reporter=verbose
fi
