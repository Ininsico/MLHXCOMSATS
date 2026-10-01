"""One MedGemma engine instance, shared by every router.

`app/main.py` loads .env before importing this module, so the engine sees the
right model paths, port and context size.
"""

from __future__ import annotations

from pathlib import Path

from fastapi import HTTPException

from app.model import MedGemmaEngine

BASE_DIR = Path(__file__).resolve().parent.parent

engine = MedGemmaEngine(BASE_DIR)


def require_model() -> None:
    if not engine.loaded:
        raise HTTPException(
            status_code=503,
            detail=engine.missing or "The model is still loading — try again in a moment.",
        )
