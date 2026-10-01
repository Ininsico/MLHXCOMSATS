"""Generation: retrieved passages + the local model → an answer with citations."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from app.rag import retrieve

RAG_PROMPT = """You are MedGemma running locally inside Aurora, a hospital management system. Answer the clinician's question using ONLY the context passages provided. If the context does not answer it, say so plainly instead of guessing.

Rules:
- Be concise and clinical. No markdown headings, no pleasantries.
- Quote figures exactly as they appear in the context (ranges, thresholds).
- Never state a diagnosis about a specific patient and never prescribe doses.
- Do not add your own disclaimer — the application attaches one."""


def build_messages(question: str, passages: list[dict[str, Any]]) -> list[dict[str, str]]:
    context = "\n\n".join(
        f"[{index + 1}] {hit['source']} — {hit['heading']}\n{hit['text']}"
        for index, hit in enumerate(passages)
    )

    return [
        {
            "role": "system",
            "content": f"{RAG_PROMPT}\n\nContext passages:\n{context or '(no passages found)'}",
        },
        {"role": "user", "content": question},
    ]


def answer(engine, base_dir: Path, question: str, k: int = 4) -> dict[str, Any]:
    """Retrieve, generate and return the answer with its citations."""
    passages = retrieve.retrieve(base_dir, question, k)

    messages = build_messages(question, passages)
    reply, latency = engine.chat(messages, engine.default_max_tokens, engine.default_temperature)

    return {
        "answer": reply,
        "sources": [
            {"source": hit["source"], "heading": hit["heading"], "score": hit["rank"]}
            for hit in passages
        ],
        "retrieved": len(passages),
        "latency_ms": latency,
    }
