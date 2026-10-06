#!/usr/bin/env python3

import json
import re
from pathlib import Path
from collections import Counter, defaultdict


# ============================================================
# JeppIran - Chart Classifier V16.1
# ============================================================

INPUT = Path("charts-index-v12.json")

OUTPUT_INDEX = Path("charts-index-v16.json")
OUTPUT_APP = Path("charts-app-v16.json")
OUTPUT_SUMMARY = Path("charts-summary-v16.json")


# ============================================================
# COUNTRY PREFIXES
# ============================================================

COUNTRY_PREFIXES = {
    "OI": "Iran",
    "OR": "Iraq",
    "OM": "United Arab Emirates",
    "OO": "Oman",
    "LT": "Turkey",
    "UD": "Armenia",
    "UG": "Georgia",
}


# ============================================================
# KNOWN AIRPORTS
# ============================================================

KNOWN_AIRPORTS = {
    "LTFM",
    "OIAA",
    "OIAM",
    "OIAW",
    "OIBB",
    "OIBK",
    "OIBP",
    "OICC",
    "OICI",
    "OIFM",
    "OIGG",
    "OIHH",
    "OIIE",
    "OIII",
    "OIIP",
    "OIKK",
    "OIMB",
    "OIMM",
    "OIMN",
    "OIMS",
    "OING",
    "OINZ",
    "OISS",
    "OITL",
    "OITR",
    "OITT",
    "OIYY",
    "OIZC",
    "OIZH",
    "OMDB",
    "OOMS",
    "ORBI",
    "ORNI",
    "UDYZ",
    "UGSB",
    "UGTB",
}


FALSE_ICAO = {
    "ONLY",
    "ONTO",
    "OPIS",
    "OOPS",
    "OPEN",
    "NONE",
    "PAGE",
    "CHART",
    "INFO",
    "STAR",
    "SID",
    "ILS",
    "VOR",
    "NDB",
    "DME",
    "RNAV",
    "GNSS",
    "LOC",
    "ICAO",
    "AIRP",
    "APCH",
    "RWY",
}


CATEGORIES = {
    "Airport",
    "STAR",
    "SID",
    "Approach",
    "Other",
}


# ============================================================
# BASIC HELPERS
# ============================================================

def text_value(value):
    if value is None:
        return ""

    if isinstance(value, str):
        return value

    if isinstance(value, (int, float)):
        return str(value)

    if isinstance(value, list):
        return "\n".join(
            text_value(x)
            for x in value
        )

    if isinstance(value, dict):
        parts = []

        for key in (
            "text",
            "raw_text",
            "page_text",
            "content",
            "name",
            "title",
        ):
            if key in value:
                parts.append(
                    text_value(value[key])
                )

        return "\n".join(parts)

    return str(value)


def first_value(obj, keys):
    if not isinstance(obj, dict):
        return ""

    for key in keys:
        if key not in obj:
            continue

        value = obj[key]

        if value is None:
            continue

        if isinstance(value, str):
            if value.strip():
                return value

        elif value != "":
            return value

    return ""


# ============================================================
# FLATTEN ANY JSON STRUCTURE
# ============================================================

def flatten_records(value):
    """
    Converts nested lists/dictionaries into a flat list
    of page-record dictionaries.

    This specifically prevents:

        'list' object has no attribute 'get'
    """

    result = []

    if isinstance(value, dict):

        # A dictionary that already looks like a page record.
        record_keys = {
            "page",
            "page_number",
            "pageNumber",
            "text",
            "raw_text",
            "page_text",
            "content",
            "airport",
            "icao",
            "category",
            "name",
            "title",
            "chart_number",
        }

        if any(
            key in value
            for key in record_keys
        ):
            result.append(value)
            return result

        # Otherwise recursively inspect dictionary values.
        for key, child in value.items():

            if (
                str(key).isdigit()
                and isinstance(child, dict)
            ):
                item = dict(child)

                if "page" not in item:
                    item["page"] = int(key)

                result.append(item)

            elif isinstance(child, (dict, list)):
                result.extend(
                    flatten_records(child)
                )

        return result

    if isinstance(value, list):

        for child in value:
            result.extend(
                flatten_records(child)
            )

        return result

    return result


# ============================================================
# LOAD INPUT
# ============================================================

