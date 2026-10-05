import json
import re
from pathlib import Path


INPUT_JSON = Path("charts-index-v9.json")
OUTPUT_JSON = Path("charts-index-v10.json")
OUTPUT_APP = Path("charts-app-v10.json")


# ------------------------------------------------------------
# Text helpers
# ------------------------------------------------------------

def normalize(text):
    return (
        text
        .replace("\x0c", "\n")
        .replace("\r", "\n")
    )


def clean_line(line):
    line = line.strip()

    line = re.sub(r"\s+", " ", line)

    return line.strip(" -|:")


def header_lines(text):
    text = normalize(text)

    lines = []

    for line in text.splitlines()[:45]:

        line = clean_line(line)

        if line:
            lines.append(line)

    return lines


# ------------------------------------------------------------
# Noise detection
# ------------------------------------------------------------

NOISE = {
    "JEPPESEN",
    "NAVIGATION",
    "AIRPORT",
    "AERODROME",
    "INFORMATION",
    "CHART",
    "NOT TO SCALE",
    "DO NOT USE",
    "TRANSITION",
    "COMMUNICATION",
    "FREQUENCY",
    "FREQUENCIES",
    "ELEVATION",
    "RUNWAY",
    "RWY",
    "PAGE",
    "COPYRIGHT",
    "AIRAC",
    "EFF",
    "EFFECTIVE",
    "NOTAM",
    "CHANGE",
    "CHANGES",
    "AMDT",
}


def looks_like_noise(line):

    upper = line.upper()

    if not line:
        return True

    if len(line) < 2:
        return True

    if upper in NOISE:
        return True

    if re.fullmatch(
        r"[\d\s./:-]+",
        line
    ):
        return True

    if re.search(
        r"\b(JEPPESEN|AIRAC|EFF|AMDT)\b",
        upper
    ):
        return True

    return False


# ------------------------------------------------------------
# Chart-number detection
# ------------------------------------------------------------

def chart_number(line):

    match = re.search(
        r"\b((?:10|11)-[A-Z0-9./-]+)\b",
        line.upper()
    )

    if match:
        return match.group(1)

    return None


# ------------------------------------------------------------
# Approach name
# ------------------------------------------------------------

def extract_approach_name(lines):

    candidates = []

    for i, line in enumerate(lines):

        upper = line.upper()

        # Typical approach names:
        #
        # ILS Y RWY 31L
        # ILS Z RWY 31L
        # RNAV (GNSS) RWY 13
        # RNP RWY 29
        # VOR/DME RWY 31
        # LOC RWY 13
        # NDB RWY 31
        #

        if re.search(
            r"\b(?:ILS|LOC|RNAV|RNP|VOR|NDB|SRA|LDA|GLS)\b",
            upper
        ):

            if "RWY" in upper:

                candidate = line

                candidate = re.sub(
                    r"\s+",
                    " ",
                    candidate
                )

                if 4 <= len(candidate) <= 80:

                    candidates.append(
                        candidate
                    )

    if candidates:

        # Prefer the shortest clean chart-title candidate.
        candidates.sort(
            key=lambda x: (
                len(x),
                x
            )
        )

        return candidates[0]

    return None


# ------------------------------------------------------------
# STAR / SID name
# ------------------------------------------------------------

def extract_route_name(
    lines,
    category
):

    candidates = []

    for i, line in enumerate(lines):

        upper = line.upper()

        # Ignore obvious text.
        if looks_like_noise(line):
            continue

        # Ignore long sentences.
        if len(line) > 80:
            continue

        # Ignore lines containing too much punctuation.
        if len(
            re.findall(
                r"[^A-Z0-9() /.-]",
                upper
            )
        ) > 2:
            continue

        # Explicit STAR/SID wording.
        if category == "STAR":

            if (
                "ARRIVAL" in upper
                or ".STAR." in upper
                or re.search(
                    r"\bSTAR\b",
                    upper
                )
            ):

                continue

        if category == "SID":

            if (
                "DEPARTURE" in upper
                or ".SID." in upper
                or re.search(
                    r"\bSID\b",
                    upper
                )
            ):

                continue

        # Reject pure ICAO/country/header lines.
        if re.fullmatch(
            r"[A-Z]{4}\s*/\s*[A-Z]{3}",
            upper
        ):
            continue

        if re.fullmatch(
            r"[A-Z]{4}",
            upper
        ):
            continue

        # Route names are usually relatively short.
        words = upper.split()

        if not (1 <= len(words) <= 8):
            continue

        # Require at least one meaningful alphabetic token.
        if not any(
            re.search(
                r"[A-Z]{2,}",
                word
            )
            for word in words
        ):
            continue

        candidates.append(line)

    if not candidates:
        return None

    # Prefer lines that contain a route-like number.
    numbered = [
        x for x in candidates
        if re.search(
            r"\b[A-Z]{2,}[0-9][A-Z0-9-]*\b",
            x.upper()
        )
    ]

    if numbered:
        candidates = numbered

    # Prefer concise titles.
    candidates.sort(
        key=lambda x: (
            len(x),
            x
        )
    )

    return candidates[0]


