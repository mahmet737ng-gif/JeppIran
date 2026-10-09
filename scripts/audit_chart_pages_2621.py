#!/usr/bin/env python3
"""Read every source PDF page independently and audit the four JEPPIRAN folders.

This is a non-destructive review: it NEVER alters charts-current.json or the app.
For each page, inspect its PDF text, visible upper header, chart index, ICAO
identifiers and category signals. Conflicts and unindexed plates are quarantined.
"""
from __future__ import annotations

import argparse
import collections
import csv
import hashlib
import json
import re
from pathlib import Path

import fitz

CANON = {"Airport": "AIRPORT", "Approach": "APP", "APP": "APP",
         "STAR": "STAR", "SID": "SID", "AIRPORT": "AIRPORT"}
CATS = {"AIRPORT", "APP", "SID", "STAR"}
ICAO = re.compile(r"\b(?:OI|OR|OM|OO|LT|UD|UG|OP|OT)[A-Z]{2}\b")
NUMBER = re.compile(r"\b(?:\d{1,2})-(?:\d{1,2})(?:[A-Z]\d*|\d*[A-Z])?\b")
APP_TITLE = re.compile(
    r"\b(?:ILS(?:\s+[XYZ])?|LOC(?:\s+[XYZ])?|RNAV|RNP|VOR|NDB|"
    r"GLS|GBAS|LDA|SDF|TACAN|LPV|GPS|INSTRUMENT APPROACH)\b.{0,35}\bRWY\b",
    re.I | re.S
)
INFO = re.compile(
    r"(?:AIRPORT[.\s]+(?:INFORMATION|BRIEFING|QUALIFICATION|CHART)|"
    r"AERODROME[.\s]+(?:INFORMATION|CHART)|"
    r"(?:AIRPORT\s+)?(?:DIAGRAM|PARKING|DOCKING|APRON|TAXIWAY|"
    r"TAXI\s+ROUTE|PUSHBACK|HOT\s+SPOT|STAND\s+COORDINATES))", re.I
)
NOTICES = re.compile(
    r"(?:NO\s+)?CHART\s+CHANGE\s+NOTICES\s+FOR\s+AIRPORT|"
    r"JEPPVIEW\s+REVISION\s+LETTER|PRINT\s+REVISION\s+LETTER", re.I
)
FIELDS = [
    "page", "indexed", "icao_index", "icao_header", "icao_conflict",
    "chart_number", "number_seen_on_pdf", "chart_name", "index_category",
    "detected_category", "proposed_category", "confidence",
    "decision", "needs_review", "review_reason", "signal",
    "has_pdf_text", "not_to_scale", "printed_from_jeppview",
    "has_bracketed_code", "has_tilde", "page_width", "page_height",
    "text_chars", "top_header"
]


def parse_args():
    p = argparse.ArgumentParser()
    p.add_argument("--pdf", type=Path, default=Path("Iran2621.pdf"))
    p.add_argument("--index", type=Path,
                   default=Path("app/src/main/assets/charts-current.json"))
    p.add_argument("--manifest", type=Path,
                   default=Path("app/src/main/assets/charts-manifest.json"))
    p.add_argument("--out", type=Path,
                   default=Path("docs/audits/V2621"))
    return p.parse_args()


def normalize(text):
    return re.sub(r"\s+", " ", text).strip()


