import json
import re

INPUT_FILE = "charts-index-v9.json"
OUTPUT_INDEX = "charts-index-v12.json"
OUTPUT_APP = "charts-app-v12.json"


# ---------------------------------------------------------
# Country prefixes
# ---------------------------------------------------------

COUNTRY_PREFIXES = {
    "OI": "Iran",
    "OR": "Iraq",
    "OM": "United Arab Emirates",
    "OO": "Oman",
    "LT": "Turkey",
    "UD": "Armenia",
    "UG": "Georgia",
}


# ---------------------------------------------------------
# Text helpers
# ---------------------------------------------------------

def clean_spaces(text):
    return re.sub(r"\s+", " ", text).strip()


def get_lines(text):
    lines = []

    for raw in text.splitlines():

        line = clean_spaces(raw)

        if line:
            lines.append(line)

    return lines


# ---------------------------------------------------------
# Extract ALL bracket codes from a page
#
# Example:
#
# EGVAX 1X [EGVA1X]
# EGVAX 1Y [EGVA1Y]
# EGVAX 1Z [EGVA1Z]
# ITIBI 1X [ITIB1X]
# ITIBI 1Y [ITIB1Y]
# ITIBI 1Z [ITIB1Z]
#
# Result:
#
# EGVA1X, EGVA1Y, EGVA1Z,
# ITIB1X, ITIB1Y, ITIB1Z
# ---------------------------------------------------------

def extract_bracket_codes(lines):

    results = []
    seen = set()

    pattern = re.compile(
        r"\[([A-Z0-9][A-Z0-9.-]{2,20})\]"
    )

    for line in lines:

        matches = pattern.findall(
            line.upper()
        )

        for code in matches:

            code = code.strip()

            if not code:
                continue

            # Ignore obvious non-procedure values
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
# Plain STAR/SID procedure extraction
#
# Used when a chart has no [CODE] notation.
# ---------------------------------------------------------

def extract_plain_procedures(lines):

    results = []
    seen = set()

    pattern = re.compile(
        r"\b([A-Z]{2,8})\s+([0-9]{1,2}[A-Z])\b"
    )

    for line in lines:

        upper = line.upper()

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

        matches = pattern.findall(upper)

        for first, second in matches:

            name = f"{first} {second}"

            if name not in seen:

                seen.add(name)
                results.append(name)

    return results


# ---------------------------------------------------------
# STAR / SID
# ---------------------------------------------------------

def get_star_sid_name(text):

    lines = get_lines(text)

    # FIRST:
    # use ALL bracket codes on the page
    bracket_codes = extract_bracket_codes(lines)

    if bracket_codes:
        return ", ".join(bracket_codes)

    # FALLBACK:
    # pages without bracket notation
    plain = extract_plain_procedures(lines)

    if plain:
        return ", ".join(plain)

    return ""


# ---------------------------------------------------------
# Approach
# ---------------------------------------------------------

def get_approach_name(text):

    lines = get_lines(text)

    results = []
    seen = set()

    patterns = [

        re.compile(
            r"\bILS\s+([XYZ])?\s*(?:OR\s+LOC\s+([XYZ])?)?"
            r"\s*RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            re.IGNORECASE
        ),

        re.compile(
            r"\bVOR(?:\s+DME)?(?:\s+[0-9A-Z]+)?"
            r"\s+RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            re.IGNORECASE
        ),

        re.compile(
            r"\bNDB\s+RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            re.IGNORECASE
        ),

        re.compile(
            r"\b(?:RNAV|RNP|SRA|LDA|GLS)"
            r"(?:\s+[A-Z0-9]+)*"
            r"\s+RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            re.IGNORECASE
        ),
    ]

    for line in lines:

        upper = line.upper()

        # -------------------------------------------------
        # ILS / LOC
        # -------------------------------------------------

        m = re.search(
            r"\bILS\s+([XYZ])?"
            r"(?:\s+OR\s+LOC\s+([XYZ])?)?"
            r"\s+RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            upper
        )

        if m:

            ils_variant = m.group(1)

            if ils_variant:
                name = f"ILS {ils_variant} OR LOC {ils_variant} RWY {m.group(3)}"
            else:
                name = f"ILS OR LOC RWY {m.group(3)}"

            if name not in seen:
                seen.add(name)
                results.append(name)

            continue

        # -------------------------------------------------
        # VOR / VOR DME
        # -------------------------------------------------

        m = re.search(
            r"\b(VOR(?:\s+DME)?(?:\s+[0-9A-Z]+)?)"
            r"\s+RWY\s+([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            upper
        )

        if m:

            name = (
                f"{clean_spaces(m.group(1))}"
                f" RWY {m.group(2)}"
            )

            if name not in seen:
                seen.add(name)
                results.append(name)

            continue

        # -------------------------------------------------
        # NDB
        # -------------------------------------------------

        m = re.search(
            r"\bNDB\s+RWY\s+"
            r"([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            upper
        )

        if m:

            name = f"NDB RWY {m.group(1)}"

            if name not in seen:
                seen.add(name)
                results.append(name)

            continue

        # -------------------------------------------------
        # RNAV / RNP / SRA / LDA / GLS
        # -------------------------------------------------

        m = re.search(
            r"\b(RNAV|RNP|SRA|LDA|GLS)"
            r"(?:\s+[A-Z0-9]+)*"
            r"\s+RWY\s+"
            r"([0-9]{1,2}[LRC]?(?:/[0-9]{1,2}[LRC]?)?)",
            upper
        )

        if m:

            name = (
                f"{m.group(1)} "
                f"RWY {m.group(2)}"
            )

            if name not in seen:
                seen.add(name)
                results.append(name)

    return ", ".join(results)


