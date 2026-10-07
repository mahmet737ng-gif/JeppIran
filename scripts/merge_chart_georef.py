#!/usr/bin/env python3
"""Merge newly measured georeferences into an existing source-matched asset."""
import argparse
import json
import os
import tempfile
from pathlib import Path


def atomic_json(path: Path, data):
    fd, temporary = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(data, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("base")
    parser.add_argument("supplement")
    args = parser.parse_args()

    base_path = Path(args.base)
    supplement_path = Path(args.supplement)

    base = json.loads(base_path.read_text(encoding="utf-8"))
    supplement = json.loads(supplement_path.read_text(encoding="utf-8"))

    for key in ("version", "coordinateSystem", "coordinateSpace", "origin"):
        if supplement.get(key) != base.get(key):
            raise ValueError(f"Georeference supplement mismatch: {key}")

    base_source = base.get("source") or {}
    supplement_source = supplement.get("source") or {}
    for key in ("chartDataVersion", "sha256"):
        if supplement_source.get(key) != base_source.get(key):
            raise ValueError(f"Georeference supplement source mismatch: {key}")

    charts = {
        int(item["page"]): item
        for item in base.get("charts", [])
    }

    added = []
    for item in supplement.get("charts", []):
        page = int(item.get("page", -1))
        if page <= 0:
            raise ValueError(f"Invalid supplement page: {page}")
        if item.get("coordinateSpace") != "pdf_points":
            raise ValueError(f"Invalid coordinate space on page {page}")
        if item.get("origin") != "top_left":
            raise ValueError(f"Invalid coordinate origin on page {page}")
        if len(item.get("points") or []) < 4:
            raise ValueError(f"Insufficient supplement points on page {page}")

        charts[page] = item
        added.append(page)

    base["charts"] = [
        charts[page]
        for page in sorted(charts)
    ]

    atomic_json(base_path, base)

    print(json.dumps({
        "mergedPages": added,
        "calibratedCharts": len(base["charts"]),
    }))


if __name__ == "__main__":
    main()
