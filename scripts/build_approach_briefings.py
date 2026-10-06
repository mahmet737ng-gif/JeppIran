#!/usr/bin/env python3
"""Generate compact approach briefing metadata from the active chart PDF.

The output is deliberately source-oriented: it extracts printed text and does not
invent procedure values. The chart remains authoritative.
"""
import argparse
import json
import re
from pathlib import Path

import fitz


def clean(value: str) -> str:
    return re.sub(r"\s+", " ", value or "").strip()


def frequencies(text: str):
    values = []
    for m in re.finditer(r"(?<!\d)(1(?:0[8-9]|1\d|2\d|3[0-6])\.\d{1,3})(?!\d)", text):
        value = m.group(1)
        if value not in values:
            values.append(value)
    return values[:10]


def final_course(text: str) -> str:
    patterns = [
        r"(?:Final\s+Apch\s+Crs|Final\s+Approach\s+Course)\s*[:\-]?\s*(\d{3})(?:°|\b)",
        r"(?:LOC|ILS)\s+COURSE\s*[:\-]?\s*(\d{3})(?:°|\b)",
        r"FINAL\s+COURSE\s*[:\-]?\s*(\d{3})(?:°|\b)",
    ]
    for pattern in patterns:
        m = re.search(pattern, text, flags=re.I)
        if m:
            return m.group(1) + "°"
    return ""


def section_after(text: str, labels, max_chars: int) -> str:
    for label in labels:
        m = re.search(label, text, flags=re.I)
        if not m:
            continue
        chunk = text[m.end():m.end() + max_chars]
        # Stop at common next-section headings where possible.
        chunk = re.split(
            r"\b(?:CHANGES:|Circle-to-Land|STRAIGHT-IN LANDING|MINIMUMS|ALTERNATE MINS|AIRPORT BRIEFING)\b",
            chunk,
            maxsplit=1,
            flags=re.I,
        )[0]
        return clean(chunk)
    return ""


def minima_summary(text: str) -> str:
    # Keep a short, literal source fragment rather than attempting operational
    # interpretation of Jeppesen minima tables.
    for label in [
        r"STRAIGHT-IN\s+LANDING",
        r"DA\(H\)",
        r"MDA\(H\)",
        r"MINIMUMS",
    ]:
        m = re.search(label, text, flags=re.I)
        if m:
            start = max(0, m.start() - 24)
            return clean(text[start:start + 320])
    return ""


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default="Iran2620.pdf")
    parser.add_argument("--index", default="app/src/main/assets/charts-current.json")
    parser.add_argument("--output", default="app/src/main/assets/approach-briefings.json")
    args = parser.parse_args()

    index = json.loads(Path(args.index).read_text())
    doc = fitz.open(args.pdf)
    output = []

    for chart in index:
        category = str(chart.get("category", "")).strip().upper()
        if category not in {"APPROACH", "APP"}:
            continue
        page_no = int(chart["page"])
        page = doc[page_no - 1]
        text = page.get_text("text")
        output.append(
            {
                "page": page_no,
                "airport": chart.get("airport", ""),
                "chart_number": chart.get("chart_number", ""),
                "name": chart.get("name", ""),
                "frequencies": frequencies(text),
                "course": final_course(text),
                "minimums": minima_summary(text),
                "missed_approach": section_after(
                    text,
                    [r"MISSED\s+APCH\s*:", r"MISSED\s+APPROACH\s*:"],
                    520,
                ),
            }
        )

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"approachBriefings": len(output), "output": args.output}, indent=2))


if __name__ == "__main__":
    main()