# ---------------------------------------------------------
# Airport
# ---------------------------------------------------------

def get_airport_name(text):

    upper = text.upper()

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

def get_other_name(text, page):

    lines = get_lines(text)

    for line in lines:

        upper = line.upper()

        if len(line) < 4:
            continue

        if "JEPPESEN" in upper:
            continue

        if "COPYRIGHT" in upper:
            continue

        if "REVISION" in upper:
            continue

        if "CHANGES:" in upper:
            continue

        if "PRINTED FROM JEPPVIEW" in upper:
            continue

        return line[:120]

    return f"Chart page {page}"


# ---------------------------------------------------------
# Build name
# ---------------------------------------------------------

def build_chart_name(
    category,
    text,
    page
):

    if category in (
        "STAR",
        "SID"
    ):

        name = get_star_sid_name(
            text
        )

        if name:
            return name

        return f"Chart page {page}"

    if category == "Approach":

        name = get_approach_name(
            text
        )

        if name:
            return name

        return f"Chart page {page}"

    if category == "Airport":

        return get_airport_name(
            text
        )

    return get_other_name(
        text,
        page
    )


# ---------------------------------------------------------
# Load V9 index
# ---------------------------------------------------------

with open(
    INPUT_FILE,
    "r",
    encoding="utf-8"
) as f:

    source = json.load(f)


# ---------------------------------------------------------
# V12 index
# ---------------------------------------------------------

output_index = {}


# ---------------------------------------------------------
# V12 application database
# ---------------------------------------------------------

output_app = {}


# ---------------------------------------------------------
# Process every PDF page
#
# V9 index is:
#
# {
#   "1": {...},
#   "2": {...},
#   ...
# }
# ---------------------------------------------------------

for page_key, item in source.items():

    page = item.get(
        "page",
        int(page_key)
    )

    category = item.get(
        "category",
        "Unknown"
    )

    airport = item.get(
        "airport"
    )

    text = item.get(
        "text",
        ""
    )

    name = build_chart_name(
        category,
        text,
        page
    )

    new_item = dict(item)

    new_item["name"] = name

    output_index[
        str(page)
    ] = new_item

    # -----------------------------------------------------
    # Build application database
    # -----------------------------------------------------

    if not airport:
        continue

    if airport not in output_app:

        output_app[airport] = {
            "country": COUNTRY_PREFIXES.get(
                airport[:2],
                ""
            ),
            "charts": {
                "Airport": [],
                "STAR": [],
                "SID": [],
                "Approach": [],
                "Other": []
            }
        }

    if category not in output_app[airport]["charts"]:

        continue

    output_app[
        airport
    ]["charts"][category].append({

        "page": page,

        "name": name

    })


# ---------------------------------------------------------
# Sort pages
# ---------------------------------------------------------

output_index = dict(
    sorted(
        output_index.items(),
        key=lambda x: int(x[0])
    )
)


# ---------------------------------------------------------
# Sort charts inside every airport
# ---------------------------------------------------------

for airport in output_app.values():

    for category in airport["charts"]:

        airport["charts"][category].sort(
            key=lambda x: x["page"]
        )


# ---------------------------------------------------------
# Save index
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


# ---------------------------------------------------------
# Save application database
# ---------------------------------------------------------

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
print("=" * 70)
print("V12 VALIDATION")
print("=" * 70)


TESTS = {

    "OIAW": {
        "STAR": [29, 30, 31],
        "SID": [32, 33, 34, 35, 36, 37],
    },

    "OIZC": {
        "STAR": [589, 590],
        "SID": [591, 592, 593],
    },

    "OIMM": {
        "STAR": [
            365, 366, 367, 368,
            369, 370, 371, 372,
            373, 374, 375, 376
        ],

        "SID": [
            377, 378, 379, 380,
            381, 382, 383, 384,
            385, 386, 387, 388,
            389
        ],
    },

    "OIII": {
        "STAR": [
            238,
            243,
            281,
            282,
            285,
            286
        ],

        "SID": [
            250,
            252,
            296,
            297,
            301,
            302
        ],
    },
}


for icao, categories in TESTS.items():

    print()
    print("=" * 70)
    print(icao)
    print("=" * 70)

    airport = output_app.get(
        icao,
        {}
    )

    charts = airport.get(
        "charts",
        {}
    )

    for category, pages in categories.items():

        print()
        print(
            f"[{category}]"
        )

        items = charts.get(
            category,
            []
        )

        by_page = {
            item["page"]: item
            for item in items
        }

        for page in pages:

            item = by_page.get(
                page
            )

            if item:

                print(
                    f"Page {page}: "
                    f"{item['name']}"
                )

            else:

                print(
                    f"Page {page}: "
                    f"NOT FOUND"
                )


print()
print("=" * 70)
print("V12 COMPLETE")
print("=" * 70)

print()
print(
    f"Airports generated: "
    f"{len(output_app)}"
)

print(
    f"Pages processed: "
    f"{len(output_index)}"
)

print()
