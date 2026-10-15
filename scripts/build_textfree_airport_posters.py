#!/usr/bin/env python3
"""Generate text-free DISPLAY copies of JEPPIRAN's 50 locked airport posters.

The source files and their published SHA-256 manifest are NEVER modified.
Only the dark lower-left caption zone is rebuilt as a soft midnight vignette.
Run before Pages packaging, so the original night airport and landmarks
outside that small owner-approved zone are pixel-identical in the input.
The typography is recreated with live HTML/CSS on top of these image copies.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
SRC = ROOT / "web" / "airport-profile-posters"
DST = ROOT / "web" / "airport-profile-posters-textfree"
MANIFEST = SRC / "manifest.json"


def smoothstep(value: float) -> float:
    value = max(0.0, min(1.0, value))
    return value * value * (3.0 - 2.0 * value)


def clean(source: Path, target: Path) -> tuple[int, int]:
    with Image.open(source) as original:
        original_rgb = original.convert("RGB")
    w, h = original_rgb.size
    if w < 500 or h < 350:
        raise ValueError(f"Unsupported poster dimensions: {source.name} {w}x{h}")
    # The AI-generated printed title block sits at the bottom LEFT, from
    # about 70% of photo height. Preserve the airport field and skyline right.
    # Inpainting a huge solid block causes severe artificial streaks; a feathered
    # midnight-vignette repair has no synthesized buildings/runways whatsoever.
    overlay = Image.new("RGB", (w, h), (5, 18, 32))
    alpha = Image.new("L", (w, h), 0)
    mask = alpha.load()
    for y in range(int(h * .630), h):
        v = smoothstep((y / h - .630) / .073)
        if v <= 0:
            continue
        for x in range(int(w * .591)):
            hx = 1.0 - smoothstep((x / w - .445) / .146)
            a = int(round(255 * v * hx))
            if a:
                mask[x, y] = a
    out = Image.composite(overlay, original_rgb, alpha)
    target.parent.mkdir(parents=True, exist_ok=True)
    out.save(target, format="WEBP", quality=95, method=6)
    return (w, h)


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    files = manifest["files"]
    if manifest["expectedCount"] != 50 or len(files) != 50 or not manifest["ownerLocked"]:
        raise RuntimeError("Approved immutable original 50-image manifest differs")
    seen = set()
    for icao, item in sorted(files.items()):
        source = SRC / item["file"]
        target = DST / item["file"]
        if source.name != f"{icao}.webp":
            raise RuntimeError(f"ICAO filename mismatch: {icao}")
        blob = source.read_bytes()
        if hashlib.sha256(blob).hexdigest() != item["sha256"]:
            raise RuntimeError(f"ORIGINAL SOURCE MODIFIED: {icao}")
        if args.check:
            if not target.is_file():
                raise RuntimeError(f"Missing clean display derivative: {icao}")
            with Image.open(target) as im:
                im.verify()
        else:
            clean(source, target)
        seen.add(target.name)
    extras = {x.name for x in DST.glob("*.webp")} - seen
    if extras:
        raise RuntimeError(f"Unknown text-free poster files: {sorted(extras)}")
    print(f"PASS: {len(seen)} text-free posters generated/checked; all original source hashes unchanged.")


if __name__ == "__main__":
    main()
