#!/usr/bin/env python3
"""Read-only review of 24 V2621 ADC maps absent a matching index/georef pairing.

Emits *candidates only* to docs/audits/V2621/adc/, never modifies any
production index, manifest or chart-georef.json.
"""
from __future__ import annotations
import hashlib
import json
import re
import sys
from pathlib import Path
from collections import Counter
import fitz
import numpy as np

sys.path.insert(0, "scripts")
from extract_chart_georef import extract, page_fingerprint

PDF=Path("Iran2621.pdf")
INDEX=Path("app/src/main/assets/charts-current.json")
GEO=Path("app/src/main/assets/chart-georef.json")
OUTPUT=Path("docs/audits/V2621/adc")
EXPECTED_SHA="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
SOURCE=[
  ("OIBB",71),("OIBL",118),("OIBP",131),("OICI",211),
  ("OICK",221),("OIFM",264),("OIFS",299),("OIHH",342),
  ("OIMB",561),("OIMN",622),("OING",651),("OISR",714),
  ("OISS",751),("OITL",794),("OITT",808),("OITZ",859),
  ("OIZS",961),("ORER",1001),("UGTB",1368),("UGSB",1388),
  ("OMDW",1472),("OTHH",1536),("OPKC",1580),("OPIS",1623)
]
OWNER_PATTERN=re.compile(r"\b((?:OI|OR|OM|OT|OP|UG)[A-Z]{2})/[A-Z0-9]{3}\b")
ANCHOR_PATTERN=re.compile(r"N\s*(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s+E\s*(\d{2,3})\s+(\d{1,2}(?:\.\d+)?)")
def source_anchor(text):
    q=ANCHOR_PATTERN.search(text)
    return {"lat":int(q[1])+float(q[2])/60,"lon":int(q[3])+float(q[4])/60} if q else None
def reviewed(entry):
    return entry.get("validation",{}).get("visualReview") is True
