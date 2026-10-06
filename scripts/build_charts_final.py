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


def canonical_airport_name(text, chart_number, existing):
    upper = text.upper()
    joined = clean(text).upper()
    number = (chart_number or "").upper()

    if "AIRPORT INFORMATION" in upper or "AERODROME INFORMATION" in upper:
        return "AIRPORT INFORMATION"
    if "AIRPORT BRIEFING" in upper:
        return "AIRPORT BRIEFING"
    if "AIRPORT QUALIFICATION" in upper:
        return "AIRPORT QUALIFICATION"
    if "RADAR MINIMUM ALTITUDES" in upper:
        return "RADAR MINIMUM ALTITUDES"
    if "INS COORDINATES" in upper:
        return "INS COORDINATES"
    if "PARKING STANDS" in upper and "COORD" in upper:
        return "PARKING STANDS & COORDS"
    if "PARKING/DOCKING" in upper or "PARKING / DOCKING" in upper or "DOCKING CHART" in upper:
        return "PARKING/DOCKING CHART (PDC)"

    taxi = re.search(
        r"\bTAXI\s+ROUTES?\s+(?:ARRIVAL|DEPARTURE)"
        r"(?:\s+RWYS?\s+[0-9LRC, &/()A-Z.-]+)?",
        joined,
    )
    if taxi:
        return taxi.group(0).rstrip(" .,-")

    if "STRAIGHT-IN RWY" in upper or (
        "TAKE-OFF" in upper and "ADEQUATE VIS REF" in upper
    ) or re.fullmatch(r"(?:10|20|30)-9S[A-Z0-9]*", number):
        return "MINIMUMS"

    if re.fullmatch(r"19-[A-Z0-9]+", number):
        return "AIRPORT QUALIFICATION"

    if re.fullmatch(r"10-1P[A-Z0-9]*", number):
        return "AIRPORT BRIEFING"

    if re.fullmatch(r"10-1R[A-Z0-9]*", number):
        return "RADAR MINIMUM ALTITUDES"

    if re.fullmatch(r"(?:10|20|30)-9", number):
        return "AIRPORT DIAGRAM CHART (ADC)"

    # Preserve a specific extracted airport-page title if it is useful.
    e = clean(existing).upper()
    if e and e not in {"AIRPORT CHART", "AERODROME CHART"} and not e.startswith("CHART PAGE"):
        return e

    # Most lettered *-9 apron pages are detailed parking/docking pages when no
    # stronger title was extractable. Keep a conservative generic label.
    if re.fullmatch(r"(?:10|20|30)-9[A-Z][A-Z0-9]*", number):
        return "PARKING/DOCKING CHART (PDC)"

    return "AIRPORT CHART"


def canonical_name(item, category):
    text = page_text(item)
    number = clean(item.get("chart_number"))
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
    category = clean(item.get("category"))
    text = page_text(item).upper()
    number = clean(item.get("chart_number")).upper()

    if category in {"Airport", "STAR", "SID", "Approach"}:
        return category

    if (
        "AIRPORT BRIEFING" in text
        or "AIRPORT QUALIFICATION" in text
        or "RADAR MINIMUM ALTITUDES" in text
        or "INS COORDINATES" in text
        or "PARKING STANDS" in text
        or "PARKING/DOCKING" in text
        or "TAXI ROUTES ARRIVAL" in text
        or "TAXI ROUTES DEPARTURE" in text
        or "STRAIGHT-IN RWY" in text
        or re.fullmatch(r"10-1[A-Z0-9]*", number)
        or re.fullmatch(r"(?:19|20)-[A-Z0-9]+", number)
        or re.fullmatch(r"(?:10|20|30)-9[A-Z0-9]*", number)
    ):
        return "Airport"

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
        if not location:
            continue
        icao, pdf_page = location

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
            "chart_number": clean(item.get("chart_number")),
            "name": name,
            "pdf_page": pdf_page,
        })

    final.sort(key=lambda x: x["page"])

    change_root = {
        "version": 1,
        "chartDataVersion": manifest.get("version", ""),
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
