#!/usr/bin/env python3
"""Apply ONLY the independently inspected V2621 source pages 1-26.

Fails closed on any source, chart-index or georeference mismatch.
Does not reclassify the other 1628 pages, alter PDFs, or touch simulator code.
"""
from __future__ import annotations

import hashlib
import json
from pathlib import Path
import sys

import fitz
import numpy as np
from extract_chart_georef import chart_key, page_fingerprint, segments

SOURCE = Path("Iran2621.pdf")
MANIFEST = Path("app/src/main/assets/charts-manifest.json")
INDEX = Path("app/src/main/assets/charts-current.json")
GEOREF = Path("app/src/main/assets/chart-georef.json")
PDF_SHA = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
UPDATES = {
    10: ("OIAA", "11-1", "ILS Z OR LOC Z RWY 32L", "ILS Z RWY 32L"),
    11: ("OIAA", "11-2", "ILS Y OR LOC Y RWY 32L", "ILS Y RWY 32L"),
    25: ("OIAM", "13-3", "VOR RWY 31", "VOR RWY 31 (CAT C & D)"),
    26: ("OIAM", "13-4", "VOR RWY 31", "VOR RWY 31 (CAT A & B)"),
}
GEO_KEYS = {
    12: ("OIAA", "13-1", "VOR Z RWY 14R",
         "8f7983b58abcca37bdf5308071417088d07c2a56dab75d2b49ef0fd6f1acca5b",
         297.9599914550781),
    18: ("OIAA", "16-1", "NDB RWY 14R",
         "916125f6a25661753eb402513612bbdc278cb450e8d410842d06b9504e94be8a",
         298.9200134277344),
}
MAP_BOUNDS = dict(left=90.84, top=168.36, right=531.6, bottom=518.16)
INSET = dict(left=356.0, top=168.36, right=531.6, bottom=251.5)
REPAIR_BOUNDS = dict(left=90.72, top=168.24, right=531.84, bottom=518.16)


def fail(cond, message):
    if not cond:
        raise RuntimeError("V2621 visual-correction FAIL CLOSED: " + message)


def canonical_checks(page, pnum, fp):
    fail(page_fingerprint(page) == fp, f"page {pnum}: PDF visible geometry changed")


def tick(page, label, bounds, vector):
    words = page.get_text("words")
    found_word = any(
        t[4] == label and max(abs(float(v)-float(w))
                              for v,w in zip(t[:4], bounds)) < .001
        for t in words
    )
    fail(found_word, f"printed grid label {label} is missing")
    lines = np.array(segments(page))
    fail(len(lines) > 0 and
         np.min(np.max(np.abs(lines-np.array(vector)), axis=1)) < .001,
         f"printed vector tick for {label} is missing")


def candidate(page, number, record):
    icao, plate, title, fingerprint, y_hi = GEO_KEYS[number]
    canonical_checks(page, number, fingerprint)
    fail(record["airport"] == icao and record["category"] == "Approach" and
         record["chart_number"] == plate and record["name"] == title,
         f"source index mismatch on {number}")
    fail("NOT TO SCALE" in page.get_text().upper(),
         f"expected upper-right NOT TO SCALE inset absent on page {number}")
    fail(abs(page.rect.width-612) < 1e-5 and abs(page.rect.height-792) < 1e-5,
         f"unexpected page dimensions {number}")
    left = [
        {"label": "30-20", "degrees": 30+20/60, "pdfPoint": 483.0,
         "pixelAxis": "y",
         "labelBounds": [98.4,480.0865,114.3879,488.7263],
         "tickSegment": [90.84,483.0,95.64,483.0]},
        {"label": "30-30", "degrees": 30.5, "pdfPoint": y_hi,
         "pixelAxis": "y",
         "labelBounds": [98.4,295.1665,114.3879,303.8064],
         "tickSegment": (
             [90.84,297.96,95.64,297.96] if number == 12
             else [113.4,298.92,111.72,298.92])},
    ]
    bottom = [
        {"label": "48-10", "degrees": 48+10/60,
         "pdfPoint": 249.24000549316406, "pixelAxis": "x",
         "labelBounds": [241.92,505.0464,257.908,513.6863],
         "tickSegment": [249.24,517.92,249.24,513.12]},
        {"label": "48-20", "degrees": 48+20/60,
         "pdfPoint": 410.0400085449219, "pixelAxis": "x",
         "labelBounds": [402.36,505.0464,418.3479,513.6863],
         "tickSegment": [410.04,517.92,410.04,513.12]},
    ]
    for control in left+bottom:
        tick(page, control["label"], control["labelBounds"], control["tickSegment"])
    points = [
        dict(lat=a["degrees"], lon=b["degrees"],
             x=b["pdfPoint"], y=a["pdfPoint"],
             source=f"Printed grid {a['label']} / {b['label']}")
        for a in left for b in bottom
    ]
    lonlat = np.array([[p["lon"], p["lat"]] for p in points])
    xy = np.array([[p["x"], p["y"]] for p in points])
    design = np.column_stack((lonlat - lonlat.mean(axis=0), np.ones(len(points))))
    matrix, _, rank, _ = np.linalg.lstsq(design, xy-xy.mean(axis=0), rcond=None)
    residual = np.max(np.linalg.norm(design@matrix-(xy-xy.mean(axis=0)),axis=1))
    determinant = float(np.linalg.det(matrix[:2]))
    fail(rank == 3 and residual < .75 and determinant < 0,
         f"affine fit failed on {number}: residual={residual}, det={determinant}")
    # Separate top-right holding sketch must NEVER receive an aircraft marker.
    for p in points:
        fail(MAP_BOUNDS["left"] <= p["x"] <= MAP_BOUNDS["right"] and
             MAP_BOUNDS["top"] <= p["y"] <= MAP_BOUNDS["bottom"],
             f"grid point outside measured-plan bounds on {number}")
        fail(not (INSET["left"]<=p["x"]<=INSET["right"] and
                  INSET["top"]<=p["y"]<=INSET["bottom"]),
             f"control point inside not-to-scale inset {number}")
    return {
        "page": number, "airport": icao, "name": title,
        "chartKey": chart_key(record), "sourceFingerprint": fingerprint,
        "coordinateSpace": "pdf_points", "origin": "top_left",
        "width": 612, "height": 792,
        "bounds": dict(MAP_BOUNDS), "excludedBounds": [dict(INSET)],
        "points": points, "gridAxes": {"latitude": left, "longitude": bottom},
        "maxResidualPdfPoints": 0.75,
        "validation": {
            "gridMaxResidualPdfPoints": float(residual),
            "controlPointCount": len(points),
            "method": "paired_printed_graticule_vector_ticks",
            "measuredAxisValueCounts": {"latitude": 2, "longitude": 2},
            "notToScaleTextPresentElsewhereOnPage": True,
            "visualReview": True,
            "reviewDecision": "allow_measured_plan",
            "reviewNote": "Main map graticule measured from PDF vector ticks. Upper-right NOT TO SCALE inset masked. Not navigation-certified; device acceptance test outstanding.",
            "pendingExternalGeodeticAccuracyValidation": True,
        },
    }


