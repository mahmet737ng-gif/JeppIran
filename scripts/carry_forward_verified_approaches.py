#!/usr/bin/env python3
"""Carry forward unchanged, previously-approved chart georeferences (no new GCPs).

The review manifest was made by comparing BOTH PDF versions offline (text,
vector lines, rendered image), and is SHA-256-bound to both source PDFs.
Never infer unchanged status from the procedure title or page number alone.
"""
import argparse
import copy
import hashlib
import json
from pathlib import Path

import fitz

from extract_chart_georef import chart_key, page_fingerprint


def read(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def sha(path):
    digest = hashlib.sha256()
    with open(path, "rb") as source:
        for block in iter(lambda: source.read(2 ** 20), b""):
            digest.update(block)
    return digest.hexdigest()


def transfer(pdf_path, old_georef, current_georef, index, reviewed):
    if reviewed["schemaVersion"] != 1:
        raise ValueError("Unknown review manifest format")
    if reviewed["previous"]["georefSourceSha256"] != old_georef["source"]["sha256"]:
        raise ValueError("Previous 2620 georeference source does not match reviewed PDF")
    if reviewed["current"]["pdfSha256"] != sha(pdf_path):
        raise ValueError("Refusing carry-forward: source 2621 PDF SHA differs from reviewed bytes")
    if reviewed["previous"]["cycle"] != old_georef["source"]["cycle"]:
        raise ValueError("Wrong previous cycle")
    if reviewed["current"]["cycle"] != str(current_georef["source"]["cycle"]):
        raise ValueError("Wrong current cycle")
    if reviewed["current"]["pdfSha256"] != current_georef["source"]["sha256"]:
        raise ValueError("Existing current georef was not made for this source PDF")
    if current_georef.get("coordinateSpace") != old_georef.get("coordinateSpace") or (
        current_georef.get("origin") != old_georef.get("origin") or
        current_georef.get("coordinateSystem") != old_georef.get("coordinateSystem")
    ):
        raise ValueError("Coordinate-space or geodetic datum mismatch")
    if reviewed["verification"]["verifiedPdfPairs"] != len(reviewed["pageMappings"]):
        raise ValueError("Unreviewed page mapping count")
    records = {int(r["page"]): r for r in old_georef["charts"]}
    if len(records) != len(old_georef["charts"]):
        raise ValueError("Ambiguous old page georeferences")
    indexed = {int(r["page"]): r for r in index}
    if len(indexed) != len(index):
        raise ValueError("Ambiguous current page numbering")
    pdf = fitz.open(pdf_path)
    if len(pdf) != reviewed["current"]["pageCount"]:
        raise ValueError("Source PDF page count mismatch")

    by_current = {int(r["page"]): r for r in current_georef["charts"]}
    if len(by_current) != len(current_georef["charts"]):
        raise ValueError("Cannot safely merge already multi-region source in this step")
    old_used, new_used, carried, legacy_one_axis = set(), set(), [], []
    for mapping in reviewed["pageMappings"]:
        old_page, new_page = int(mapping["previousPage"]), int(mapping["currentPage"])
        if old_page in old_used or new_page in new_used:
            raise ValueError("Duplicate reuse mapping")
        old_used.add(old_page)
        new_used.add(new_page)
        old_record, target = records.get(old_page), indexed.get(new_page)
        if old_record is None or target is None:
            raise ValueError("Missing previously approved record or indexed new chart")
        old_chart_key = old_record.get("chartKey", "").split("|")
        if (
            len(old_chart_key) != 4 or
            old_record.get("airport") != target.get("airport") or
            old_chart_key[0] != target.get("airport") or
            old_chart_key[1] != "APPROACH" or
            target.get("category", "").upper() != "APPROACH" or
            old_chart_key[2] != str(target.get("chart_number", "")).upper()
        ):
            raise ValueError(
                f"Chart identity mismatch (old page {old_page}, new page {new_page})"
            )
        source = pdf[new_page - 1]
        if (old_record["width"] != source.rect.width or
                old_record["height"] != source.rect.height):
            raise ValueError(f"Source geometry changed for page {new_page}")
        entry = copy.deepcopy(old_record)
        entry.update({
            "page": new_page,
            "airport": target["airport"],
            "name": target.get("name", ""),
            "chartKey": chart_key(target),
            "sourceFingerprint": page_fingerprint(source),
            "originalSourceFingerprint": old_record["sourceFingerprint"]
        })
        validation = entry.setdefault("validation", {})
        validation.update({
            "reusedUnchangedSource": True,
            "verifiedUnchangedAgainstPreviousSource": True,
            "carryForwardApproved": True,
            "inheritedPreviousCycle": reviewed["previous"]["cycle"],
            "inheritedPreviousPage": old_page,
            "notANewIndependentGeodeticAccuracyTest": True
        })
        if validation.get("method") == "single_axis_plus_conformal_scale":
            legacy_one_axis.append(new_page)
            validation["legacyMethodRequiresIndependentAccuracyRevalidation"] = True
        by_current[new_page] = entry
        carried.append((old_page, new_page))

    result = dict(current_georef)
    result["charts"] = [by_current[k] for k in sorted(by_current)]
    audit = {
        "inheritedFromPreviousCycle": len(carried),
        "legacySingleAxisCarryForwards": len(legacy_one_axis),
        "legacySingleAxisPages": legacy_one_axis,
        "carriedPageMappings": [
            {"previousPage": o, "currentPage": n} for o, n in carried
        ],
        "note": "Carry-forward validates unchanged geometry and preserves prior approval; it does not independently certify old map accuracy."
    }
    return result, audit


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--previous-georef", required=True)
    parser.add_argument("--current-georef", required=True)
    parser.add_argument("--index", required=True)
    parser.add_argument("--reviewed-manifest", required=True)
    parser.add_argument("--output", required=True)
    parser.add_argument("--report", required=True)
    args = parser.parse_args()
    current = read(args.current_georef)
    result, audit = transfer(
        args.pdf,
        read(args.previous_georef),
        current,
        read(args.index),
        read(args.reviewed_manifest)
    )
    Path(args.output).write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    Path(args.report).write_text(
        json.dumps(audit, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(
        f"Reused {audit['inheritedFromPreviousCycle']} unchanged prior Approach charts "
        f"(legacy single-axis: {audit['legacySingleAxisCarryForwards']})"
    )


if __name__ == "__main__":
    main()
