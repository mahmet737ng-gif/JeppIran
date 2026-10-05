import json
import re

INPUT_FILE = "charts-index-v12.json"
OUTPUT_INDEX = "charts-index-v13.json"
OUTPUT_APP = "charts-app-v13.json"
OUTPUT_SUMMARY = "charts-summary-v13.json"

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


def get_lines(text):
    return [
        clean_spaces(line)
        for line in text.splitlines()
        if clean_spaces(line)
    ]


def detect_chart_number(text):
    """
    Detect Jeppesen chart number such as:
    10-1
    10-1R
    10-2
    10-3
    10-9
    11-1
    13-1
    16-1
    """

    patterns = [
        r"\b(10-[0-9]{1,2}[A-Z]?)\b",
        r"\b(11-[0-9]{1,2}[A-Z]?)\b",
        r"\b(12-[0-9]{1,2}[A-Z]?)\b",
        r"\b(13-[0-9]{1,2}[A-Z]?)\b",
        r"\b(14-[0-9]{1,2}[A-Z]?)\b",
        r"\b(15-[0-9]{1,2}[A-Z]?)\b",
        r"\b(16-[0-9]{1,2}[A-Z]?)\b",
        r"\b(17-[0-9]{1,2}[A-Z]?)\b",
    ]

    upper = text.upper()

    for pattern in patterns:
        match = re.search(pattern, upper)
        if match:
            return match.group(1)

    return ""


def classify_from_chart_number(chart_number):
    """
    Jeppesen chart family classification.

    10-2 = STAR / Arrival
    10-3 = SID / Departure
    10-9 = Airport / Aerodrome
    11/13/14/15/16/17 = Approach families

    10-1 and 10-1R remain Other.
    """

    if not chart_number:
        return None

    if chart_number.startswith("10-1"):
        return "Other"

    if chart_number.startswith("10-2"):
        return "STAR"

    if chart_number.startswith("10-3"):
        return "SID"

    if chart_number.startswith("10-9"):
        return "Airport"

    if re.match(r"^(11|13|14|15|16|17)-", chart_number):
        return "Approach"

    return None


def classify_from_text(text):
    """
    Secondary textual classification.
    Used only when chart number is not sufficient.
    """

    upper = text.upper()

    # Explicit procedure labels have highest priority.
    if re.search(r"\b\.STAR\.", upper):
        return "STAR"

    if re.search(r"\b\.SID\.", upper):
        return "SID"

    # Strong approach indicators.
    approach_patterns = [
        "INSTRUMENT APPROACH",
        "INSTRUMENT APPROACH PROCEDURE",
        "ACFT EXECUTING INSTRUMENT APPROACH",
        "MISSED APPROACH",
        "ILS",
        "LOC",
        "VOR",
        "NDB",
        "RNAV",
        "RNP",
        "VOR/DME",
        "VOR DME",
    ]

    if any(pattern in upper for pattern in approach_patterns):
        return "Approach"

    # Airport information/chart.
    airport_patterns = [
        "AIRPORT INFORMATION",
        "AERODROME INFORMATION",
        "AIRPORT CHART",
        "AERODROME CHART",
    ]

    if any(pattern in upper for pattern in airport_patterns):
        return "Airport"

    return None


def classify_page(item):
    text = item.get("text", "")

    # 1. Chart number is the primary source.
    chart_number = detect_chart_number(text)

    category = classify_from_chart_number(chart_number)

    if category:
        return category, chart_number

    # 2. Explicit textual indicators.
    category = classify_from_text(text)

    if category:
        return category, chart_number

    # 3. Preserve existing V12 category only as a final fallback.
    old_category = item.get("category")

    if old_category in CATEGORIES:
        return old_category, chart_number

    return "Other", chart_number


def build_app(output_index):
    app = {}

    for page_key, item in output_index.items():

        airport = item.get("airport")

        if not airport:
            continue

        category = item.get("category")

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

        app[airport]["charts"][category].append({
            "page": item.get(
                "page",
                int(page_key)
            ),
            "name": item.get(
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


with open(INPUT_FILE, "r", encoding="utf-8") as f:
    source = json.load(f)


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

    category, chart_number = classify_page(item)

    new_item["category"] = category

    if chart_number:
        new_item["chart_number"] = chart_number

    output_index[str(
        item.get("page", int(page_key))
    )] = new_item

    category_counts[category] += 1


output_index = dict(
    sorted(
        output_index.items(),
        key=lambda x: int(x[0])
    )
)


output_app = build_app(output_index)


summary = {
    "source": "Iran2620.pdf",
    "pages": len(output_index),
    "category_counts": category_counts,
    "airport_count": len(output_app),
    "airports": {},
}


for icao, airport in sorted(output_app.items()):

    charts = airport["charts"]

    summary["airports"][icao] = {
        "country": airport["country"],
        "Airport": len(charts["Airport"]),
        "STAR": len(charts["STAR"]),
        "SID": len(charts["SID"]),
        "Approach": len(charts["Approach"]),
        "Other": len(charts["Other"]),
    }


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


print()
print("=" * 70)
print("V13 CLASSIFICATION")
print("=" * 70)

print()
print("TOTAL PAGES:", len(output_index))

print()
print("CATEGORY COUNTS:")

for category in CATEGORIES:
    print(
        f"{category}: "
        f"{category_counts[category]}"
    )


TEST_PAGES = [
    29,
    32,
    41,
    268,
    281,
    283,
    294,
    296,
    304,
    309,
    361,
    365,
    366,
    377,
    390,
    394,
    587,
    589,
    591,
    594,
    597,
]


print()
print("=" * 70)
print("V13 TEST PAGES")
print("=" * 70)


for page in TEST_PAGES:

    item = output_index.get(str(page))

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
print("V13 COMPLETE")
print("=" * 70)