def load_input():

    if not INPUT.exists():
        raise FileNotFoundError(
            f"Input file not found: {INPUT}"
        )

    with INPUT.open(
        "r",
        encoding="utf-8",
    ) as f:
        data = json.load(f)

    records = flatten_records(data)

    # Remove accidental duplicate page records.
    by_page = {}

    for record in records:

        if not isinstance(record, dict):
            continue

        page = first_value(
            record,
            [
                "page",
                "page_number",
                "pageNumber",
                "pdf_page",
            ],
        )

        try:
            page = int(page)
        except Exception:
            continue

        record["page"] = page

        # Prefer the latest complete record.
        by_page[page] = record

    records = list(
        by_page.values()
    )

    records.sort(
        key=lambda x: x["page"]
    )

    return records


# ============================================================
# ICAO
# ============================================================

def detect_airport(
    text,
    existing="",
):

    existing = text_value(
        existing
    ).upper().strip()

    if existing in KNOWN_AIRPORTS:
        return existing

    upper = text.upper()

    for airport in sorted(
        KNOWN_AIRPORTS,
        key=len,
        reverse=True,
    ):
        if re.search(
            rf"\b{re.escape(airport)}\b",
            upper,
        ):
            return airport

    candidates = re.findall(
        r"\b[A-Z]{4}\b",
        upper,
    )

    for candidate in candidates:

        if candidate in FALSE_ICAO:
            continue

        if candidate[:2] not in COUNTRY_PREFIXES:
            continue

        return candidate

    return ""


def detect_country(airport):

    airport = airport.upper()

    return COUNTRY_PREFIXES.get(
        airport[:2],
        "",
    )


# ============================================================
# CHART NUMBER
# ============================================================

def detect_chart_number(
    text,
    existing="",
):

    existing = text_value(
        existing
    ).upper().strip()

    if existing and existing != "20-2026":
        match = re.search(
            r"\b(?:10|11|12|13|14|15|16|17|18|19|20|30|31|32)-[0-9A-Z]+\b",
            existing,
        )
        if match:
            return match.group(0)

    # Only inspect the Jeppesen header area. Explicitly ignore the generated
    # JeppView print line so terminal-data-cycle strings such as 20-2026 can
    # never be mistaken for a chart index.
    lines = [
        clean
        for clean in (
            re.sub(r"\s+", " ", line).strip()
            for line in text.splitlines()
        )
        if clean
        and "PRINTED FROM JEPPVIEW" not in clean.upper()
        and "TERMINAL CHART DATA CYCLE" not in clean.upper()
    ]

    header = "\n".join(lines[:18]).upper()

    candidates = re.findall(
        r"\b(?:10|11|12|13|14|15|16|17|18|19|20|30|31|32)-[0-9A-Z]+\b",
        header,
    )

    for candidate in candidates:
        if candidate == "20-2026":
            continue
        return candidate

    return ""

# ============================================================
# PAGE SIGNALS
# ============================================================

def airport_information(text):

    upper = text.upper()

    return bool(
        re.search(
            r"\bAIRPORT\s+INFORMATION\b",
            upper,
        )
        or re.search(
            r"\bAERODROME\s+INFORMATION\b",
            upper,
        )
    )


def airport_chart(text):

    upper = text.upper()

    return bool(
        re.search(
            r"\bAIRPORT\s+CHART\b",
            upper,
        )
        or re.search(
            r"\bAERODROME\s+CHART\b",
            upper,
        )
    )


def airport_support_text(text):

    upper = text.upper()

    signals = [
        "AIRPORT BRIEFING",
        "AIRPORT QUALIFICATION",
        "RADAR MINIMUM ALTITUDES",
        "INS COORDINATES",
        "PARKING STANDS",
        "PARKING/DOCKING",
        "DOCKING CHART",
        "TAXI ROUTES ARRIVAL",
        "TAXI ROUTE ARRIVAL",
        "TAXI ROUTES DEPARTURE",
        "STRAIGHT-IN RWY",
    ]

    return any(signal in upper for signal in signals)


def star_text(text):

    upper = text.upper()

    return bool(
        re.search(
            r"\.STAR\.",
            upper,
        )
        or re.search(
            r"\bSTAR\b",
            upper,
        )
    )


def sid_text(text):

    upper = text.upper()

    return bool(
        re.search(
            r"\.SID\.",
            upper,
        )
        or re.search(
            r"\bSID\b",
            upper,
        )
    )


