#!/usr/bin/env python3

import json
import re
from pathlib import Path
from collections import Counter, defaultdict


# ============================================================
# JeppIran - Chart Classifier V16
# ============================================================
#
# Input:
#   charts-index-v12.json
#
# Outputs:
#   charts-index-v16.json
#   charts-app-v16.json
#   charts-summary-v16.json
#
# IMPORTANT:
#   V12 naming is preserved.
#   This script changes classification only.
# ============================================================


BASE_DIR = Path(".")

INPUT_FILES = [
    BASE_DIR / "charts-index-v12.json",
    BASE_DIR / "charts-index-v12" / "charts-index-v12.json",
]

OUTPUT_INDEX = BASE_DIR / "charts-index-v16.json"
OUTPUT_APP = BASE_DIR / "charts-app-v16.json"
OUTPUT_SUMMARY = BASE_DIR / "charts-summary-v16.json"


# ============================================================
# Supported ICAO prefixes
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
# Known airports
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


# ============================================================
# ICAO false positives
# ============================================================

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


# ============================================================
# Category names
# ============================================================

CATEGORIES = {
    "Airport",
    "STAR",
    "SID",
    "Approach",
    "Other",
}


# ============================================================
# Utility functions
# ============================================================

def normalize_text(value):
    if value is None:
        return ""

    if isinstance(value, list):
        return "\n".join(str(x) for x in value)

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
                parts.append(str(value[key]))

        return "\n".join(parts)

    return str(value)


def find_input_file():
    for path in INPUT_FILES:
        if path.exists():
            return path

    raise FileNotFoundError(
        "Could not find charts-index-v12.json"
    )


def load_json(path):
    with path.open("r", encoding="utf-8") as f:
        return json.load(f)


def save_json(path, data):
    with path.open("w", encoding="utf-8") as f:
        json.dump(
            data,
            f,
            ensure_ascii=False,
            indent=2,
        )


def first_nonempty(obj, keys):
    for key in keys:
        if key in obj:
            value = obj[key]

            if value is None:
                continue

            if isinstance(value, str) and not value.strip():
                continue

            return value

    return ""


# ============================================================
# ICAO detection
# ============================================================

def detect_airport(text, existing_airport=""):
    existing = str(existing_airport or "").upper().strip()

    if existing in KNOWN_AIRPORTS:
        return existing

    upper = text.upper()

    # First: exact known airports
    for airport in sorted(KNOWN_AIRPORTS, key=len, reverse=True):
        if re.search(rf"\b{re.escape(airport)}\b", upper):
            return airport

    # Generic ICAO candidate
    candidates = re.findall(
        r"\b[A-Z]{4}\b",
        upper,
    )

    for candidate in candidates:
        if candidate in FALSE_ICAO:
            continue

        prefix = candidate[:2]

        if prefix not in COUNTRY_PREFIXES:
            continue

        return candidate

    return ""


def detect_country(airport):
    airport = str(airport or "").upper()

    if len(airport) >= 2:
        return COUNTRY_PREFIXES.get(
            airport[:2],
            "",
        )

    return ""


# ============================================================
# Chart number detection
# ============================================================

def detect_chart_number(text, existing=""):
    """
    Detect Jeppesen chart numbers.

    Examples:
      10-2
      10-2A
      10-2B
      10-3
      10-3A
      10-9
      10-9S
      10-9S1
      10-1P
      10-1P10
      10-1R
      11-1
      13-2
      16-1
      17-1
    """

    existing = str(existing or "").strip()

    if existing:
        # Do not blindly trust arbitrary existing text.
        m = re.search(
            r"\b(?:10-[1239][A-Z0-9]*|"
            r"(?:11|13|14|15|16|17)-[A-Z0-9]*)\b",
            existing.upper(),
        )

        if m:
            return m.group(0)

    upper = text.upper()

    # Prefer the normal Jeppesen chart-number forms.
    patterns = [
        r"\b10-9[A-Z0-9]*\b",
        r"\b10-3[A-Z0-9]*\b",
        r"\b10-2[A-Z0-9]*\b",
        r"\b10-1[A-Z0-9]*\b",
        r"\b(?:11|13|14|15|16|17)-[A-Z0-9]*\b",
    ]

    for pattern in patterns:
        matches = re.findall(pattern, upper)

        if matches:
            # Prefer the first useful match.
            return matches[0]

    return ""


