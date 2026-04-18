#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ -z "${GROQ_API_KEY:-}" ]; then
  echo "GROQ_API_KEY is not set. Generation endpoints that require Groq will return 503."
fi

exec env PRIMARY_LLM_PROVIDER="${PRIMARY_LLM_PROVIDER:-groq}" uvicorn main:app --app-dir "$SCRIPT_DIR" --host 0.0.0.0 --port "${PORT:-8001}"
