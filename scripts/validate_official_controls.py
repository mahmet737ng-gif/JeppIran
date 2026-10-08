#!/usr/bin/env python3
"""Validate published WGS84 controls WITHOUT synthesising absent coordinates.

Printed coordinate precision is not survey accuracy.  A table with only
0.1-minute stand coordinates has ~185m north/south resolution and must not
be promoted to stand-level moving-map data.
"""
import argparse
import json
import math
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse

DMS = re.compile(r"^(\d{2,3})(\d{2})(\d{2}(?:\.\d+)?)([NSEW])$")
KINDS = {"RUNWAY_THRESHOLD", "ARP", "VOR", "DME", "NDB",
         "PARKING_STAND", "TAXIWAY_CONTROL", "FIX"}
# Maximum published coordinate resolution to qualify as a potential
# source control for an accurate airport ground map; *not* an accuracy claim.
GROUND_MAX_RESOLUTION_M = 5.0


def parse_dms(value, *, latitude):
    """Return (degrees, printed resolution in arcseconds); no rounding."""
    if not isinstance(value, str):
        raise ValueError("Coordinate must be printed DMS text")
    match = DMS.fullmatch(value.strip().upper())
    if not match:
        raise ValueError("Unsupported published DMS: " + str(value))
    degrees, minutes, seconds, hemi = match.groups()
    if latitude != (hemi in "NS"):
        raise ValueError("Latitude/longitude hemisphere mismatch")
    if int(minutes) > 59 or float(seconds) >= 60:
        raise ValueError("Invalid DMS minute/second")
    if latitude and len(degrees) != 2 or not latitude and len(degrees) != 3:
        raise ValueError("Invalid published degrees format")
    result = int(degrees) + int(minutes) / 60 + float(seconds) / 3600
    if result > (90 if latitude else 180):
        raise ValueError("Coordinate outside WGS84 range")
    places = len(seconds.split(".")[1]) if "." in seconds else 0
    arcsec_resolution = 10.0 ** -places
    if hemi in "SW":
        result = -result
    return result, arcsec_resolution


def validate(data):
    if data.get("schemaVersion") != 1 or data.get("coordinateDatum") != "WGS84":
        raise ValueError("Unsupported source format or datum")
    points = data.get("points")
    if not isinstance(points, list):
        raise ValueError("Missing source control array")
    seen = set()
    checked = []
    for p in points:
        icao = p.get("airport", "")
        kind = p.get("featureType")
        name = p.get("featureId", "")
        key = (icao, kind, name)
        if not re.fullmatch("[A-Z]{4}", icao) or kind not in KINDS or not name:
            raise ValueError("Incomplete feature identity: " + str(key))
        if key in seen:
            raise ValueError("Duplicate published feature: " + str(key))
        seen.add(key)
        lat, lat_sec = parse_dms(p["latitude"], latitude=True)
        lon, lon_sec = parse_dms(p["longitude"], latitude=False)
        source = p.get("sourceUrl", "")
        parts = urlparse(source)
        if parts.scheme != "https" or not parts.netloc or not p.get("sourceDocument") or not p.get("sourceLocation"):
            raise ValueError("Missing HTTPS published source/provenance: " + str(key))
        # Coordinate precision ≠ geodetic correctness. It only prevents
        # treating a coarse rounded coordinate as surveyed stand position.
        resolution_m = max(30.87 * lat_sec,
                           30.87 * max(0.01, math.cos(math.radians(lat))) * lon_sec)
        fine_enough = resolution_m <= GROUND_MAX_RESOLUTION_M
        checked.append({**p, "latitudeDecimal": lat, "longitudeDecimal": lon,
                        "printedResolutionMetersApprox": round(resolution_m, 3),
                        "precisionEligibleForGroundMap": fine_enough,
                        "coordinateVerifiedAgainstSource": False})
    return checked


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", default="data/georeferencing/official-control-points.json")
    parser.add_argument("--index", help="Optional chart index JSON to audit ICAO coverage")
    parser.add_argument("--output")
    args = parser.parse_args()
    root = json.loads(Path(args.source).read_text(encoding="utf-8"))
    checked = validate(root)
    by_icao = Counter(p["airport"] for p in checked)
    known = set(by_icao)
    if args.index:
        index = json.loads(Path(args.index).read_text(encoding="utf-8"))
        if isinstance(index, dict):
            index = index["charts"]
        known |= {p["airport"] for p in index}
    report = {
        "publishedControlRecords": len(checked),
        "coordinateDatum": "WGS84",
        "airportsWithControls": len(by_icao),
        "airportsWithoutControls": sorted(known - set(by_icao)),
        "eligibleResolutionCount": sum(p["precisionEligibleForGroundMap"] for p in checked),
        "note": ("Pass means provenance and DMS syntax validation ONLY. "
                 "It does NOT mean feature placement or positional "
                 "accuracy has been independently verified."),
        "points": checked,
    }
    out = json.dumps(report, indent=2, ensure_ascii=False)
    if args.output:
        Path(args.output).write_text(out + "\n", encoding="utf-8")
    print(out)


if __name__ == "__main__":
    main()
