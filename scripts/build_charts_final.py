#!/usr/bin/env python3
"""Build JEPPIRAN's final four-category chart index and official change metadata.

Input:
  charts-index-v16.json  - page text/classification generated from Iran2620.pdf
  app/src/main/assets/charts-manifest.json - per-airport PDF global/local page map

Output:
  charts-current-final.json
  chart-changes-final.json

The application exposes only AIRPORT / STAR / SID / APP. Change-notice pages are
kept out of the normal chart tree and are parsed into the Changes data source.
"""

import json
import os
import re
from pathlib import Path

INDEX = Path("charts-index-v16.json")
MANIFEST = Path("app/src/main/assets/charts-manifest.json")
OUT = Path("charts-current-final.json")
CHANGES_OUT = Path("chart-changes-final.json")

BRACKET = re.compile(r"\s*\[[^\]]+\]")
SPACE = re.compile(r"\s+")


def clean(value):
    return SPACE.sub(" ", str(value or "")).strip()


def page_text(item):
    return str(item.get("text") or item.get("raw_text") or item.get("content") or "")


def chart_number_from_text(text, existing=""):
    current = clean(existing).upper()
    if current and current != "20-2026":
        return current

    lines = [
        clean(line)
        for line in text.splitlines()
        if clean(line)
        and "PRINTED FROM JEPPVIEW" not in line.upper()
        and "TERMINAL CHART DATA CYCLE" not in line.upper()
    ]

    # Some large airport diagrams place the Jeppesen index away from the
    # normal text header, so inspect the whole extracted page after excluding
    # the injected cycle notice.
    body = "\n".join(lines).upper()

    matches = re.findall(
        r"\b(?:10|11|12|13|14|15|16|17|18|19|20|30|31|32)-[0-9A-Z]+\b",
        body,
    )

    for value in matches:
        if value != "20-2026":
            return value

    return ""


