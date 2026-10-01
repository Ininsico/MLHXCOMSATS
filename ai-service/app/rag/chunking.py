"""Markdown-aware chunking: documents in, retrievable passages out."""

from __future__ import annotations

import os
import re

CHUNK_CHARS = int(os.getenv("RAG_CHUNK_CHARS", "900"))
CHUNK_OVERLAP = int(os.getenv("RAG_CHUNK_OVERLAP", "150"))


def chunk_markdown(text: str, source: str) -> list[dict[str, str]]:
    """Split on level-2 headings, then window each section with overlap.

    Every chunk carries its document title and heading so answers can cite a
    precise location instead of the whole file.
    """
    title_match = re.search(r"^#\s+(.+)$", text, flags=re.MULTILINE)
    title = title_match.group(1).strip() if title_match else source

    sections: list[tuple[str, str]] = []
    heading = title
    buffer: list[str] = []

    for line in text.splitlines():
        if line.startswith("## "):
            if buffer:
                sections.append((heading, "\n".join(buffer).strip()))
                buffer = []
            heading = line[3:].strip()
            continue
        buffer.append(line)

    if buffer:
        sections.append((heading, "\n".join(buffer).strip()))

    chunks: list[dict[str, str]] = []

    for section_heading, body in sections:
        if not body:
            continue

        start = 0
        while start < len(body):
            window = body[start : start + CHUNK_CHARS]
            chunks.append(
                {
                    "text": f"{title} — {section_heading}\n{window}".strip(),
                    "heading": section_heading,
                    "source": source,
                }
            )
            if start + CHUNK_CHARS >= len(body):
                break
            start += CHUNK_CHARS - CHUNK_OVERLAP

    return chunks
