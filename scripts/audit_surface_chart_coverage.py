#!/usr/bin/env python3
import argparse
import json
from collections import defaultdict
from pathlib import Path


DETAIL_WORDS = (
    "PARKING/DOCKING",
    "PARKING STANDS",
    "DOCKING",
    "TAXI ROUTES",
    "REMOTE PARK",
    "AIRPORT DIAGRAM CHART (ADC) - CODE F",
)


def is_airport_chart(item):
    return str(item.get("category", "")).strip().upper() == "AIRPORT"


def is_adc(name):
    n = str(name or "").strip().upper()
    return "AIRPORT DIAGRAM" in n and "CODE F" not in n


def is_detail(name):
    n = str(name or "").strip().upper()
    return any(word in n for word in DETAIL_WORDS)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--index", required=True)
    ap.add_argument("--georef", required=True)
    ap.add_argument("--output", required=True)
    args = ap.parse_args()

    index_raw = json.loads(Path(args.index).read_text(encoding="utf-8"))
    charts = index_raw if isinstance(index_raw, list) else index_raw.get("charts", [])
    georef_raw = json.loads(Path(args.georef).read_text(encoding="utf-8"))
    georef_pages = {
        int(x.get("page"))
        for x in georef_raw.get("charts", [])
        if isinstance(x, dict) and int(x.get("page", -1)) > 0
    }

    by_airport = defaultdict(list)
    for item in charts:
        if is_airport_chart(item):
            by_airport[str(item.get("airport", "")).upper()].append(item)

    airports = []
    totals = {
        "airports": 0,
        "withAdc": 0,
        "withGeorefAdc": 0,
        "withDetailCharts": 0,
        "withGeorefDetailCharts": 0,
        "autoSwitchReady": 0,
    }

    for icao in sorted(k for k in by_airport if k):
        items = by_airport[icao]
        adc = [x for x in items if is_adc(x.get("name"))]
        detail = [x for x in items if is_detail(x.get("name"))]
        adc_geo = [x for x in adc if int(x.get("page", -1)) in georef_pages]
        detail_geo = [x for x in detail if int(x.get("page", -1)) in georef_pages]

        row = {
            "icao": icao,
            "adcPages": [{"page": x.get("page"), "name": x.get("name"), "chartNumber": x.get("chart_number", "")} for x in adc],
            "georeferencedAdcPages": [x.get("page") for x in adc_geo],
            "detailPages": [{"page": x.get("page"), "name": x.get("name"), "chartNumber": x.get("chart_number", "")} for x in detail],
            "georeferencedDetailPages": [x.get("page") for x in detail_geo],
            "autoSwitchReady": bool(adc_geo and detail_geo),
            "mode": "adc+detail" if adc_geo and detail_geo else ("adc-only" if adc_geo else "no-georef-adc"),
        }
        airports.append(row)

        totals["airports"] += 1
        totals["withAdc"] += bool(adc)
        totals["withGeorefAdc"] += bool(adc_geo)
        totals["withDetailCharts"] += bool(detail)
        totals["withGeorefDetailCharts"] += bool(detail_geo)
        totals["autoSwitchReady"] += bool(adc_geo and detail_geo)

    payload = {
        "version": 1,
        "purpose": "JEPPIRAN smart airport surface chart coverage audit",
        "totals": totals,
        "airports": airports,
    }
    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")

    print(json.dumps(totals, sort_keys=True))
    print("Auto-switch ready airports:")
    for row in airports:
        if row["autoSwitchReady"]:
            print("  " + row["icao"] + "  details=" + ",".join(str(x) for x in row["georeferencedDetailPages"]))


if __name__ == "__main__":
    main()
