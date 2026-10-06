#!/usr/bin/env python3

import argparse
import json
import re
from pathlib import Path

COUNTRY_PREFIXES = {
    "OI": "Iran",
    "OR": "Iraq",
    "OM": "United Arab Emirates",
    "OO": "Oman",
    "LT": "Turkey",
    "UD": "Armenia",
    "UG": "Georgia",
}

FALSE_ICAO = {
    "ONLY", "ONTO", "OPIS", "NONE", "PAGE", "DATE", "NOTE"
}

ICAO_RE = re.compile(
    r"\b((?:OI|OR|OM|OO|LT|UD|UG)[A-Z]{2})\s*/\s*[A-Z]{3}\b"
)


def find_airport(text):
    upper = text.upper()
    for icao in ICAO_RE.findall(upper):
        if icao not in FALSE_ICAO:
            return icao
    for prefix in COUNTRY_PREFIXES:
        for icao in re.findall(rf"\b{prefix}[A-Z]{{2}}\b", upper):
            if icao not in FALSE_ICAO:
                return icao
    return ""


def detect_chart_number(text):
    upper = text.upper()
    patterns = [
        r"\b10-9[A-Z0-9]*\b",
        r"\b10-3[A-Z0-9]*\b",
        r"\b10-2[A-Z0-9]*\b",
        r"\b10-1[A-Z0-9]*\b",
        r"\b11-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b13-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b14-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b15-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b16-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b17-[0-9]{1,3}[A-Z0-9]*\b",
    ]
    for pattern in patterns:
        match = re.search(pattern, upper)
        if match:
            return match.group(0)
    return ""


def classify(text):
    upper = text.upper()
    if ".STAR." in upper:
        return "STAR"
    if ".SID." in upper:
        return "SID"

    for term in (
        "AIRPORT INFORMATION",
        "AERODROME INFORMATION",
        "AIRPORT CHART",
        "AERODROME CHART",
    ):
        if term in upper:
            return "Airport"

    for term in (
        "INSTRUMENT APPROACH",
        "ACFT EXECUTING INSTRUMENT APPROACH",
        "MISSED APPROACH",
    ):
        if term in upper:
            return "Approach"

    number = detect_chart_number(text)
    if number.startswith("10-9"):
        return "Airport"
    if number.startswith("10-2"):
        return "STAR"
    if number.startswith("10-3"):
        return "SID"
    if number.startswith("10-1"):
        return "Other"
    if re.match(r"^(11|13|14|15|16|17)-", number):
        return "Approach"

    if (
        any(term in upper for term in ("ILS", "VOR", "NDB", "RNAV", "RNP"))
        and ("RWY" in upper or "RUNWAY" in upper)
    ):
        return "Approach"

    return "Other"


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf-text", default="pdf-text")
    parser.add_argument("--output", default="charts-index-v9.json")
    args = parser.parse_args()

    directory = Path(args.pdf_text)
    pages = sorted(
        directory.glob("page-*.txt"),
        key=lambda p: int(p.stem.split("-")[1])
    )
    if not pages:
        raise SystemExit("No extracted PDF pages found")

    output = {}
    current_airport = ""

    for path in pages:
        page = int(path.stem.split("-")[1])
        text = path.read_text(encoding="utf-8", errors="ignore")
        airport = find_airport(text)
        if airport:
            current_airport = airport

        output[str(page)] = {
            "page": page,
            "airport": airport or current_airport,
            "category": classify(text),
            "chart_number": detect_chart_number(text),
            "text": text,
            "name": "",
        }

    Path(args.output).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print("Base index pages:", len(output))


if __name__ == "__main__":
    main()
