#!/usr/bin/env python3
"""V2621 SOURCE-EXCLUSIVE georeference audit; NEVER a production publisher.

Inputs: original Jeppesen terminal PDF + current chart index + current georeference.
Allowed external geodetic controls: official State AIP exclusively.
No OpenStreetMap, Google Maps, public directories or third-party runway datasets.
DME slant range is a legitimate 3D measurement, not an unconditional ground radius.
"""
from __future__ import annotations
import csv
import hashlib
import json
import re
import sys
from collections import Counter, defaultdict
from pathlib import Path

import fitz
import numpy as np

sys.path.insert(0, "scripts")
from extract_chart_georef import extract, page_fingerprint

EXPECTED_SHA = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
PDF = Path("Iran2621.pdf")
ASSETS = Path("app/src/main/assets")
OUT = Path("docs/audits/V2621/aip-jeppesen-only")
# These are actual State AIS/AIM publishers, not aviation-data aggregators.
OFFICIAL_STATE_AIS = {
    "Iran": ["ais.airport.ir"],
    "Turkey": ["dhmi.gov.tr","ais.dhmi.gov.tr"],
    "UAE": ["gcaa.gov.ae"],
    "Qatar": ["caa.gov.qa","aim.gov.qa"],
    "Pakistan": ["caapakistan.com.pk","pcaa.gov.pk"],
    "Iraq": ["icaa.gov.iq"],
    "Armenia": ["armats.am"],
    "Georgia": ["airnav.ge"],
    "Oman": ["caa.gov.om"],
}
KNOWN_OFFICIAL_AIP = {
    "OIBL": "https://ais.airport.ir/documents/452631/186839484/OIBL.pdf",
    "OIHH": "https://ais.airport.ir/documents/452631/186839535/OIHH.pdf",
    "OIMB": "https://ais.airport.ir/documents/452631/186839606/OIMB.pdf",
    "OIZS": "https://ais.airport.ir/documents/452631/186846259/OIZS.pdf",
}
SUCCESSFUL_USER_TESTS = {"OIMB":561,"OIHH":342,"OIBL":118}
UNTESTED_ADCS = {"OIZS":961}
GRID = re.compile(r"(?<!\d)\d{2,3}-(?:\d{2})(?:\.\d+)?(?!\d)")
RADIAL = re.compile(r"(?<![A-Z])R\s*[- ]?\s*(\d{3})(?:\^|°)?",re.I)
DME = re.compile(r"(?<![A-Z0-9])D\s*(\d{1,3}(?:\.\d+)?)(?!\d)|\bDME\s*(\d{1,3}(?:\.\d+)?)\b",re.I)
ICAO_HEADER = re.compile(r"\b([A-Z]{4})/[A-Z0-9]{3}\b")
LAT_LONG_INFO = re.compile(r"Lat/Long:\s*N\s*(\d{1,2})°\s*([\d.]+).*?E\s*(\d{2,3})°\s*([\d.]+)",re.I|re.S)
CHART_NE = re.compile(r"\bN\s*(\d{1,2})\s+(\d{1,2}(?:\.\d+)?)\s+E\s*(\d{2,3})\s+(\d{1,2}(?:\.\d+)?)\b")
LAYOUT = re.compile(r"^(?:10|20|30)-9[A-Z0-9]*$")
MINIMUMS = re.compile(r"MINIMUMS|(?:10|20|30)-9S\d*$",re.I)
PLAN_NAMES = re.compile(r"AIRPORT DIAGRAM|AIRPORT CHART|AIRPORT LAYOUT|GROUND CHART|PARKING|APRON|TAXIWAY|TAXI ROUTE|DOCKING|INS COORDINATES|STANDS|HOT SPOT|PUSHBACK|PUSH.BACK",re.I)
EXCLUDED_DESCRIPTION = re.compile(r"MINIMUMS|ADDITIONAL RUNWAY INFORMATION|TAKE.OFF MINIMUMS",re.I)
TARGET_PAGES = {118:"OIBL",342:"OIHH",561:"OIMB",961:"OIZS"}

