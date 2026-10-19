#!/usr/bin/env python3
"""Build a source-attributed ICAO airport profile index for JeppIran.

OurAirports is community-maintained public-domain data, not a substitute for
current AIP/ADC. Only copy published values; never infer unreported fields.
"""
import argparse
import csv
import io
import json
import time
import urllib.request
from datetime import datetime, timezone
from pathlib import Path

URL = "https://raw.githubusercontent.com/davidmegginson/ourairports-data/main/airports.csv"
CHART_PROFILES = Path(__file__).resolve().parents[1] / "app/src/main/assets/airport-profile-chart-overrides.json"
COUNTRIES = {
    "IR": "Iran", "TR": "Türkiye", "AE": "United Arab Emirates",
    "OM": "Oman", "IQ": "Iraq", "AM": "Armenia", "GE": "Georgia",
}

def number(value, minimum, maximum, integer=False):
    if value is None or str(value).strip() == "":
        return None
    try:
        n = float(value)
        if minimum <= n <= maximum:
            return int(n) if integer else round(n, 6)
    except (TypeError, ValueError, OverflowError):
        pass
    return None

def read_csv(path=None):
    if path is not None:
        with open(path, "r", encoding="utf-8-sig", newline="") as stream:
            yield from csv.DictReader(stream)
        return
    error = None
    for attempt in range(3):
        try:
            request = urllib.request.Request(URL, headers={"User-Agent": "JeppIran-AirportProfiles/1.0"})
            with urllib.request.urlopen(request, timeout=90) as response:
                data = response.read()
            if len(data) < 500000:
                raise ValueError("Airport source appears incomplete")
            with io.StringIO(data.decode("utf-8-sig")) as stream:
                yield from csv.DictReader(stream)
            return
        except Exception as exc:
            error = exc
            if attempt < 2:
                time.sleep(2 * (attempt + 1))
    raise RuntimeError("Unable to load OurAirports airports.csv") from error

def build(manifest_path, csv_path=None):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    desired = set(manifest["airports"])
    found = {}
    grades = {}
    for row in read_csv(csv_path):
        ident = (row.get("ident") or "").strip().upper()
        gps = (row.get("gps_code") or "").strip().upper()
        key = ident if ident in desired else gps if gps in desired else None
        if not key:
            continue
        grade = 2 if ident == key else 1
        if grade < grades.get(key, 0):
            continue
        if row.get("iso_country") not in COUNTRIES:
            continue
        record = {
            "source": "OurAirports community data — not an operational AIP",
            "country": COUNTRIES[row["iso_country"]],
        }
        name = (row.get("name") or "").strip()
        city = (row.get("municipality") or "").strip()
        iata = (row.get("iata_code") or "").strip().upper()
        if name:
            record["name"] = name
        if city:
            record["city"] = city
        if len(iata) == 3 and iata.isalpha():
            record["iata"] = iata
        for field, raw, bounds, is_int in [
            ("lat", "latitude_deg", (-90, 90), False),
            ("lon", "longitude_deg", (-180, 180), False),
            ("elevation", "elevation_ft", (-1600, 30000), True),
        ]:
            value = number(row.get(raw), *bounds, integer=is_int)
            if value is not None:
                record[field] = value
        found[key] = record
        grades[key] = grade
    # OICZ is Saqez Airport in Saqez (owner-verified V2621 identity).
    # Preserve source-backed lat/lon/elevation if available, only correct the
    # name and municipality; an external CSV must not relabel this airport.
    if "OICZ" in desired:
        found["OICZ"] = {**found.get("OICZ", {"source": "JEPPIRAN airport identity override"}),
                         "country": "Iran", "name": "Saqez Airport", "city": "Saqez"}
    # Owner-reviewed chart values take precedence only for this exact source
    # cycle. This also fills OPIS/OPKC, which the regional CSV filter omits.
    chart_profiles = json.loads(CHART_PROFILES.read_text(encoding="utf-8"))
    if (chart_profiles.get("schema") == 1 and
            chart_profiles.get("cycle") == manifest.get("version") and
            chart_profiles.get("sourceSha256") == manifest.get("source_sha256")):
        for icao, entry in chart_profiles.get("airports", {}).items():
            if icao not in desired:
                continue
            found[icao] = {**found.get(icao, {}), **entry["profile"],
                           "source": "Jeppesen Airport Information and ADC " + chart_profiles["cycle"],
                           "chartSource": entry["source"]}
    # Display-name overrides approved by the owner. Preserve ICAO, country,
    # coordinates and runway/elevation fields from their original sources.
    owner_names = {
        "ORBI": "Baghdad International Airport",
        "OIAW": "Ahwaz International Airport",
    }
    for icao, name in owner_names.items():
        if icao in desired:
            found[icao] = {**found.get(icao, {}), "name": name}
    missing = sorted(desired.difference(found))
    out = {
        "cycle": manifest.get("version", ""),
        "source_url": URL if csv_path is None else "OurAirports sample (offline test)",
        "updated_utc": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "notice": "Community data only. Verify current airport publications; not for actual navigation.",
        "total_airports": len(desired),
        "covered_airports": len(found),
        "missing_icaos": missing,
        "airports": dict(sorted(found.items())),
    }
    return out

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--manifest", default="app/src/main/assets/charts-manifest.json")
    parser.add_argument("--airports-file", default=None)
    parser.add_argument("--output", default="web/data/airport-profiles.json")
    opts = parser.parse_args()
    data = build(opts.manifest, opts.airports_file)
    if data["covered_airports"] == 0:
        raise SystemExit("No matching ICAOs: refusing to publish empty profile data")
    path = Path(opts.output)
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print("JeppIran profiles:", data["covered_airports"], "/", data["total_airports"], "ICAOs")
    print("Missing exact matches:", ", ".join(data["missing_icaos"]) or "none")

if __name__ == "__main__":
    main()
