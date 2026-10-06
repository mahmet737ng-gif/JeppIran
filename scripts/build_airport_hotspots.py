#!/usr/bin/env python3
import argparse
import json
import re
from pathlib import Path

import fitz


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default="Iran2620.pdf")
    parser.add_argument("--index", default="app/src/main/assets/charts-current.json")
    parser.add_argument("--output", default="app/src/main/assets/airport-hotspots.json")
    args = parser.parse_args()

    index = json.loads(Path(args.index).read_text())
    doc = fitz.open(args.pdf)
    output = []
    seen = set()

    hotspot_re = re.compile(r"\b(?:HOT\s*SPOT|HS\s*\d+[A-Z]?)\b", re.I)

    for chart in index:
        category = str(chart.get("category", "")).strip().upper()
        if category != "AIRPORT":
            continue
        page_no = int(chart.get("page", 0) or 0)
        if page_no <= 0 or page_no > len(doc):
            continue
        text = doc[page_no - 1].get_text("text")
        for match in hotspot_re.finditer(text):
            start = max(0, match.start() - 120)
            end = min(len(text), match.end() + 280)
            snippet = clean(text[start:end])
            if not snippet:
                continue
            key = (chart.get("airport", ""), page_no, snippet)
            if key in seen:
                continue
            seen.add(key)
            output.append({
                "airport": chart.get("airport", ""),
                "page": page_no,
                "chart_number": chart.get("chart_number", ""),
                "chart_name": chart.get("name", ""),
                "label": clean(match.group(0)).upper(),
                "snippet": snippet,
                "source": "printed_airport_chart_text"
            })

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps({"hotspots": len(output), "output": args.output}, indent=2))


if __name__ == "__main__":
    main()
