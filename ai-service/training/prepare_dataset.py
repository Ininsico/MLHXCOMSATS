"""Download a public medical-imaging dataset and export it for the local model.

Uses MedMNIST (PneumoniaMNIST) — de-identified, openly licensed (CC BY 4.0) chest
radiographs, derived from the Kermany paediatric pneumonia collection. Nothing here
is patient-identifiable and everything stays on this machine.

The exporter:
  * pulls the split through the `medmnist` package (cached under ai-service/data/raw)
  * balances the classes (normal vs pneumonia)
  * normalises contrast and upscales to 512x512 (the vision encoder resizes anyway,
    but a clean PNG keeps the harness honest)
  * writes PNGs plus `manifest.json`, which the evaluator and the prompt tuner read.

Usage:
    python scripts/prepare_dataset.py --per-class 8 --splits train val test
"""

from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageOps
from medmnist import INFO, PneumoniaMNIST

if hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

BASE_DIR = Path(__file__).resolve().parent.parent
RAW_DIR = BASE_DIR / "data" / "raw"
OUT_DIR = BASE_DIR / "data" / "pneumoniamnist"

LABEL_NAMES = {0: "normal", 1: "pneumonia"}


def export_split(split: str, per_class: int, size: int, seed: int) -> list[dict]:
    print(f"  loading {split} split…")
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    dataset = PneumoniaMNIST(split=split, download=True, size=28, root=str(RAW_DIR))
    labels = np.asarray(dataset.labels).reshape(-1)

    rng = np.random.default_rng(seed)
    chosen: list[int] = []

    for label in sorted(LABEL_NAMES):
        indices = np.where(labels == label)[0]
        if not len(indices):
            continue
        take = min(per_class, len(indices))
        chosen.extend(rng.choice(indices, size=take, replace=False).tolist())

    rng.shuffle(chosen)

    split_dir = OUT_DIR / split
    split_dir.mkdir(parents=True, exist_ok=True)

    items: list[dict] = []

    for index in chosen:
        image, label = dataset[int(index)]
        label_value = int(np.asarray(label).reshape(-1)[0])

        processed = ImageOps.autocontrast(image.convert("L"), cutoff=1)
        processed = processed.resize((size, size), Image.LANCZOS)

        filename = f"{LABEL_NAMES[label_value]}_{int(index):05d}.png"
        target = split_dir / filename
        processed.save(target)

        items.append(
            {
                "path": str(target.relative_to(BASE_DIR)).replace("\\", "/"),
                "label": label_value,
                "labelName": LABEL_NAMES[label_value],
                "split": split,
            }
        )

    print(f"    exported {len(items)} images ({sum(1 for i in items if i['label'] == 1)} pneumonia)")
    return items


def main() -> None:
    parser = argparse.ArgumentParser(description="Prepare a public medical-imaging dataset")
    parser.add_argument("--per-class", type=int, default=8, help="images per class, per split")
    parser.add_argument("--size", type=int, default=512, help="exported image size in pixels")
    parser.add_argument("--splits", nargs="+", default=["train", "val", "test"])
    parser.add_argument("--seed", type=int, default=7)
    args = parser.parse_args()

    info = INFO["pneumoniamnist"]
    print(f"Preparing {info['description']} (license: {info['license']})")

    items: list[dict] = []

    for split in args.splits:
        items.extend(export_split(split, args.per_class, args.size, args.seed))

    manifest = {
        "dataset": "PneumoniaMNIST (MedMNIST v2)",
        "description": info["description"],
        "license": info["license"],
        "source": "https://medmnist.com/",
        "imageSize": args.size,
        "labels": LABEL_NAMES,
        "count": len(items),
        "items": items,
    }

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifest_path = OUT_DIR / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2), encoding="utf-8")

    print(f"\nWrote {manifest_path}")
    print(f"{len(items)} images ready — evaluate with: python scripts/evaluate.py")


if __name__ == "__main__":
    main()
