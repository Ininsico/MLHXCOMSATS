"""Aurora local AI sidecar.

Offline MedGemma inference for Aurora: image analysis, clinical chat and a RAG
knowledge base. Everything runs on this machine — see README.md.

Layout
    app/main.py         app assembly (lifespan + routers)
    app/engine.py       the single MedGemma engine instance
    app/model.py        llama-server supervision, GPU ladder, prompt handling
    app/queue.py        RabbitMQ publisher
    app/rag/            chunking → embeddings → Chroma → retrieval → generation
    app/routers/        HTTP surface (health, analysis, chat, rag, jobs)
    training/           dataset preparation, evaluation and prompt calibration
"""

from __future__ import annotations

import logging
from contextlib import asynccontextmanager
from pathlib import Path

from dotenv import load_dotenv
from fastapi import FastAPI

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR / ".env")

from app.engine import engine  # noqa: E402 — .env must load first
from app.routers import analysis, chat, health, jobs, rag  # noqa: E402

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(name)s: %(message)s")


@asynccontextmanager
async def lifespan(_: FastAPI):
    engine.start()
    try:
        yield
    finally:
        engine.stop()


app = FastAPI(
    title="Aurora local AI sidecar",
    description="Offline MedGemma inference plus a local RAG knowledge base. No patient data leaves this machine.",
    version="1.1.0",
    lifespan=lifespan,
)

app.include_router(health.router)
app.include_router(analysis.router)
app.include_router(chat.router)
app.include_router(rag.router)
app.include_router(jobs.router)
