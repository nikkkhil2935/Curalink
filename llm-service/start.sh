#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if [ "${LLM_PROVIDER:-ollama}" = "ollama" ]; then
  if command -v ollama >/dev/null 2>&1; then
    ollama serve &
    sleep 5
    ollama pull "${OLLAMA_MODEL:-llama3.1:8b}" || true
    ollama pull "${OLLAMA_EMBED_MODEL:-nomic-embed-text}" || true
  else
    echo "Ollama binary not found. Continuing with local fallback provider mode."
  fi
fi

exec uvicorn main:app --app-dir "$SCRIPT_DIR" --host 0.0.0.0 --port "${PORT:-8001}"
