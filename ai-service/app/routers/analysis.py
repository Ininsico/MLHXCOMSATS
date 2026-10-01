"""Image analysis: MedGemma vision with DICOM support and queue events."""

from __future__ import annotations

from typing import Optional

import httpx
from fastapi import APIRouter, Depends, File, Form, HTTPException, UploadFile
from starlette.concurrency import run_in_threadpool

from app import queue as job_queue
from app.engine import engine, require_model
from app.model import dicom_to_png, is_dicom
from app.schemas import AnalysisResponse

router = APIRouter(tags=["analysis"])

MAX_UPLOAD_BYTES = 20 * 1024 * 1024
SUPPORTED_IMAGE_TYPES = {"image/jpeg", "image/png", "image/webp"}


@router.post("/analyze-image", response_model=AnalysisResponse)
async def analyze_image(
    file: UploadFile = File(..., description="JPEG, PNG, WebP, or a DICOM instance"),
    question: Optional[str] = Form(None),
    system_prompt: Optional[str] = Form(None, description="Prompt override for calibration runs"),
    max_tokens: Optional[int] = Form(None),
    temperature: Optional[float] = Form(None),
    _: None = Depends(require_model),
) -> AnalysisResponse:
    data = await file.read()

    if not data:
        raise HTTPException(status_code=400, detail="The uploaded file is empty.")
    if len(data) > MAX_UPLOAD_BYTES:
        raise HTTPException(status_code=413, detail="Images must be 20 MB or smaller.")

    filename = file.filename or ""
    mime_type = file.content_type or ""

    if is_dicom(data, filename):
        try:
            data = await run_in_threadpool(dicom_to_png, data)
        except Exception as exc:  # noqa: BLE001
            raise HTTPException(status_code=415, detail=f"DICOM could not be decoded: {exc}") from exc
        mime_type = "image/png"
    elif mime_type not in SUPPORTED_IMAGE_TYPES:
        mime_type = "image/jpeg" if filename.lower().endswith((".jpg", ".jpeg")) else "image/png"

    try:
        result, latency, raw = await run_in_threadpool(
            engine.analyze_image, data, mime_type, question, max_tokens, temperature, system_prompt
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Inference failed: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    await run_in_threadpool(
        job_queue.publish,
        {
            "type": "analysis.completed",
            "modelVersion": engine.model_version,
            "severity": result.get("severity"),
            "impression": result.get("impression"),
            "latencyMs": latency,
        },
    )

    return AnalysisResponse(
        **result,
        model_version=engine.model_version,
        latency_ms=latency,
        raw=raw[:2000],
    )