def canonical_airport_name(text, chart_number, existing):
    upper = text.upper()
    joined = clean(text).upper()
    number = clean(chart_number).upper()

    # Jeppesen index is authoritative for the base airport diagram/minima.
    if re.fullmatch(r"(?:10|20|30)-9", number):
        return "Airport Diagram Chart (ADC)"

    if re.fullmatch(r"(?:10|20|30)-9S[A-Z0-9]*", number):
        return "MINIMUMS"

    if re.fullmatch(r"(?:10|20|30)-1P[A-Z0-9]*", number):
        return "AIRPORT BRIEFING"

    if re.fullmatch(r"(?:10|20|30)-1R[A-Z0-9]*", number):
        return "RADAR MINIMUM ALTITUDES"

    if re.fullmatch(r"19-[A-Z0-9]+", number):
        return "AIRPORT QUALIFICATION"

    if number == "30-4":
        return "NOISE"

    if re.fullmatch(r"30-9B|30-9C", number):
        return "PARKING/DOCKING CHART (PDC)"

    if re.fullmatch(r"30-9D|30-9E", number):
        return "INS COORDINATES"

    if re.fullmatch(r"30-9H", number):
        return "TAXIWAY RESTRICTIONS"

    if re.fullmatch(r"30-9J[A-Z0-9]*", number):
        return "PUSHBACK PROCEDURES"

    if re.fullmatch(r"30-9U[A-Z0-9]*", number):
        return "REMOTE PARK AREA HOLDING PROCEDURE"

    if number == "30-9K" and "FOR CODE F ONLY" in upper:
        return "Airport Diagram Chart (ADC) - CODE F"

    if re.fullmatch(r"30-9A1", number):
        return "HOT SPOTS"

    if re.fullmatch(r"30-9A", number) and "ADDITIONAL RUNWAY INFORMATION" in upper:
        return "ADDITIONAL RUNWAY INFORMATION"

    # Dotted Jeppesen extracted headings are common (.AIRPORT.BRIEFING.).
    if re.search(r"AIRPORT[.\s]+QUALIFICATION", upper):
        return "AIRPORT QUALIFICATION"

    if re.search(r"AIRPORT[.\s]+BRIEFING", upper):
        return "AIRPORT BRIEFING"

    if re.search(r"RADAR[.\s]+MINIMUM[.\s]+ALTITUDES", upper):
        return "RADAR MINIMUM ALTITUDES"

    if "ADDITIONAL RUNWAY INFORMATION" in upper:
        return "ADDITIONAL RUNWAY INFORMATION"

    # 10-9A plan-view + stand table is the page the ADC references as
    # PARKING STANDS & COORDS. It can also contain hot-spot symbols.
    if number == "10-9A" and "INS COORDINATES" in upper and "APRON" in upper:
        return "PARKING STANDS & COORDS"

    # Taxi-route diagrams often contain HOT SPOTS legends; the route title is
    # the primary page identity and must win over that secondary legend.
    def taxi_route_title(kind):
        marker = f"TAXI ROUTES {kind}"
        pos = joined.find(marker)
        if pos < 0:
            marker = f"TAXI ROUTE {kind}"
            pos = joined.find(marker)
        if pos < 0:
            return ""

        snippet = joined[pos:pos + 280]

        rwys = re.search(
            r"\b(RWYS?)\s+"
            r"((?:[0-9]{1,2}[LRC]?"
            r"(?:\s*,\s*[0-9]{1,2}[LRC]?)*"
            r")(?:\s*\([0-9A-Z, /-]+\))?)",
            snippet,
        )

        if rwys:
            return f"TAXI ROUTES {kind} {rwys.group(1)} {clean(rwys.group(2))}"

        # Text extraction on dense diagrams can move the word RWYS away from
        # the runway pair. Recover the first unmistakable runway+route code.
        pair = re.search(
            r"\b([0-9]{1,2}[LRC]?\s*,\s*[0-9]{1,2}[LRC]?"
            r"\s*\([0-9A-Z, /-]+\))",
            snippet,
        )
        if pair:
            return f"TAXI ROUTES {kind} RWYS {clean(pair.group(1))}"

        single = re.search(
            r"\b([0-9]{1,2}[LRC]?\s*\([0-9A-Z, /-]+\))",
            snippet,
        )
        if single:
            return f"TAXI ROUTES {kind} RWY {clean(single.group(1))}"

        return f"TAXI ROUTES {kind}"

    if "TAXI ROUTES ARRIVAL" in joined or "TAXI ROUTE ARRIVAL" in joined:
        return taxi_route_title("ARRIVAL")

    if "TAXI ROUTES DEPARTURE" in joined or "TAXI ROUTE DEPARTURE" in joined:
        return taxi_route_title("DEPARTURE")

    if "HOT SPOTS" in upper and "STRAIGHT-IN RWY" not in upper:
        return "HOT SPOTS"

    if "PUSHBACK PROCEDURES" in upper:
        return "PUSHBACK PROCEDURES"

    if "REMOTE PARK AREA HOLDING PROCEDURE" in upper:
        return "REMOTE PARK AREA HOLDING PROCEDURE"

    if "TWY RESTRICTIONS" in upper or "TAXIWAY RESTRICTIONS" in upper:
        return "TAXIWAY RESTRICTIONS"

    if "PARKING STANDS" in upper and "COORD" in upper:
        return "PARKING STANDS & COORDS"

    if "INS COORDINATES" in upper:
        return "INS COORDINATES"

    if (
        "PARKING/DOCKING" in upper
        or "PARKING / DOCKING" in upper
        or "DOCKING CHART" in upper
    ):
        return "PARKING/DOCKING CHART (PDC)"

    if "AIRPORT INFORMATION" in upper or "AERODROME INFORMATION" in upper:
        return "AIRPORT INFORMATION"

    if "STRAIGHT-IN RWY" in upper:
        return "MINIMUMS"

    if "AIRPORT CHART" in upper or "AERODROME CHART" in upper:
        return "Airport Diagram Chart (ADC)"

    e = clean(existing)
    if (
        e
        and not e.upper().startswith("CHART PAGE")
        and "JEPPVIEW" not in e.upper()
        and "20-2026" not in e.upper()
    ):
        return e

    return "AIRPORT CHART"

