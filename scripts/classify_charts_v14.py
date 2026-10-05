import json
import re

INPUT_FILE = "charts-index-v12.json"
OUTPUT_INDEX = "charts-index-v14.json"
OUTPUT_APP = "charts-app-v14.json"
OUTPUT_SUMMARY = "charts-summary-v14.json"

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


def clean_spaces(text):
    return re.sub(r"\s+", " ", text).strip()


def detect_chart_number(text):
    upper = text.upper()

    # Longest/specific patterns first.
    patterns = [
        r"\b(10-9[A-Z]?[0-9]*)\b",
        r"\b(10-3[A-Z]?[0-9]*)\b",
        r"\b(10-2[A-Z]?[0-9]*)\b",
        r"\b(10-1[A-Z]?[0-9]*)\b",
        r"\b(11-[0-9]{1,2}[A-Z]?)\b",
        r"\b(12-[0-9]{1,2}[A-Z]?)\b",
        r"\b(13-[0-9]{1,2}[A-Z]?)\b",
        r"\b(14-[0-9]{1,2}[A-Z]?)\b",
        r"\b(15-[0-9]{1,2}[A-Z]?)\b",
        r"\b(16-[0-9]{1,2}[A-Z]?)\b",
        r"\b(17-[0-9]{1,2}[A-Z]?)\b",
    ]

    for pattern in patterns:
        match = re.search(pattern, upper)

        if match:
            return match.group(1)

    return ""


def classify_from_chart_number(chart_number):
    if not chart_number:
        return None

    # ------------------------------------------------------------
    # Airport chart family
    # ------------------------------------------------------------
    if chart_number.startswith("10-9"):
        return "Airport"

    # ------------------------------------------------------------
    # STAR / Arrival family
    # ------------------------------------------------------------
    if chart_number.startswith("10-2"):
        return "STAR"

    # ------------------------------------------------------------
    # SID / Departure family
    # ------------------------------------------------------------
    if chart_number.startswith("10-3"):
        return "SID"

    # ------------------------------------------------------------
    # 10-1 family = general / radar / minimum altitude etc.
    # ------------------------------------------------------------
    if chart_number.startswith("10-1"):
        return "Other"

    # ------------------------------------------------------------
    # Approach families
    # ------------------------------------------------------------
    if re.match(
        r"^(11|13|14|15|16|17)-",
        chart_number
    ):
        return "Approach"

    return None


def classify_from_text(text):
    upper = text.upper()

    # ------------------------------------------------------------
    # IMPORTANT:
    # Airport information MUST be checked BEFORE approach words.
    # ------------------------------------------------------------
    airport_terms = [
        "AIRPORT INFORMATION",
        "AERODROME INFORMATION",
        "AIRPORT CHART",
        "AERODROME CHART",
    ]

    for term in airport_terms:
        if term in upper:
            return "Airport"

    # ------------------------------------------------------------
    # Explicit STAR / SID
    # ------------------------------------------------------------
    if ".STAR." in upper:
        return "STAR"

    if ".SID." in upper:
        return "SID"

    # ------------------------------------------------------------
    # Strong approach indicators only.
    #
    # Do NOT classify a page as Approach merely because
    # it contains ILS / VOR / LOC / NDB somewhere in the text.
    # ------------------------------------------------------------
    strong_approach_terms = [
        "INSTRUMENT APPROACH",
        "INSTRUMENT APPROACH PROCEDURE",
        "ACFT EXECUTING INSTRUMENT APPROACH",
        "MISSED APPROACH",
    ]

    for term in strong_approach_terms:
        if term in upper:
            return "Approach"

    # ------------------------------------------------------------
    # Procedure text patterns
    # ------------------------------------------------------------

    approach_patterns = [
        r"\bILS\s+[XYZ]\s+OR\s+LOC\s+[XYZ]\s+RWY\b",
        r"\bILS\s+OR\s+LOC\s+RWY\b",
        r"\bVOR(?:\s+DME)?(?:\s+[A-Z0-9]+)?\s+RWY\b",
        r"\bNDB\s+RWY\b",
        r"\bRNAV.*\bRWY\b",
        r"\bRNP.*\bRWY\b",
        r"\bGLS.*\bRWY\b",
        r"\bLDA.*\bRWY\b",
    ]

    for pattern in approach_patterns:
        if re.search(pattern, upper):
            return "Approach"

    return None


def classify_page(item):

    text = item.get(
        "text",
        ""
    )

    # ============================================================
    # 1. Airport information/chart gets highest priority.
    # ============================================================

    text_category = classify_from_text(text)

    if text_category == "Airport":
        chart_number = detect_chart_number(text)

        return "Airport", chart_number

    # ============================================================
    # 2. Chart number classification.
    # ============================================================

    chart_number = detect_chart_number(text)

    category = classify_from_chart_number(
        chart_number
    )

    if category:
        return category, chart_number

    # ============================================================
    # 3. Remaining textual classification.
    # ============================================================

    if text_category:
        return text_category, chart_number

    # ============================================================
    # 4. Preserve V12 classification as fallback.
    # ============================================================

    old_category = item.get(
        "category"
    )

    if old_category in CATEGORIES:
        return old_category, chart_number

    return "Other", chart_number


def build_app(output_index):

    app = {}

    for page_key, item in output_index.items():

        airport = item.get(
            "airport"
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
                "country": COUNTRY_PREFIXES.get(
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

        app[airport]["charts"][category].append(
            {
                "page": item.get(
                    "page",
                    int(page_key)
                ),
                "name": item.get(
                    "name",
                    f"Chart page {page_key}"
                )
            }
        )

    # Sort everything by PDF page.
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


output_index = {}

category_counts = {
    "Airport": 0,
    "STAR": 0,
    "SID": 0,
    "Approach": 0,
    "Other": 0,
}


# ================================================================
# CLASSIFY ALL PAGES
# ================================================================

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

    output_index[
        str(
            item.get(
                "page",
                int(page_key)
            )
        )
    ] = new_item

    category_counts[
        category
    ] += 1


# ================================================================
# SORT PAGES
# ================================================================

output_index = dict(
    sorted(
        output_index.items(),
        key=lambda x: int(x[0])
    )
)


# ================================================================
# BUILD APP DATABASE
# ================================================================

output_app = build_app(
    output_index
)


# ================================================================
# SUMMARY
# ================================================================

summary = {
    "source": "Iran2620.pdf",
    "pages": len(output_index),
    "category_counts": category_counts,
    "airport_count": len(output_app),
    "airports": {},
}


for icao, airport in sorted(
    output_app.items()
):

    charts = airport["charts"]

    summary["airports"][icao] = {
        "country": airport["country"],
        "Airport": len(
            charts["Airport"]
        ),
        "STAR": len(
            charts["STAR"]
        ),
        "SID": len(
            charts["SID"]
        ),
        "Approach": len(
            charts["Approach"]
        ),
        "Other": len(
            charts["Other"]
        ),
    }


# ================================================================
# WRITE OUTPUT FILES
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
print("V14 SUMMARY")
print("=" * 70)

print()
print("TOTAL PAGES:")
print(len(output_index))

print()
print("CATEGORY COUNTS:")

for category in CATEGORIES:

    print(
        f"{category}: "
        f"{category_counts[category]}"
    )


print()
print("=" * 70)
print("V14 SAMPLE PAGES")
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
print("V14 COMPLETE")
print("=" * 70)
