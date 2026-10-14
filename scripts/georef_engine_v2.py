#!/usr/bin/env python3
"""JEPPIRAN georeference V2: source-locked grid + independently checked landmark QA.

No production JSON is written; all newly derived models are REVIEW CANDIDATES.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path
import fitz
import numpy as np
from extract_chart_georef import extract, page_fingerprint

EXPECTED_SOURCE="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
EARTH=111319.49079327358

def within(r,x,y):
    return r["left"]<=x<=r["right"] and r["top"]<=y<=r["bottom"]

def valid_bounds(r,w,h):
    if not (0<=r["left"]<r["right"]<=w and 0<=r["top"]<r["bottom"]<=h):
        raise ValueError("Invalid map region bounds")

def calc_en(c,lat0,lon0):
    return ((c["lon"]-lon0)*EARTH*math.cos(math.radians(lat0)),
            (c["lat"]-lat0)*EARTH)

def fit_landmark_region(controls,region,excludes,page=None,tolerance=1.5):
    """Fit similarity transform with 3+ training GCPs and independent withheld GCP."""
    if len(controls)<4: raise ValueError("At least four independent controls required")
    if len(set(c["id"] for c in controls))!=len(controls):
        raise ValueError("Duplicate landmark IDs")
    if len(set(c.get("sourceRef") for c in controls))<2:
        raise ValueError("At least two published coordinate sources required")
    for c in controls:
        if not c.get("sourceRef") or not c.get("pdfMarkerText"):
            raise ValueError("Control missing sourceRef or printed PDF marker")
        if not all(map(math.isfinite,[c["lat"],c["lon"],c["x"],c["y"]])):
            raise ValueError("Non-finite control")
        if not (-90<=c["lat"]<=90 and -180<=c["lon"]<=180):
            raise ValueError("Invalid WGS84 coordinate")
        if not within(region,c["x"],c["y"]) or any(within(mask,c["x"],c["y"]) for mask in excludes):
            raise ValueError("Control outside calibrated region or inside an inset")
        if page is not None:
            matches=page.search_for(c["pdfMarkerText"])
            if not matches or not any(m.x0-110<=c["x"]<=m.x1+110 and
                      m.y0-110<=c["y"]<=m.y1+110 for m in matches):
                raise ValueError("Measured marker not located in original PDF: "+c["id"])
    test=[c for c in controls if c.get("role")=="holdout"]
    train=[c for c in controls if c.get("role")!="holdout"]
    if not test: train,test=controls[:-1],controls[-1:]
    if len(train)<3: raise ValueError("Three independent fitting controls required")
    lat0,lon0=train[0]["lat"],train[0]["lon"]
    A=[]; z=[]
    for c in train:
        e,n=calc_en(c,lat0,lon0)
        A.extend(([1,0,e,n],[0,1,-n,e]))
        z.extend((c["x"],c["y"]))
    coefficients,_,rank,_=np.linalg.lstsq(np.array(A,float),np.array(z,float),rcond=None)
    if rank!=4: raise ValueError("Degenerate landmark baseline")
    x0,y0,a,b=(float(t) for t in coefficients)
    scale=math.hypot(a,b)
    if not (0.0002<scale<0.2): raise ValueError("Unrealistic image scale")
    positions=[calc_en(c,lat0,lon0) for c in train]
    baseline=max(math.dist(p,q) for p in positions for q in positions)
    if baseline<1000: raise ValueError("Landmark baseline shorter than 1 km")
    def error(c):
        e,n=calc_en(c,lat0,lon0)
        return math.hypot(x0+a*e+b*n-c["x"],y0+b*e-a*n-c["y"])
    fit_error=max(error(c) for c in train)
    test_error=max(error(c) for c in test)
    if max(fit_error,test_error)>tolerance:
        raise ValueError("Independent or fitting residual exceeds tolerance")
    return {"method":"v2_verified_landmark_similarity",
            "status":"simulator_qa_candidate_only",
            "region":region,"excludedBounds":excludes,
            "anchor":{"lat":lat0,"lon":lon0,"x":x0,"y":y0},
            "a":a,"b":b,"trainingCount":len(train),
            "holdoutCount":len(test),
            "fitResidualPdfPoints":round(fit_error,6),
            "independentResidualPdfPoints":round(test_error,6)}

def scan(page):
    words=page.get_text("words")
    labels=sorted({w[4].upper() for w in words if any(
        key in w[4].upper() for key in ("NOTSA","VOR","DME","NDB","THR","KHD","ARP"))})
    return {"labels":labels[:35],
            "notToScaleRects":[list(map(float,r)) for r in page.search_for("NOT TO SCALE")]}

def grid_candidate(page,record,anchor):
    try:
        geo=extract(page,record["page"],record,anchor,page_fingerprint(page))
        for rect in page.search_for("NOT TO SCALE"):
            x,y=(rect.x0+rect.x1)/2,(rect.y0+rect.y1)/2
            if not any(within(mask,x,y) for mask in geo.get("excludedBounds",[])):
                raise ValueError("NOT TO SCALE region is not safely masked")
        return {"status":"source_grid_candidate_manual_review",
                "method":geo["validation"]["method"],
                "controlCount":len(geo["points"]),
                "maxResidualPdfPoints":geo["validation"]["gridMaxResidualPdfPoints"],
                "candidate":geo}
    except Exception as exc:
        return {"status":"needs_independent_controls","reason":str(exc)[:300]}

def fit_regions(page,rows):
    output=[]; registered=[]
    for item in rows:
        region=item["region"]
        valid_bounds(region,page.rect.width,page.rect.height)
        for prev in registered:
            if max(region["left"],prev["left"])<min(region["right"],prev["right"]) and max(region["top"],prev["top"])<min(region["bottom"],prev["bottom"]):
                raise ValueError("Two independent map regions overlap")
        registered.append(region)
        masks=item.get("excludedBounds",[])
        for mask in masks:
            valid_bounds(mask,page.rect.width,page.rect.height)
            if not within(region,mask["left"],mask["top"]) or not within(region,mask["right"],mask["bottom"]):
                raise ValueError("Inset mask is outside calibrated region")
        for label in page.search_for("NOT TO SCALE"):
            x,y=(label.x0+label.x1)/2,(label.y0+label.y1)/2
            if within(region,x,y) and not any(within(m,x,y) for m in masks):
                raise ValueError("NOT TO SCALE label not masked")
        output.append(fit_landmark_region(item.get("controls",[]),region,masks,page))
    return output

def run(pdf,index_file,georef_file,registry_file,airport="OICK"):
    pdf_sha=hashlib.sha256(pdf.read_bytes()).hexdigest()
    if pdf_sha!=EXPECTED_SOURCE: raise ValueError("Not the original V2621 PDF")
    source=georef_file.read_bytes(); root=json.loads(source)
    if root["source"]["sha256"]!=pdf_sha or root["source"]["chartDataVersion"]!="V2621":
        raise ValueError("Georeference PDF/cycle mismatch")
    entries=[x for x in json.loads(index_file.read_text()) if x["airport"]==airport]
    if not entries: raise ValueError("Airport not found")
    existing={c["page"]:c for c in root["charts"] if c["airport"]==airport}
    anchors=[c.get("airportAnchor") for c in existing.values() if c.get("airportAnchor")]
    if not anchors: raise ValueError("No published airport anchor")
    controls=json.loads(registry_file.read_text())
    if controls["airport"]!=airport or controls["sourceSha256"]!=pdf_sha:
        raise ValueError("External GCP registry is not source-locked")
    registrations={}
    for row in controls.get("charts",[]):
        if row["page"] in registrations: raise ValueError("Duplicate control page")
        registrations[row["page"]]=row.get("regions",[])
    if not set(registrations).issubset({x["page"] for x in entries}):
        raise ValueError("Controls refer to a foreign page")
    doc=fitz.open(pdf)
    if len(doc)!=root["source"]["pageCount"]: raise ValueError("Source page count changed")
    result={"engine":"JEPPIRAN_GEOREF_V2","airport":airport,"cycle":"V2621",
            "sourceSha256":pdf_sha,"productionSha256":hashlib.sha256(source).hexdigest(),
            "existingProtected":sorted(existing),"results":[]}
    for row in entries:
        page_number=row["page"]; page=doc[page_number-1]
        entry={"page":page_number,"name":row["name"],"category":row["category"]}
        if page_number in existing:
            entry["status"]="preserved_unchanged"
            entry["fingerprintVerified"]=(page_fingerprint(page)==existing[page_number]["sourceFingerprint"])
        elif row["name"].upper() in ("AIRPORT INFORMATION","MINIMUMS"):
            entry["status"]="information_or_minimums"
        else:
            entry.update(grid_candidate(page,row,anchors[0]))
            entry["sourceScan"]=scan(page)
            if page_number in registrations:
                try:
                    entry["landmarkRegions"]=fit_regions(page,registrations[page_number])
                    if entry["landmarkRegions"]:
                        entry["status"]="landmark_region_candidate_manual_review"
                except Exception as exc:
                    entry["landmarkError"]=str(exc)
        result["results"].append(entry)
    if hashlib.sha256(georef_file.read_bytes()).hexdigest()!=result["productionSha256"]:
        raise ValueError("Production data mutated during read-only scan")
    result["existingFingerprintVerified"]=all(x.get("fingerprintVerified") for x in result["results"] if x["status"]=="preserved_unchanged")
    result["candidatePages"]=[x["page"] for x in result["results"] if "candidate_manual_review" in x["status"]]
    result["needsControls"]=[x["page"] for x in result["results"] if x["status"]=="needs_independent_controls"]
    return result

def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument("--pdf",type=Path,default=Path("Iran2621.pdf"))
    ap.add_argument("--index",type=Path,default=Path("web/data/charts-current.json"))
    ap.add_argument("--georef",type=Path,default=Path("web/data/chart-georef.json"))
    ap.add_argument("--registry",type=Path,default=Path("docs/georeferencing/controls-v2-oick.json"))
    ap.add_argument("--airport",default="OICK")
    ap.add_argument("--output",type=Path,default=Path("review-assets/georef-v2-oick-qa.json"))
    args=ap.parse_args()
    result=run(args.pdf,args.index,args.georef,args.registry,args.airport)
    args.output.parent.mkdir(parents=True,exist_ok=True)
    args.output.write_text(json.dumps(result,indent=2,ensure_ascii=False)+"\n")
    print("GEOREF_V2_SUMMARY "+json.dumps({
        "airport":args.airport,"existingProtected":result["existingProtected"],
        "existingFingerprintVerified":result["existingFingerprintVerified"],
        "candidatePages":result["candidatePages"],"needsControls":result["needsControls"],
        "perPage":[{"page":r["page"],"status":r["status"],"reason":r.get("reason")}
                   for r in result["results"]]},ensure_ascii=False))
    if not result["existingFingerprintVerified"]:
        raise SystemExit("Previously accepted PDF fingerprints changed: stop release")

if __name__=="__main__": main()
