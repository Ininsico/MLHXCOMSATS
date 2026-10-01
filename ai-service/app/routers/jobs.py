"""Job queue visibility."""

from __future__ import annotations

import json

from fastapi import APIRouter
from starlette.concurrency import run_in_threadpool

from app import queue as job_queue
from app.engine import BASE_DIR

router = APIRouter(tags=["jobs"])


@router.get("/jobs")
async def jobs(limit: int = 10) -> dict:
    broker = await run_in_threadpool(job_queue.status)
    log_path = BASE_DIR / "data" / "jobs.log.jsonl"
    recent: list[dict] = []

    if log_path.exists():
        lines = log_path.read_text(encoding="utf-8").strip().splitlines()[-max(1, min(limit, 50)) :]
        for line in lines:
            try:
                recent.append(json.loads(line))
            except json.JSONDecodeError:
                continue

    return {"data": {"queue": broker, "recent": recent}}
