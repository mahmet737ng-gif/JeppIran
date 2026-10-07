#!/usr/bin/env python3
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
    parser.add_argument("overrides")
    args = parser.parse_args()

    base_path = Path(args.base)
    override_path = Path(args.overrides)
    base = json.loads(base_path.read_text(encoding="utf-8"))
    override = json.loads(override_path.read_text(encoding="utf-8"))

    if override.get("schema") != 1:
        raise ValueError("Unsupported georeference override schema")

    source = base.get("source") or {}
    if override.get("chartDataVersion") != source.get("chartDataVersion"):
        raise ValueError("Georeference override data version mismatch")
    if override.get("sourceSha256") != source.get("sha256"):
        raise ValueError("Georeference override source PDF mismatch")

    charts = {
        int(item["page"]): item
        for item in base.get("charts", [])
    }

    applied = []
    seen = set()
    for item in override.get("charts", []):
        page = int(item.get("page", -1))
        if page <= 0 or page in seen:
            raise ValueError(f"Invalid or duplicate override page: {page}")
        seen.add(page)

        if item.get("coordinateSpace") != "pdf_points":
            raise ValueError(f"Invalid coordinate space on page {page}")
        if item.get("origin") != "top_left":
            raise ValueError(f"Invalid coordinate origin on page {page}")
        if len(item.get("points") or []) < 4:
            raise ValueError(f"Insufficient override control points on page {page}")

        charts[page] = item
        applied.append(page)

    base["charts"] = [
        charts[page]
        for page in sorted(charts)
    ]
    atomic_json(base_path, base)

    print(json.dumps({
        "appliedOverrides": applied,
        "calibratedCharts": len(base["charts"]),
    }))


if __name__ == "__main__":
    main()
