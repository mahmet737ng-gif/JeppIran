import json
import re
from pathlib import Path


INDEX_FILE = Path("charts-index-v9.json")
OUTPUT_INDEX = Path("charts-index-v11.json")
OUTPUT_APP = Path("charts-app-v11.json")


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
    "FL420",
    "FL430",
    "FL440",
    "FL450",
    "CONTOUR",
    "TEHRAN",
    "MSD",
    "GO",
    "MI O",
    "MI",
    "O",
    "NIL",
    "NONE",
    "CHART",
    "PAGE",
    "AIRPORT",
    "INFORMATION",
}


PROCEDURE_KEYWORDS = (
    "RWY",
    "ILS",
    "LOC",
    "VOR",
    "NDB",
    "RNAV",
    "RNP",
    "SRA",
    "LDA",
    "GLS",
    "DME",
    "CAT",
)


def clean_spaces(text):
    return re.sub(r"\s+", " ", text).strip()


def normalize_line(line):
    line = line.replace("\x0c", " ")
    line = clean_spaces(line)
    return line


def is_noise(line):
    if not line:
        return True

    upper = line.upper().strip()

    if upper in NOISE_EXACT:
        return True

    if re.fullmatch(r"FL\d{2,3}", upper):
        return True

    if re.fullmatch(r"\d+", upper):
        return True

    if "CONTOUR" in upper and len(upper) < 30:
        return True

    if upper in {
        "TEHRAN",
        "AHWAZ",
        "MASHHAD",
        "KERMAN",
        "SHIRAZ",
        "TABRIZ",
        "YAZD",
        "ISFAHAN",
        "CHABAHAR",
        "ZAHEDAN",
        "RASHT",
        "BANDAR ABBAS",
    }:
        return True

    return False


def get_page_text(page):
    path = Path("extracted") / f"page-{page}.txt"

    if not path.exists():
        return ""

    return path.read_text(
        encoding="utf-8",
        errors="ignore"
    )


def get_lines(text):
    result = []

    for raw in text.splitlines():
        line = normalize_line(raw)

        if line:
            result.append(line)

    return result


def extract_bracket_procedure(lines):
    """
    Finds procedure names containing:
        NAME 1A [NAME1A]
        NAME 2N [NAME2N]
    """

    candidates = []

    for line in lines:

        if "[" not in line or "]" not in line:
            continue

        match = re.search(
            r"([A-Z0-9][A-Z0-9 .'\-/]{2,40})\s*\[([A-Z0-9]{3,12})\]",
            line,
            re.IGNORECASE
        )

        if not match:
            continue

        left = clean_spaces(match.group(1))
        code = match.group(2).upper()

        if is_noise(left):
            continue

        if re.search(r"\bFL\d{2,3}\b", left):
            continue

        if len(left) < 4:
            continue

        candidates.append(
            f"{left} [{code}]"
        )

    return candidates


def extract_procedure_without_brackets(lines):
    """
    Finds common STAR/SID procedure names when the
    PDF text extraction does not preserve brackets.
    """

    candidates = []

    pattern = re.compile(
        r"\b[A-Z]{3,7}\s+\d{1,2}[A-Z]\b"
    )

    for line in lines:

        upper = line.upper()

        if is_noise(upper):
            continue

        if any(
            keyword in upper
            for keyword in (
                "RWY",
                "ILS",
                "LOC",
                "VOR",
                "NDB",
                "RNAV",
                "RNP",
                "MISSED APPROACH",
                "AERODROME",
                "AIRPORT INFORMATION",
            )
        ):
            continue

        matches = pattern.findall(upper)

        for match in matches:

            candidate = clean_spaces(
                line
            )

            if len(candidate) <= 50:
                candidates.append(candidate)

    return candidates