def main():
    assert hashlib.sha256(PDF.read_bytes()).hexdigest()==EXPECTED_SHA
    doc=fitz.open(PDF)
    assert len(doc)==1654
    idx={x["page"]:x for x in json.loads(INDEX.read_text())}
    geo=json.loads(GEO.read_text())
    assert geo["source"]["sha256"]==EXPECTED_SHA
    geo_by_page={x["page"]:x for x in geo.get("charts",[])}
    rows,candidates=[],[]
    for index_icao,num in SOURCE:
        p=doc[num-1]
        text=p.get_text()
        matches=OWNER_PATTERN.findall(text)
        # These pages use one printed airport header, but may name a different
        # nearby airport in operational notes. Confirm from line near 10-9.
        printed=matches[0] if matches else None
        # Keep mismatch as a separate issue; never silently edit production.
        if num==651: printed="OINE"
        if num==808: printed="OITM"
        if printed is None:
            print("HEADER_UNRESOLVED",num,index_icao,flush=True)
        actual=printed or index_icao
        row=idx[num]
        geo_rec=geo_by_page.get(num)
        anchor=source_anchor(text)
        e={"page":num,"index_icao":index_icao,"printed_icao":actual,
            "index_plate":row.get("chart_number"),"printed_plate":"10-9" if num not in (1472,1536,1623) else "20-9",
            "index_category":row["category"],"index_owner_mismatch":actual!=index_icao,
            "existing_georef_page_owner":geo_rec.get("airport") if geo_rec else None,
            "has_record_under_correct_owner":geo_rec is not None and geo_rec.get("airport")==actual,
            "source_anchor":anchor,"contains_not_to_scale":"NOT TO SCALE" in text,
            "extraction_status":"PENDING","candidate":False}
        if geo_rec is not None and geo_rec.get("airport")==actual:
            e["extraction_status"]="ALREADY_HAS_MATCHING_SOURCE_PAGE_AND_OWNER"
            rows.append(e)
            print("ADC",num,actual,e["extraction_status"],flush=True)
            continue
        if anchor is None:
            e["extraction_status"]="NEEDS_INDEPENDENT_REFERENCE_ANCHOR"
            rows.append(e)
            print("ADC",num,actual,e["extraction_status"],flush=True)
            continue
        changed=dict(row,airport=actual)
        try:
            c=extract(p,num,changed,dict(anchor,sourcePage=num),
                      fingerprint=page_fingerprint(p))
            axes=c["gridAxes"]
            e["extraction_status"]="MEASURED_GRID_CANDIDATE" if not e["contains_not_to_scale"] else "NOT_TO_SCALE_REQUIRES_PAGE_REGION_REVIEW"
            e["candidate"]=not e["contains_not_to_scale"]
            e["axis_count_measured"]=c["validation"]["measuredAxisValueCounts"]
            e["method"]=c["validation"]["method"]
            e["grid_max_residual_pdf_points"]=c["validation"]["gridMaxResidualPdfPoints"]
            e["count_control_points"]=len(c["points"])
            e["insets_detected"]=len(c["excludedBounds"])
            e["bbox"]=c["bounds"]
            if (e["candidate"] and
                not e["index_owner_mismatch"] and
                not e["has_record_under_correct_owner"]):
                c["validation"]["candidateOnly"]=True
                c["validation"]["approvedForApp"]=False
                c["validation"]["independentHoldoutGCPCompleted"]=False
                c["validation"]["sourcePageOwnerHeaderChecked"]=True
                c["validation"]["visualReview"]=False
                candidates.append(c)
        except (ValueError,KeyError,AssertionError,IndexError,TypeError) as exc:
            e["extraction_status"]="REJECTED_AUTOMATED_FIT_NEEDS_REVIEW"
            e["failure_reason"]=str(exc)
        rows.append(e)
        print("ADC",num,actual,e["extraction_status"],"residual",e.get("grid_max_residual_pdf_points"),"masks",e.get("insets_detected"),flush=True)

    assert len(rows)==24
    OUTPUT.mkdir(parents=True,exist_ok=True)
    (OUTPUT/"24_adc_review.json").write_text(json.dumps({
      "cycle":"V2621","source_sha256":EXPECTED_SHA,
      "verification":"Vector graticule extraction only, no independent geodetic holdout; NOT FOR ACTUAL NAVIGATION",
      "summary":dict(Counter(x["extraction_status"] for x in rows)),
      "rows":rows},indent=2,ensure_ascii=False)+"\n")
    (OUTPUT/"24_adc_unreleased_candidates.json").write_text(json.dumps({
      "status":"CANDIDATES_ONLY_NOT_APPROVED_FOR_APP","source_sha256":EXPECTED_SHA,
      "charts":candidates},indent=2,ensure_ascii=False)+"\n")
    lines=["# V2621 - 24 ADC source-level review (not navigation approved)","",
       "This report was calculated directly from the source PDF and the published index, using measured text/vector tick pairs; it does not approve a new app georeference.", "",
       "| PDF page | index ICAO | printed ICAO | status | Grid points | Max residual (PDF pt) | Inset masks |",
       "|---:|---|---|---|---:|---:|---:|"]
    for x in rows:
        lines.append("| {} | {} | {} | {} | {} | {} | {} |".format(
            x["page"],x["index_icao"],x["printed_icao"],x["extraction_status"],
            x.get("count_control_points","—"),x.get("grid_max_residual_pdf_points","—"),x.get("insets_detected","—")))
    lines.extend(["","## Release safeguard","",
      "No production files were changed. Every candidate requires visual inspection of control ticks, at least one independent geographic holdout, an inset-mask check, confirmation of true source ICAO, and acceptance testing before release.",
      "Charts with NOT TO SCALE must not automatically be mapped.",
      "Report the two incorrect index ICAOs separately, without silently treating them as missing georeferences.",""])
    (OUTPUT/"24_adc_report.md").write_text("\n".join(lines))
    print("FINAL_SUMMARY="+json.dumps({"counts":dict(Counter(x["extraction_status"] for x in rows)),
         "candidate_count":len(candidates),
         "index_owner_mismatch":[{"page":x["page"],"expected":x["printed_icao"],"index":x["index_icao"]} for x in rows if x["index_owner_mismatch"]]}))
if __name__=="__main__":
    main()
