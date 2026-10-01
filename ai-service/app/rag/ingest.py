"""Indexing: corpus files and clinician-uploaded documents into Chroma."""

from __future__ import annotations

import logging
from pathlib import Path
from typing import Any

from app.rag import chunking, store

LOGGER = logging.getLogger("aurora.ai.rag.ingest")


def ingest_corpus(base_dir: Path) -> dict[str, Any]:
    """Re-index every markdown file in ai-service/corpus/."""
    corpus_dir = base_dir / "corpus"

    if not corpus_dir.exists():
        raise FileNotFoundError(f"corpus directory missing: {corpus_dir}")

    ids: list[str] = []
    documents: list[str] = []
    metadatas: list[dict[str, Any]] = []

    for path in sorted(corpus_dir.glob("*.md")):
        for index, chunk in enumerate(chunking.chunk_markdown(path.read_text(encoding="utf-8"), path.name)):
            ids.append(f"{path.stem}-{index:03d}")
            documents.append(chunk["text"])
            metadatas.append({"source": chunk["source"], "heading": chunk["heading"]})

    indexed = store.upsert(base_dir, ids, documents, metadatas)
    LOGGER.info("Indexed %s chunks from %s files", indexed, len({meta['source'] for meta in metadatas}))

    return {
        "chunks": indexed,
        "sources": sorted({meta["source"] for meta in metadatas}),
        "collection": store.COLLECTION_NAME,
    }


def add_document(base_dir: Path, title: str, text: str, source: str | None = None) -> dict[str, Any]:
    """Chunk and index one document supplied at runtime (admin/doctor upload)."""
    import time

    safe_source = (source or title).strip().replace(" ", "-").lower()[:60] or "upload"
    slug = f"{safe_source}-{int(time.time())}"

    chunks = chunking.chunk_markdown(text, f"{safe_source}.md")

    ids = [f"{slug}-{index:03d}" for index in range(len(chunks))]
    documents = [chunk["text"] for chunk in chunks]
    metadatas = [{"source": chunk["source"], "heading": chunk["heading"]} for chunk in chunks]

    indexed = store.upsert(base_dir, ids, documents, metadatas)
    LOGGER.info("Indexed uploaded document %s (%s chunks)", safe_source, indexed)

    return {"source": f"{safe_source}.md", "chunks": indexed}
