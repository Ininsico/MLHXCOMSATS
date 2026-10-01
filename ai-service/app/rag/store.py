"""Chroma persistence for the Aurora knowledge base.

Embeddings use Chroma's built-in ONNX MiniLM model (all-MiniLM-L6-v2, ~80 MB):
it downloads once, then embeds locally on the CPU — no external API, consistent
with the rest of the stack.
"""

from __future__ import annotations

import logging
import os
from pathlib import Path
from typing import Any

LOGGER = logging.getLogger("aurora.ai.rag.store")

COLLECTION_NAME = os.getenv("RAG_COLLECTION", "aurora-knowledge")
EMBEDDING_MODEL = "all-MiniLM-L6-v2 (ONNX, bundled with Chroma)"

_client = None


def chroma_dir(base_dir: Path) -> Path:
    return base_dir / "data" / "chroma"


def get_client(base_dir: Path):
    global _client

    if _client is None:
        import chromadb
        from chromadb.config import Settings

        path = chroma_dir(base_dir)
        path.mkdir(parents=True, exist_ok=True)

        _client = chromadb.PersistentClient(
            path=str(path),
            settings=Settings(anonymized_telemetry=False),
        )

    return _client


def get_collection(base_dir: Path):
    return get_client(base_dir).get_or_create_collection(
        name=COLLECTION_NAME,
        metadata={"hnsw:space": "cosine"},
    )


def upsert(base_dir: Path, ids: list[str], documents: list[str], metadatas: list[dict[str, Any]]) -> int:
    if not ids:
        return 0

    get_collection(base_dir).upsert(ids=ids, documents=documents, metadatas=metadatas)
    return len(ids)


def vector_search(base_dir: Path, text: str, k: int = 6) -> list[dict[str, Any]]:
    collection = get_collection(base_dir)
    count = collection.count()

    if not count:
        return []

    result = collection.query(
        query_texts=[text],
        n_results=min(k, count),
        include=["documents", "metadatas", "distances"],
    )

    hits: list[dict[str, Any]] = []

    for chunk_id, document, meta, distance in zip(
        result["ids"][0],
        result["documents"][0],
        result["metadatas"][0],
        result["distances"][0],
    ):
        hits.append(
            {
                "id": chunk_id,
                "text": document,
                "source": (meta or {}).get("source", ""),
                "heading": (meta or {}).get("heading", ""),
                "score": round(max(0.0, 1.0 - float(distance)), 4),
            }
        )

    return hits


def stats(base_dir: Path) -> dict[str, Any]:
    collection = get_collection(base_dir)
    count = collection.count()
    sources: list[str] = []

    if count:
        stored = collection.get(include=["metadatas"], limit=min(count, 2000))
        sources = sorted({meta.get("source", "") for meta in (stored.get("metadatas") or []) if meta})

    return {
        "collection": COLLECTION_NAME,
        "chunks": count,
        "sources": sources,
        "embeddingModel": EMBEDDING_MODEL,
        "path": str(chroma_dir(base_dir)),
    }