def classify(header, whole, code, current, title_hint=""):
    """Prioritize actual chart labels and Jeppesen plate numbers.

    Do not promote 'SID'/'STAR' mentions from generic explanatory prose.
    Do not infer a chart number from a JeppView printed-on date.
    """
    h = header.upper()
    w = whole.upper()
    c = code.upper().strip()
    reasons = []
    if NOTICES.search(h) or (not current and NOTICES.search(w[:2000])):
        return "REFERENCE", 99, "change_notice"
    if re.search(r"\.STAR\.", h) or re.search(
        r"\bSTANDARD(?:\s+INSTRUMENT)?\s+ARRIVAL\b", h
    ):
        return "STAR", 98, "printed_STAR_header"
    if re.search(r"\.SID\.", h) or re.search(
        r"\bSTANDARD(?:\s+INSTRUMENT)?\s+DEPARTURE\b", h
    ):
        return "SID", 98, "printed_SID_header"

    # Jeppesen section families vary by region (10-/20-/30-).
    # 10-2/20-2/30-2 are procedure arrivals and 10-3/20-3/30-3
    # departures. 10-20 is NOT 10-2, hence require suffix to start
    # with a letter. Remaining 10-/20-/30- pages are airport support.
    if re.match(r"^(10|20|30)-2(?:[A-Z][A-Z0-9]*)?$", c):
        return "STAR", 96, "Jeppesen_STAR_series"
    if re.match(r"^(10|20|30)-3(?:[A-Z][A-Z0-9]*)?$", c):
        return "SID", 96, "Jeppesen_SID_series"
    if old_airport_support := (current == "AIRPORT" and
        ("QUALIFICATION" in title_hint or "BRIEFING" in title_hint)):
        return "AIRPORT", 91, "airport_qualification_or_briefing"
    if re.match(r"^(10|20|30)-", c):
        return "AIRPORT", 94, "Jeppesen_airport_support_series"

    if INFO.search(h):
        return "AIRPORT", 88, "airport_header"
    if re.search(r"\b(?:STAR|ARRIVAL)\s+CHART\b", h):
        return "STAR", 88, "arrival_chart_header"
    if re.search(r"\b(?:SID|DEPARTURE)\s+CHART\b", h):
        return "SID", 88, "departure_chart_header"
    if APP_TITLE.search(h):
        return "APP", 91, "instrument_approach_header"
    if re.match(r"^(11|12|13|14|15|16|17|18|19|21|22|23|24|25|26|27|28|29)-", c):
        return "APP", 84, "Jeppesen_approach_number_series"
    if current in CATS:
        return current, 55, "prior_index_only"
    if re.search(r"\b(?:ILS|LOC|RNAV|RNP|VOR|NDB|GLS)\b.{0,45}\bRWY\b", w[:1600]):
        return "APP", 70, "body_approach_title"
    return "", 0, "unclassified"


def compact_header(page):
    bounds = page.rect
    region = fitz.Rect(bounds.x0, bounds.y0, bounds.x1,
                       bounds.y0 + 0.36 * bounds.height)
    upper = page.get_textbox(region)
    # For rotated plates, the first text lines are useful auxiliary evidence.
    full = page.get_text("text", sort=True)
    lines = [normalize(x) for x in upper.splitlines() if normalize(x)]
    lines = [x for x in lines
             if "PRINTED FROM JEPPVIEW" not in x.upper()
             and not re.search(r"PRINTED\s+ON\s+\d", x.upper())]
    head = normalize(" ".join(lines[:24]))
    if not head:
        head = normalize(" ".join(full.splitlines()[:22]))
    return head[:2300], full


