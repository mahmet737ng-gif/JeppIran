import json
import re

INPUT_FILE = "charts-index-v9.json"
OUTPUT_INDEX = "charts-index-v12.json"
OUTPUT_APP = "charts-app-v12.json"


# ---------------------------------------------------------
# Noise words / values that should never become chart names
# ---------------------------------------------------------

NOISE_EXACT = {
    "FL100",
    "FL110",
    "FL120",
    "FL130",
    "FL140",
    "FL150",
    "FL160",
    "FL170",
    "FL180",
    "FL190",
    "FL200",
    "FL210",
    "FL220",
    "FL230",
    "FL240",
    "FL250",
    "FL260",
    "FL270",
    "FL280",
    "FL290",
    "FL300",
    "FL310",
    "FL320",
    "FL330",
    "FL340",
    "FL350",
    "FL360",
    "FL370",
    "FL380",
    "FL390",
    "FL400",
    "FL410",

    "CONTOUR",
    "TEHRAN",
    "MSD",
    "GO",
    "MI O",
    "MIO",

    "ARRIVAL",
    "DEPARTURE",
}


# ---------------------------------------------------------
# Basic text cleaning
# ---------------------------------------------------------

def clean_spaces(text):
    text = re.sub(r"\s+", " ", text)
    return text.strip()


def normalize_line(line):
    line = line.replace("\x00", " ")
    line = clean_spaces(line)
    return line


def is_noise(text):
    value = clean_spaces(text).upper()

    if not value:
        return True

    if value in NOISE_EXACT:
        return True

    # Pure flight-level values
    if re.fullmatch(r"FL\d{2,3}", value):
        return True

    # Pure altitude values
    if re.fullmatch(r"\d{3,5}", value):
        return True

    return False


# ---------------------------------------------------------
# Read page text
# ---------------------------------------------------------

def get_page_text(item):
    if "text" in item:
        return item.get("text", "")

    if "page_text" in item:
        return item.get("page_text", "")

    if "content" in item:
        return item.get("content", "")

    return ""


def get_lines(item):
    text = get_page_text(item)

    lines = []

    for raw in text.splitlines():
        line = normalize_line(raw)

        if line:
            lines.append(line)

    return lines


# ---------------------------------------------------------
# MULTI PROCEDURE EXTRACTION
#
# Example:
#
# EGVAX 1X [EGVA1X]
# EGVAX 1Y [EGVA1Y]
# ITIBI 1X [ITIB1X]
#
# becomes:
#
# EGVA1X, EGVA1Y, ITIB1X
# ---------------------------------------------------------

def extract_all_bracket_codes(lines):

    results = []
    seen = set()

    # ICAO/procedure-style codes inside brackets.
    #
    # Examples:
    # [EGVA1X]
    # [GABS1A]
    # [BOXA1P]
    # [MIVA4N]
    # [TANB1T]
    #
    pattern = re.compile(
        r"\[([A-Z0-9][A-Z0-9.-]{2,15})\]"
    )

    for line in lines:

        matches = pattern.findall(line)

        for code in matches:

            code = code.strip().upper()

            if not code:
                continue

            if is_noise(code):
                continue

            # Ignore obvious non-procedure bracket text
            if code in {
                "RWY",
                "ILS",
                "LOC",
                "VOR",
                "NDB",
                "DME",
                "RNAV",
                "RNP",
                "STAR",
                "SID",
            }:
                continue

            if code not in seen:
                seen.add(code)
                results.append(code)

    return results


# ---------------------------------------------------------
# Procedure without brackets
#
# Used only when a page does not contain bracketed codes.
# ---------------------------------------------------------

def extract_plain_procedures(lines):

    results = []
    seen = set()

    patterns = [

        # Example:
        # RUS 4C
        # SAV 2N
        # PAMTU 1A
        # BOTEK 2N
        re.compile(
            r"\b([A-Z]{2,8})\s+([0-9]{1,2}[A-Z])\b"
        ),

        # Example:
        # EGVAX 1X
        # ITIBI 1E
        re.compile(
            r"\b([A-Z]{3,8})\s+([0-9][A-Z])\b"
        ),
    ]

    for line in lines:

        upper = line.upper()

        # Skip lines that are clearly not procedure names
        if "RWY" in upper:
            continue

        if "ILS" in upper:
            continue

        if "LOC" in upper:
            continue

        if "VOR" in upper:
            continue

        if "NDB" in upper:
            continue

        if "AIRPORT" in upper:
            continue

        if "AERODROME" in upper:
            continue

        for pattern in patterns:

            for match in pattern.finditer(upper):

                name = clean_spaces(
                    f"{match.group(1)} {match.group(2)}"
                )

                if is_noise(name):
                    continue

                if name not in seen:
                    seen.add(name)
                    results.append(name)

    return results


# ---------------------------------------------------------
# STAR / SID name
# ---------------------------------------------------------