def canonical_name(item, category):
    text = page_text(item)
    number = chart_number_from_text(
        text,
        item.get("chart_number")
    )
    raw = clean(item.get("name"))
    raw = BRACKET.sub("", raw)
    raw = clean(raw).strip(" ,")

    if category == "Airport":
        return canonical_airport_name(text, number, raw)

    if category in {"STAR", "SID"}:
        # Naming stage should already have extracted the visible names before
        # [ARINC_ID]. This final guard guarantees bracket IDs never leak to UI.
        if raw and not raw.upper().startswith("CHART PAGE"):
            return raw
        return f"{category} {number}".strip()

    if category == "Approach":
        if raw and not raw.upper().startswith("CHART PAGE"):
            return raw
        return f"APPROACH {number}".strip()

    return raw


def infer_category(item):
    existing = clean(item.get("category"))
    text = page_text(item)
    upper = text.upper()
    number = chart_number_from_text(
        text,
        item.get("chart_number")
    ).upper()

    # Airport-support index ranges take priority over accidental approach
    # signals such as VOR frequency labels printed on airport diagrams.
    if re.fullmatch(r"(?:10|20|30)-(?:1|4|9)[A-Z0-9]*", number):
        return "Airport"

    if re.fullmatch(r"19-[A-Z0-9]+", number):
        return "Airport"

    if re.fullmatch(r"(?:31|32)-[A-Z0-9]+", number):
        return "Approach"

    if re.fullmatch(r"10-2[A-Z0-9]*", number):
        return "STAR"

    if re.fullmatch(r"10-3[A-Z0-9]*", number):
        return "SID"

    # For complex LTFM 30-2/30-3 sequences use the explicit STAR/SID label
    # already resolved by the classifier instead of guessing from the index.
    if existing in {"STAR", "SID"}:
        return existing

    if existing in {"Airport", "Approach"}:
        return existing

    if (
        re.search(r"AIRPORT[.\s]+BRIEFING", upper)
        or re.search(r"AIRPORT[.\s]+QUALIFICATION", upper)
        or re.search(r"RADAR[.\s]+MINIMUM[.\s]+ALTITUDES", upper)
        or "INS COORDINATES" in upper
        or "PARKING STANDS" in upper
        or "PARKING/DOCKING" in upper
        or "PUSHBACK PROCEDURES" in upper
        or "REMOTE PARK AREA HOLDING PROCEDURE" in upper
        or "TWY RESTRICTIONS" in upper
        or "TAXIWAY RESTRICTIONS" in upper
        or "TAXI ROUTES ARRIVAL" in upper
        or "TAXI ROUTES DEPARTURE" in upper
        or "STRAIGHT-IN RWY" in upper
    ):
        return "Airport"

    if (
        "MISSED APCH" in upper
        or "MISSED APPROACH" in upper
    ) and (
        "RWY" in upper
        or "Rwy" in text
    ):
        return "Approach"

    return ""

def is_change_page(text):
    upper = text.upper()
    return (
        "CHART CHANGES SINCE CYCLE" in upper
        or "TERMINAL CHART CHANGE NOTICES" in upper
        or "CHART CHANGE NOTICES FOR AIRPORT" in upper
        or "NO CHART CHANGE NOTICES FOR AIRPORT" in upper
    )


def records():
    data = json.loads(INDEX.read_text(encoding="utf-8"))
    if isinstance(data, dict):
        values = list(data.values())
    else:
        values = list(data)
    return [x for x in values if isinstance(x, dict)]


def global_to_local(manifest):
    result = {}
    airports = manifest.get("airports", {})
    for icao, info in airports.items():
        for local, global_page in enumerate(info.get("global_pages", []), 1):
            result[int(global_page)] = (icao.upper(), local)
    return result


def parse_summary_changes(text, out):
    current = ""
    for raw in text.splitlines():
        line = clean(raw)
        if not line:
            continue

        # Examples: AHWAZ, (AHWAZ - OIAW) / KARAJ, IRAN ...
        airport_match = re.search(r"\b((?:OI|OR|OM|OO|LT|UD|UG)[A-Z]{2})\b", line.upper())
        if airport_match and not re.match(r"^(ADD|REV|DEL)\b", line.upper()):
            current = airport_match.group(1)

        change = re.match(
            r"^(ADD|REV|DEL)\s+(.+?)\s+((?:10|11|13|14|15|16|17|19|20|30)-[A-Z0-9]+)"
            r"(?:\s+([0-9]{1,2}\s+[A-Z][a-z]{2}\s+[0-9]{4}))?"
            r"(?:\s+([0-9]{1,2}\s+[A-Z][a-z]{2}\s+[0-9]{4}))?$",
            line,
            re.IGNORECASE,
        )
        if change and current:
            out.setdefault(current, {}).setdefault("summary", []).append({
                "action": change.group(1).upper(),
                "procedure": clean(change.group(2)),
                "index": change.group(3).upper(),
                "revisionDate": change.group(4) or "",
                "effectiveDate": change.group(5) or "",
            })