def main():
    manifest = json.loads(MANIFEST.read_text(encoding="utf8"))
    index = json.loads(INDEX.read_text(encoding="utf8"))
    geo = json.loads(GEOREF.read_text(encoding="utf8"))
    fail(manifest["version"] == "V2621" and manifest["cycle"] == "2621" and
         manifest["source"] == SOURCE.name and manifest["source_sha256"] == PDF_SHA
         and manifest["pages"] == 1654, "manifest mismatch")
    fail(geo["source"]["sha256"] == PDF_SHA and
         geo["source"]["chartDataVersion"] == "V2621", "georef source mismatch")
    sha = hashlib.file_digest(SOURCE.open("rb"), "sha256").hexdigest()
    fail(sha == PDF_SHA, "source PDF bytes changed")
    doc = fitz.open(SOURCE)
    fail(len(doc) == 1654, "source PDF size changed")
    indexed = {int(row["page"]): row for row in index}
    fail(len(indexed) == len(index) == 1494, "unexpected index count or duplicate pages")
    fail(all(indexed[n]["airport"]=="OIAA" for n in range(1,19)), "OIAA source page mapping moved")
    fail(all(indexed[n]["airport"]=="OIAM" for n in range(19,27)), "OIAM source page mapping moved")
    original_refs = {int(c["page"]):c for c in geo["charts"]}
    fail(len(original_refs)==len(geo["charts"]), "duplicate legacy georef pages")
    for page, (icao, plate, old, new) in UPDATES.items():
        row=indexed[page]
        fail(row["airport"]==icao and row["category"]=="Approach" and
             row["chart_number"]==plate and row["name"] in (old,new),
             f"title to be corrected no longer matches page {page}")
        header=doc[page-1].get_text("text")[:1800].upper()
        if page in (10,11):
            fail("ILS" in header and plate in doc[page-1].get_text(),
                 f"ILS title evidence missing from plate {page}")
        else:
            fail("CAT C & D" in header if page ==25 else "CAT A & B" in header,
                 f"CAT A/B or C/D evidence missing page {page}")
        row["name"]=new
        if page in original_refs:
            original_refs[page]["name"]=new
            original_refs[page]["chartKey"]=chart_key(row)

    for page in (13,16):
        entry=original_refs.get(page)
        fail(entry is not None, f"existing geo page {page} missing")
        fail(entry["airport"] == "OIAA" and
             entry["bounds"] == dict(left=0,top=0,right=612,bottom=792),
             f"expected full-page bounds changed on {page}")
        for pt in entry["points"]:
            fail(REPAIR_BOUNDS["left"]<=pt["x"]<=REPAIR_BOUNDS["right"] and
                 REPAIR_BOUNDS["top"]<=pt["y"]<=REPAIR_BOUNDS["bottom"],
                 f"control point outside proposed safe region on {page}")
        for mask in entry.get("excludedBounds",[]):
            fail(REPAIR_BOUNDS["left"]<=mask["left"]<mask["right"]<=REPAIR_BOUNDS["right"]
                 and REPAIR_BOUNDS["top"]<=mask["top"]<mask["bottom"]<=REPAIR_BOUNDS["bottom"],
                 f"existing inset outside proposed bounds on {page}")
        entry["bounds"]=dict(REPAIR_BOUNDS)

    for page in (12,18):
        fail(page not in original_refs, f"new georef already exists on {page}")
        original_refs[page]=candidate(doc[page-1],page,indexed[page])
    doc.close()
    geo["charts"]=sorted(original_refs.values(),key=lambda x:int(x["page"]))
    fail(len(geo["charts"])==776, "georef count should increase 774 → 776")
    fail(indexed[25]["name"] != indexed[26]["name"], "CAT A&B and C&D must remain distinct")
    INDEX.write_text(json.dumps(index,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    GEOREF.write_text(json.dumps(geo,ensure_ascii=False,indent=2)+"\n",encoding="utf-8")
    print(json.dumps({
        "cycle": "V2621", "source_pdf_pages":1654, "classified":len(index),
        "title_fixes":sorted(UPDATES), "new_georefs":[12,18],
        "bounds_fixed":[13,16],"validated_georefs":len(geo["charts"]),
        "simulator_changes":False, "navigation_certified":False
    },indent=2))


if __name__=="__main__":
    main()
