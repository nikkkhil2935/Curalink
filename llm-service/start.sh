#!/usr/bin/env bash
set -euo pipefail

if [ "${LLM_PROVIDER:-ollama}" = "ollama" ]; then
  if command -v ollama >/dev/null 2>&1; then
    ollama serve &
    sleep 5
    ollama pull "${OLLAMA_MODEL:-phi3:mini}" || true
  else
    echo "Ollama binary not found. Continuing with local fallback provider mode."
  fi
fi

exec uvicorn main:app --host 0.0.0.0 --port "${PORT:-8001}"
