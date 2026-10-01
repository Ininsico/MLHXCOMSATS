"""Service health and model status."""

from __future__ import annotations

from fastapi import APIRouter

from app.engine import engine
from app.schemas import HealthResponse

router = APIRouter(tags=["health"])


@router.get("/health", response_model=HealthResponse)
def health() -> HealthResponse:
    info = engine.describe()
    return HealthResponse(status="ok" if info["modelLoaded"] else "unavailable", **info)
