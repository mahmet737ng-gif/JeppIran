import json
import re

INPUT_FILE = "charts-index-v12.json"

OUTPUT_INDEX = "charts-index-v16.json"
OUTPUT_APP = "charts-app-v16.json"
OUTPUT_SUMMARY = "charts-summary-v16.json"


COUNTRY_PREFIXES = {
    "OI": "Iran",
    "OR": "Iraq",
    "OM": "United Arab Emirates",
    "OO": "Oman",
    "LT": "Turkey",
    "UD": "Armenia",
    "UG": "Georgia",
}


CATEGORIES = [
    "Airport",
    "STAR",
    "SID",
    "Approach",
    "Other",
]


def detect_chart_number(text):

    upper = text.upper()

    patterns = [

        r"\b10-9[A-Z0-9]*\b",
        r"\b10-2[A-Z0-9]*\b",
        r"\b10-3[A-Z0-9]*\b",
        r"\b10-1[A-Z0-9]*\b",

        r"\b11-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b13-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b14-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b15-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b16-[0-9]{1,3}[A-Z0-9]*\b",
        r"\b17-[0-9]{1,3}[A-Z0-9]*\b",
    ]

    for pattern in patterns:

        match = re.search(
            pattern,
            upper
        )

        if match:
            return match.group(0)

    return ""


def category_from_chart_number(chart_number):

    if not chart_number:
        return None

    if chart_number.startswith("10-9"):
        return "Airport"

    if chart_number.startswith("10-2"):
        return "STAR"

    if chart_number.startswith("10-3"):
        return "SID"

    if chart_number.startswith("10-1"):
        return "Other"

    if re.match(
        r"^(11|13|14|15|16|17)-",
        chart_number
    ):
        return "Approach"

    return None


def airport_information(text):

    upper = text.upper()

    return (
        "AIRPORT INFORMATION" in upper
        or
        "AERODROME INFORMATION" in upper
    )


def airport_chart(text):

    upper = text.upper()

    return (
        "AIRPORT CHART" in upper
        or
        "AERODROME CHART" in upper
    )


def explicit_star(text):

    return ".STAR." in text.upper()


def explicit_sid(text):

    return ".SID." in text.upper()


def strong_approach(text):

    upper = text.upper()

    terms = [
        "INSTRUMENT APPROACH",
        "INSTRUMENT APPROACH PROCEDURE",
        "ACFT EXECUTING INSTRUMENT APPROACH",
        "MISSED APPROACH",
        "APPROACH PROCEDURE",
    ]

    return any(
        term in upper
        for term in terms
    )


def approach_procedure(text):

    upper = text.upper()

    procedures = [
        "ILS",
        "LOC",
        "VOR",
        "VOR/DME",
        "VOR DME",
        "NDB",
        "RNAV",
        "RNP",
        "GLS",
        "LDA",
        "SDF",
    ]

    runway = (
        "RWY" in upper
        or
        "RUNWAY" in upper
    )

    procedure = any(
        item in upper
        for item in procedures
    )

    return procedure and runway


def classify_text(text):

    if airport_information(text):
        return "Airport"

    if airport_chart(text):
        return "Airport"

    if explicit_star(text):
        return "STAR"

    if explicit_sid(text):
        return "SID"

    if strong_approach(text):
        return "Approach"

    if approach_procedure(text):
        return "Approach"

    return None


def classify_page(item):

    text = item.get(
        "text",
        ""
    )

    old_category = item.get(
        "category"
    )

    # ============================================================
    # 1. AIRPORT INFORMATION
    # ============================================================

    if airport_information(text):

        return (
            "Airport",
            detect_chart_number(text)
        )

    # ============================================================
    # 2. EXPLICIT CHART NUMBER
    # ============================================================

    chart_number = detect_chart_number(
        text
    )

    number_category = category_from_chart_number(
        chart_number
    )

    if number_category:

        return (
            number_category,
            chart_number
        )

    # ============================================================
    # 3. EXPLICIT STAR / SID
    # ============================================================

    if explicit_star(text):

        return (
            "STAR",
            chart_number
        )

    if explicit_sid(text):

        return (
            "SID",
            chart_number
        )

    # ============================================================
    # 4. STRONG APPROACH TEXT
    # ============================================================

    if strong_approach(text):

        return (
            "Approach",
            chart_number
        )

    # ============================================================
    # 5. APPROACH PROCEDURE + RUNWAY
    # ============================================================

    if approach_procedure(text):

        return (
            "Approach",
            chart_number
        )

    # ============================================================
    # 6. PRESERVE ORIGINAL V9/V12 CATEGORY
    # ============================================================

    if old_category in CATEGORIES:

        return (
            old_category,
            chart_number
        )

    return (
        "Other",
        chart_number
    )


