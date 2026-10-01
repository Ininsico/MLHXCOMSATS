"""Text-only clinical reasoning."""

from __future__ import annotations

import httpx
from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from app.engine import engine, require_model
from app.schemas import ChatRequest, ChatResponse

router = APIRouter(tags=["chat"])


@router.post("/chat", response_model=ChatResponse)
async def chat(request: ChatRequest, _: None = Depends(require_model)) -> ChatResponse:
    if not request.messages:
        raise HTTPException(status_code=400, detail="Send at least one message.")

    try:
        reply, latency = await run_in_threadpool(
            engine.chat,
            [message.model_dump() for message in request.messages],
            request.max_tokens,
            request.temperature,
        )
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=502, detail=f"Inference failed: {exc}") from exc
    except RuntimeError as exc:
        raise HTTPException(status_code=502, detail=str(exc)) from exc

    return ChatResponse(reply=reply, model_version=engine.model_version, latency_ms=latency)
