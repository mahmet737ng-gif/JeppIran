#!/usr/bin/env python3
"""Report coverage without conflating provisional geometry with verified georeferencing.

Approach pages are all in scope. Airport layout pages are either explicitly
identified in a review file or suggested by their titles. All other Airport
pages remain an explicit review backlog; they must not silently disappear
from a claimed 100% coverage statistic.
"""
import argparse
import json
import re
from collections import defaultdict
from pathlib import Path

LAYOUT_TITLE = re.compile(
    r"\b(?:ADC|PDC|DIAGRAM|AIRPORT CHART|PARKING|DOCKING|"
    r"TAXI(?:WAY| ROUTE| ROUTES)?|PUSHBACK|APRON|RAMP|"
    r"HOT SPOTS?|STANDS?|GROUND MOVEMENT|INS COORDINATES)\b",
    re.IGNORECASE,
)


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def selection(index, explicit):
    approach = []
    airport_layout = []
    airport_needs_review = []
    for item in index:
        category = str(item.get("category") or "").strip().lower()
        page = int(item["page"])
        if category == "approach":
            approach.append(item)
        elif category == "airport":
            if str(page) in explicit:
                if explicit[str(page)]:
                    airport_layout.append(item)
            elif LAYOUT_TITLE.search(str(item.get("name") or "")):
                airport_layout.append(item)
            else:
                airport_needs_review.append(item)
    return approach, airport_layout, airport_needs_review


def summarize(entries, georef, excluded):
    counts = {"total": len(entries), "geometryValidated": 0,
              "provisionalNeedsReview": 0, "missing": 0}
    details = []
    for entry in entries:
        page = int(entry["page"])
        record = georef.get(page)
        status = ("missing" if record is None else
                  "provisionalNeedsReview" if
                  record.get("validation", {}).get("verificationStatus")
                  == "provisional_geometry_only" else "geometryValidated")
        counts[status] += 1
        if status != "geometryValidated":
            failure = excluded.get(page) or {}
            details.append({
                "page": page, "airport": entry.get("airport"),
                "name": entry.get("name"), "status": status,
                "reason": failure.get("reason") or
                          ("Independent feature review required" if record
                           else "No georeference record"),
            })
    counts["geometryCoveragePercent"] = round(
        100 * (counts["geometryValidated"] + counts["provisionalNeedsReview"])
        / counts["total"], 2) if counts["total"] else None
    counts["verifiedGeometryPercent"] = round(
        100 * counts["geometryValidated"] / counts["total"], 2
    ) if counts["total"] else None
    counts["issues"] = details
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", required=True)
    parser.add_argument("--georef", required=True)
    parser.add_argument("--audit", default="")
    parser.add_argument("--airport-layout-review", default="",
                        help="Optional JSON map from page number to true/false")
    parser.add_argument("--output", default="")
    parser.add_argument("--strict", action="store_true",
                        help="Fail if there is missing, provisional or unreviewed coverage")
    args = parser.parse_args()
    index = read(args.index)
    if isinstance(index, dict):
        index = index["charts"]
    root = read(args.georef)
    georef = {int(x["page"]): x for x in root["charts"]}
    excluded = ({int(x["page"]): x for x in read(args.audit)["excludedCharts"]}
                if args.audit else {})
    explicit = read(args.airport_layout_review) if args.airport_layout_review else {}
    if not isinstance(explicit, dict) or any(
        type(value) is not bool for value in explicit.values()
    ):
        raise ValueError("Airport layout review must be a {page: boolean} JSON map")
    approach, airport_layout, unknown = selection(index, explicit)
    report = {
        "source": root.get("source", {}),
        "approach": summarize(approach, georef, excluded),
        "airportLayoutCandidates": summarize(airport_layout, georef, excluded),
        "unreviewedAirportPages": [
            {"page": int(x["page"]), "airport": x.get("airport"),
             "name": x.get("name")} for x in unknown
        ],
        "notes": [
            "Printed-grid calibration is not independent positional verification.",
            "Provisional NOT TO SCALE records are not ready for aircraft display.",
            "Airport layout candidates need visual confirmation before a 100% claim.",
        ],
    }
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if args.strict and (
        any(report[key][status] for key in ("approach", "airportLayoutCandidates")
            for status in ("missing", "provisionalNeedsReview"))
        or unknown
    ):
        raise SystemExit(2)


if __name__ == "__main__":
    main()
