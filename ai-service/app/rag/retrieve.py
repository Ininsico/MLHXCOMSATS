"""Retrieval: vector search plus a keyword nudge and de-duplication.

Pure vector search on a small corpus can retrieve a neighbouring section instead
of the exact one. Ranking by cosine similarity, then boosting chunks that share
query keywords and preferring distinct sources, gives noticeably better passages
for the generator.
"""

from __future__ import annotations

import re
from pathlib import Path

from app.rag import store

STOPWORDS = {
    "the", "a", "an", "and", "or", "of", "to", "in", "is", "are", "for", "on", "with",
    "what", "how", "does", "do", "it", "this", "that", "at", "by", "as", "be", "from",
}


def keywords(text: str) -> set[str]:
    words = re.findall(r"[a-z0-9%µ\.]+", text.lower())
    return {word.strip(".") for word in words if len(word) > 2 and word not in STOPWORDS}


def retrieve(base_dir: Path, question: str, k: int = 4) -> list[dict]:
    """Return the best passages for a question, ranked and de-duplicated."""
    candidates = store.vector_search(base_dir, question, k=max(k * 3, 8))

    if not candidates:
        return []

    wanted = keywords(question)

    for hit in candidates:
        overlap = len(wanted & keywords(hit["text"]))
        hit["keywordHits"] = overlap
        hit["rank"] = round(hit["score"] + min(0.25, overlap * 0.05), 4)

    candidates.sort(key=lambda hit: hit["rank"], reverse=True)

    selected: list[dict] = []
    per_source: dict[str, int] = {}

    for hit in candidates:
        # At most two passages per source keeps answers from quoting one file only.
        if per_source.get(hit["source"], 0) >= 2:
            continue
        per_source[hit["source"]] = per_source.get(hit["source"], 0) + 1
        selected.append(hit)
        if len(selected) >= k:
            break

    return selected