def approach_text(text):

    upper = text.upper()

    signals = [
        r"\bILS\b",
        r"\bLOC\b",
        r"\bVOR\b",
        r"\bNDB\b",
        r"\bRNAV\b",
        r"\bRNP\b",
        r"\bGNSS\b",
        r"\bDME\b",
        r"\bAPPROACH\b",
        r"\bRWY\b",
        r"\bRUNWAY\b",
    ]

    score = 0

    for pattern in signals:

        if re.search(
            pattern,
            upper,
        ):
            score += 1

    return score >= 2


# ============================================================
# CLASSIFIER
# ============================================================

def classify(
    text,
    chart_number,
    previous_category="",
):

    upper = text.upper()

    # --------------------------------------------------------
    # 1. Airport Information
    # --------------------------------------------------------

    if airport_information(upper):
        return "Airport"

    # --------------------------------------------------------
    # 2. Explicit chart number
    # --------------------------------------------------------

    if chart_number:

        cn = chart_number.upper()

        if re.fullmatch(r"10-2[A-Z0-9]*", cn):
            return "STAR"

        if re.fullmatch(r"10-3[A-Z0-9]*", cn):
            return "SID"

        if re.fullmatch(r"(?:10|20|30)-(?:1|4|9)[A-Z0-9]*", cn):
            return "Airport"

        if re.fullmatch(r"19-[A-Z0-9]+", cn):
            return "Airport"

        if re.fullmatch(r"(?:11|12|13|14|15|16|17|18|31|32)-[A-Z0-9]+", cn):
            return "Approach"

    # --------------------------------------------------------
    # 3. Explicit STAR
    # --------------------------------------------------------

    if star_text(upper):
        return "STAR"

    # --------------------------------------------------------
    # 4. Explicit SID
    # --------------------------------------------------------

    if sid_text(upper):
        return "SID"

    # --------------------------------------------------------
    # 5. Airport chart
    # --------------------------------------------------------

    if airport_chart(upper):
        return "Airport"

    # --------------------------------------------------------
    # 6. Airport support pages
    # --------------------------------------------------------

    if airport_support_text(upper):
        return "Airport"

    # --------------------------------------------------------
    # 7. Approach fallback
    # --------------------------------------------------------

    if approach_text(upper):
        return "Approach"

    # --------------------------------------------------------
    # 7. Preserve previous classification
    # --------------------------------------------------------

    if previous_category in CATEGORIES:
        return previous_category

    # --------------------------------------------------------
    # 8. Final fallback
    # --------------------------------------------------------

    return "Other"


# ============================================================
# PROCESS ONE RECORD
# ============================================================

def process(record):

    # Safety:
    # never allow a list to reach .get()
    if not isinstance(record, dict):
        return None

    text = first_value(
        record,
        [
            "text",
            "raw_text",
            "page_text",
            "content",
            "raw",
        ],
    )

    text = text_value(text)

    existing_airport = first_value(
        record,
        [
            "airport",
            "icao",
            "airport_icao",
        ],
    )

    existing_category = first_value(
        record,
        [
            "category",
            "type",
        ],
    )

    existing_chart_number = first_value(
        record,
        [
            "chart_number",
            "chartNumber",
            "chart_no",
            "number",
        ],
    )

    # --------------------------------------------------------
    # IMPORTANT:
    # preserve V12 name
    # --------------------------------------------------------

    name = first_value(
        record,
        [
            "name",
            "title",
            "chart_name",
        ],
    )

    name = text_value(
        name
    ).strip()

    if not name:
        name = "Chart"

    # --------------------------------------------------------
    # Page
    # --------------------------------------------------------

    page = first_value(
        record,
        [
            "page",
            "page_number",
            "pageNumber",
            "pdf_page",
        ],
    )

    try:
        page = int(page)
    except Exception:
        return None

    # --------------------------------------------------------
    # Detect
    # --------------------------------------------------------

    airport = detect_airport(
        text,
        existing_airport,
    )

    country = detect_country(
        airport
    )

    chart_number = detect_chart_number(
        text,
        existing_chart_number,
    )

    category = classify(
        text,
        chart_number,
        existing_category,
    )

    # --------------------------------------------------------
    # Copy original record
    # --------------------------------------------------------

    output = dict(record)

    output["page"] = page
    output["airport"] = airport
    output["country"] = country
    output["chart_number"] = chart_number
    output["category"] = category
    output["name"] = name

    return output


