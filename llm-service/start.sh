#!/usr/bin/env bash
set -euo pipefail

if [ "${LLM_PROVIDER:-ollama}" = "ollama" ]; then
  ollama serve &
  sleep 5
  ollama pull "${OLLAMA_MODEL:-phi3:mini}" || true
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8001}"
