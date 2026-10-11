#!/usr/bin/env python3
"""Index official Jeppesen LTFM 30-9J2..J12 stand pushback taxiway references.
Written instructions identify potential connecting taxiways, but do NOT supply
pushback geometry, operational clearance, or surveyed apron node coordinates.
"""
import fitz,json,re,sys
from collections import defaultdict
from pathlib import Path

TOKEN=re.compile(r"\b([A-Z]?\d{1,3}[LR]?)\b")
RANGE=re.compile(r"\b([A-Z]?)(\d{1,3})([LR]?)\s+thru\s+([A-Z]?)(\d{1,3})([LR]?)\b",re.I)
def expand(text):
    result=[]
    for chunk in re.split(r"\s*,\s*",text.replace("\n"," ").replace("through","thru")):
        m=RANGE.search(chunk)
        if not m:
            result.extend(x.group(1) for x in TOKEN.finditer(chunk));continue
        a,first,x,b,last,y=m.groups()
        first=int(first);last=int(last)
        if a!=b or last<first or last-first>80:continue
        if first==last:
            suffixes=["L","","R"]
            sequence=suffixes[suffixes.index(x):suffixes.index(y)+1] if x in suffixes and y in suffixes and suffixes.index(x)<=suffixes.index(y) else [x,y]
            result.extend(a+str(first)+suffix for suffix in sequence)
        elif last-first<=16:
            result.append(a+str(first)+x)
            result.extend(a+str(n) for n in range(first+1,last))
            result.append(a+str(last)+y)
        else:
            result.extend([a+str(first)+x,a+str(last)+y])
    return list(dict.fromkeys(result))

def build(pdf_path):
    pdf=fitz.open(pdf_path)
    rows=[]; bystand=defaultdict(list);seen=set()
    for index,page in enumerate(pdf):
        text=page.get_text("text")
        key=re.search(r"\b30-9J(1[012]|[2-9])\b",text[:700])
        if not key or "STAND\nPUSHBACK PROCEDURE" not in text[:700]:continue
        label="30-9J"+key.group(1)
        seen.add(label)
        horizontals=[]
        for d in page.get_drawings():
            for line in d["items"]:
                if line[0]!="l":continue
                p,q=line[1:3]
                if abs(p.y-q.y)<.6 and min(p.x,q.x)<=90 and max(p.x,q.x)>490 and 60<p.y<775:
                    horizontals.append(round(p.y,1))
        horizontals=sorted(set(horizontals))
        if horizontals and horizontals[-1]<760:horizontals.append(773.)
        for top,bottom in zip(horizontals,horizontals[1:]):
            if bottom-top<20:continue
            standtext=page.get_textbox(fitz.Rect(84,top+1,140,bottom-1)).strip()
            if not standtext or any(v in standtext.upper() for v in ["STAND","APRON","TERMINAL","CHANGES","NONE."]):continue
            ids=expand(standtext)
            if not ids or len(ids)>60:continue
            instructions=page.get_textbox(fitz.Rect(140,top+1,375,bottom-1)).strip()
            if "pushback" not in instructions.lower() and "aircraft" not in instructions.lower():continue
            named=(re.findall(r"\bTWY\s+([A-Z][0-9A-Z]*)\b",instructions,re.I)
                   +re.findall(r"\b([A-Z][0-9A-Z]*)\s+taxiway\b",instructions,re.I))
            targets=list(dict.fromkeys(v.upper() for v in named if v.upper() not in
                {"FACING","AND","TO","ONTO","ONLY","FOR","BE","AS"}))
            row={"sourceChart":label,"sourcePdfPage":index+1,
              "standField":standtext.replace("\n"," "),
              "standIds":ids,"publishedTaxiwaysMentioned":targets,
              "publishedInstruction":instructions[:850],
              "pushbackGeometryVerified":False,"routable":False}
            rows.append(row)
            for sid in ids:bystand[sid].append(len(rows)-1)
    if len(rows)<60 or len(bystand)<240 or not any("30-9J4"==r["sourceChart"] and
            "D3" in r["standIds"] and "T5" in r["publishedTaxiwaysMentioned"] for r in rows):
        raise ValueError("Incomplete Jeppesen pushback table extraction: "+
                         repr((len(rows),len(bystand),sorted(seen))))
    return {"airport":"LTFM","cycle":"2621","kind":"published-pushback-taxiway-references",
      "simulationOnly":True,"routable":False,
      "warning":"Published pushback names only, no node connectivity or authorization. Alternate routes/aircraft restrictions must be read from original chart.",
      "stats":{"tableRows":len(rows),"standNamesCovered":len(bystand),"charts":len(seen)},
      "rows":rows,"standRows":dict(bystand)}
if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: extract_ltfm_pushback_targets.py LTFM.pdf output.json")
    data=build(sys.argv[1]);p=Path(sys.argv[2]);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(data,indent=2)+"\n",encoding="utf8")
    print(data["stats"])