# ============================================================
# BUILD APP JSON
# ============================================================

def build_app(records):

    result = []

    for item in records:

        result.append(
            {
                "page": item["page"],
                "airport": item["airport"],
                "country": item["country"],
                "category": item["category"],
                "chart_number": item[
                    "chart_number"
                ],
                "name": item["name"],
            }
        )

    return result


# ============================================================
# SUMMARY
# ============================================================

def build_summary(records):

    counts = Counter()

    airports = defaultdict(
        lambda: {
            "country": "",
            "Airport": 0,
            "STAR": 0,
            "SID": 0,
            "Approach": 0,
            "Other": 0,
        }
    )

    for item in records:

        category = item.get(
            "category",
            "Other",
        )

        airport = item.get(
            "airport",
            "",
        )

        country = item.get(
            "country",
            "",
        )

        if category not in CATEGORIES:
            category = "Other"

        counts[category] += 1

        if airport:

            if not airports[airport][
                "country"
            ]:
                airports[airport][
                    "country"
                ] = country

            airports[airport][
                category
            ] += 1

    return {
        "source": "Iran2620.pdf",
        "pages": len(records),
        "category_counts": {
            "Airport": counts["Airport"],
            "STAR": counts["STAR"],
            "SID": counts["SID"],
            "Approach": counts["Approach"],
            "Other": counts["Other"],
        },
        "airport_count": len(airports),
        "airports": {
            key: airports[key]
            for key in sorted(airports)
        },
    }


# ============================================================
# VERIFIED BLOCKS
# ============================================================

VERIFIED = {

    "OIAW": [
        (27, 28, "Airport"),
        (29, 31, "STAR"),
        (32, 37, "SID"),
        (38, 40, "Airport"),
        (41, 51, "Approach"),
    ],

    "OIII": [
        (268, 269, "Airport"),
        (270, 282, "Other"),
        (283, 293, "STAR"),
        (294, 303, "SID"),
        (304, 308, "Airport"),
        (309, 314, "Approach"),
    ],

    "OIMM": [
        (361, 362, "Airport"),
        (363, 365, "Other"),
        (366, 376, "STAR"),
        (377, 389, "SID"),
        (390, 393, "Airport"),
        (394, 403, "Approach"),
    ],

    "OIZC": [
        (587, 588, "Airport"),
        (589, 590, "STAR"),
        (591, 593, "SID"),
        (594, 596, "Airport"),
        (597, 601, "Approach"),
    ],
}


# ============================================================
# VALIDATION
# ============================================================

def validate(records, summary):

    errors = []

    # 991 pages
    if len(records) != 991:
        errors.append(
            f"Expected 991 pages, got {len(records)}"
        )

    # Category total
    total = sum(
        summary["category_counts"].values()
    )

    if total != len(records):
        errors.append(
            f"Category total {total} "
            f"!= {len(records)}"
        )

    # 36 airports
    if summary["airport_count"] != 36:
        errors.append(
            f"Expected 36 airports, "
            f"got {summary['airport_count']}"
        )

    # Page dictionary
    by_page = {
        item["page"]: item
        for item in records
    }

    # Verified blocks
    for airport, blocks in VERIFIED.items():

        for start, end, expected in blocks:

            for page in range(
                start,
                end + 1,
            ):

                item = by_page.get(page)

                if item is None:

                    errors.append(
                        f"{airport} page {page}: "
                        "missing"
                    )

                    continue

                if item.get(
                    "airport",
                    "",
                ) != airport:

                    errors.append(
                        f"{airport} page {page}: "
                        f"wrong airport "
                        f"{item.get('airport', '')}"
                    )

                if item.get(
                    "category",
                    "",
                ) != expected:

                    errors.append(
                        f"{airport} page {page}: "
                        f"expected {expected}, "
                        f"got {item.get('category', '')}"
                    )

    return errors


# ============================================================
# SAMPLE PRINTER
# ============================================================

