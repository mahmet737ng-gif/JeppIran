#!/usr/bin/env python3
"""Merge exact published-control map regions into a same-source chart-georef.

Fail closed on source/version mismatch or duplicate region identifiers.
Provisional or derived-axis geometry is not promoted into independently
verified data. Preserve reliable older records for a staged review, but a
strict 100% auditor will still reject them until independent checks exist.
"""
import argparse
import json
from pathlib import Path


def load(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def key(record):
    return int(record["page"]), record.get("regionId") or "main"


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--base", required=True)
    parser.add_argument("--verified", required=True)
    parser.add_argument("--index", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    base, verified = load(args.base), load(args.verified)
    idx = load(args.index)
    if isinstance(idx, dict):
        idx = idx["charts"]
    pages = {int(c["page"]): c for c in idx}

    if (base.get("version") != 2 or verified.get("version") != 2 or
            base["source"] != verified["source"] or
            base.get("coordinateSystem") != "WGS84" or
            verified.get("coordinateSystem") != "WGS84" or
            base.get("origin") != "top_left" or
            verified.get("origin") != "top_left"):
        raise ValueError("Cannot combine records from different PDFs/cycles/datums")
    merged = {}
    for record in base["charts"]:
        item = dict(record)
        page, region = key(item)
        if page not in pages or (page, region) in merged:
            raise ValueError("Missing index or duplicated original page-region identity")
        if item.get("airport") != pages[page]["airport"]:
            raise ValueError("Airport/source identity mismatch")
        if not item.get("regionId"):
            item["regionId"] = "main"
            item["regionType"] = "main"
        merged[(page, region)] = item

    promoted = []
    for record in verified["charts"]:
        page, region = key(record)
        ident = (page, region)
        validation = record.get("validation") or {}
        if page not in pages or record.get("airport") != pages[page]["airport"]:
            raise ValueError("Official-control page does not match chart index")
        if validation.get("method") != "published_wgs84_control_points_affine":
            raise ValueError("Only reviewed published-control calibrations may supersede old regions")
        if validation.get("verificationStatus") != "passed_independent_control_checks":
            raise ValueError("Cannot merge unchecked or provisional surveyed geometry")
        if validation.get("groundControlCount", 0) < 4 or not record.get("verifiedFootprint"):
            raise ValueError("Missing independently checked control footprint")
        if ident in promoted:
            raise ValueError("Duplicated exact-survey region")
        promoted.append(ident)
        merged[ident] = record

    result = {
        "version": 2,
        "coordinateSystem": "WGS84",
        "coordinateSpace": "pdf_points",
        "origin": "top_left",
        "source": base["source"],
        "charts": [merged[k] for k in sorted(merged)]
    }
    report = {
        "inputBaseRegionCount": len(base["charts"]),
        "inputVerifiedRegionCount": len(verified["charts"]),
        "mergedRegionCount": len(merged),
        "mergedPageCount": len({p for p, _ in merged}),
        "independentlyVerifiedRegions": len(promoted),
        "allIndexedPagesProcessed": False,
        "notACoverageCertification": True,
    }
    Path(args.output).write_text(json.dumps(result, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    Path(args.report).write_text(json.dumps(report, indent=2, ensure_ascii=False)+"\n", encoding="utf-8")
    print(json.dumps(report, indent=2))


if __name__ == "__main__":
    main()
