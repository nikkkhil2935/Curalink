#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LLM_PROVIDER="${LLM_PROVIDER:-${PRIMARY_LLM_PROVIDER:-groq}}"

if [ "${LLM_PROVIDER}" = "ollama" ]; then
  if command -v ollama >/dev/null 2>&1; then
    ollama serve &
    sleep 5
    ollama pull "${OLLAMA_MODEL:-llama3.1:8b}" || true
    ollama pull "${OLLAMA_EMBED_MODEL:-nomic-embed-text}" || true
  else
    echo "Ollama binary not found. Continuing with hosted/fallback provider mode."
  fi
elif [ "${LLM_PROVIDER}" = "groq" ] && [ -z "${GROQ_API_KEY:-}" ]; then
  echo "GROQ_API_KEY is not set. Groq requests will fail unless Ollama fallback is available."
fi

exec env PRIMARY_LLM_PROVIDER="${PRIMARY_LLM_PROVIDER:-$LLM_PROVIDER}" uvicorn main:app --app-dir "$SCRIPT_DIR" --host 0.0.0.0 --port "${PORT:-8001}"
