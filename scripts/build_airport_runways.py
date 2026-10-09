#!/usr/bin/env python3
"""Package runway-end headings extracted from the current Jeppesen ADC charts.

ADC is the *only* heading source for JEPPIRAN profile/wind compass.
Do not substitute AIP GEO headings, community headings or an estimated
heading from a runway designator.  If the ADC omits a number, leave
that runway's heading unavailable; never invent a value.
"""
import argparse
import json
import math
import re
from pathlib import Path

DEFAULT_ADC = Path("app/src/main/assets/airport-runways.json")
DEFAULT_MANIFEST = Path("app/src/main/assets/charts-manifest.json")

def build(manifest_path=DEFAULT_MANIFEST, adc_path=DEFAULT_ADC):
    manifest = json.loads(Path(manifest_path).read_text(encoding="utf-8"))
    adc = json.loads(Path(adc_path).read_text(encoding="utf-8"))
    cycle = manifest.get("version")
    if not cycle or adc.get("cycle") != cycle:
        raise ValueError("ADC runway data is missing or not from the current PDF cycle")
    if not str(adc.get("source", "")).startswith("Terminal chart cycle"):
        raise ValueError("Only ADC-extracted runway headings may be published")
    airports = adc.get("airports")
    if not isinstance(airports, dict) or not airports:
        raise ValueError("No ADC runway heading records available")
    direction_count = 0
    for icao, rows in airports.items():
        if not re.fullmatch(r"[A-Z]{4}", icao):
            raise ValueError(f"Invalid airport identifier {icao!r}")
        if not isinstance(rows, list):
            raise ValueError(f"Malformed ADC runway records: {icao}")
        seen = set()
        for row in rows:
            name = row.get("name")
            if not isinstance(name, str) or not re.fullmatch(r"(?:0[1-9]|[12][0-9]|3[0-6])[LRC]?", name):
                raise ValueError(f"Invalid runway end name in {icao}: {name!r}")
            if name in seen:
                raise ValueError(f"Duplicate runway end on {icao} ADC: {name}")
            seen.add(name)
            if row.get("headingSourceType") != "Jeppesen ADC":
                raise ValueError(f"Non-ADC heading source at {icao} {name}")
            heading = row.get("headingAdc")
            if heading is not None:
                if isinstance(heading, bool) or not isinstance(heading, (int, float)) or not math.isfinite(heading) or not 0 <= heading < 360:
                    raise ValueError(f"Invalid ADC heading for {icao} {name}")
                direction_count += 1
    # Regression guards against accidentally reintroducing AIP GEO headings.
    if cycle == "V2621":
        expected = {
            ("OIAA", "32L"): 321, ("OIAA", "14R"): 141,
            ("OIAW", "12"): 120, ("OIAW", "30"): 300,
        }
        for (icao, name), heading in expected.items():
            matches = [row for row in airports.get(icao, []) if row.get("name") == name]
            if len(matches) != 1 or matches[0].get("headingAdc") != heading:
                raise ValueError(f"ADC runway heading regression: {icao} {name} must be {heading}")
    selected = set(manifest["airports"])
    covered = set(airports).intersection(selected)
    adc["airport_count"] = len(selected)
    adc["runway_airport_count"] = len(covered)
    adc["runway_direction_count"] = direction_count
    adc["missing_icaos"] = sorted(selected - set(airports))
    return adc

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--manifest", default=str(DEFAULT_MANIFEST))
    p.add_argument("--adc-source", default=str(DEFAULT_ADC))
    p.add_argument("--runways-file", default=None,
                   help="Legacy alias for --adc-source; file MUST be verified ADC JSON")
    p.add_argument("--output", default="web/data/airport-runways.json")
    args = p.parse_args()
    adc = build(args.manifest, args.runways_file or args.adc_source)
    target = Path(args.output)
    target.parent.mkdir(parents=True, exist_ok=True)
    target.write_text(json.dumps(adc, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(f"ADC runway data: {adc['runway_airport_count']}/{adc['airport_count']} active airports; "
          f"{adc['runway_direction_count']} printed runway-end headings")
    if adc["missing_icaos"]:
        print("ADC runway heading unavailable:", ", ".join(adc["missing_icaos"]))

if __name__ == "__main__":
    main()
