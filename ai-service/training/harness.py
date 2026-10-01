"""Shared helpers for the dataset harness (evaluate/tune)."""

from __future__ import annotations

import json
import statistics
from pathlib import Path
from typing import Any, Optional

import httpx

BASE_DIR = Path(__file__).resolve().parent.parent
MANIFEST_PATH = BASE_DIR / "data" / "pneumoniamnist" / "manifest.json"
PROMPTS_DIR = BASE_DIR / "prompts"
ACTIVE_PROMPT_PATH = PROMPTS_DIR / "analysis_prompt.txt"

DEFAULT_QUESTION = (
    "Assess this chest radiograph: describe any abnormality you can see and give your overall impression."
)


def load_manifest(split: str, per_class: int = 0) -> list[dict]:
    if not MANIFEST_PATH.exists():
        raise SystemExit(
            "No dataset yet — run: python scripts/prepare_dataset.py --per-class 8"
        )

    items = json.loads(MANIFEST_PATH.read_text(encoding="utf-8"))["items"]
    items = [item for item in items if item["split"] == split]

    if per_class:
        limited: list[dict] = []
        for label in (0, 1):
            limited.extend([item for item in items if item["label"] == label][:per_class])
        items = limited

    if not items:
        raise SystemExit(f"No {split} items in the manifest — rerun prepare_dataset.py")

    return items


def prompt_candidates() -> list[Path]:
    return sorted(path for path in PROMPTS_DIR.glob("analysis_prompt.*.txt"))


def analyze(
    client: httpx.Client,
    url: str,
    item: dict,
    *,
    system_prompt: Optional[str],
    temperature: float,
    max_tokens: int,
) -> dict[str, Any]:
    image_path = BASE_DIR / item["path"]
    data = {"question": DEFAULT_QUESTION, "temperature": str(temperature), "max_tokens": str(max_tokens)}

    if system_prompt:
        data["system_prompt"] = system_prompt

    with image_path.open("rb") as handle:
        files = {"file": (image_path.name, handle, "image/png")}
        response = client.post(url, data=data, files=files)

    response.raise_for_status()
    payload = response.json()

    return {
        "label": item["label"],
        "labelName": item["labelName"],
        "path": item["path"],
        "impression": payload.get("impression"),
        "severity": payload.get("severity"),
        "confidence": payload.get("confidence"),
        "findings": payload.get("findings"),
        "latencyMs": payload.get("latency_ms"),
        "jsonValid": isinstance(payload.get("findings"), list) and payload.get("impression") in {"normal", "abnormal"},
        "error": None,
    }


def score(results: list[dict]) -> dict[str, Any]:
    tp = fp = tn = fn = 0
    latencies: list[float] = []
    confidences: list[float] = []
    valid = 0

    for row in results:
        if row.get("jsonValid"):
            valid += 1

        if row.get("latencyMs"):
            latencies.append(float(row["latencyMs"]))

        if isinstance(row.get("confidence"), (int, float)):
            confidences.append(float(row["confidence"]))

        predicted_abnormal = row.get("impression") == "abnormal"
        actually_abnormal = row.get("label") == 1

        if predicted_abnormal and actually_abnormal:
            tp += 1
        elif predicted_abnormal and not actually_abnormal:
            fp += 1
        elif not predicted_abnormal and not actually_abnormal:
            tn += 1
        else:
            fn += 1

    total = len(results)
    accuracy = (tp + tn) / total if total else 0.0
    sensitivity = tp / (tp + fn) if (tp + fn) else 0.0
    specificity = tn / (tn + fp) if (tn + fp) else 0.0

    return {
        "total": total,
        "accuracy": round(accuracy, 4),
        "sensitivity": round(sensitivity, 4),
        "specificity": round(specificity, 4),
        "confusion": {"tp": tp, "fp": fp, "tn": tn, "fn": fn},
        "jsonValidity": round(valid / total, 4) if total else 0.0,
        "meanLatencyMs": round(statistics.fmean(latencies)) if latencies else 0,
        "medianLatencyMs": round(statistics.median(latencies)) if latencies else 0,
        "meanConfidence": round(statistics.fmean(confidences), 3) if confidences else 0.0,
    }