# ------------------------------------------------------------
# Airport chart name
# ------------------------------------------------------------

def extract_airport_name(lines):

    preferred = [
        "AERODROME CHART",
        "AIRPORT CHART",
        "AERODROME INFORMATION",
        "AIRPORT INFORMATION",
    ]

    for wanted in preferred:

        for line in lines:

            if wanted in line.upper():

                return wanted

    return "Airport Chart"


# ------------------------------------------------------------
# Main chart-name classifier
# ------------------------------------------------------------

def extract_chart_name(
    page_number,
    category,
    text
):

    lines = header_lines(text)

    # Approach
    if category == "Approach":

        name = extract_approach_name(
            lines
        )

        if name:
            return name

    # STAR / SID
    if category in (
        "STAR",
        "SID"
    ):

        name = extract_route_name(
            lines,
            category
        )

        if name:
            return name

    # Airport
    if category == "Airport":

        return extract_airport_name(
            lines
        )

    # Other
    if category == "Other":

        # Try to extract a meaningful header.
        for line in lines:

            if not looks_like_noise(line):

                if 3 <= len(line) <= 70:

                    return line

        return "Other Chart"

    return f"Chart page {page_number}"


# ------------------------------------------------------------
# Load old V9 index
# ------------------------------------------------------------

index = json.loads(
    INPUT_JSON.read_text(
        encoding="utf-8"
    )
)


# ------------------------------------------------------------
# Enrich every chart
# ------------------------------------------------------------

for airport, airport_data in index.items():

    charts = airport_data.get(
        "charts",
        {}
    )

    for category, chart_list in charts.items():

        for chart in chart_list:

            page = chart["page"]

            text_file = Path(
                "extracted",
                f"page-{page}.txt"
            )

            if text_file.exists():

                text = text_file.read_text(
                    encoding="utf-8",
                    errors="ignore"
                )

                name = extract_chart_name(
                    page,
                    category,
                    text
                )

            else:

                name = f"Chart page {page}"

            chart["name"] = name


# ------------------------------------------------------------
# Save detailed index
# ------------------------------------------------------------

OUTPUT_JSON.write_text(
    json.dumps(
        index,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)


# ------------------------------------------------------------
# Create app database
# ------------------------------------------------------------

app_data = {}

for airport, airport_data in index.items():

    app_data[airport] = {
        "country":
            airport_data.get(
                "country",
                "Unknown"
            ),
        "charts": {}
    }

    for category in [
        "STAR",
        "SID",
        "Airport",
        "Approach"
    ]:

        app_data[airport]["charts"][category] = []

        for chart in airport_data.get(
            "charts",
            {}
        ).get(category, []):

            app_data[airport]["charts"][category].append({

                "page":
                    chart["page"],

                "name":
                    chart.get(
                        "name",
                        f"Chart page {chart['page']}"
                    )
            })


# ------------------------------------------------------------
# Save app database
# ------------------------------------------------------------

OUTPUT_APP.write_text(
    json.dumps(
        app_data,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)


print("")
print("====================================")
print("V10 CHART NAME EXTRACTION")
print("====================================")
print(
    f"Airports: {len(app_data)}"
)
print(
    f"Output: {OUTPUT_APP}"
)
print("")


# ------------------------------------------------------------
# Show examples
# ------------------------------------------------------------

shown = 0

for airport, data in app_data.items():

    for category, charts in data["charts"].items():

        for chart in charts:

            print(
                airport,
                category,
                chart["page"],
                "=>",
                chart["name"]
            )

            shown += 1

            if shown >= 40:
                break

        if shown >= 40:
            break

    if shown >= 40:
        break