def hash_source(path:Path)->str:
    h=hashlib.sha256()
    with path.open("rb") as f:
        for data in iter(lambda:f.read(1024*1024),b""):h.update(data)
    return h.hexdigest()

def identity(row):
    return "|".join(str(row.get(k,"")).strip().upper() for k in ("airport","category","chart_number","name"))

def category(row):
    if row["category"]=="Approach":return "APP"
    if row["category"]!="Airport":return None
    plate=(row.get("chart_number") or "").strip()
    name=row.get("name") or ""
    if MINIMUMS.search(plate+" "+name):return None
    if plate in ("10-9","20-9","30-9"):return "ADC"
    if LAYOUT.fullmatch(plate):
        # Include ambiguous 9A-9Z plates for manual layout determination rather
        # than silently dropping unlabelled airport drawings.
        return "AIRPORT_LAYOUT_REVIEW" if not PLAN_NAMES.search(name) else "AIRPORT_LAYOUT"
    if PLAN_NAMES.search(name) and not EXCLUDED_DESCRIPTION.search(name):
        return "AIRPORT_LAYOUT_REVIEW"
    return None

def main():
    if hash_source(PDF)!=EXPECTED_SHA:raise RuntimeError("Source Jeppesen PDF SHA mismatch")
    doc=fitz.open(PDF)
    if len(doc)!=1654:raise RuntimeError("Source PDF pagecount mismatch")
    manifest=json.loads((ASSETS/"charts-manifest.json").read_text())
    index=json.loads((ASSETS/"charts-current.json").read_text())
    georef=json.loads((ASSETS/"chart-georef.json").read_text())
    if manifest["version"]!="V2621" or manifest["source_sha256"]!=EXPECTED_SHA:raise RuntimeError("Manifest source mismatch")
    if georef["source"]["sha256"]!=EXPECTED_SHA or georef["source"]["chartDataVersion"]!="V2621":raise RuntimeError("Live georef metadata mismatch")
    if len(index)!=1642:raise RuntimeError("Unexpected indexed chart count")
    actual={int(row["page"]):row for row in index}
    if len(actual)!=len(index):raise RuntimeError("Duplicate global PDF page")
    by_icao=defaultdict(list)
    for row in index:by_icao[row["airport"]].append(row)
    # The source from JEPPESEN GENERAL INFORMATION is only a rough, chart-
    # printed anchor for choosing latitude vs longitude labels; it is NOT an
    # independently AIP-surveyed <10m control point.
    anchors={}
    for icao,rows in by_icao.items():
        for row in rows:
            m=LAT_LONG_INFO.search(doc[row["page"]-1].get_text())
            if m:
                anchors[icao]={"lat":int(m[1])+float(m[2])/60,
                               "lon":int(m[3])+float(m[4])/60,
                               "sourcePage":row["page"],
                               "sourceType":"Jeppesen general-information approximate Lat/Long (not a surveyed GCP)"}
                break
        if icao not in anchors:
            for row in rows:
                s=doc[row["page"]-1].get_text()
                h=ICAO_HEADER.search(s)
                n=CHART_NE.search(s)
                if n and (not h or h[1]==icao):
                    anchors[icao]={"lat":int(n[1])+float(n[2])/60,
                                   "lon":int(n[3])+float(n[4])/60,
                                   "sourcePage":row["page"],
                                   "sourceType":"Jeppesen printed N/E chart header approximate anchor"}
                    break
    by_geopage=defaultdict(list)
    for row in georef["charts"]:
        if isinstance(row.get("page"),int):by_geopage[row["page"]].append(row)
    report=[]
    candidates=[]
    rejected=Counter()
    reason_counts=Counter()
    matched=Counter()
    for row in sorted(index,key=lambda x:x["page"]):
        kind=category(row)
        if not kind:continue
        n=row["page"]
        page=doc[n-1]
        text=page.get_text()
        geo_list=by_geopage.get(n,[])
        consistent=[g for g in geo_list if g.get("airport")==row["airport"] and
                   (g.get("chartKey") or "").strip().upper()==identity(row) and
                   g.get("width")==page.rect.width and g.get("height")==page.rect.height]
        h=ICAO_HEADER.search(text)
        owner=(h[1] if h else "")
        owner_mismatch=bool(owner and owner!=row["airport"] and owner in by_icao)
        # A map assigned to the wrong printed ICAO must not be treated as safe.
        status=("OWNER_MISMATCH_WITH_EXISTING_GEO_HOLD"
                if owner_mismatch and consistent else
                "EXISTING_MATCHED" if consistent else "NEEDS_GEOREF")
        if status=="EXISTING_MATCHED":matched[kind]+=1
        not_to_scale="NOT TO SCALE" in text.upper()
        has_grid=bool(GRID.search(text))
        # Textual labels are hints; NAVAID and chart-symbol association pending.
        # Reject obvious ATC frequencies and visibility minima as false DME/radials.
        radials=sorted(set(r for r in RADIAL.findall(text) if int(r) < 360))
        slants=sorted(set(
            a or b for a,b in DME.findall(text)
            if 0.0 < float(a or b) <= 80.0
        ),key=lambda x:float(x))
        anchor=anchors.get(row["airport"])
        record={
            "page":n,"airport":row["airport"],"printedHeaderICAO":owner,
            "headerOwnerMismatch":owner_mismatch,
            "category":kind,"plate":row.get("chart_number",""),"name":row.get("name",""),
            "baseline":status,"georefKeyVerified":bool(consistent),
            "previousGeoRecordsOnPage":len(geo_list),
            "jeppPrintedGrid":has_grid,"jeppNotToScaleMention":not_to_scale,
            "jeppARPTextMention":bool(re.search(r"\bARP\b",text)),
            "jeppVORTextMention":bool(re.search(r"\bVOR\b",text)),
            "jeppNDBTextMention":bool(re.search(r"\bNDB\b",text)),
            "jeppRadialLabels":radials[:60],"jeppDmeLabelsNm":slants[:60],
            "officialAipUrl":KNOWN_OFFICIAL_AIP.get(row["airport"],""),
            "officialAipControlsIndependentVerified":False,
            "externalReferencePolicy":"Official State AIP or Jeppesen source ONLY",
            "dmeSlantPolicy":"3D range constraint; needs NAVAID elevation, target altitude, radial variation and independent point evidence",
            "approvedForApp":False,"userTestStatus":(
                "SUCCESSFUL_USER_ADC_MARKER_TEST" if TARGET_PAGES.get(n)==row["airport"] and row["airport"] in SUCCESSFUL_USER_TESTS else
                "NOT_TESTED" if TARGET_PAGES.get(n)==row["airport"] and row["airport"] in UNTESTED_ADCS else ""),
            "jeppApproximateAnchorFound":bool(anchor),"candidateResult":"NOT_ATTEMPTED"
        }
        if status!="EXISTING_MATCHED":
            if owner_mismatch:
                record["candidateResult"]="HEADER_OWNER_MISMATCH_REQUIRES_REINDEX"
            elif not anchor:
                record["candidateResult"]="NEEDS_SOURCE_ANCHOR_AIP_OR_JEPP"
            elif not_to_scale:
                record["candidateResult"]="NOT_TO_SCALE_REQUIRES_SPECIFIC_PLAN_VIEW_REGION_QA"
            elif not has_grid:
                record["candidateResult"]="NO_PRINTED_GRATICULE_AIP_GCP_OR_RADIAL_DME_CONSTRAINTS_NEEDED"
            else:
                try:
                    chart=extract(page,n,row,anchor,fingerprint=page_fingerprint(page))
                    check=chart.get("validation",{})
                    record["candidateResult"]="JEPP_VECTOR_GRATICULE_FIT_PROVISIONAL"
                    record["vectorMethod"]=check.get("method","")
                    record["vectorGridResidualPdfPoints"]=check.get("gridMaxResidualPdfPoints")
                    record["vectorControlCount"]=check.get("controlPointCount")
                    record["maskCount"]=len(chart.get("excludedBounds",[]))
                    # Reject a candidate from being used as production data.
                    chart["validation"]["sourceOnly"]=True
                    chart["validation"]["thirdPartyReferenceCount"]=0
                    chart["validation"]["independentOfficialAipGcpValidated"]=False
                    chart["validation"]["approvedForApp"]=False
                    chart["validation"]["requiresIndependent10mHoldout"]=True
                    chart["validation"]["userTestStatus"]=record["userTestStatus"]
                    candidates.append(chart)
                except Exception as exc:
                    record["candidateResult"]="VECTOR_GEOMETRY_REJECTED_PENDING_AIP_CONTROL"
                    record["vectorFailure"]=str(exc)[:220]
            rejected[record["candidateResult"]]+=1
        reason_counts[kind]+=1
        report.append(record)
        if len(report)%50==0:
            print("SOURCE_ONLY_PROGRESS",len(report),"/",len(index),"candidates",len(candidates),flush=True)
    counts=Counter(x["category"] for x in report)
    needed=Counter(x["category"] for x in report if x["baseline"]!="EXISTING_MATCHED")
    headers=[x for x in report if x["headerOwnerMismatch"]]
    OUT.mkdir(parents=True,exist_ok=True)
    (OUT/"SOURCE_POLICY.json").write_text(json.dumps({
        "originalPdfSha256":EXPECTED_SHA,"originalPages":1654,"cycle":2621,
        "allowedAuthoritativeExternalReferenceDomains":OFFICIAL_STATE_AIS,
        "knownOfficialAipDocuments":KNOWN_OFFICIAL_AIP,
        "aipDocumentVersionDateMustBeChecked":True,
        "sourceAipLinksOnlyAreNotCompletedGroundControlChecks":True,
        "userValidatedAdcs":SUCCESSFUL_USER_TESTS,
        "userUnvalidatedAdcs":UNTESTED_ADCS,
        "dmeSlantMetersFormula":"horizontal_m=sqrt(max(0,(slant_nm*1852)^2 - (alt_target_m-alt_navaid_m)^2))",
        "dmeIfVerticalSeparationUnknown":"valid spherical/circular constraint with uncertainty; NEVER equate to exact horizontal range",
        "radialNeeds":"documented station, magnetic variation and date, angular uncertainty; fixes need intersecting independent source constraints",
        "aipGcpPrecision":"do not use Jepp general-info rounded Lat/Long as 10m control; require official precision and held-out fit",
        "radialDmeLabelParsing":"preliminary textual token screening ONLY; station pairing, plotted fix position and AIP validity not verified",
        "testDoesNotImplyNavigationCertification":True,
        "noAutomaticPublication":True},indent=2,ensure_ascii=False)+"\n")
    with (OUT/"all_app_and_airport_layout_audit.csv").open("w",newline="",encoding="utf-8") as f:
        keys=["page","airport","printedHeaderICAO","headerOwnerMismatch","category","plate","name",
              "baseline","georefKeyVerified","previousGeoRecordsOnPage","jeppPrintedGrid","jeppNotToScaleMention",
              "jeppARPTextMention","jeppVORTextMention","jeppNDBTextMention","jeppRadialLabels","jeppDmeLabelsNm",
              "officialAipUrl","jeppApproximateAnchorFound","candidateResult","vectorMethod","vectorGridResidualPdfPoints",
              "vectorControlCount","maskCount","vectorFailure","userTestStatus","approvedForApp"]
        writer=csv.DictWriter(f,fieldnames=keys,extrasaction="ignore")
        writer.writeheader()
        for item in report:
            item=dict(item)
            for k in ("jeppRadialLabels","jeppDmeLabelsNm"):item[k]=";".join(item[k])
            writer.writerow(item)
    (OUT/"all_app_and_airport_layout_audit.json").write_text(json.dumps({
        "metadata":{"source":"V2621 official AIP + licensed Jeppesen source only","sourcePdfSha256":EXPECTED_SHA,
                    "originalAirportCount":len(by_icao),"georefCurrentCount":len(georef["charts"]),
                    "eligibleCount":len(report),"needsGeoreference":sum(needed.values()),
                    "eligibleByType":dict(counts),"needsByType":dict(needed),
                    "jeppVectorFitProvisionalCount":len(candidates),
                    "reasonCounts":dict(rejected),"headerOwnerMismatches":headers,
                    "existingGeorefUnderWrongPrintedIcao":sum(x["baseline"]=="OWNER_MISMATCH_WITH_EXISTING_GEO_HOLD" for x in report),
                    "noAutomaticPublish":True},
        "charts":report},indent=2,ensure_ascii=False)+"\n")
    (OUT/"JEPP_ONLY_UNAPPROVED_CANDIDATES.json").write_text(json.dumps({
        "experimentalOnly":True,"allowedSources":["Official AIP","Jeppesen V2621 original PDF"],
        "sourceSha256":EXPECTED_SHA,"acceptedForNavigation":False,"charts":candidates},indent=2,ensure_ascii=False)+"\n")
    summary=[
        "# JEPPIRAN V2621 — All APP + airport layout re-audit, official AIP / Jeppesen only","",
        f"Original Jeppesen PDF SHA256: \`{EXPECTED_SHA}\`, 1654 pages.",
        "THIRD-PARTY COORDINATES: **0 permitted**. Application/runtime GPS, FSX/X-Plane bridges and live chart-georef.json unchanged.","",
        f"Indexed terminal charts: {len(index)}; published georeference records: {len(georef['charts'])}.",
        f"Eligible APP / ADC / airport layout & layout-review charts: **{len(report)}**.",
        f"Records without strictly matched current-cycle chart georeference: **{sum(needed.values())}**.","",
        "| Category | Eligible | Missing / identity mismatch |",
        "|---|---:|---:|",
    ]
    for kind in ("APP","ADC","AIRPORT_LAYOUT","AIRPORT_LAYOUT_REVIEW"):
        summary.append(f"| {kind} | {counts[kind]} | {needed[kind]} |")
    summary.extend(["","## Source-only candidate screening (NOT approval)","",
       f"Provisional chart-grid/vector affine fits: **{len(candidates)}**.",
       "These do not pass official-AIP-independent 10 metre ground-point QA unless an official AIP point is checked separately.",
       "Jeppesen general information coordinates are rounded; they are used only to disambiguate source tick labels, never as precise runway/ARP points.",
       "All DME/radial labels are recorded as source-derived constraints only. Slant range is accepted as a 3D sphere; its 2D projected locus requires aircraft/fix and NAVAID elevation or an uncertainty bound.",
       "Printed NOT TO SCALE may apply only to a separate inset; it requires scale-region marking before calibrating the primary plan view.","",
       "### Missing-page reason groups",""])
    for reason,n in rejected.most_common():summary.append(f"- \`{reason}\`: {n}")
    summary.extend(["","### Source ICAO discrepancies flagged (check the printed header visually before changing index)",""])
    for h in headers[:30]:summary.append(f"- PDF page {h['page']}: index {h['airport']} / extracted printed header {h['printedHeaderICAO']}.")
    summary.extend(["","### User's field-test outcomes","",
        "- Birjand OIMB, Hamadan OIHH, Bandar Lengeh OIBL: **successful hands-on tests**, not automatic certification for other plates.",
        "- Saravan OIZS: **not field-tested**.",
        "",
        "**RELEASE GATE:** 10 m maximum independently withheld AIP/Jepp ground-control 2D error; explicit PDF page identity and source vintage; navaid altitude/variation for slant range/radial; map/inset masks; confirmed marker projection. Release only after separately authorized approval.",
        "",
        "**NOT FOR ACTUAL NAVIGATION**.",""])
    (OUT/"README.md").write_text("\n".join(summary),encoding="utf-8")
    print("SOURCE_ONLY_SUMMARY="+json.dumps({
        "eligible":len(report),"byType":dict(counts),"missing":sum(needed.values()),
        "missingByType":dict(needed),"provisionalFits":len(candidates),
        "reasons":dict(rejected),"ownerHeaderMismatchCount":len(headers),"output":str(OUT)},sort_keys=True),flush=True)

if __name__=="__main__":
    main()