def print_block(
    records,
    airport,
    start,
    end,
):

    print()
    print(
        f"----- {airport} "
        f"{start}-{end} -----"
    )

    for item in records:

        # IMPORTANT:
        # item is guaranteed to be a dict here.
        if not isinstance(
            item,
            dict,
        ):
            continue

        page = item.get(
            "page",
            0,
        )

        if page < start or page > end:
            continue

        print(
            f"Page {page}: "
            f"{item.get('category', '')} | "
            f"{item.get('chart_number', '')} | "
            f"{item.get('airport', '')} | "
            f"{item.get('name', '')}"
        )


def print_samples(records):

    print()
    print("=" * 40)
    print("V16 SAMPLE PAGES")
    print("=" * 40)

    print_block(
        records,
        "OIAW",
        27,
        51,
    )

    print_block(
        records,
        "OIII",
        268,
        314,
    )

    print_block(
        records,
        "OIMM",
        361,
        403,
    )

    print_block(
        records,
        "OIZC",
        587,
        601,
    )


# ============================================================
# OICC
# ============================================================

def print_oicc(records):

    print()
    print("=" * 40)
    print("OICC SAMPLE")
    print("=" * 40)

    found = False

    for item in records:

        if not isinstance(
            item,
            dict,
        ):
            continue

        if item.get(
            "airport",
            "",
        ) != "OICC":
            continue

        found = True

        print(
            f"Page {item.get('page', '')}: "
            f"{item.get('category', '')} | "
            f"{item.get('chart_number', '')} | "
            f"{item.get('airport', '')} | "
            f"{item.get('name', '')}"
        )

    if not found:
        print(
            "WARNING: No OICC pages detected."
        )


# ============================================================
# MAIN
# ============================================================

def main():

    print()
    print("=" * 40)
    print("JeppIran V16.1")
    print("=" * 40)
    print()

    print(
        f"Reading: {INPUT}"
    )

    raw_records = load_input()

    print(
        f"Raw page records: "
        f"{len(raw_records)}"
    )

    # --------------------------------------------------------
    # Process
    # --------------------------------------------------------

    records = []

    for raw in raw_records:

        item = process(raw)

        if item is not None:
            records.append(item)

    records.sort(
        key=lambda x: x["page"]
    )

    print(
        f"Processed pages: "
        f"{len(records)}"
    )

    # --------------------------------------------------------
    # Build
    # --------------------------------------------------------

    app = build_app(
        records
    )

    summary = build_summary(
        records
    )

    # --------------------------------------------------------
    # Validation
    # --------------------------------------------------------

    errors = validate(
        records,
        summary,
    )

    print()

    print("=" * 40)
    print("V16 VALIDATION")
    print("=" * 40)

    if errors:

        print()

        for error in errors:
            print(
                "ERROR:",
                error,
            )

        print()
        print(
            f"Validation errors: "
            f"{len(errors)}"
        )

    else:

        print()
        print(
            "ALL VALIDATED BLOCKS PASSED"
        )

    # --------------------------------------------------------
    # Save
    # --------------------------------------------------------

    with OUTPUT_INDEX.open(
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            records,
            f,
            ensure_ascii=False,
            indent=2,
        )

    with OUTPUT_APP.open(
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            app,
            f,
            ensure_ascii=False,
            indent=2,
        )

    with OUTPUT_SUMMARY.open(
        "w",
        encoding="utf-8",
    ) as f:

        json.dump(
            summary,
            f,
            ensure_ascii=False,
            indent=2,
        )

    # --------------------------------------------------------
    # Summary
    # --------------------------------------------------------

    print()
    print("=" * 40)
    print("V16 SUMMARY")
    print("=" * 40)
    print()

    print(
        json.dumps(
            summary,
            ensure_ascii=False,
            indent=2,
        )
    )

    # --------------------------------------------------------
    # Samples
    # --------------------------------------------------------

    print_samples(
        records
    )

    # --------------------------------------------------------
    # OICC
    # --------------------------------------------------------

    print_oicc(
        records
    )

    # --------------------------------------------------------
    # Outputs
    # --------------------------------------------------------

    print()
    print("=" * 40)
    print("V16 OUTPUT FILES")
    print("=" * 40)
    print()

    print(
        OUTPUT_INDEX
    )

    print(
        OUTPUT_APP
    )

    print(
        OUTPUT_SUMMARY
    )

    print()

    if errors:
        print(
            "V16 finished with validation errors."
        )
    else:
        print(
            "V16 finished successfully."
        )


if __name__ == "__main__":
    main()
