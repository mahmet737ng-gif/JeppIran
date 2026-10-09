#!/usr/bin/env python3
"""Build a directional runway directory from OurAirports for JeppIran.

OurAirports headings are TRUE if supplied; they are not magnetic/ADC headings.
Missing source values remain null. No heading is inferred from a RWY number.
"""
import argparse
import csv
import io
import json
import re
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/runways.csv"
# User-corrected V2621 OIAA geographic heading, no magnetic variation added.
# RWY 32L is 324 degrees; reciprocal RWY 14R is 144 degrees.
# This is a user-supplied reference, NOT certified current AIP/ADC.
CONFIRMED_TRUE = {("OIAA", "32L"): 324.0, ("OIAA", "14R"): 144.0}


def numeric(raw, low, high):
    if raw is None or str(raw).strip() == "":
        return None
    try:
        n = float(raw)
        return n if low <= n <= high else None
    except (TypeError, ValueError):
        return None

def source_rows(source=None):
    if source:
        with open(source, newline="", encoding="utf-8-sig") as stream:
            yield from csv.DictReader(stream)
        return
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(URL, headers={"User-Agent": "JeppIran-RunwayMetadata/1.0"})
            with urllib.request.urlopen(request, timeout=90) as response:
                raw = response.read()
            if len(raw) < 100000:
                raise ValueError("runways.csv appears incomplete")
            with io.StringIO(raw.decode("utf-8-sig")) as stream:
                yield from csv.DictReader(stream)
            return
        except Exception as exc:
            error = exc
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError("Could not download runways.csv") from error

def build(manifest_path, source=None):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    selected = set(manifest["airports"])
    grouped = {code: [] for code in selected}
    with_heading = 0
    for row in source_rows(source):
        icao = (row.get("airport_ident") or "").strip().upper()
        if icao not in selected or row.get("closed") == "1":
            continue
        length_ft = numeric(row.get("length_ft"), 100, 25000)
        width_ft = numeric(row.get("width_ft"), 10, 1000)
        pair = [(row.get("le_ident"),row.get("he_ident"),row.get("le_heading_degT")),
                (row.get("he_ident"),row.get("le_ident"),row.get("he_heading_degT"))]
        for ident, opposite, heading in pair:
            ident = (ident or "").strip().upper()
            opposite = (opposite or "").strip().upper()
            if not re.fullmatch(r"\d{2}[LRC]?", ident) and not re.fullmatch(r"\d{2}", ident):
                continue
            true = numeric(heading, 0, 360)
            approved = CONFIRMED_TRUE.get((icao, ident))
            if approved is not None:
                true = approved
            if true == 360:
                true = 0.0
            runway = {
                "name": ident,
                "opposite": opposite if re.fullmatch(r"\d{2}[LRC]?", opposite) else "",
                "headingTrue": round(true, 2) if true is not None else None,
                "headingMag": None,
                "length": round(length_ft * 0.3048) if length_ft is not None else None,
                "width": round(width_ft * 0.3048) if width_ft is not None else None,
                "lengthFt": round(length_ft) if length_ft is not None else None,
                "widthFt": round(width_ft) if width_ft is not None else None,
                "surface": (row.get("surface") or "").strip() or None,
                "source": ("User-approved V2621 OIAA ADC annotation — TRUE bearing; verify current AIP"
                           if approved is not None else "OurAirports community data — verify current ADC/AIP"),
            }
            grouped[icao].append(runway)
            with_heading += true is not None
    for icao in grouped:
        unique = {}
        for rwy in grouped[icao]:
            key = (rwy["name"], rwy["opposite"], rwy["lengthFt"])
            unique[key] = rwy
        grouped[icao] = sorted(unique.values(), key=lambda d: (d["name"],d["opposite"]))
    populated = {icao:rows for icao,rows in sorted(grouped.items()) if rows}
    return {
        "cycle": manifest["version"],
        "source_url": URL,
        "updated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notice": "Community source, not certified ADC. Headings are TRUE only and never converted to magnetic without verified variation.",
        "airport_count": len(selected),
        "runway_airport_count": len(populated),
        "runway_direction_count": sum(map(len, populated.values())),
        "directions_with_true_heading": with_heading,
        "missing_icaos": sorted(selected - set(populated)),
        "airports": populated,
    }

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", default="app/src/main/assets/charts-manifest.json")
    p.add_argument("--runways-file")
    p.add_argument("--output", default="web/data/airport-runways.json")
    a = p.parse_args()
    data = build(a.manifest, a.runways_file)
    if not data["runway_direction_count"]:
        raise SystemExit("No runway records: refusing to deploy incomplete runway dataset")
    path = Path(a.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print("JeppIran runway airports: {}/{}".format(data["runway_airport_count"], data["airport_count"]))
    print("Runway directions: {} ({} TRUE headings available)".format(data["runway_direction_count"], data["directions_with_true_heading"]))
    print("Without runway records:", ", ".join(data["missing_icaos"]) or "none")

if __name__ == "__main__":
    main()
