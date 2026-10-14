#!/usr/bin/env python3
"""Publish exactly three OICC SID georeferences for simulator flight QA (V2621).

Fail closed on source mismatches, unsafe map geometry, unexpected existing
records, or changed AIRAC page identities. Do not recalculate protected maps.
"""
from __future__ import annotations

import copy
import hashlib
import json
from pathlib import Path

import fitz
import numpy as np
from extract_chart_georef import chart_key, page_fingerprint

ROOT = Path(__file__).resolve().parent.parent
NATIVE = ROOT / "app/src/main/assets/chart-georef.json"
WEB = ROOT / "web/data/chart-georef.json"
PROVISIONAL = ROOT / "web/data/georef-provisional-v2621.json"
INDEX = ROOT / "web/data/charts-current.json"
MANIFEST = ROOT / "web/data/charts-manifest.json"
PDF = ROOT / "Iran2621.pdf"
REPORT = ROOT / "docs/georeferencing/V2621_OICC_SID_FLIGHT_QA_RELEASE.json"
WANTED = (187, 189, 191)
PROTECTED_SID = (188, 190, 192, 193, 194)
OICC = "OICC"


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as handle:
        for chunk in iter(lambda: handle.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def affine_qa(item: dict) -> float:
    points = item["points"]
    assert len(points) >= 4, "At least four calibration points required"
    ll = np.array([[p["lon"], p["lat"]] for p in points], dtype=np.float64)
    xy = np.array([[p["x"], p["y"]] for p in points], dtype=np.float64)
    assert np.isfinite(ll).all() and np.isfinite(xy).all()
    center = ll.mean(axis=0)
    matrix = np.column_stack([ll-center, np.ones(len(ll))])
    coef, _, rank, _ = np.linalg.lstsq(matrix, xy, rcond=None)
    assert rank == 3, "Non-independent georeference controls"
    determinant = float(np.linalg.det(coef[:2, :2]))
    assert determinant < 0, "Mirrored georeference"
    residual = float(np.max(np.linalg.norm(matrix @ coef - xy, axis=1)))
    assert residual < 0.75 and residual <= item["maxResidualPdfPoints"], "Grid fit failure"
    return residual


def main() -> None:
    native_before = NATIVE.read_text(encoding="utf-8")
    web_before = WEB.read_text(encoding="utf-8")
    assert web_before == native_before, "Web and Android georefs differ; preserve both"
    stable = json.loads(native_before)
    provisional = json.loads(PROVISIONAL.read_text(encoding="utf-8"))
    index = {int(row["page"]): row for row in json.loads(INDEX.read_text(encoding="utf-8"))}
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))

    source = stable["source"]
    expected_sha = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
    assert source["sha256"] == provisional["source"]["sha256"] == manifest["source_sha256"] == expected_sha
    assert source["chartDataVersion"] == provisional["source"]["chartDataVersion"] == manifest["version"] == "V2621"
    assert source["pageCount"] == provisional["source"]["pageCount"] == manifest["pages"] == 1654
    assert PDF.stat().st_size > 1000000, "Original LFS PDF not downloaded"
    assert sha256_file(PDF) == expected_sha, "Original PDF source mismatch"

    before_by_page = {int(c["page"]): c for c in stable["charts"]}
    assert len(before_by_page) == len(stable["charts"]), "Duplicate original georefs"
    assert set(PROTECTED_SID) <= set(before_by_page), "Previously accepted OICC SIDs unavailable"
    original_oiii = {p: c for p, c in before_by_page.items() if c["airport"] == "OIII"}
    assert original_oiii, "Locked Mehrabad records missing"
    pilot_candidates = {int(c["page"]): c for c in provisional["charts"] if int(c["page"]) in WANTED}
    assert set(pilot_candidates) == set(WANTED), "Missing flight-test candidates"

    doc = fitz.open(PDF)
    new_text = native_before
    additions = []
    for page in WANTED:
        row = index[page]
        item = pilot_candidates[page]
        assert row["airport"] == item["airport"] == OICC and row["category"] == "SID"
        assert item["chartKey"] == chart_key(row)
        assert item["sourceFingerprint"] == page_fingerprint(doc[page-1]), "Chart fingerprint mismatch"
        assert item["validation"]["method"] == "single_axis_plus_conformal_scale"
        assert item["validation"]["qaTestOnly"] and item["validation"]["notApprovedForNavigation"]
        assert item["validation"]["notToScaleTextPresentElsewhereOnPage"] is False
        assert not doc[page-1].search_for("NOT TO SCALE"), "Unexpected non-scale region"
        assert item["coordinateSpace"] == "pdf_points" and item["origin"] == "top_left"
        assert item["width"] == doc[page-1].rect.width and item["height"] == doc[page-1].rect.height
        residual = affine_qa(item)

        if page in before_by_page:
            # Never overwrite any preexisting or separately approved map.
            assert before_by_page[page]["sourceFingerprint"] == item["sourceFingerprint"]
            continue
        model = copy.deepcopy(item)
        model["validation"]["flightTestOnly"] = True
        model["validation"]["ownerFlightTestPending"] = True
        marker = '    {\n      "page": ' + str(page+1) + ","
        assert new_text.count(marker) == 1, "Cannot insert uniquely in source order"
        insertion = "\n".join("    " + line for line in json.dumps(model, ensure_ascii=False, indent=2).splitlines())
        new_text = new_text.replace(marker, insertion + ",\n" + marker, 1)
        additions.append({
            "pdfPage": page,
            "chartNumber": row["chart_number"],
            "name": row["name"],
            "fingerprint": item["sourceFingerprint"],
            "controlPoints": len(item["points"]),
            "gridFitResidualPdfPoints": residual,
            "method": item["validation"]["method"],
            "flightTestOnly": True
        })

    result = json.loads(new_text)
    after_by_page = {int(c["page"]): c for c in result["charts"]}
    assert len(after_by_page) == len(result["charts"])
    assert len(after_by_page) == len(before_by_page) + len(additions)
    assert set(WANTED) <= set(after_by_page)
    for page, record in before_by_page.items():
        assert after_by_page[page] == record, "Existing calibration was changed: " + str(page)
    assert {p: c for p, c in after_by_page.items() if c["airport"] == "OIII"} == original_oiii
    assert all(c["airport"] == OICC and c["validation"]["qaTestOnly"]
               and c["validation"]["notApprovedForNavigation"]
               for p, c in after_by_page.items() if p in WANTED)

    if additions:
        NATIVE.write_text(new_text, encoding="utf-8")
        WEB.write_text(new_text, encoding="utf-8")
    assert NATIVE.read_bytes() == WEB.read_bytes(), "Web and Android release assets differ"
    report = {
        "sourcePdf": PDF.name,
        "airac": "V2621",
        "sourceSha256": expected_sha,
        "airport": OICC,
        "category": "SID",
        "scope": "simulator moving-map flight test only; NOT for actual navigation",
        "requestedPages": list(WANTED),
        "newlyAddedPages": [a["pdfPage"] for a in additions],
        "activeBefore": len(before_by_page),
        "activeAfter": len(after_by_page),
        "allPreviousRecordsPreserved": True,
        "mehrabadUnmodified": True,
        "webAndroidAssetsIdentical": True,
        "independentFlightTest": "pending",
        "pages": additions
    }
    REPORT.write_text(json.dumps(report, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    print(json.dumps({"newlyAdded": len(additions), "activeTotal": len(after_by_page),
                      "pages": list(WANTED), "OIIIProtected": len(original_oiii)}, indent=2))


if __name__ == "__main__":
    main()
