"""Calibrate the analysis prompt against the labelled validation slice.

This is the local stand-in for gradient fine-tuning: it scores every candidate
prompt in ai-service/prompts/ on real labelled images and writes the winner to
prompts/analysis_prompt.txt, which the running service loads at startup.
(Updating weights on a 4 GB Max-Q GPU is not possible; see the README.)

Usage:
    python scripts/tune_prompt.py --per-class 4
"""

from __future__ import annotations

import argparse
import json
import sys
import time
from pathlib import Path

import httpx

sys.path.insert(0, str(Path(__file__).resolve().parent))

from harness import ACTIVE_PROMPT_PATH, BASE_DIR, analyze, load_manifest, prompt_candidates, score  # noqa: E402

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

DEFAULT_URL = "http://127.0.0.1:8000/analyze-image"


def main() -> None:
    parser = argparse.ArgumentParser(description="Tune the analysis prompt on labelled images")
    parser.add_argument("--split", default="val", choices=["train", "val", "test"])
    parser.add_argument("--per-class", type=int, default=4)
    parser.add_argument("--temperature", type=float, default=0.2)
    parser.add_argument("--max-tokens", type=int, default=320)
    parser.add_argument("--url", default=DEFAULT_URL)
    args = parser.parse_args()

    candidates = prompt_candidates()

    if not candidates:
        raise SystemExit("No candidate prompts found in ai-service/prompts/")

    items = load_manifest(args.split, args.per_class)
    print(f"Calibrating {len(candidates)} prompts on {len(items)} {args.split} images\n")

    leaderboard: list[dict] = []
    started = time.perf_counter()

    with httpx.Client(timeout=600.0) as client:
        for candidate in candidates:
            system_prompt = candidate.read_text(encoding="utf-8").strip()
            print(f"→ {candidate.name}")

            results: list[dict] = []

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
                        "jsonValid": False,
                        "impression": None,
                        "latencyMs": None,
                        "error": str(exc),
                    }

                results.append(row)
                print(
                    f"    [{index:>2}/{len(items)}] truth={row['labelName']:<9} "
                    f"impression={str(row.get('impression')):<8} "
                    f"{(row.get('latencyMs') or 0) / 1000:.1f}s"
                )

            metrics = score(results)
            score_value = (
                metrics["accuracy"] * 1.0
                + metrics["sensitivity"] * 0.5
                + metrics["specificity"] * 0.5
                + metrics["jsonValidity"] * 0.5
            )

            leaderboard.append(
                {
                    "prompt": candidate.name,
                    "score": round(score_value, 4),
                    "metrics": metrics,
                    "results": results,
                }
            )

            print(
                f"    → accuracy {metrics['accuracy'] * 100:.0f}% · "
                f"sensitivity {metrics['sensitivity'] * 100:.0f}% · "
                f"specificity {metrics['specificity'] * 100:.0f}% · "
                f"json {metrics['jsonValidity'] * 100:.0f}%\n"
            )

    leaderboard.sort(key=lambda entry: entry["score"], reverse=True)
    winner = leaderboard[0]

    print("--- leaderboard ----------------------------------------------")
    for rank, entry in enumerate(leaderboard, start=1):
        print(f"  {rank}. {entry['prompt']:<38} score {entry['score']:.2f}  acc {entry['metrics']['accuracy'] * 100:.0f}%")

    source = BASE_DIR / "prompts" / winner["prompt"]
    ACTIVE_PROMPT_PATH.write_text(source.read_text(encoding="utf-8").strip() + "\n", encoding="utf-8")

    report_path = BASE_DIR / "docs" / "tuning-report.json"
    report_path.parent.mkdir(parents=True, exist_ok=True)
    report_path.write_text(
        json.dumps(
            {
                "split": args.split,
                "perClass": args.per_class,
                "temperature": args.temperature,
                "winner": winner["prompt"],
                "leaderboard": [
                    {"prompt": entry["prompt"], "score": entry["score"], "metrics": entry["metrics"]}
                    for entry in leaderboard
                ],
                "generatedAt": time.strftime("%Y-%m-%dT%H:%M:%S"),
            },
            indent=2,
        ),
        encoding="utf-8",
    )

    print(f"\nWinner: {winner['prompt']} → written to {ACTIVE_PROMPT_PATH}")
    print(f"Report: {report_path}")
    print(f"Took {(time.perf_counter() - started) / 60:.1f} min")
    print("\nRestart the sidecar to pick up the new prompt, or leave it running to keep testing.")


if __name__ == "__main__":
    main()
