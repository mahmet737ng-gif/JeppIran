#!/usr/bin/env python3
"""JEPPIRAN reusable ADC survey input scanner (source-PDF vectors, NOT OCR).

Usage:
  pip install pymupdf
  python web/tools/scan_adc_vectors.py --pdf 2621.pdf --page 38 --icao OIAW \
    --inset 60,327,240,437 --out OIAW-page38-scan.json

This is an INVENTORY stage, not an autorouter. A reviewer must identify which
original Bezier strokes are taxiway centrelines, runway strips, parking leads
or annotation. Never connect stroke endpoints by proximity alone.
"""
import argparse
import hashlib
import json
from pathlib import Path
import fitz

def point(p):
    return [round(p.x, 3), round(p.y, 3)]

def scan(pdf, one_based_page, icao, clip):
    doc = fitz.open(str(pdf))
    if not 1 <= one_based_page <= len(doc):
        raise ValueError("Page outside PDF")
    page = doc[one_based_page - 1]
    area = fitz.Rect(clip) if clip else page.rect
    words = []
    for entry in page.get_text("words"):
        x0, y0, x1, y1, value = entry[:5]
        if not fitz.Rect(x0, y0, x1, y1).intersects(area):
            continue
        txt = str(value).strip()
        if txt:
            words.append({"text": txt,
                          "box": [round(x0, 3),round(y0, 3),
                                  round(x1, 3),round(y1, 3)]})
    strokes = []
    for ident, d in enumerate(page.get_drawings()):
        if not d["rect"].intersects(area):
            continue
        commands = []
        for e in d.get("items", []):
            if e[0] not in ("l", "c"):
                continue
            positions = [point(v) for v in e[1:] if isinstance(v, fitz.Point)]
            if len(positions) == (2 if e[0]=="l" else 4):
                commands.append([e[0], *positions])
        if commands:
            r = d["rect"]
            strokes.append({"pdfDrawingId": ident,
                "bounds": [round(r.x0,3),round(r.y0,3),round(r.x1,3),round(r.y1,3)],
                "stroke": d.get("color"), "fill": d.get("fill"),
                "width": round(d.get("width",0),3), "commands": commands})
    data = {
        "schemaVersion": 1, "icao": icao, "sourcePdf": pdf.name,
        "sha256": hashlib.sha256(pdf.read_bytes()).hexdigest(),
        "page": one_based_page, "pageCount": len(doc),
        "pdfPoints": [page.rect.width, page.rect.height],
        "clipRectPdfPoints": [area.x0, area.y0, area.x1, area.y1],
        "status": "INVENTORY_NOT_ROUTE_APPROVED",
        "candidateLabels": words, "sourceStrokes": strokes,
        "reviewRequired": [
            "Identify each actual physical runway black strip and its paired ends",
            "Separate graph centerlines from apron edges, building outlines and text",
            "Label named taxiways; trace full curve through proper intersections",
            "Match numbered stands to real printed lead lines, not nearest-road snap",
            "Mark verified hold-short, runway gate and backtrack interfaces",
            "Run geometry and QA tests before enabling chart overlays",
        ]
    }
    return data

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--page", type=int, required=True)
    parser.add_argument("--icao", required=True)
    parser.add_argument("--inset", help="Optional PDF-point crop: left,top,right,bottom")
    parser.add_argument("--out", required=True)
    args = parser.parse_args()
    airport = args.icao.strip().upper()
    if len(airport)!=4 or not airport.isalpha():
        parser.error("ICAO must be exactly four letters")
    clip = None
    if args.inset:
        try: clip = [float(v) for v in args.inset.split(",")]
        except ValueError: parser.error("--inset needs four PDF-point numbers")
        if len(clip)!=4 or clip[2]<=clip[0] or clip[3]<=clip[1]:
            parser.error("--inset needs left,top,right,bottom")
    info = scan(Path(args.pdf), args.page, airport, clip)
    dest = Path(args.out);dest.parent.mkdir(parents=True, exist_ok=True)
    dest.write_text(json.dumps(info,indent=2)+"\n", encoding="utf-8")
    print(f"{airport} ADC source scan: {len(info['candidateLabels'])} words, "
          f"{len(info['sourceStrokes'])} vector strokes, page {args.page}; "
          "route geometry remains unapproved")

if __name__ == "__main__":
    main()