def extract_approach_name(lines):
    """
    Extracts a clean approach name.

    Example:
      AHWAZ 28 NOV 25 11-1 ILS Z or LOC Z Rwy 30

    becomes:
      ILS Z or LOC Z RWY 30
    """

    candidates = []

    approach_pattern = re.compile(
        r"\b("
        r"ILS"
        r"|LOC"
        r"|VOR"
        r"|NDB"
        r"|RNAV"
        r"|RNP"
        r"|SRA"
        r"|LDA"
        r"|GLS"
        r")\b",
        re.IGNORECASE
    )

    for line in lines:

        upper = line.upper()

        match = approach_pattern.search(
            upper
        )

        if not match:
            continue

        if (
            "RWY" not in upper
            and
            "RUNWAY" not in upper
        ):
            continue

        start = match.start()

        candidate = upper[start:]

        candidate = re.sub(
            r"\b\d{1,2}-\d+\b",
            "",
            candidate
        )

        candidate = re.sub(
            r"\b\d{1,2}\s+[A-Z]{3}\s+\d{2}\b",
            "",
            candidate
        )

        candidate = re.sub(
            r"\b\d{1,2}\s+[A-Z]{3}\s+\d{2,4}\b",
            "",
            candidate
        )

        candidate = re.sub(
            r"\bRUNWAY\b",
            "RWY",
            candidate
        )

        candidate = clean_spaces(
            candidate
        )

        candidate = candidate.strip(
            " -–—"
        )

        if not candidate:
            continue

        if len(candidate) < 5:
            continue

        candidates.append(
            candidate
        )

    if not candidates:
        return None

    # Prefer the shortest clean approach title.
    candidates.sort(
        key=lambda x: (
            len(x),
            x
        )
    )

    return candidates[0]


def extract_airport_name(lines):
    for line in lines:

        upper = line.upper()

        if "AERODROME INFORMATION" in upper:
            return "AERODROME INFORMATION"

        if "AIRPORT INFORMATION" in upper:
            return "AIRPORT INFORMATION"

        if "AERODROME CHART" in upper:
            return "AERODROME CHART"

        if "AIRPORT CHART" in upper:
            return "AIRPORT CHART"

    return "AIRPORT CHART"


def clean_procedure_name(name):
    if not name:
        return None

    name = clean_spaces(name)

    # Remove accidental leading punctuation.
    name = name.strip(
        " .,:;|/-"
    )

    # Remove obvious extraction artifacts.
    name = re.sub(
        r"^\.*\s*0+\s*",
        "",
        name
    )

    name = clean_spaces(name)

    if is_noise(name):
        return None

    if len(name) < 3:
        return None

    return name


def get_best_star_sid_name(
    page,
    category
):
    text = get_page_text(page)

    if not text:
        return f"Chart page {page}"

    lines = get_lines(text)

    # ----------------------------------------------------------
    # 1. Highest priority: bracketed procedure
    # ----------------------------------------------------------

    bracketed = extract_bracket_procedure(
        lines
    )

    if bracketed:

        # Prefer the first meaningful procedure.
        for candidate in bracketed:

            cleaned = clean_procedure_name(
                candidate
            )

            if cleaned:
                return cleaned

    # ----------------------------------------------------------
    # 2. Procedure without brackets
    # ----------------------------------------------------------

    plain = extract_procedure_without_brackets(
        lines
    )

    for candidate in plain:

        cleaned = clean_procedure_name(
            candidate
        )

        if cleaned:
            return cleaned

    # ----------------------------------------------------------
    # 3. Search neighboring pages
    #
    # Some Jeppesen pages have very poor PDF text extraction.
    # Look at nearby pages in the same category.
    # ----------------------------------------------------------

    for offset in [-1, 1, -2, 2]:

        nearby = page + offset

        if nearby < 1:
            continue

        nearby_text = get_page_text(
            nearby
        )

        if not nearby_text:
            continue

        nearby_lines = get_lines(
            nearby_text
        )

        bracketed = extract_bracket_procedure(
            nearby_lines
        )

        if bracketed:

            for candidate in bracketed:

                cleaned = clean_procedure_name(
                    candidate
                )

                if cleaned:
                    return cleaned

    return f"Chart page {page}"