def build_app(index):

    app = {}

    for page_key, item in index.items():

        airport = item.get(
            "airport",
            ""
        )

        if not airport:
            continue

        category = item.get(
            "category"
        )

        if category not in CATEGORIES:
            continue

        if airport not in app:

            app[airport] = {

                "country":
                    COUNTRY_PREFIXES.get(
                        airport[:2],
                        ""
                    ),

                "charts": {

                    "Airport": [],
                    "STAR": [],
                    "SID": [],
                    "Approach": [],
                    "Other": [],
                }
            }

        app[airport]["charts"][category].append({

            "page":
                item.get(
                    "page",
                    int(page_key)
                ),

            "name":
                item.get(
                    "name",
                    f"Chart page {page_key}"
                )
        })

    for airport in app.values():

        for category in airport["charts"]:

            airport["charts"][category].sort(
                key=lambda x: x["page"]
            )

    return app


# ================================================================
# LOAD V12
# ================================================================

with open(
    INPUT_FILE,
    "r",
    encoding="utf-8"
) as f:

    source = json.load(f)


# ================================================================
# CLASSIFICATION
# ================================================================

output_index = {}

category_counts = {

    "Airport": 0,
    "STAR": 0,
    "SID": 0,
    "Approach": 0,
    "Other": 0,
}


for page_key, item in source.items():

    new_item = dict(item)

    category, chart_number = classify_page(
        item
    )

    new_item["category"] = category

    if chart_number:

        new_item["chart_number"] = (
            chart_number
        )

    page = item.get(
        "page",
        int(page_key)
    )

    output_index[
        str(page)
    ] = new_item

    category_counts[
        category
    ] += 1


output_index = dict(
    sorted(
        output_index.items(),
        key=lambda x: int(x[0])
    )
)


# ================================================================
# APP DATABASE
# ================================================================

output_app = build_app(
    output_index
)


# ================================================================
# SUMMARY
# ================================================================

summary = {

    "source":
        "Iran2620.pdf",

    "pages":
        len(output_index),

    "category_counts":
        category_counts,

    "airport_count":
        len(output_app),

    "airports":
        {},
}


for icao, airport in sorted(
    output_app.items()
):

    charts = airport["charts"]

    summary["airports"][icao] = {

        "country":
            airport["country"],

        "Airport":
            len(charts["Airport"]),

        "STAR":
            len(charts["STAR"]),

        "SID":
            len(charts["SID"]),

        "Approach":
            len(charts["Approach"]),

        "Other":
            len(charts["Other"]),
    }


# ================================================================
# WRITE FILES
# ================================================================

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


with open(
    OUTPUT_SUMMARY,
    "w",
    encoding="utf-8"
) as f:

    json.dump(
        summary,
        f,
        ensure_ascii=False,
        indent=2
    )


# ================================================================
# VALIDATION
# ================================================================

TEST_PAGES = [

    # OIAW
    27, 28, 29, 30, 31,
    32, 33, 34, 35, 36, 37,
    38, 39, 40,
    41, 42, 43, 44, 45,
    46, 47, 48, 49, 50, 51,

    # OIII
    268, 269, 270, 280, 281, 282,
    283, 284, 285, 286, 287, 288,
    289, 290, 291, 292, 293,
    294, 295, 296, 297, 298, 299,
    300, 301, 302, 303,
    304, 305, 306, 307, 308,
    309, 310, 311, 312, 313, 314,

    # OIMM
    361, 362, 363, 364, 365,
    366, 367, 368, 369, 370,
    371, 372, 373, 374, 375, 376,
    377, 378, 379, 380, 381, 382,
    383, 384, 385, 386, 387, 388,
    389, 390, 391, 392, 393,
    394, 395, 396, 397, 398, 399,
    400, 401, 402, 403,

    # OIZC
    587, 588, 589, 590, 591,
    592, 593, 594, 595, 596,
    597, 598, 599, 600, 601,
]


print()
print("=" * 70)
print("V16 SUMMARY")
print("=" * 70)

print(
    f"Total pages: {len(output_index)}"
)

print()

for category in CATEGORIES:

    print(
        f"{category}: "
        f"{category_counts[category]}"
    )


print()
print("=" * 70)
print("V16 SAMPLE PAGES")
print("=" * 70)


for page in TEST_PAGES:

    item = output_index.get(
        str(page)
    )

    if not item:

        print(
            f"Page {page}: NOT FOUND"
        )

        continue

    print(
        f"Page {page}: "
        f"{item.get('category')} | "
        f"{item.get('chart_number', '')} | "
        f"{item.get('airport', '')} | "
        f"{item.get('name', '')}"
    )


print()
print("=" * 70)
print("V16 COMPLETE")
print("=" * 70)