# ============================================================
# Strong page signals
# ============================================================

def is_airport_information(text):
    upper = text.upper()

    strong_patterns = [
        r"\bAIRPORT INFORMATION\b",
        r"\bAERODROME INFORMATION\b",
        r"\bAIRPORT\s+INFORMATION\b",
        r"\bAERODROME\s+INFORMATION\b",
    ]

    return any(
        re.search(pattern, upper)
        for pattern in strong_patterns
    )


def is_airport_chart(text):
    upper = text.upper()

    patterns = [
        r"\bAIRPORT CHART\b",
        r"\bAERODROME CHART\b",
        r"\bAIRPORT\s+CHART\b",
        r"\bAERODROME\s+CHART\b",
    ]

    return any(
        re.search(pattern, upper)
        for pattern in patterns
    )


def is_star(text):
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


def is_sid(text):
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


def is_approach_text(text):
    upper = text.upper()

    strong_patterns = [
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

    for pattern in strong_patterns:
        if re.search(pattern, upper):
            score += 1

    return score >= 2


def is_other_chart(text, chart_number):
    upper = text.upper()

    if chart_number:
        if re.fullmatch(
            r"10-1[A-Z0-9]*",
            chart_number,
        ):
            return True

    # Radar minimum altitude charts are Other.
    if (
        "RADAR.MINIMUM.ALTITUDES" in upper
        or "RADAR MINIMUM ALTITUDES" in upper
        or "MINIMUM ALTITUDES" in upper
    ):
        return True

    # En-route / terminal reference style material.
    other_patterns = [
        r"\bTHR\b",
        r"\bTERMINAL\b",
        r"\bRADAR\b",
    ]

    if chart_number.startswith("10-1"):
        return True

    return False


# ============================================================
# Category classification
# ============================================================

def classify_page(
    text,
    airport="",
    chart_number="",
    previous_category="",
):
    """
    V16 priority order.

    1. Airport Information
    2. Explicit chart number
    3. Explicit STAR
    4. Explicit SID
    5. Approach text
    6. Airport text
    7. Other
    8. Previous/base category
    """

    upper = text.upper()

    # --------------------------------------------------------
    # 1. Airport Information MUST come first.
    #
    # This prevents generic words such as ILS/VOR/RWY appearing
    # in airport information pages from turning them into
    # Approach.
    # --------------------------------------------------------

    if is_airport_information(upper):
        return "Airport"

    # --------------------------------------------------------
    # 2. Explicit Jeppesen chart number
    # --------------------------------------------------------

    if chart_number:
        cn = chart_number.upper().strip()

        # 10-9 = Airport
        if re.fullmatch(
            r"10-9[A-Z0-9]*",
            cn,
        ):
            return "Airport"

        # 10-2 = STAR
        if re.fullmatch(
            r"10-2[A-Z0-9]*",
            cn,
        ):
            return "STAR"

        # 10-3 = SID
        if re.fullmatch(
            r"10-3[A-Z0-9]*",
            cn,
        ):
            return "SID"

        # 10-1 = Other
        if re.fullmatch(
            r"10-1[A-Z0-9]*",
            cn,
        ):
            return "Other"

        # Approach chart series
        if re.fullmatch(
            r"(?:11|13|14|15|16|17)-[A-Z0-9]*",
            cn,
        ):
            return "Approach"

    # --------------------------------------------------------
    # 3. Strong STAR signal
    # --------------------------------------------------------

    if is_star(upper):
        return "STAR"

    # --------------------------------------------------------
    # 4. Strong SID signal
    # --------------------------------------------------------

    if is_sid(upper):
        return "SID"

    # --------------------------------------------------------
    # 5. Airport chart signal
    #
    # This is intentionally before generic approach terms.
    # --------------------------------------------------------

    if is_airport_chart(upper):
        return "Airport"

    # --------------------------------------------------------
    # 6. Approach textual fallback
    #
    # Important for airports/pages where chart number OCR is
    # missing or damaged.
    # --------------------------------------------------------

    if is_approach_text(upper):
        return "Approach"

    # --------------------------------------------------------
    # 7. Other
    # --------------------------------------------------------

    if is_other_chart(upper, chart_number):
        return "Other"

    # --------------------------------------------------------
    # 8. Preserve previous/base classifier if available.
    # --------------------------------------------------------

    if previous_category in CATEGORIES:
        return previous_category

    # --------------------------------------------------------
    # 9. Final fallback
    # --------------------------------------------------------

    return "Other"


# ============================================================
# Normalize input records
# ============================================================

def extract_records(data):
    """
    Accept several possible V12 JSON structures.

    Returns:
        list of dictionaries
    """

    if isinstance(data, list):
        return data

    if isinstance(data, dict):

        # Common keys
        for key in (
            "pages",
            "charts",
            "items",
            "records",
            "index",
            "data",
        ):
            value = data.get(key)

            if isinstance(value, list):
                return value

        # Page-keyed dictionary:
        # {
        #   "27": {...},
        #   "28": {...}
        # }
        numeric_keys = []

        for key, value in data.items():
            if str(key).isdigit() and isinstance(value, dict):
                numeric_keys.append(
                    (int(key), value)
                )

        if numeric_keys:
            numeric_keys.sort(
                key=lambda x: x[0]
            )

            records = []

            for page, value in numeric_keys:
                item = dict(value)
                item.setdefault(
                    "page",
                    page,
                )
                records.append(item)

            return records

    raise ValueError(
        "Unsupported charts-index-v12.json structure"
    )


# ============================================================
# Convert one record
# ============================================================

def process_record(record):
    item = dict(record)

    # --------------------------------------------------------
    # Page
    # --------------------------------------------------------

    page = first_nonempty(
        item,
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
        page = 0

    # --------------------------------------------------------
    # Text
    # --------------------------------------------------------

    text = first_nonempty(
        item,
        [
            "text",
            "raw_text",
            "page_text",
            "content",
            "raw",
        ],
    )

    text = normalize_text(text)

    # --------------------------------------------------------
    # Existing values
    # --------------------------------------------------------

    existing_airport = first_nonempty(
        item,
        [
            "airport",
            "icao",
            "airport_icao",
        ],
    )

    existing_category = first_nonempty(
        item,
        [
            "category",
            "type",
        ],
    )

    existing_chart_number = first_nonempty(
        item,
        [
            "chart_number",
            "chartNumber",
            "chart_no",
            "number",
        ],
    )

    # --------------------------------------------------------
    # Detect airport
    # --------------------------------------------------------

    airport = detect_airport(
        text,
        existing_airport,
    )

    # --------------------------------------------------------
    # Detect country
    # --------------------------------------------------------

    country = detect_country(airport)

    # --------------------------------------------------------
    # Detect chart number
    # --------------------------------------------------------

    chart_number = detect_chart_number(
        text,
        existing_chart_number,
    )

    # --------------------------------------------------------
    # Preserve V12 name.
    #
    # DO NOT replace a good V12 name with raw header text.
    # --------------------------------------------------------

    name = first_nonempty(
        item,
        [
            "name",
            "title",
            "chart_name",
        ],
    )

    name = normalize_text(name).strip()

    if not name:
        name = "Chart"

    # --------------------------------------------------------
    # Classify
    # --------------------------------------------------------

    category = classify_page(
        text=text,
        airport=airport,
        chart_number=chart_number,
        previous_category=existing_category,
    )

    # --------------------------------------------------------
    # Write normalized V16 fields.
    # --------------------------------------------------------

    item["page"] = page
    item["airport"] = airport
    item["country"] = country
    item["chart_number"] = chart_number
    item["category"] = category
    item["name"] = name

    return item


# ============================================================
# Sort records
# ============================================================

def sort_records(records):
    return sorted(
        records,
        key=lambda x: (
            int(x.get("page", 0))
            if str(x.get("page", "")).isdigit()
            else 0
        ),
    )


# ============================================================
# Build app index
# ============================================================

def build_app_index(records):
    app = []

    for item in records:
        page = item.get("page", 0)

        airport = item.get(
            "airport",
            "",
        )

        category = item.get(
            "category",
            "Other",
        )

        name = item.get(
            "name",
            "Chart",
        )

        chart_number = item.get(
            "chart_number",
            "",
        )

        country = item.get(
            "country",
            "",
        )

        app.append(
            {
                "page": page,
                "airport": airport,
                "country": country,
                "category": category,
                "chart_number": chart_number,
                "name": name,
            }
        )

    return app


# ============================================================
# Build summary
# ============================================================

def build_summary(records):
    category_counts = Counter()

    airport_data = defaultdict(
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

        category_counts[category] += 1

        if airport:
            if not airport_data[airport]["country"]:
                airport_data[airport]["country"] = country

            airport_data[airport][category] += 1

    # Ensure all categories exist
    final_category_counts = {
        "Airport": category_counts.get(
            "Airport",
            0,
        ),
        "STAR": category_counts.get(
            "STAR",
            0,
        ),
        "SID": category_counts.get(
            "SID",
            0,
        ),
        "Approach": category_counts.get(
            "Approach",
            0,
        ),
        "Other": category_counts.get(
            "Other",
            0,
        ),
    }

    airports = {}

    for airport in sorted(airport_data):
        airports[airport] = airport_data[
            airport
        ]

    return {
        "source": "Iran2620.pdf",
        "pages": len(records),
        "category_counts": final_category_counts,
        "airport_count": len(airports),
        "airports": airports,
    }


# ============================================================
# Validation
# ============================================================

def validate(records, summary):
    errors = []

    # --------------------------------------------------------
    # Page count
    # --------------------------------------------------------

    if len(records) != 991:
        errors.append(
            f"Expected 991 pages, found {len(records)}"
        )

    # --------------------------------------------------------
    # Category total
    # --------------------------------------------------------

    counts = summary["category_counts"]

    total = sum(counts.values())

    if total != len(records):
        errors.append(
            f"Category total {total} != "
            f"record total {len(records)}"
        )

    # --------------------------------------------------------
    # Airport count
    # --------------------------------------------------------

    if summary["airport_count"] != 36:
        errors.append(
            "Expected 36 airports, found "
            f"{summary['airport_count']}"
        )

    # --------------------------------------------------------
    # Check airport names
    # --------------------------------------------------------

    found_airports = set(
        item.get("airport", "")
        for item in records
        if item.get("airport")
    )

    missing_airports = sorted(
        KNOWN_AIRPORTS - found_airports
    )

    if missing_airports:
        errors.append(
            "Missing airports: "
            + ", ".join(missing_airports)
        )

    # --------------------------------------------------------
    # Known verified blocks
    # --------------------------------------------------------

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

    by_page = {
        int(item["page"]): item
        for item in records
        if str(item.get("page", "")).isdigit()
    }

    for airport, blocks in VERIFIED.items():

        for start, end, expected in blocks:

            for page in range(start, end + 1):

                item = by_page.get(page)

                if not item:
                    errors.append(
                        f"{airport} page {page}: "
                        "missing"
                    )
                    continue

                actual_airport = item.get(
                    "airport",
                    "",
                )

                actual_category = item.get(
                    "category",
                    "",
                )

                if actual_airport != airport:
                    errors.append(
                        f"{airport} page {page}: "
                        f"airport={actual_airport}"
                    )

                if actual_category != expected:
                    errors.append(
                        f"{airport} page {page}: "
                        f"expected {expected}, "
                        f"got {actual_category}"
                    )

    return errors


# ============================================================
# Print summary
# ============================================================

def print_summary(summary):
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

    print()


# ============================================================
# Print sample pages
# ============================================================

def print_samples(records):
    samples = [
        ("OIAW", 27, 51),
        ("OIII", 268, 314),
        ("OIMM", 361, 403),
        ("OIZC", 587, 601),
    ]

    print()
    print("=" * 40)
    print("V16 SAMPLE PAGES")
    print("=" * 40)

    for airport, start, end in samples:

        print()
        print(
            f"----- {airport} -----"
        )

        for item in records:

            page = item.get(
                "page",
                0,
            )

            if not (
                start <= page <= end
            ):
                continue

            print(
                f"Page {page}: "
                f"{item.get('category', '')} | "
                f"{item.get('chart_number', '')} | "
                f"{item.get('airport', '')} | "
                f"{item.get('name', '')}"
            )


def print_oicc(records):
    print()
    print("=" * 40)
    print("OICC SAMPLE")
    print("=" * 40)
    print()

    found = False

    for item in records:

        if item.get("airport") != "OICC":
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
        print("WARNING: No OICC pages detected.")


# ============================================================
# Main
# ============================================================

def main():

    print()
    print("=" * 40)
    print("JeppIran V16 classifier")
    print("=" * 40)
    print()

    input_file = find_input_file()

    print(
        f"Input: {input_file}"
    )

    data = load_json(
        input_file
    )

    records = extract_records(
        data
    )

    print(
        f"Input records: {len(records)}"
    )

    # --------------------------------------------------------
    # Process
    # --------------------------------------------------------

    processed = []

    for record in records:
        processed.append(
            process_record(record)
        )

    processed = sort_records(
        processed
    )

    # --------------------------------------------------------
    # Build outputs
    # --------------------------------------------------------

    app_index = build_app_index(
        processed
    )

    summary = build_summary(
        processed
    )

    # --------------------------------------------------------
    # Validate
    # --------------------------------------------------------

    errors = validate(
        processed,
        summary,
    )

    if errors:

        print()
        print("=" * 40)
        print("V16 VALIDATION ERRORS")
        print("=" * 40)
        print()

        for error in errors:
            print(
                f"ERROR: {error}"
            )

        print()
        print(
            f"Total validation errors: "
            f"{len(errors)}"
        )

        # Do not stop the workflow.
        # Outputs are still generated so they can be inspected.

    else:

        print()
        print("=" * 40)
        print("V16 VALIDATION")
        print("=" * 40)
        print()
        print(
            "ALL VALIDATED BLOCKS PASSED"
        )

    # --------------------------------------------------------
    # Save index
    # --------------------------------------------------------

    save_json(
        OUTPUT_INDEX,
        processed,
    )

    # --------------------------------------------------------
    # Save app index
    # --------------------------------------------------------

    save_json(
        OUTPUT_APP,
        app_index,
    )

    # --------------------------------------------------------
    # Save summary
    # --------------------------------------------------------

    save_json(
        OUTPUT_SUMMARY,
        summary,
    )

    # --------------------------------------------------------
    # Print summary
    # --------------------------------------------------------

    print_summary(
        summary
    )

    # --------------------------------------------------------
    # Print samples
    # --------------------------------------------------------

    print_samples(
        processed
    )

    # --------------------------------------------------------
    # IMPORTANT OICC CHECK
    # --------------------------------------------------------

    print_oicc(
        processed
    )

    # --------------------------------------------------------
    # Output files
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
            "V16 completed with validation warnings."
        )
    else:
        print(
            "V16 completed successfully."
        )


if __name__ == "__main__":
    main()
