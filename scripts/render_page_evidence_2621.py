#!/usr/bin/env python3
"""Create 200-DPI source-page evidence for every V2621 page, without publishing unverified charts.

Rendering is not human visual approval. Report verified=True only for separately
reviewed page records in docs/audits/V2621/manual-review.
"""
from __future__ import annotations
import argparse
import collections
import csv
import hashlib
import json
from pathlib import Path
import re

import fitz
from PIL import Image

EXPECTED = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
CATEGORIES = {"AIRPORT", "STAR", "SID", "APP"}

def manual_pages(folder: Path):
    validated = {}
    for path in sorted(folder.glob("pages*.csv")):
        with path.open(encoding="utf-8-sig", newline="") as f:
            for row in csv.DictReader(f):
                number = row.get("SOURCE_PDF_PAGE") or row.get("source_page")
                if number:
                    num = int(number)
                    if num in validated:
                        raise ValueError(f"Duplicate manual page {num}")
                    validated[num] = row
    return validated

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--pdf", default="Iran2621.pdf")
    p.add_argument("--manifest", default="app/src/main/assets/charts-manifest.json")
    p.add_argument("--audit", default="docs/audits/V2621/pages.csv")
    p.add_argument("--manual", default="docs/audits/V2621/manual-review")
    p.add_argument("--out", default="docs/audits/V2621/full-size-evidence")
    args = p.parse_args()

    pdf = Path(args.pdf)
    manifest = json.loads(Path(args.manifest).read_text(encoding="utf-8"))
    source = hashlib.file_digest(pdf.open("rb"), "sha256").hexdigest()
    if (source != EXPECTED or manifest.get("source_sha256") != source or
        manifest.get("source") != pdf.name or
        manifest.get("pages") != 1654 or manifest.get("version") != "V2621"):
        raise SystemExit("SOURCE IDENTITY MISMATCH: refusing to associate another PDF with this audit.")

    with Path(args.audit).open(encoding="utf-8-sig", newline="") as f:
        detected = {int(q["page"]): q for q in csv.DictReader(f)}
    if len(detected) != 1654 or set(detected) != set(range(1, 1655)):
        raise ValueError("Missing or duplicate page in original audit")

    checked = manual_pages(Path(args.manual))
    # A page is NOT manually approved simply because it was rendered at 200 DPI.
    if set(checked) != set(range(1, 33)):
        raise ValueError(f"Unexpected manual sign-off range: {sorted(checked)}")
    out = Path(args.out)
    out.mkdir(parents=True, exist_ok=True)
    rows = []
    counts = collections.Counter()
    doc = fitz.open(pdf)
    for page_num in range(1, 1655):
        page = doc[page_num - 1]
        d = detected[page_num]
        category = str(d["index_category"] or d["proposed_category"] or "").upper()
        if category == "APPROACH": category = "APP"
        if category not in CATEGORIES: category = "UNRESOLVED"
        original = d["index_category"] or ""
        is_approved = page_num in checked
        explicit_disagreement = d["decision"] in {"CONFLICT", "REVIEW"}
        status = ("MANUALLY_CHECKED_FULL_SIZE" if is_approved else
                  "SOURCE_SUPPLEMENT" if d["decision"] == "NON_CHART" else
                  "AWAITING_INDIVIDUAL_VISUAL_VERIFICATION")
        # Flag likely hidden chart pages without silently granting an index entry.
        in_index = str(d.get("indexed", "")).lower() == "true"
        header = page.get_textbox(fitz.Rect(0, 0, page.rect.width, page.rect.height * 0.30))
        normalized = re.sub(r"\s+", " ", header).strip()
        top_icao = d.get("icao_header", "")
        if page_num <= 32 and not is_approved:
            raise ValueError(f"Expected early manual sign-off not found at page {page_num}")
        group = (page_num - 1) // 400 + 1
        dirname = out / "images" / f"pages_{(group-1)*400+1:04d}_{min(group*400,1654):04d}"
        dirname.mkdir(parents=True, exist_ok=True)
        image_path = dirname / f"{page_num:04d}.jpg"
        if not image_path.exists():
            bitmap = page.get_pixmap(matrix=fitz.Matrix(200 / 72, 200 / 72), alpha=False)
            Image.frombytes("RGB", (bitmap.width, bitmap.height), bitmap.samples).save(
                image_path, format="JPEG", quality=83, optimize=False
            )
        rows.append(dict(
            page=page_num, classified_icao=d["icao_index"] or top_icao,
            visible_header_icao=top_icao, proposed_category=category,
            current_category=original, current_plate=d["chart_number"],
            current_title=d["chart_name"], original_audit_decision=d["decision"],
            original_audit_reason=d["review_reason"],
            indexed_in_live_app=in_index,
            title_and_plate_verified_by_human=is_approved,
            photo_rendered_at_200_dpi=True,
            human_review_status=status,
            manual_review_notes=(
                checked[page_num].get("notes") or
                checked[page_num].get("review_notes") or ""
            ) if is_approved else "",
            image_path=str(image_path.relative_to(out)),
            detected_header_excerpt=normalized[:280],
            source_pdf_sha256=source
        ))
        counts[status] += 1
        if page_num % 100 == 0:
            print(f"200-DPI page evidence: {page_num}/1654", flush=True)
    doc.close()
    if sum(counts.values()) != 1654:
        raise ValueError("Output page count is incomplete")

    with (out / "all_1654_pages.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(rows)
    pending = [row for row in rows if row["human_review_status"] == "AWAITING_INDIVIDUAL_VISUAL_VERIFICATION"]
    with (out / "manual_review_queue.csv").open("w", newline="", encoding="utf-8-sig") as f:
        writer = csv.DictWriter(f, fieldnames=list(rows[0]))
        writer.writeheader()
        writer.writerows(pending)
    summary = {
        "source": pdf.name,
        "source_sha256": source,
        "total_pages": 1654,
        "images_at_200_dpi": len(rows),
        "manually_reviewed_pages": sum(r["title_and_plate_verified_by_human"] for r in rows),
        "unverified_pages": sum(not r["title_and_plate_verified_by_human"] for r in rows),
        "statuses": dict(counts),
        "auto_audit_conflicts": sum(r["original_audit_decision"] == "CONFLICT" for r in rows),
        "auto_audit_review_requests": sum(r["original_audit_decision"] == "REVIEW" for r in rows),
        "live_chart_data_modified": False,
        "new_geo_approvals": 0,
        "disclaimer": "Rendering and parsing all pages is not individual human visual confirmation. Unverified classifications and georeferences must not be deployed as validated."
    }
    (out / "summary.json").write_text(json.dumps(summary, indent=2, ensure_ascii=False) + "\n")
    print(json.dumps(summary, indent=2), flush=True)

if __name__ == "__main__":
    main()
