#!/usr/bin/env python3
"""Airport-neutral Jeppesen terminal PDF evidence extractor.

Extracts chart labels, printed coordinates and native source vector curves.
NEVER calls a stroke/touch a taxiway, stand lead or legal runway crossing.
Output is repeatable and may be checkpointed/resumed by the airport job.
"""
import argparse, hashlib, json, math, re
from pathlib import Path
import fitz

PLATE=re.compile(r"^(?:10|20|30)-9[A-Z]?$")
RUNWAY=re.compile(r"^(?:0[1-9]|[12]\d|3[0-6])[LRC]?$")
STAND=re.compile(r"^\d{2,3}[LR]?$")
TAXI=re.compile(r"^[A-Z](?:\d{1,2})?$")
def pt(p): return [round(p.x,3),round(p.y,3)]
def bezier(a,b,c,d,t):
    s=1-t
    return [round(s*s*s*a[k]+3*s*s*t*b[k]+3*s*t*t*c[k]+t*t*t*d[k],3) for k in (0,1)]
def decode_paths(d):
    paths=[];cur=[]
    def flush():
        nonlocal cur
        if len(cur)>=2:paths.append(cur)
        cur=[]
    for obj in d.get("items",[]):
        if obj[0]=="l":
            a,b=pt(obj[1]),pt(obj[2])
            if cur and math.dist(cur[-1],a)>.25:flush()
            if not cur:cur=[a]
            if math.dist(cur[-1],b)>.02:cur.append(b)
        elif obj[0]=="c":
            a,b,c,e=map(pt,obj[1:5])
            if cur and math.dist(cur[-1],a)>.25:flush()
            if not cur:cur=[a]
            n=min(50,max(3,math.ceil((math.dist(a,b)+math.dist(b,c)+math.dist(c,e))/3)))
            cur.extend(bezier(a,b,c,e,k/n) for k in range(1,n+1))
        else:flush()
    flush()
    return paths
def is_airport_chart(text,icao):
    # Most Jepp headers print OIIE/IKA; accepts ICAO standalone as fallback.
    return bool(re.search(r"\b"+re.escape(icao)+r"\b",text))
def extract(pdf,icao,expected_sha=None):
    raw=Path(pdf).read_bytes()
    sha=hashlib.sha256(raw).hexdigest()
    if expected_sha and sha!=expected_sha:
        raise ValueError("Airport PDF SHA256 mismatch: check source cycle/revision")
    doc=fitz.open(stream=raw,filetype="pdf")
    charts=[]
    for page_index,p in enumerate(doc):
        text=p.get_text()
        if not is_airport_chart(text,icao):continue
        words=p.get_text("words")
        plates=[x[4] for x in words if PLATE.fullmatch(x[4])]
        # The source PDF contains approach and terminal text too. Only
        # AIRPORT diagram/parking pages enter taxi classification.
        if not plates:continue
        chart=plates[0]
        page={"pdfPageIndex0":page_index,"plate":chart,
              "width":round(p.rect.width,2),"height":round(p.rect.height,2),
              "sourcePageFingerprint":hashlib.sha256(text.encode()).hexdigest(),
              "labels":[],"vectorCandidates":[],"unreviewed":True}
        for x0,y0,x1,y1,txt,*_ in words:
            t=txt.strip().upper()
            if RUNWAY.fullmatch(t):kind="RUNWAY_DESIGNATOR_CANDIDATE"
            elif STAND.fullmatch(t):kind="STAND_TEXT_CANDIDATE"
            elif TAXI.fullmatch(t):kind="TAXI_OR_LEADER_LABEL_CANDIDATE"
            elif t.startswith("N35") or t.startswith("E051"):kind="GRID_TEXT_CANDIDATE"
            else:continue
            page["labels"].append({"text":t,"type":kind,
             "centerPdf":[round((x0+x1)/2,2),round((y0+y1)/2,2)],
             "confirmedStandNose":False,"reviewed":False})
        for idx,d in enumerate(p.get_drawings()):
            if d["type"] not in ("s","fs"):continue
            if d.get("color") is None:continue
            width=float(d.get("width") or 0)
            if width<.2 or width>2.2:continue
            for seg,pnts in enumerate(decode_paths(d)):
                length=sum(math.dist(a,b) for a,b in zip(pnts,pnts[1:]))
                if length<3:continue
                if any(pt[0]<55 or pt[0]>p.rect.width-45 or
                       pt[1]<40 or pt[1]>p.rect.height-5 for pt in (pnts[0],pnts[-1])):
                    continue
                page["vectorCandidates"].append({
                 "drawingId":idx,"segment":seg,"widthPt":round(width,3),
                 "kind":"UNREVIEWED_GRAPHICS_NOT_TAXIWAY",
                 "sourceChart":chart,"points":pnts,"lengthPt":round(length,2),
                 "taxiwayName":None,"physicalConnectionApproved":False})
        charts.append(page)
    if not charts:raise RuntimeError("No source AIRPORT diagrams located for "+icao)
    return {"schemaVersion":4,"engine":"JEPPIRAN_SOURCE_GEOMETRY_V4",
      "icao":icao,"airportPdfSha256":sha,"pages":len(doc),
      "sourcePdfPages":charts,"coordinateSystem":"PDF_POINTS_TOP_LEFT",
      "approvedTaxiwayCenterlines":0,"approvedStandLeads":0,
      "approvedHoldShorts":0,"approvedChartPortals":0,
      "simulatorOnly":True,"routeable":False,
      "policy":"Source vectors are unreviewed evidence. No automatic link approval from proximity."}
if __name__=="__main__":
    a=argparse.ArgumentParser()
    a.add_argument("--pdf",required=True)
    a.add_argument("--icao",required=True)
    a.add_argument("--sha256")
    a.add_argument("--out",required=True)
    opt=a.parse_args()
    icao=opt.icao.upper().strip()
    if not re.fullmatch(r"[A-Z]{4}",icao):raise ValueError("ICAO must be four letters")
    result=extract(opt.pdf,icao,opt.sha256)
    target=Path(opt.out);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,separators=(",",":"),ensure_ascii=False)+"\n",encoding="utf8")
    print("SOURCE PASS",icao,len(result["sourcePdfPages"]),"airfield diagram pages; native vectors, not fake routes")
