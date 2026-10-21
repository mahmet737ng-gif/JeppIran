#!/usr/bin/env python3
"""Create Android-only portrait artwork from the 78 approved landscape posters.

Original WebP files and their SHA-256 locks remain untouched. These files are
DECORATIVE only: they must never be used for flight chart geometry. The source
has an airport-above-city composition; the portrait adaptation reframes its
sky, apron/runway and skyline areas into a vertical photographic composition.
Unlike CSS cover, this produces a real independent 9:16 file for each ICAO.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path

from PIL import Image, ImageDraw, ImageOps

SIZE = (768, 1365)
# Source and destination fractions: airport at top, skyline at bottom.
LAYERS = (
    (0.00, 0.31, 0.00, 0.285, 0.50),
    (0.17, 0.76, 0.245, 0.795, 0.50),
    (0.65, 1.00, 0.755, 1.00, 0.36),
)
FADE = 0.047


def sha256(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for data in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(data)
    return digest.hexdigest()


def portrait(source: Path, destination: Path) -> None:
    with Image.open(source) as image:
        original = image.convert("RGB")
    w, h = original.size
    if w < 500 or h < 300 or w <= h:
        raise ValueError(f"Not an approved landscape poster: {source.name} ({w}x{h})")
    result = Image.new("RGB", SIZE)
    for layer_index, (crop_top, crop_bottom, out_top, out_bottom, focus_x) in enumerate(LAYERS):
        region = original.crop((0, round(h * crop_top), w, round(h * crop_bottom)))
        y0, y1 = round(SIZE[1] * out_top), round(SIZE[1] * out_bottom)
        pane = ImageOps.fit(
            region, (SIZE[0], y1 - y0), method=Image.Resampling.LANCZOS,
            centering=(focus_x, 0.5),
        )
        if layer_index == 0:
            result.paste(pane, (0, y0))
        else:
            # Feather neighbouring scenic zones; do not add invented landmarks.
            fade = min(round(SIZE[1] * FADE), y1 - y0)
            mask = Image.new("L", pane.size, 255)
            painter = ImageDraw.Draw(mask)
            for offset in range(fade):
                painter.line((0, offset, SIZE[0], offset), fill=round(255 * offset / fade))
            result.paste(pane, (0, y0), mask)
    destination.parent.mkdir(parents=True, exist_ok=True)
    result.save(destination, "WEBP", quality=86, method=6)


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--source", required=True, type=Path)
    parser.add_argument("--output", required=True, type=Path)
    args = parser.parse_args()
    source_manifest = json.loads((args.source / "manifest.json").read_text())
    entries = source_manifest["files"]
    if source_manifest.get("expectedCount") != 78 or len(entries) != 78:
        raise RuntimeError("Expected exactly 78 owner-approved V3 posters")
    args.output.mkdir(parents=True, exist_ok=True)
    manifest = {"format": "image/webp", "size": list(SIZE), "source": "approved V3 landscapes",
                "expectedCount": len(entries), "files": {}}
    for icao, spec in sorted(entries.items()):
        source = args.source / spec["file"]
        if not source.is_file() or source.stat().st_size != spec["size"] or sha256(source) != spec["sha256"]:
            raise RuntimeError(f"Original poster SHA/size mismatch: {icao}")
        destination = args.output / f"{icao}.webp"
        portrait(source, destination)
        manifest["files"][icao] = {"file": destination.name, "size": destination.stat().st_size,
                                    "sha256": sha256(destination), "sourceSha256": spec["sha256"]}
    (args.output / "manifest.json").write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"PASS: {len(entries)} Android portrait posters, originals unchanged", flush=True)


if __name__ == "__main__":
    main()
