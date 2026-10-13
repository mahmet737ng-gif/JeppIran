#!/usr/bin/env python3
"""Cycle V2621 OIIE source-verified RUNWAY AXES only.

Derives two 45 m wide black runway polygons from the unmodified Jeppesen ADC,
checks WGS84 axis distances versus published AIP/Jeppesen lengths and emits only
runway-axis geometry. Does not publish guessed hold-short or apron portals.
For simulator/chart QA; never a taxi clearance or navigation authorization.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import fitz
from build_oiie_pdf_ground_evidence import find_page

# Fit to native ADC printed latitude/longitude labels, source cycle 2621.
XLAT=(-187.8,5001.01899)
YLON=(-154.09422,1825.24616)
SOURCE_SHA="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
PUBLISHED=(("11L_29R",("11L","29R"),4198),("11R_29L",("11R","29L"),4092))
def pt(p):return [round(p.x,5),round(p.y,5)]
def coord(p):
    lat=35+((p[0]-XLAT[1])/XLAT[0])/60
    lon=51+((p[1]-YLON[1])/YLON[0])/60
    return [lat,lon]
def hav(a,b):
    p,q=math.radians(a[0]),math.radians(b[0]);dp=q-p
    dl=math.radians(b[1]-a[1])
    h=math.sin(dp/2)**2+math.cos(p)*math.cos(q)*math.sin(dl/2)**2
    return 2*6371000*math.asin(min(1,math.sqrt(h)))
def center(a,b):return [(a[0]+b[0])/2,(a[1]+b[1])/2]
def scan(pdf):
    binary=pdf.read_bytes();d=fitz.open(stream=binary,filetype="pdf")
    pg=d[find_page(d,"20-9")]
    candidates=[]
    for idx,draw in enumerate(pg.get_drawings()):
        if draw.get("fill")!=(0.0,0.0,0.0):continue
        items=draw["items"]
        if draw.get("type") not in ("fs","f") or len(items)!=4 or any(x[0]!="l" for x in items):continue
        a,b,c,d=items
        # A -> B is left long side; C -> D is parallel opposite long side.
        A,B,C,D=pt(a[1]),pt(a[2]),pt(c[1]),pt(c[2])
        axis=[center(A,D),center(B,C)]
        long=math.dist(*axis)
        if not 350<long<500:continue
        near=math.dist(A,D);far=math.dist(B,C)
        if not 3<near<8 or not 3<far<8:continue
        geo=[coord(v) for v in axis]
        candidates.append({"drawingId":idx,"page":380,"axisPdf":axis,
          "axisWGS84":geo,"runwayLengthFromGridM":hav(*geo),
          "widthNearM":hav(coord(A),coord(D)),
          "widthFarM":hav(coord(B),coord(C)),
          "polygonPdf":[A,B,C,D],"sourceType":"JEPPESEN_FILLED_RUNWAY_POLYGON"})
    if len(candidates)!=2:
        raise RuntimeError("Expected two source-drawn long parallel runway strips; found "+str(len(candidates)))
    candidates.sort(key=lambda r:r["axisPdf"][0][0])
    approved=[]
    for source,(physical,ends,published) in zip(candidates,PUBLISHED):
        diff=abs(source["runwayLengthFromGridM"]-published)/published
        if diff>.01:raise RuntimeError(f"{physical} exceeds 1% published-length QA: {diff:.4%}")
        if any(not 35<w<55 for w in (source["widthNearM"],source["widthFarM"])):
            raise RuntimeError(f"{physical} source polygon width inconsistent with 45m runway")
        approved.append({
          **source,"physicalId":physical,"ends":list(ends),"publishedLengthM":published,
          "relativeLengthErrorPct":round(diff*100,4),
          "physicalRunwayAxisVerified":True,"axisSourceReviewed":True,
          "runwayEndLabelsVerified":True,"approvedHoldShortNodes":[],
          "entryOrExitTaxiGatesApproved":False,
          "requiresExplicitRunwayClearance":True,
          "allowed180DegreeTurns":"RUNWAY_END_ONLY"
        })
    return {"schemaVersion":1,"airport":"OIIE","cycle":"2621",
      "originalSourceSha256":SOURCE_SHA,
      "airportPdfSha256":hashlib.sha256(binary).hexdigest(),
      "pdfChart":380,"coordinateSystem":"WGS84_AND_PDF_PAGE_380",
      "qa":"RUNWAY_AXIS_SOURCE_POLYGON_AND_PUBLISHED_DIMENSIONS_PASSED",
      "safeForNavigation":False,"runwayOnlySimulatorPreview":True,
      "approvedStandRunwayRoutes":0,"approvedRunwayGates":0,
      "holdShortPositionSurveyed":False,
      "runways":approved,
      "guard":"Never use source runway endpoints to infer taxiway entry or stand-to-runway paths."}
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",required=True);ap.add_argument("--output",required=True)
    a=ap.parse_args()
    v=scan(Path(a.pdf));p=Path(a.output);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(v,separators=(',',':'))+"\n",encoding="utf8")
    for r in v["runways"]:
        print(r["physicalId"],"Drawing",r["drawingId"],
         "axis length",round(r["runwayLengthFromGridM"],1),"m",
         "versus",r["publishedLengthM"],"m", "error",r["relativeLengthErrorPct"],"%")
    print("PASS: 2 source-verified runway axes; 0 unreviewed apron or hold-short links.")
if __name__=="__main__":main()
