#!/usr/bin/env python3
"""Fail-closed Approach + Airport-plan georeference and region coverage report.

An automatic graticule fit is NOT called an independently verified map.
An ADC parking inset needs its own independently verified region before the
page can be counted as fully covered. No chart is silently removed from scope.
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


def reviewed_entry(item):
    if isinstance(item, bool):
        return {"layout": item, "regions": ["main"] if item else []}
    if not isinstance(item, dict) or type(item.get("layout")) is not bool:
        raise ValueError("Airport review entry must be bool or {layout: bool, regions: [...]} object")
    regions = item.get("regions", ["main"] if item["layout"] else [])
    if (not isinstance(regions, list) or
            any(not isinstance(x, str) or not re.fullmatch(r"[A-Za-z][A-Za-z0-9_-]{0,63}", x)
                for x in regions) or len(regions) != len(set(regions)) or
            (item["layout"] and not regions) or (not item["layout"] and regions)):
        raise ValueError("Invalid region IDs in Airport review entry")
    return {"layout": item["layout"], "regions": regions}


def classify(index, explicit):
    approach = []
    airport = []
    unreviewed = []
    for entry in index:
        page = int(entry["page"])
        category = str(entry.get("category") or "").strip().lower()
        if category == "approach":
            approach.append((entry, ["main"]))
        elif category == "airport":
            if str(page) in explicit:
                item = reviewed_entry(explicit[str(page)])
                if item["layout"]:
                    airport.append((entry, item["regions"]))
            else:
                unreviewed.append({
                    "page": page, "airport": entry.get("airport"),
                    "name": entry.get("name"),
                    "layoutCandidate": bool(LAYOUT_TITLE.search(str(entry.get("name") or ""))),
                })
    return approach, airport, unreviewed


def status_for_page(required, actual):
    if not actual:
        return "missing"
    by_region = {str(a.get("regionId") or "main"): a for a in actual}
    if any(name not in by_region for name in required):
        return "missingRegions"
    for name in required:
        item = by_region[name]
        validation = item.get("validation") or {}
        if (validation.get("carryForwardApproved") is True and
                validation.get("verifiedUnchangedAgainstPreviousSource") is True and
                validation.get("reusedUnchangedSource") is True):
            # Unchanged prior calibration retains its historical approval.
            # It is NOT promoted to independent current-cycle accuracy QA.
            return "legacyApprovedUnchanged"
        if validation.get("verificationStatus") == "provisional_geometry_only":
            return "provisionalNeedsReview"
        if validation.get("method") == "single_axis_plus_conformal_scale":
            return "derivedAxisNotAccepted"
        if (validation.get("method") != "published_wgs84_control_points_affine" or
                validation.get("verificationStatus") != "passed_independent_control_checks" or
                not validation.get("pixelMeasurementsReviewed") or
                validation.get("groundControlCount", 0) < 4 or
                not item.get("verifiedFootprint")):
            return "geometryWithoutIndependentCheck"
    return "independentlyVerified"


def summarize(selected, georef, excluded):
    counts = {
        "totalPages": len(selected),
        "independentlyVerified": 0,
        "legacyApprovedUnchanged": 0,
        "geometryWithoutIndependentCheck": 0,
        "provisionalNeedsReview": 0,
        "derivedAxisNotAccepted": 0,
        "missingRegions": 0,
        "missing": 0,
        "requiredRegions": sum(len(ids) for _, ids in selected),
        "issues": [],
    }
    for entry, region_ids in selected:
        page = int(entry["page"])
        records = georef.get(page, [])
        state = status_for_page(region_ids, records)
        counts[state] += 1
        if state != "independentlyVerified":
            found = {str(r.get("regionId") or "main") for r in records}
            counts["issues"].append({
                "page": page, "airport": entry.get("airport"),
                "name": entry.get("name"), "state": state,
                "expectedRegions": region_ids, "foundRegions": sorted(found),
                "missingRegions": sorted(set(region_ids) - found),
                "extractorReason": (excluded.get(page) or {}).get("reason"),
            })
    count = counts["totalPages"]
    counts["independentlyVerifiedPercent"] = (
        round(100 * counts["independentlyVerified"] / count, 2) if count else None
    )
    counts["previouslyApprovedOrIndependentlyVerifiedPercent"] = (
        round(100 * (counts["independentlyVerified"] + counts["legacyApprovedUnchanged"]) / count, 2)
        if count else None
    )
    counts["complete"] = count > 0 and (
        counts["independentlyVerified"] + counts["legacyApprovedUnchanged"] == count
    )
    return counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--index", required=True)
    parser.add_argument("--georef", required=True)
    parser.add_argument("--audit", default="")
    parser.add_argument("--airport-layout-review", default="",
                        help="JSON {page: bool | {layout: bool, regions: [IDs]}}")
    parser.add_argument("--output", default="")
    parser.add_argument("--strict", action="store_true",
                        help="Fail if any required region is unverified or any Airport page is unreviewed")
    args = parser.parse_args()
    index = read(args.index)
    if isinstance(index, dict):
        index = index["charts"]
    root = read(args.georef)
    georef = defaultdict(list)
    for item in root["charts"]:
        georef[int(item["page"])].append(item)
    excluded = ({int(x["page"]): x for x in read(args.audit)["excludedCharts"]}
                if args.audit else {})
    explicit = read(args.airport_layout_review) if args.airport_layout_review else {}
    if not isinstance(explicit, dict) or any(not str(k).isdigit() for k in explicit):
        raise ValueError("Review must be a JSON object indexed by global PDF page")
    # Prevent a review for a different cycle from accidentally certifying 2621.
    valid_airport_pages = {
        str(int(x["page"])) for x in index if str(x.get("category")).lower() == "airport"
    }
    if not set(explicit).issubset(valid_airport_pages):
        raise ValueError("Airport review references missing or non-Airport pages")
    approach, airport, unreviewed = classify(index, explicit)
    report = {
        "source": root.get("source", {}),
        "approach": summarize(approach, georef, excluded),
        "airportLayouts": summarize(airport, georef, excluded),
        "unreviewedAirportPages": unreviewed,
        "layoutReviewComplete": not unreviewed,
        "canClaim100Percent": False,
        "notes": [
            "Previously approved unchanged charts may retain legacy approval, separately counted from independent GCP checks.",
            "Only separately validated published-WGS84 map regions count as independently verified.",
            "An inset may share a global source PDF page but requires a distinct region ID and independent transform.",
            "NOT TO SCALE labeling is region-specific and must never invalidate an unrelated verified plan.",
            "No missing chart or region is filled with guessed, computed-radial, or assumed coordinates.",
        ],
    }
    report["canClaim100Percent"] = (
        report["layoutReviewComplete"] and report["approach"]["complete"]
        and report["airportLayouts"]["complete"]
    )
    report["canClaim100PercentIndependentlyVerified"] = (
        report["layoutReviewComplete"] and
        all(
            report[k]["totalPages"] > 0 and
            report[k]["independentlyVerified"] == report[k]["totalPages"]
            for k in ("approach", "airportLayouts")
        )
    )
    rendered = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(rendered + "\n", encoding="utf-8")
    print(rendered)
    if args.strict and not report["canClaim100Percent"]:
        raise SystemExit(2)


if __name__ == "__main__":
    main()
