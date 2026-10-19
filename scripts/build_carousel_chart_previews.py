#!/usr/bin/env python3
"""Build lightweight, source-verified JeppIran Carousel previews.

The source PDF remains untouched. Each published chart gets one low-resolution
JPEG; browsing never needs to download the full PDF. Full Classic loads the
unchanged source only on explicit user action. No screenshot/cropped mock data.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path

import fitz
from PIL import Image

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "web/data/charts-manifest.json"
INDEX = ROOT / "web/data/charts-current.json"
PDF_DIR = ROOT / "web/charts"
OUT = ROOT / "web/chart-previews"


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--airport", help="Build one airport for development; default all 78")
    parser.add_argument("--verify", action="store_true", help="Check that every indexed page has a thumbnail")
    args = parser.parse_args()

    airports = json.loads(MANIFEST.read_text(encoding="utf-8"))["airports"]
    rows = json.loads(INDEX.read_text(encoding="utf-8"))
    if len(airports) != 78:
        raise RuntimeError(f"Unexpected airport catalog: {len(airports)} (expected 78)")
    if not rows:
        raise RuntimeError("Empty chart index")

    grouped = {}
    for row in rows:
        icao = row["airport"]
        if args.airport and icao != args.airport:
            continue
        if icao not in airports:
            raise RuntimeError(f"Unexpected airport in chart catalog: {icao}")
        pdf_page = int(row["pdf_page"])
        global_pages = airports[icao].get("global_pages", [])
        if pdf_page <= 0 or pdf_page > len(global_pages) or int(global_pages[pdf_page - 1]) != int(row["page"]):
            raise RuntimeError(f"Chart/page mapping mismatch: {icao} {pdf_page}")
        grouped.setdefault(icao, set()).add(pdf_page)

    output_count = 0
    output_bytes = 0
    for icao, pages in sorted(grouped.items()):
        source = PDF_DIR / airports[icao].get("file", icao + ".pdf")
        if not source.exists() and not args.verify:
            raise FileNotFoundError(source)
        dest = OUT / icao
        if not args.verify:
            dest.mkdir(parents=True, exist_ok=True)
        if args.verify:
            for page_no in pages:
                target = dest / f"{page_no}.jpg"
                if target.stat().st_size < 1500:
                    raise RuntimeError(f"Missing/empty chart preview: {target}")
                output_count += 1
            continue

        with fitz.open(source) as doc:
            for page_no in sorted(pages):
                if page_no > doc.page_count:
                    raise RuntimeError(f"Missing PDF page {icao} {page_no} > {doc.page_count}")
                page = doc[page_no - 1]
                rect = page.rect
                scale = min(1.2, 570 / rect.width, 690 / rect.height)
                pix = page.get_pixmap(matrix=fitz.Matrix(scale, scale), colorspace=fitz.csRGB, alpha=False)
                im = Image.frombytes("RGB", (pix.width, pix.height), pix.samples)
                target = dest / f"{page_no}.jpg"
                im.save(target, "JPEG", quality=68, optimize=True, subsampling=0)
                output_bytes += target.stat().st_size
                output_count += 1
        print(f"{icao}: {len(pages)} verified pages", flush=True)

    expected = sum(len(pages) for pages in grouped.values())
    if output_count != expected:
        raise RuntimeError(f"Missing chart thumbnails: generated {output_count} / {expected}")
    print(
        f"PASS chart previews: {output_count} real chart pages, "
        f"{len(grouped)} airports, {output_bytes / (1024 * 1024):.1f} MiB",
        flush=True,
    )


if __name__ == "__main__":
    main()
