#!/usr/bin/env python3
"""OIIE stage 4-6 source-vector evidence. NO automatic taxi graph approval.

Accept either original 1654-page V2621 print or airport-split OIIE release PDF.
Native PDF strokes are evidence candidates, NOT stand leads, hold-short markings
or taxi centreline edges until independently reviewed against the source chart.
"""
import argparse
import hashlib
import json
import math
import re
from pathlib import Path

import fitz

CHARTS = {380: "20-9", 382: "20-9B", 383: "20-9C"}
BOXES = {380: (84,83,525,782),382: (84,51,525,782),383: (84,51,525,782)}
SALAM = (316.68,419.04,525,781.56)
SOURCE_HASH = "d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
RUNWAYS = ("11L","29R","11R","29L")
RUNWAY_CONTACT_LABELS = ("R1","R2","R3","R4","R5","R6")
def point(p): return [round(p.x,3),round(p.y,3)]
def in_box(p,b,t=0):
    return b[0]-t<=p[0]<=b[2]+t and b[1]-t<=p[1]<=b[3]+t
def bez(a,b,c,d,t):
    s=1-t
    return [round(s*s*s*a[i]+3*s*s*t*b[i]+3*s*t*t*c[i]+t*t*t*d[i],3) for i in range(2)]
def subpaths(d):
    result=[]
    current=[]
    def flush():
        nonlocal current
        if len(current)>=2:result.append(current)
        current=[]
    for op in d["items"]:
        if op[0]=="l":
            a,b=point(op[1]),point(op[2])
            if current and math.dist(current[-1],a)>.1:flush()
            if not current:current=[a]
            if math.dist(current[-1],b)>.001:current.append(b)
        elif op[0]=="c":
            a,b,c,end=map(point,op[1:5])
            if current and math.dist(current[-1],a)>.1:flush()
            if not current:current=[a]
            steps=min(70,max(3,math.ceil((math.dist(a,b)+math.dist(b,c)+math.dist(c,end))/2)))
            current += [bez(a,b,c,end,k/steps) for k in range(1,steps+1)]
        else:flush()
    flush()
    return result
def find_page(doc,chart):
    matches=[]
    for index in range(len(doc)):
        text=doc[index].get_text()
        if "OIIE/IKA" not in text:continue
        if re.search(r"(?<![A-Z0-9])"+re.escape(chart)+r"(?![A-Z0-9])",text):
            matches.append(index)
    if len(matches)!=1:raise ValueError(f"Expected one {chart} page, got indices {matches}")
    return matches[0]
def scan(pdf):
    data=pdf.read_bytes(); doc=fitz.open(stream=data,filetype="pdf")
    result={"schemaVersion":1,"airport":"OIIE","cycle":"2621",
     "parentSourceSha256":SOURCE_HASH,"inputPdfSha256":hashlib.sha256(data).hexdigest(),
     "coordinateSystem":"PDF_POINTS_TOP_LEFT","verifiedTaxiEdges":0,"verifiedRunwayGates":0,
     "status":"NATIVE_VECTOR_CANDIDATES_UNREVIEWED",
     "allowNavigation":False,"allowAutomaticRoutePromotion":False,
     "note":"Black strokes can depict lines, stand markings, tick marks, leaders or boundaries. A stroke intersection alone is never an approved taxiway junction.",
     "pages":{}}
    for page_no,plate in CHARTS.items():
        idx=find_page(doc,plate); page=doc[idx]; strokes=[];regcounts={}
        for id,dr in enumerate(page.get_drawings()):
            c=dr.get("color");w=dr.get("width") or 0
            if dr["type"]!="s" or c is None or any(abs(x)>.015 for x in c) or not (.4<=w<=.9):continue
            box=dr["rect"]; b=BOXES[page_no]
            if not in_box((box.x0,box.y0),b,.05) or not in_box((box.x1,box.y1),b,.05):continue
            for j,pts in enumerate(subpaths(dr)):
                length=sum(math.dist(a,z) for a,z in zip(pts,pts[1:]))
                if length<3.5:continue
                middle=((box.x0+box.x1)/2,(box.y0+box.y1)/2)
                region=("SALAM" if in_box(middle,SALAM) else "CARGO") if page_no==383 else ("PASSENGER" if page_no==382 else "ADC")
                strokes.append({"id":f"P{page_no}_D{id}_S{j}","drawingId":id,"page":page_no,"region":region,
                 "weightPt":round(w,3),"lengthPt":round(length,2),
                 "points":pts,"classification":"UNREVIEWED",
                 "physicalConnectionApproved":False})
                regcounts[region]=regcounts.get(region,0)+1
        labels=[]
        for x0,y0,x1,y1,t,*_ in page.get_text("words"):
            if t.upper() in RUNWAYS+RUNWAY_CONTACT_LABELS:
                labels.append({"text":t.upper(),"page":page_no,"centerPdf":[round((x0+x1)/2,2),round((y0+y1)/2,2)],
                 "role":"PUBLISHED_TEXT_LABEL_ONLY","holdShortPositionKnown":False,
                 "runwayEntryApproved":False})
        if not strokes:raise ValueError(f"No vector source candidates found for page {page_no}")
        result["pages"][str(page_no)]={"plate":plate,"sourceIndex0":idx,"nativeDrawings":len(page.get_drawings()),
         "candidateVectorStrokes":len(strokes),"regions":regcounts,"strokes":strokes,"runwayAndAccessLabels":labels}
    return result
def main():
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",required=True);ap.add_argument("--output",required=True)
    args=ap.parse_args()
    result=scan(Path(args.pdf));target=Path(args.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,separators=(",",":"))+"\n",encoding="utf-8")
    print("OIIE source-only candidate evidence:",
      {k:{"paths":v["candidateVectorStrokes"],"regions":v["regions"]} for k,v in result["pages"].items()})
    print("Approved centerlines: ZERO; runway gates: ZERO; only source evidence exported.")
if __name__=="__main__":main()