def parse_terminal_notices(text, out):
    pattern = re.compile(
        r"(?:No\s+)?Chart Change Notices for Airport\s+((?:OI|OR|OM|OO|LT|UD|UG)[A-Z]{2})",
        re.IGNORECASE,
    )
    matches = list(pattern.finditer(text))
    for idx, match in enumerate(matches):
        icao = match.group(1).upper()
        heading = match.group(0)
        end = matches[idx + 1].start() if idx + 1 < len(matches) else len(text)
        block = text[match.end():end]
        if heading.upper().startswith("NO "):
            continue

        lines = [clean(x) for x in block.splitlines() if clean(x)]
        notice = {
            "type": "",
            "effectivity": "",
            "beginDate": "",
            "endDate": "",
            "text": "",
        }
        body = []
        for line in lines:
            upper = line.upper()
            if upper.startswith("TYPE:"):
                notice["type"] = clean(line.split(":", 1)[1])
            elif upper.startswith("EFFECTIVITY:"):
                notice["effectivity"] = clean(line.split(":", 1)[1])
            elif upper.startswith("BEGIN DATE:"):
                notice["beginDate"] = clean(line.split(":", 1)[1])
            elif upper.startswith("END DATE:"):
                notice["endDate"] = clean(line.split(":", 1)[1])
            elif "JEPPVIEW FOR WINDOWS" not in upper and "COPYRIGHT" not in upper:
                body.append(line)

        notice["text"] = clean(" ".join(body))
        if any(notice.values()):
            out.setdefault(icao, {}).setdefault("notices", []).append(notice)


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    mapping = global_to_local(manifest)

    source = records()
    final = []
    changes = {}

    for item in source:
        try:
            page = int(item.get("page"))
        except Exception:
            continue
        text = page_text(item)

        if is_change_page(text):
            parse_summary_changes(text, changes)
            parse_terminal_notices(text, changes)
            continue

        location = mapping.get(page)

        item_icao = clean(
            item.get("airport") or item.get("icao")
        ).upper()

        if location:
            mapped_icao, mapped_pdf_page = location
        else:
            mapped_icao, mapped_pdf_page = "", 0

        icao = item_icao or mapped_icao
        if not icao:
            continue

        # For the bundled/current cycle preserve exact per-airport local page
        # mapping. A future cycle may contain added/shifted pages; the cycle
        # builder recalculates pdf_page after this canonical index is produced.
        pdf_page = (
            mapped_pdf_page
            if mapped_icao == icao
            else 0
        )

        category = infer_category(item)
        if not category:
            continue

        name = canonical_name(item, category)
        if not name:
            continue

        final.append({
            "page": page,
            "airport": icao,
            "country": clean(item.get("country")),
            "category": category,
            "chart_number": chart_number_from_text(
                text,
                item.get("chart_number")
            ),
            "name": name,
            "pdf_page": pdf_page,
        })

    final.sort(key=lambda x: x["page"])

    change_root = {
        "version": 1,
        "chartDataVersion": os.environ.get(
            "JEPPIRAN_DATA_VERSION",
            manifest.get("version", "")
        ),
        "source": manifest.get("source", ""),
        "airports": changes,
    }

    OUT.write_text(json.dumps(final, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    CHANGES_OUT.write_text(
        json.dumps(change_root, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    counts = {}
    for item in final:
        counts[item["category"]] = counts.get(item["category"], 0) + 1

    print(json.dumps({
        "charts": len(final),
        "categories": counts,
        "airportsWithChangeMetadata": len(changes),
        "excludedSourcePages": len(source) - len(final),
    }, indent=2))


if __name__ == "__main__":
    main()
