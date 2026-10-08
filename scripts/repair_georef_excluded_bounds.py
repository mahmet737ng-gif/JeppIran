#!/usr/bin/env python3
"""Remove impossible exclusion masks from chart georeference data."""
import argparse
import json
import os
import tempfile
from pathlib import Path


def contains(area, point):
    return (
        area["left"] <= point["x"] <= area["right"]
        and area["top"] <= point["y"] <= area["bottom"]
    )


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("path")
    args = parser.parse_args()

    path = Path(args.path)
    root = json.loads(path.read_text(encoding="utf-8"))

    repaired = []
    for chart in root.get("charts", []):
        points = chart.get("points") or []
        masks = chart.get("excludedBounds") or []
        safe = []
        removed = 0

        for area in masks:
            if points and all(contains(area, point) for point in points):
                removed += 1
                continue
            safe.append(area)

        if removed:
            chart["excludedBounds"] = safe
            repaired.append({
                "page": int(chart.get("page", -1)),
                "removedMasks": removed,
            })

    fd, temp = tempfile.mkstemp(
        prefix=f".{path.name}.",
        suffix=".tmp",
        dir=path.parent,
    )
    try:
        with os.fdopen(fd, "w", encoding="utf-8") as stream:
            json.dump(root, stream, indent=2, ensure_ascii=False)
            stream.write("\n")
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temp, path)
    finally:
        if os.path.exists(temp):
            os.unlink(temp)

    print(json.dumps({
        "repairedImpossibleExcludedBounds": repaired,
        "count": len(repaired),
    }))


if __name__ == "__main__":
    main()
