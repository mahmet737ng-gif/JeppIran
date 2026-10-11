#!/usr/bin/env python3
"""Extract existing Jeppesen-colored taxi procedure strokes, no inferred links.
USAGE: python scripts/extract_ltfm_taxi_procedure_vectors.py LTFM.pdf output.json
For simulator QA only. Parking stand pushback leads are not provided by this file.
"""
import fitz
import json
import math
import re
import sys
from pathlib import Path

ROW_PATTERN=re.compile(r"\b(DEP|ARR)\s+(\d+[A-Z]):(.*?)(?=\b(?:DEP|ARR)\s+\d+[A-Z]:|TAXI ROUTES|See HOT|See AIRPORT|\bCHANGES:|\b31 JUL|\b1\s+HS3|\bPrinted from|\Z)",re.S)

def ink(d):
    rgb=d.get("color")
    if not rgb or float(d.get("width") or 0)<1.42: return None
    if rgb[2]>.9 and rgb[0]<.05 and rgb[1]<.05: return "blue"
    if rgb[0]>.5 and rgb[1]<.3 and rgb[2]<.4: return "red"
    return None

def strokes(page):
    route={"blue":[],"red":[]}
    for d in page.get_drawings():
        color=ink(d)
        if not color: continue
        for part in d["items"]:
            if part[0]!="l":continue
            a,b=part[1:3]
            cx=(a.x+b.x)/2;cy=(a.y+b.y)/2
            if not(145<=cx<=532 and 160<=cy<=665 and math.hypot(a.x-b.x,a.y-b.y)>=1.4):
                continue
            route[color].append([round(a.x,2),round(a.y,2),round(b.x,2),round(b.y,2)])
    return route

def chart(page,index):
    raw=page.get_text("text")
    if "STANDARD TAXI ROUTES" not in raw or not ("LTFM/IST" in raw or "ISTANBUL" in raw):
        return []
    name=re.search(r"\b30-9([FG]\d*)\b",raw)
    if not name: return []
    source="30-9"+name.group(1)
    block=re.sub(r"\s+"," ",raw[raw.index("STANDARD TAXI ROUTES"):][:1450])
    rw=re.search(r"For RWY\s+(.+?):",block)
    found=re.findall(r"\b\d{2}[LRC]?\b",rw.group(1)) if rw else []
    if not found:return []
    runway=found[0]
    rows=list(ROW_PATTERN.finditer(block))
    lines=strokes(page)
    out=[]
    for n,row in enumerate(rows):
        op,designator,body=row.group(1),row.group(2),row.group(3).strip()
        found=re.search(r"\b(?:shall use|use)\s+(?:TWYs?\s+)?([A-Z0-9, ]+?)\s+(?:TWYs?\s+)?and\s+hold",body,re.I)
        if not found: found=re.search(r"\buse\s+(?:TWYs?\s+)?([A-Z0-9, ]+?)\s+(?:TWYs?\s+)?hold",body,re.I)
        if found:
            waynames=[x.strip().upper() for x in found.group(1).split(",")
                      if re.fullmatch(r"[A-Z][A-Z0-9]*",x.strip(),re.I)]
        else:
            # The source chart body still supplies the clearance-limit text.
            waynames=[]
        hold=re.search(r"hold short of\s+(?:RWY\s+)?(\d{2}[LRC]?|TWY\s+[A-Z][A-Z0-9]*)",body,re.I)
        holdText=hold.group(1).upper() if hold else None
        choice=("blue" if lines["blue"] else "red") if n==0 else "red"
        segments=lines[choice]
        if not segments:raise RuntimeError(f"Missing {choice} route trace on {source}")
        out.append({
            "key":runway+designator,
            "operation":"DEPARTURE" if op=="DEP" else "ARRIVAL",
            "taxiways":waynames,
            "holdShortOf":holdText,
            "sourceChart":source,
            "sourcePdfPage":index,
            "sourceRouteColor":choice,
            "printedSegments":segments,
            "standConnectorMapped":False,
            "nodeGeometryVerified":False,
            "publishedText":body[:350].split(" .Eff.")[0]})
    return out

def build(path):
    data=fitz.open(path)
    result=[]
    for i,p in enumerate(data,1):
        text=p.get_text("text")
        if "30-9F" not in text and "30-9G" not in text:continue
        result+=chart(p,i)
    keys={(p["key"],p["operation"]) for p in result}
    if len(result)<25 or ("17R2F","DEPARTURE") not in keys:
        raise RuntimeError(f"Required LTFM route charts missing: {len(result)} routes found")
    return {
      "airport":"LTFM","cycle":"2621",
      "kind":"published-taxi-procedure-vector-traces",
      "coordinateSpace":"pdf_points","pdfPageSize":[612,792],
      "source":"Jeppesen LTFM cycle 21-2026 chart 30-9F*/30-9G*",
      "warning":"SIM QA ONLY. Original printed path strokes; no implied stand-to-taxi, runway crossing or ATC authorization.",
      "procedures":result
    }

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: extract_ltfm_taxi_procedure_vectors.py chart.pdf out.json")
    result=build(sys.argv[1])
    file=Path(sys.argv[2]);file.parent.mkdir(parents=True,exist_ok=True)
    file.write_text(json.dumps(result,ensure_ascii=False,separators=(",",":")),encoding="utf8")
    print(f"routes={len(result['procedures'])}, output={file}, bytes={file.stat().st_size}")
