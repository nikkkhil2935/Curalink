"""Compatibility ASGI entrypoint.

Allows running `uvicorn main:app` from the repository root by
forwarding to llm-service/main.py.
"""

from __future__ import annotations

import importlib.util
from pathlib import Path

SERVICE_MAIN = Path(__file__).resolve().parent / "llm-service" / "main.py"

if not SERVICE_MAIN.exists():
    raise RuntimeError(f"Expected LLM service entrypoint at {SERVICE_MAIN}")

spec = importlib.util.spec_from_file_location("llm_service_main", SERVICE_MAIN)
if spec is None or spec.loader is None:
    raise RuntimeError("Unable to load llm-service/main.py module spec")

module = importlib.util.module_from_spec(spec)
spec.loader.exec_module(module)

app = getattr(module, "app", None)
if app is None:
    raise RuntimeError("llm-service/main.py does not expose `app`")