def main():
    a = parse_args()
    manifest = json.loads(a.manifest.read_text(encoding="utf-8"))
    records = json.loads(a.index.read_text(encoding="utf-8"))
    if manifest["version"] != "V2621" or str(manifest["cycle"]) != "2621":
        raise SystemExit("FAIL CLOSED: active manifest is not V2621")
    if a.pdf.name != manifest.get("source"):
        raise SystemExit("FAIL CLOSED: source PDF filename mismatch")
    digest = hashlib.sha256()
    with a.pdf.open("rb") as f:
        for chunk in iter(lambda: f.read(2 << 20), b""):
            digest.update(chunk)
    sha = digest.hexdigest()
    if sha != manifest.get("source_sha256"):
        raise SystemExit("FAIL CLOSED: source PDF SHA-256 mismatch")
    index = {}
    for row in records:
        pn = int(row["page"])
        if pn in index:
            raise SystemExit(f"Duplicate source index page {pn}")
        index[pn] = row

    doc = fitz.open(a.pdf)
    if len(doc) != manifest["pages"]:
        raise SystemExit("FAIL CLOSED: PDF page count and manifest disagree")
    if len(index) != len(records):
        raise SystemExit("Duplicate index entries")
    a.out.mkdir(parents=True, exist_ok=True)
    audit = []
    evidence = []
    category_counts = collections.Counter()
    decision_counts = collections.Counter()
    reviewed = []
    existing_names = collections.defaultdict(list)

    for pn in range(1, len(doc) + 1):
        page = doc[pn - 1]
        row = index.get(pn, {})
        old = CANON.get(str(row.get("category", "")).strip(), "")
        code = str(row.get("chart_number", "")).strip().upper()
        title = str(row.get("name", "")).strip()
        icao = str(row.get("airport", "")).strip().upper()
        header, full = compact_header(page)
        visible = re.sub(r"PRINTED\s+(?:FROM\s+JEPPVIEW|ON[^\n]{0,80})", "",
                         header, flags=re.I)
        ids = set(ICAO.findall(visible))
        top_icao = icao if icao in ids else (
            next(iter(ids)) if len(ids) == 1 else "")
        if code:
            number_present = code in NUMBER.findall(visible)
        else:
            number_present = False
        detected, confidence, signal = classify(visible, full, code, old, title.upper())
        if not old:
            if detected == "REFERENCE":
                decision, reason, proposal = "NON_CHART", "unindexed_change_notice", ""
            elif detected in CATS:
                decision, reason, proposal = "REVIEW", "unindexed_chart_candidate", detected
            else:
                decision, reason, proposal = "REVIEW", "unindexed_page_needs_inspection", ""
        elif detected == old:
            proposal = old
            if signal == "prior_index_only":
                decision, reason = "REVIEW", "only_old_index_supports_category"
            else:
                decision, reason = "MATCH", "independently_consistent"
        elif detected in CATS:
            decision, reason, proposal = "CONFLICT", "index_vs_pdf_category", detected
        elif detected == "REFERENCE":
            decision, reason, proposal = "CONFLICT", "indexed_page_is_change_notice", ""
        else:
            decision, reason, proposal = "REVIEW", "category_not_verifiable", old

        # A top-header ICAO can appear in a chart about another airport.
        # Treat inconsistent observations as a review signal, never silent reassignment.
        icao_conflict = bool(icao and top_icao and top_icao != icao)
        if icao_conflict and decision == "MATCH":
            decision, reason = "REVIEW", "header_icao_differs_from_index"
        if not full.strip() and decision == "MATCH":
            decision, reason = "REVIEW", "no_machine_readable_text"
        has_brackets = bool(re.search(r"\[[^]]+\]", title))
        has_tilde = "~" in title
        if old:
            category_counts[old] += 1
            existing_names[(icao, old, code, title)].append(pn)
        decision_counts[decision] += 1
        item = {
            "page": pn,
            "indexed": bool(row),
            "icao_index": icao,
            "icao_header": top_icao,
            "icao_conflict": icao_conflict,
            "chart_number": code,
            "number_seen_on_pdf": number_present,
            "chart_name": title,
            "index_category": old,
            "detected_category": detected,
            "proposed_category": proposal,
            "confidence": confidence,
            "decision": decision,
            "needs_review": decision in {"REVIEW", "CONFLICT"},
            "review_reason": reason,
            "signal": signal,
            "has_pdf_text": bool(full.strip()),
            "not_to_scale": "NOT TO SCALE" in full.upper(),
            "printed_from_jeppview": bool(re.search(
                r"PRINTED\s+FROM\s+JEPPVIEW|PRINTED\s+ON\s+\d", full, re.I)),
            "has_bracketed_code": has_brackets,
            "has_tilde": has_tilde,
            "page_width": round(page.rect.width, 2),
            "page_height": round(page.rect.height, 2),
            "text_chars": len(full),
            "top_header": header[:350],
        }
        audit.append(item)
        evidence.append({"page": pn, "text_excerpt": full[:1300],
                         "header_excerpt": header[:1300], "signal": signal})
        if item["needs_review"]:
            reviewed.append(item)
        if pn % 200 == 0:
            print(f"Audited {pn}/{len(doc)} source PDF pages", flush=True)
    doc.close()
    if len(audit) != manifest["pages"] or {r["page"] for r in audit} != set(
            range(1, manifest["pages"] + 1)):
        raise SystemExit("FAIL CLOSED: missing or duplicated audited page")

    dupes = [
        {"icao": k[0], "category": k[1], "chart_number": k[2],
         "title": k[3], "pages": pages}
        for k, pages in existing_names.items()
        if len(pages) > 1 and k[2] and k[3]
    ]
    summary = {
        "cycle": "2621",
        "data_version": "V2621",
        "source": str(a.pdf),
        "source_sha256": sha,
        "pdf_pages": len(audit),
        "indexed_charts": len(index),
        "airports": len(manifest["airports"]),
        "indexed_categories": dict(sorted(category_counts.items())),
        "decisions": dict(sorted(decision_counts.items())),
        "unindexed_pages": sum(not r["indexed"] for r in audit),
        "category_conflicts": sum(r["decision"] == "CONFLICT" for r in audit),
        "review_required": len(reviewed),
        "duplicate_title_groups": len(dupes),
        "changes_applied_to_app": False,
        "interpretation": "Text/vector evidence audit; ambiguous charts await visual validation.",
    }
    with (a.out / "pages.csv").open("w", newline="", encoding="utf-8-sig") as f:
        wr = csv.DictWriter(f, fieldnames=FIELDS)
        wr.writeheader()
        for r in audit:
            wr.writerow(r)
    with (a.out / "review_queue.csv").open(
            "w", newline="", encoding="utf-8-sig") as f:
        wr = csv.DictWriter(f, fieldnames=FIELDS)
        wr.writeheader()
        wr.writerows(reviewed)
    (a.out / "summary.json").write_text(
        json.dumps(summary, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    (a.out / "duplicate_titles.json").write_text(
        json.dumps(dupes, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    # Source excerpts help a reviewer inspect every page, with no OCR guesses.
    with (a.out / "page_evidence.jsonl").open("w", encoding="utf-8") as f:
        for rec in evidence:
            f.write(json.dumps(rec, ensure_ascii=False) + "\n")
    lines = [
        "# JEPPIRAN V2621 - page-by-page PDF classification audit",
        "",
        "Source pages: " + str(len(audit)),
        "Indexed chart pages: " + str(len(index)),
        "Airport folders: " + str(len(manifest["airports"])),
        "Unindexed source pages: " + str(summary["unindexed_pages"]),
        "Conflicting categories: " + str(summary["category_conflicts"]),
        "Pages requiring review: " + str(summary["review_required"]),
        "Repeated title/number groups: " + str(len(dupes)),
        "",
        "## Existing indexed categories",
        "",
    ]
    lines += ["- " + k + ": " + str(v) for k, v in sorted(category_counts.items())]
    lines += ["", "## Audit outcomes", ""]
    lines += ["- " + k + ": " + str(v) for k, v in sorted(decision_counts.items())]
    lines += [
        "",
        "The full one-row-per-page classification is in pages.csv.",
        "Only high-confidence matches are considered checked by automatic evidence.",
        "REVIEW/CONFLICT rows must be visually inspected before any data edit.",
        "This audit does not modify the existing index, app, PDFs, or FSX.",
        "",
    ]
    (a.out / "SUMMARY.md").write_text("\n".join(lines), encoding="utf-8")
    print(json.dumps(summary, ensure_ascii=False, indent=2), flush=True)


if __name__ == "__main__":
    main()
