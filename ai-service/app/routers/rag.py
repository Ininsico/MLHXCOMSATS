"""RAG endpoints: ask, search, stats, reindex and document ingestion."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from starlette.concurrency import run_in_threadpool

from app import queue as job_queue
from app.engine import BASE_DIR, engine, require_model
from app.rag import ingest, pipeline, retrieve, store
from app.schemas import RagAnswer, RagDocumentRequest, RagQueryRequest, RagStats, RagSource

router = APIRouter(prefix="/rag", tags=["rag"])


@router.post("/query", response_model=RagAnswer)
async def rag_query(request: RagQueryRequest, _: None = Depends(require_model)) -> RagAnswer:
    result = await run_in_threadpool(pipeline.answer, engine, BASE_DIR, request.question, request.k or 4)

    return RagAnswer(
        answer=result["answer"],
        sources=[RagSource(**source) for source in result["sources"]],
        retrieved=result["retrieved"],
        model_version=engine.model_version,
        latency_ms=result["latency_ms"],
    )


@router.post("/search")
async def rag_search(request: RagQueryRequest) -> dict:
    hits = await run_in_threadpool(retrieve.retrieve, BASE_DIR, request.question, request.k or 4)
    return {
        "data": [
            {
                "source": hit["source"],
                "heading": hit["heading"],
                "score": hit["rank"],
                "preview": hit["text"][:240],
            }
            for hit in hits
        ]
    }


@router.get("/stats", response_model=RagStats)
async def rag_stats() -> RagStats:
    info = await run_in_threadpool(store.stats, BASE_DIR)
    broker = await run_in_threadpool(job_queue.status)
    return RagStats(**info, queue=broker)


@router.post("/reindex")
async def rag_reindex() -> dict:
    result = await run_in_threadpool(ingest.ingest_corpus, BASE_DIR)
    queued = await run_in_threadpool(job_queue.publish, {"type": "rag.reindex", "chunks": result["chunks"]})
    return {"data": {**result, "queued": queued}}


@router.post("/documents")
async def rag_add_document(request: RagDocumentRequest) -> dict:
    if len(request.text.strip()) < 40:
        raise HTTPException(status_code=400, detail="Send at least 40 characters of text.")

    result = await run_in_threadpool(ingest.add_document, BASE_DIR, request.title, request.text, request.source)
    return {"data": result}
