"""Score the local MedGemma model against the labelled public dataset.

Runs every manifest item of a split through the live sidecar (POST /analyze-image)
and reports accuracy, sensitivity, specificity, JSON validity and latency.

Usage:
    python scripts/evaluate.py --split test
    python scripts/evaluate.py --split test --prompt-file prompts/analysis_prompt.checklist.txt
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import BASE_DIR, DEFAULT_QUESTION, analyze, load_manifest, score  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_URL = "http://127.0.0.1:8000/analyze-image"


def main() -> None:
    parser = argparse.ArgumentParser(description="Evaluate the local model on a labelled split")
    parser.add_argument("--split", default="test", choices=["train", "val", "test"])
    parser.add_argument("--per-class", type=int, default=0, help="limit images per class")
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-tokens", type=int, default=320)
    parser.add_argument("--prompt-file", default="", help="override the service system prompt")
    parser.add_argument("--url", default=DEFAULT_URL)
    parser.add_argument("--report", default="")
    args = parser.parse_args()

    items = load_manifest(args.split, args.per_class)
    system_prompt = None

    if args.prompt_file:
        system_prompt = (BASE_DIR / args.prompt_file).read_text(encoding="utf-8").strip()
        print(f"Using prompt: {args.prompt_file}")

    print(f"Evaluating {len(items)} {args.split} images (temperature {args.temperature})\n")

    results: list[dict] = []
    started = time.perf_counter()

    with httpx.Client(timeout=600.0) as client:
        for index, item in enumerate(items, start=1):
            try:
                row = analyze(
                    client,
                    args.url,
                    item,
                    system_prompt=system_prompt,
                    temperature=args.temperature,
                    max_tokens=args.max_tokens,
                )
            except Exception as exc:  # noqa: BLE001
                row = {
                    "label": item["label"],
                    "labelName": item["labelName"],
                    "path": item["path"],
                    "impression": None,
                    "severity": None,
                    "confidence": None,
                    "findings": None,
                    "latencyMs": None,
                    "jsonValid": False,
                    "error": str(exc),
                }

            results.append(row)
            mark = "ok " if row.get("jsonValid") else "ERR"
            print(
                f"  [{index:>2}/{len(items)}] {mark} truth={row['labelName']:<9} "
                f"impression={str(row.get('impression')):<8} severity={str(row.get('severity')):<8} "
                f"{(row.get('latencyMs') or 0) / 1000:.1f}s"
            )

    metrics = score(results)
    wall = time.perf_counter() - started

    print("\n--- metrics -------------------------------------------------")
    print(f"  accuracy     {metrics['accuracy'] * 100:.1f}%   ({metrics['confusion']})")
    print(f"  sensitivity  {metrics['sensitivity'] * 100:.1f}%   (pneumonia caught)")
    print(f"  specificity  {metrics['specificity'] * 100:.1f}%   (normals left alone)")
    print(f"  JSON valid   {metrics['jsonValidity'] * 100:.1f}%")
    print(f"  latency      mean {metrics['meanLatencyMs'] / 1000:.1f}s · median {metrics['medianLatencyMs'] / 1000:.1f}s")
    print(f"  confidence   mean {metrics['meanConfidence']:.2f}")
    print(f"  wall clock   {wall / 60:.1f} min for {len(items)} images")

    report = {
        "split": args.split,
        "promptFile": args.prompt_file or "(service default)",
        "temperature": args.temperature,
        "maxTokens": args.max_tokens,
        "question": DEFAULT_QUESTION,
        "metrics": metrics,
        "results": results,
        "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
    }

    report_path = Path(args.report) if args.report else BASE_DIR / "docs" / f"eval-{args.split}.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(json.dumps(report, indent=2), encoding="utf-8")
    print(f"\nReport written to {report_path}")


if __name__ == "__main__":
    main()
