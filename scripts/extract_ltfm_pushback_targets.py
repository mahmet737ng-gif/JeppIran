#!/usr/bin/env python3
"""Index official Jeppesen LTFM 30-9J2..J12 stand pushback taxiway references.
Written instructions identify potential connecting taxiways, but do NOT supply
pushback geometry, operational clearance, or surveyed apron node coordinates.
"""
import fitz,json,re,sys
from collections import defaultdict
from pathlib import Path

# Include every physically printed parking label when an official procedure uses
# a range: e.g. B3L thru B3R or B3L thru B13R. Avoid inventing stand names.
KNOWN_STANDS=set()

TOKEN=re.compile(r"\b([A-Z]?\d{1,3}[LR]?)\b")
RANGE=re.compile(r"\b([A-Z]?)(\d{1,3})([LR]?)\s+thru\s+([A-Z]?)(\d{1,3})([LR]?)\b",re.I)
def expand(text):
    t=text.replace("\n"," ").upper()
    output=[]
    pattern=re.compile(r"\b([A-Z]?)(\d{1,3})([LR]?)\s+THRU\s+([A-Z]?)(\d{1,3})([LR]?)\b")
    def key(s):
        m=re.fullmatch(r"([A-Z]?)(\d{1,3})([LR]?)",s)
        if not m:return None
        return m.group(1),int(m.group(2)),{"L":0,"":1,"R":2}[m.group(3)]
    def include(m):
        a,n,sa,b,k,sb=m.groups()
        n=int(n);k=int(k)
        if a!=b or k<n or k-n>80:return " "
        start=(n,{"L":0,"":1,"R":2}[sa]);stop=(k,{"L":0,"":1,"R":2}[sb])
        candidates=[sid for sid in KNOWN_STANDS if key(sid) and
                    key(sid)[0]==a and start<=key(sid)[1:]<=stop]
        output.extend(sorted(candidates,key=lambda sid:key(sid)))
        # Preserve chart instructions for stands not printed on the airport
        # layout sheets (100-series etc.), but do not fabricate L/R variants.
        if not candidates:
            if a=="" and sa==sb=="":
                output.extend(str(i) for i in range(n,k+1))
            elif n==k:
                output.extend([a+str(n)+x for x in ["L","","R"]
                    if (n,{"L":0,"":1,"R":2}[x])>=start and
                       (n,{"L":0,"":1,"R":2}[x])<=stop])
            else:
                output.extend([a+str(n)+sa,a+str(k)+sb])
        return " "
    # Replace ranges so their endpoint names do not get double counted.
    t=pattern.sub(include,t)
    output.extend(z.group(1) for z in TOKEN.finditer(t))
    return list(dict.fromkeys(output))

def build(pdf_path,stand_positions=None):
    global KNOWN_STANDS
    if stand_positions is not None:
        p=json.loads(Path(stand_positions).read_text())
        assert p["airport"]=="LTFM" and str(p["cycle"])=="2621"
        KNOWN_STANDS={str(x["id"]).upper() for x in p["stands"]}
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
            # The table's header STAND overlaps its first actual stand row
            # on every J page. Filter the header LINE, not every cell containing it.
            standtext="\n".join(line for line in standtext.splitlines()
                if line.strip().upper() not in ("STAND","APRON","TERMINAL","CHANGES","NONE."))
            if not standtext.strip():continue
            ids=expand(standtext)
            if not ids or len(ids)>60:continue
            instructions=page.get_textbox(fitz.Rect(140,top+1,375,bottom-1)).strip()
            if "pushback" not in instructions.lower() and "aircraft" not in instructions.lower():continue
            named=(re.findall(r"\bTWY\s+([A-Z][0-9A-Z]*)\b",instructions,re.I)
                   +re.findall(r"\b([A-Z][0-9A-Z]*)\s+taxiway\b",instructions,re.I))
            targets=list(dict.fromkeys(v.upper() for v in named if re.fullmatch(r"(?:[A-Z]{1,2}|[A-Z][0-9]+[A-Z]?)",v.upper()) and v.upper() not in
                {"FACING","AND","TO","ONTO","ONLY","FOR","BE","AS"}))
            row={"sourceChart":label,"sourcePdfPage":index+1,
              "standField":standtext.replace("\n"," "),
              "standIds":ids,"publishedTaxiwaysMentioned":targets,
              "publishedInstruction":instructions[:850],
              "pushbackGeometryVerified":False,"routable":False}
            rows.append(row)
            for sid in ids:bystand[sid].append(len(rows)-1)
    if len(rows)<75 or len(bystand)<240 or not any("30-9J4"==r["sourceChart"] and
            "D3" in r["standIds"] and "T5" in r["publishedTaxiwaysMentioned"] for r in rows):
        raise ValueError("Incomplete Jeppesen pushback table extraction: "+
                         repr((len(rows),len(bystand),sorted(seen))))
    return {"airport":"LTFM","cycle":"2621","kind":"published-pushback-taxiway-references",
      "simulationOnly":True,"routable":False,
      "warning":"Published pushback names only, no node connectivity or authorization. Alternate routes/aircraft restrictions must be read from original chart.",
      "stats":{"tableRows":len(rows),"standNamesCovered":len(bystand),"charts":len(seen)},
      "rows":rows,"standRows":dict(bystand)}
if __name__=="__main__":
    if len(sys.argv) not in (3,4):raise SystemExit("Usage: extract_ltfm_pushback_targets.py LTFM.pdf output.json [stand-positions.json]")
    data=build(sys.argv[1],sys.argv[3] if len(sys.argv)>3 else None);p=Path(sys.argv[2]);p.parent.mkdir(parents=True,exist_ok=True)
    p.write_text(json.dumps(data,indent=2)+"\n",encoding="utf8")
    print(data["stats"])