def get_star_sid_name(lines):

    # FIRST PRIORITY:
    # all bracket codes on this page
    bracket_codes = extract_all_bracket_codes(lines)

    if bracket_codes:
        return ", ".join(bracket_codes)

    # SECOND PRIORITY:
    # plain procedure names
    plain = extract_plain_procedures(lines)

    if plain:
        return ", ".join(plain)

    return ""


# ---------------------------------------------------------
# Approach names
# ---------------------------------------------------------

def get_approach_name(lines):

    approaches = []
    seen = set()

    pattern = re.compile(
        r"\b("
        r"ILS(?:\s+[A-Z])?"
        r"|ILS"
        r"|VOR(?:\s+DME)?(?:\s+[A-Z0-9]+)?"
        r"|NDB"
        r"|RNAV"
        r"|RNP"
        r"|SRA"
        r"|LDA"
        r"|GLS"
        r")"
        r"(?:\s+OR\s+LOC(?:\s+[A-Z])?)?"
        r"\s+RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
        re.IGNORECASE
    )

    for line in lines:

        upper = clean_spaces(line.upper())

        match = pattern.search(upper)

        if not match:
            continue

        method = clean_spaces(match.group(1).upper())

        runway = match.group(2).upper()

        # Normalize common wording
        method = method.replace(
            "VOR DME",
            "VOR DME"
        )

        result = f"{method} RWY {runway}"

        if result not in seen:
            seen.add(result)
            approaches.append(result)

    return ", ".join(approaches)


# ---------------------------------------------------------
# Airport names
# ---------------------------------------------------------

def get_airport_name(lines):

    for line in lines:

        upper = line.upper()

        if "AIRPORT INFORMATION" in upper:
            return "AIRPORT INFORMATION"

        if "AERODROME INFORMATION" in upper:
            return "AERODROME INFORMATION"

        if "AIRPORT CHART" in upper:
            return "AIRPORT CHART"

        if "AERODROME CHART" in upper:
            return "AERODROME CHART"

    return "AIRPORT CHART"


# ---------------------------------------------------------
# Other
# ---------------------------------------------------------

def get_other_name(lines, page):

    # Try to find a useful short heading
    for line in lines:

        value = clean_spaces(line)

        if len(value) < 4:
            continue

        upper = value.upper()

        if upper in {
            "JEPPESEN",
            "JEPPVIEW",
            "NOT FOR NAVIGATION",
        }:
            continue

        if "COPYRIGHT" in upper:
            continue

        if "REVISION" in upper:
            continue

        if "CHANGE" in upper:
            continue

        return value[:120]

    return f"Chart page {page}"


# ---------------------------------------------------------
# Process one chart
# ---------------------------------------------------------

def build_chart_name(category, item):

    page = item.get("page", 0)

    lines = get_lines(item)

    if category in ("STAR", "SID"):

        name = get_star_sid_name(lines)

        if name:
            return name

        return f"Chart page {page}"

    if category == "Approach":

        name = get_approach_name(lines)

        if name:
            return name

        return f"Chart page {page}"

    if category == "Airport":

        return get_airport_name(lines)

    return get_other_name(lines, page)


# ---------------------------------------------------------
# Main
# ---------------------------------------------------------

with open(INPUT_FILE, "r", encoding="utf-8") as f:
    source = json.load(f)


output_index = {}
output_app = {}


for icao, airport in source.items():

    output_index[icao] = dict(airport)
    output_app[icao] = {
        "country": airport.get("country", ""),
        "charts": {}
    }

    charts = airport.get("charts", {})

    for category, items in charts.items():

        new_items = []

        for item in items:

            new_item = dict(item)

            new_item["name"] = build_chart_name(
                category,
                item
            )

            new_items.append(new_item)

        output_index[icao]["charts"][category] = new_items
        output_app[icao]["charts"][category] = new_items


# ---------------------------------------------------------
# Save
# ---------------------------------------------------------

with open(
    OUTPUT_INDEX,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        output_index,
        f,
        ensure_ascii=False,
        indent=2
    )


with open(
    OUTPUT_APP,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        output_app,
        f,
        ensure_ascii=False,
        indent=2
    )


# ---------------------------------------------------------
# Validation
# ---------------------------------------------------------

print()
print("=" * 60)
print("V12 VALIDATION")
print("=" * 60)


TEST_AIRPORTS = {
    "OIAW": [29, 32, 41],
    "OIMM": [365, 371, 377],
    "OIZC": [589, 591],
}


for icao, pages in TEST_AIRPORTS.items():

    print()
    print("=" * 60)
    print(icao)
    print("=" * 60)

    airport = output_index.get(icao, {})
    charts = airport.get("charts", {})

    for category, items in charts.items():

        selected = [
            item for item in items
            if item.get("page") in pages
        ]

        if not selected:
            continue

        print()
        print(f"[{category}]")

        for item in selected:

            print(
                f"Page {item.get('page')}: "
                f"{item.get('name')}"
            )


print()
print("=" * 60)
print("V12 COMPLETE")
print("=" * 60)
