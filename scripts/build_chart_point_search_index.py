#!/usr/bin/env python3
"""Build a lightweight searchable fix index from the actual V2621 chart PDFs.

Only page-derived five-letter ICAO waypoint/fix identifiers are indexed, not
fabricated position data. Entries link to the immutable chart manifest pages.
Chart/procedure names are searched separately from charts-current.json.
"""
from __future__ import annotations
import argparse
import json
import re
from pathlib import Path
import fitz

ROOT = Path(__file__).resolve().parents[1]
MANIFEST = ROOT / "web/data/charts-manifest.json"
CHARTS = ROOT / "web/data/charts-current.json"
OUTPUT = ROOT / "web/data/chart-point-index-v2621.json"
WORDS = re.compile(r"(?<![A-Z])[A-Z]{5}(?![A-Z])")
# Common prose and chart metadata cannot be interpreted as named fixes.
IGNORE = set("""
ABOUT ABOVE AFTER AGAIN ALONG ANGLE APPLY APRON ATCIS BELOW BLOCK BREAK
BRIEF CHART CHECK CLEAR CLOSE CLOUD CODED CONTA COURSE CROSS DAILY DEGEE
DEGRE DEPART DEPTH DIRECT DISTA DMEGP EASTS EIGHT ENTER ERROR EXITS
FINAL FIRST FIXES FLAPS FLIGH FLIGT FLOOR FOLLOW FORCE FORMS FREQS
FROMA GENERAL GLIDE GPSAP GROUN GROUP GUIDE HEIGHT HOLDI HOURS
INBOU INCLD INDEX INNER INTER ISSUE JEPPES JEPPN KNOWN LABEL
LANDI LANDS LARGE LATER LEVEL LIMIT LOCAL LOWER MAGNE MAINT
METAR MINIM MODES NORTH NOTAM NOTES OTHER OUTBO OUTER PARTS
PILOT PLANS POINT POSIT POWER RADAR RADIO RANGE REFER RIGHT
ROUTE RULES RWYIN SCALE SCENE SHOWN SIDES SMALL SOUTH SPEED
STAND START STEEP STRIP TABLE TAFOR TEMPO TERMS THRES TIMES
TITLE TOTAL TRACK TRANS TRUEA TURNS TWYIN UNTIL UPPER VALID
VALUE VERTI VIAAS VORDE VORRW WATCH WATER WHERE WIDTH WINDS
YEARS
""".split())
# Exact ordinary words frequently found in PDFs.
IGNORE.update({
 "ABOVE","AFTER","BELOW","CHART","CHECK","CLEAR","CLOSE","CROSS",
 "FINAL","FIRST","FLIGHT","GLIDE","GROUP","INNER","LANDS","LEVEL",
 "LIMIT","LOCAL","NORTH","NOTES","OTHER","OUTER","POINT","RADAR",
 "RADIO","RANGE","RIGHT","ROUTE","SCALE","SHALL","SHOWN","SOUTH",
 "SPEED","START","TABLE","THERE","TRACK","UNTIL","UPPER","WHEN",
 "WHILE","WIDTH","WINDS","WORLD","THREE","REFER","ALONG","ABOUT",
 "BOUND","BASED","LINES","AREAS","LIGHT","NIGHT","AFTER","ALTIT",
 "AIRPT","AIRPO","DEPAR","PROCE","AIRCR","JEPPES","APPRC","RANGE",
})

def candidates(page: fitz.Page) -> set[str]:
    # Word positions are extracted from the published vector PDF, not the
    # thumbnail or page-number metadata. Text remains a locator, not a claim
    # that a navigation database confirms a fix exists.
    found: set[str] = set()
    for word in page.get_text("words", sort=True):
        token = str(word[4]).upper().strip()
        for hit in WORDS.findall(token):
            if hit not in IGNORE:
                found.add(hit)
    return found

def build(airport: str | None = None) -> dict:
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))["airports"]
    charts = json.loads(CHARTS.read_text(encoding="utf-8"))
    if len(manifest) != 78 or len(charts) != 1642:
        raise ValueError("Source chart cycle changed; regenerate and revalidate the search index")
    by_airport: dict[str, list[dict]] = {}
    for row in charts:
        if airport and row["airport"] != airport:
            continue
        by_airport.setdefault(row["airport"], []).append(row)
    out: dict[str, list[str]] = {}
    for icao, rows in sorted(by_airport.items()):
        filename = manifest[icao].get("file") or icao + ".pdf"
        pdf = ROOT / "web/charts" / filename
        if not pdf.is_file():
            raise FileNotFoundError(str(pdf))
        with fitz.open(pdf) as doc:
            for row in rows:
                page = int(row["pdf_page"])
                if not 1 <= page <= doc.page_count:
                    raise ValueError(f"Invalid PDF page {icao} {page}")
                if int(manifest[icao]["global_pages"][page - 1]) != int(row["page"]):
                    raise ValueError(f"Mismatch between manifest and chart row: {icao} {page}")
                terms = sorted(candidates(doc[page - 1]))
                if terms:
                    out[str(row["page"])] = terms
        print(f"{icao}: {len(rows)} charts scanned", flush=True)
    return {"cycle": "2621", "source": "published PDF text", "pages": out}

def main() -> None:
    p = argparse.ArgumentParser()
    p.add_argument("--airport")
    p.add_argument("--output", type=Path, default=OUTPUT)
    args = p.parse_args()
    result = build(args.airport)
    args.output.parent.mkdir(parents=True, exist_ok=True)
    args.output.write_text(json.dumps(result, separators=(",", ":"), ensure_ascii=False) + "\n", encoding="utf-8")
    print(f"PASS named-fix search index: {len(result['pages'])} nonempty chart pages", flush=True)

if __name__ == "__main__":
    main()