def get_approach_name(page):
    text = get_page_text(page)

    if not text:
        return f"Chart page {page}"

    lines = get_lines(text)

    name = extract_approach_name(
        lines
    )

    if name:
        return name

    # ----------------------------------------------------------
    # Neighbor fallback
    # ----------------------------------------------------------

    for offset in [-1, 1]:

        nearby = page + offset

        if nearby < 1:
            continue

        nearby_text = get_page_text(
            nearby
        )

        nearby_lines = get_lines(
            nearby_text
        )

        name = extract_approach_name(
            nearby_lines
        )

        if name:
            return name

    return f"Chart page {page}"


def get_airport_name(page):
    text = get_page_text(page)

    if not text:
        return "AIRPORT CHART"

    lines = get_lines(text)

    return extract_airport_name(
        lines
    )


def get_other_name(page):
    text = get_page_text(page)

    if not text:
        return f"Chart page {page}"

    lines = get_lines(text)

    for line in lines:

        if is_noise(line):
            continue

        if len(line) < 4:
            continue

        return line[:80]

    return f"Chart page {page}"


# ==============================================================
# LOAD V9
# ==============================================================

if not INDEX_FILE.exists():
    raise FileNotFoundError(
        "charts-index-v9.json not found"
    )


index = json.loads(
    INDEX_FILE.read_text(
        encoding="utf-8"
    )
)


# ==============================================================
# BUILD V11 INDEX
# ==============================================================

for airport, airport_data in index.items():

    charts = airport_data.get(
        "charts",
        {}
    )

    for category, items in charts.items():

        for item in items:

            page = item["page"]

            if category == "STAR":

                name = get_best_star_sid_name(
                    page,
                    "STAR"
                )

            elif category == "SID":

                name = get_best_star_sid_name(
                    page,
                    "SID"
                )

            elif category == "Approach":

                name = get_approach_name(
                    page
                )

            elif category == "Airport":

                name = get_airport_name(
                    page
                )

            else:

                name = get_other_name(
                    page
                )

            item["name"] = name


# ==============================================================
# SAVE V11 INDEX
# ==============================================================

OUTPUT_INDEX.write_text(
    json.dumps(
        index,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)


# ==============================================================
# BUILD APP DATABASE
# ==============================================================

app_data = {}


for airport, airport_data in index.items():

    app_data[airport] = {
        "country": airport_data.get(
            "country",
            "Unknown"
        ),
        "charts": {}
    }

    charts = airport_data.get(
        "charts",
        {}
    )

    for category in [
        "STAR",
        "SID",
        "Airport",
        "Approach"
    ]:

        app_data[airport]["charts"][
            category
        ] = []

        for item in charts.get(
            category,
            []
        ):

            app_data[airport]["charts"][
                category
            ].append(
                {
                    "page": item["page"],
                    "name": item.get(
                        "name",
                        f"Chart page {item['page']}"
                    )
                }
            )


OUTPUT_APP.write_text(
    json.dumps(
        app_data,
        ensure_ascii=False,
        indent=2
    ),
    encoding="utf-8"
)


# ==============================================================
# VALIDATION
# ==============================================================

print("")
print("=" * 70)
print("V11 CHART NAME EXTRACTION")
print("=" * 70)


TEST_AIRPORTS = [
    "OIAW",
    "OIII",
    "OIMM",
    "OIZC"
]


for airport in TEST_AIRPORTS:

    print("")
    print("=" * 70)
    print(airport)
    print("=" * 70)

    if airport not in app_data:

        print("AIRPORT NOT FOUND")
        continue

    charts = app_data[
        airport
    ]["charts"]

    for category in [
        "Airport",
        "STAR",
        "SID",
        "Approach"
    ]:

        print("")
        print(
            f"[{category}]"
        )

        for item in charts.get(
            category,
            []
        ):

            print(
                f"Page {item['page']}: "
                f"{item['name']}"
            )


print("")
print("=" * 70)
print("V11 COMPLETE")
print("=" * 70)

print(
    f"Created: {OUTPUT_INDEX}"
)

print(
    f"Created: {OUTPUT_APP}"
)
