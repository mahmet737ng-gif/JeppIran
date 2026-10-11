#!/usr/bin/env python3
"""Extract individually PRINTED stand labels from cycle-2621 LTFM 30-9B/30-9C.
Their calibrated WGS84 locations are LABEL ANCHORS, not stand nosewheel
points, surveyed pushback trajectories, or automatically routable links.
Run: python scripts/extract_ltfm_stand_anchors.py LTFM.pdf output.json
"""
import fitz, json, re, sys
from collections import Counter
from pathlib import Path

RE_STAND = re.compile(r"^(?:[A-G]\d{1,2}[LR]?|H\d{1,2}[LR]?|K\d{1,2}[LR]?|[1-7]\d{2}[LR]?)$")
def allowed(s,x,y,p):
    if not RE_STAND.fullmatch(s):return False
    if p==1247:
        if s[0]=="A":return 180<x<260 and 392<y<545
        if s[0]=="B":return 182<x<265 and 245<y<405
        if s[0]=="C":return 263<x<310 and 349<y<400
        if s[0]=="D":return 309<x<369 and 230<y<395
        if s[0]=="E":return 365<x<415 and 349<y<390
        if s[0]=="F":return 400<x<505 and 244<y<401
        if s[0]=="G":return 425<x<510 and 394<y<528
        if s[0]=="H":return 175<x<500 and 129<y<157
        if s[0].isdigit():return (s[0] in "23" and
            ((150<x<252 and 559<y<746) or (455<x<548 and 551<y<709)))
    if p==1248:
        if s[0]=="K":return x<300 and 350<y<711
        if s[0]=="H":return (x<305 and 60<y<755) or (310<x<580 and 60<y<215)
        if s[0].isdigit():return s[0] in "4567" and 345<x<560 and 100<y<225
    return False

def grid(words,coord,region):
    xy=[]
    for w in words:
        if not region(w):continue
        s=w[4]
        if coord=="lon" and re.fullmatch(r"28-\d{2}\.\d",s):
            xy.append(((w[0]+w[2])/2,28+float(s[3:])/60))
        elif coord=="lat" and re.fullmatch(r"41-\d{2}\.\d",s):
            xy.append(((w[1]+w[3])/2,41+float(s[3:])/60))
    if len(xy)<3:raise ValueError("Missing georeferenced graticule ticks")
    for _ in range(3):
        mx=sum(x for x,y in xy)/len(xy);my=sum(y for x,y in xy)/len(xy)
        slope=sum((x-mx)*(y-my) for x,y in xy)/sum((x-mx)**2 for x,y in xy)
        intercept=my-slope*mx
        residuals=[abs(intercept+slope*x-y)*111195 for x,y in xy]
        if max(residuals)<8:break
        clipped=[pair for pair,e in zip(xy,residuals) if e<max(8,sorted(residuals)[len(residuals)//2]*2.5)]
        if len(clipped)<4 or len(clipped)==len(xy):break
        xy=clipped
    maxerr=max(abs(intercept+slope*x-y)*111195 for x,y in xy)
    if maxerr>15:raise ValueError("Unreliable chart graticule fit: "+str(maxerr))
    return slope,intercept,round(maxerr,2)

def build(pdf_path):
    pdf=fitz.open(pdf_path)
    if len(pdf)<1248:raise ValueError("Cannot locate cycle 2621 airport diagrams")
    texts=[pdf[1246].get_text("words"),pdf[1247].get_text("words")]
    a,b=texts
    # All regions below are bounded by named chart panels; two disjoint
    # 30-9C panels MUST NOT share the same coordinate transformation.
    cal={
      "30-9B_lon":grid(a,"lon",lambda w:w[1]<46 or w[1]>750),
      "30-9B_lat":grid(a,"lat",lambda w:w[0]<37 or w[0]>558),
      "30-9C_W_lon":grid(b,"lon",lambda w:(w[1]<48 or w[1]>750) and w[0]<310),
      "30-9C_W_lat":grid(b,"lat",lambda w:(w[0]<35 or 285<w[0]<310) and w[1]>400),
      "30-9C_E_lon":grid(b,"lon",lambda w:(w[1]<47 or 222<w[1]<243) and w[0]>310),
      "30-9C_E_lat":grid(b,"lat",lambda w:310<w[0]<335 and w[1]<241)}
    stands={}
    for page_no,words in zip((1247,1248),texts):
        for w in words:
            s=w[4].strip().upper();x=(w[0]+w[2])/2;y=(w[1]+w[3])/2
            if not allowed(s,x,y,page_no):continue
            panel="30-9B" if page_no==1247 else ("30-9C_W" if x<310 else "30-9C_E")
            ml,bl,_=cal[panel+"_lon"];ma,ba,_=cal[panel+"_lat"]
            pos={"lat":round(ma*y+ba,8),"lon":round(ml*x+bl,8)}
            entry={"id":s,**pos,"source":"Jeppesen cycle 2621 printed stand label",
              "chartPage":page_no,"chart":panel,
              "pdfPoint":[round(x,2),round(y,2)],
              "positionType":"APPROXIMATE_PRINTED_LABEL_NOT_STAND_CENTER",
              "positionSurveyed":False,"connectorVerified":False}
            if s in stands: # Never silently overwrite conflicting chart evidence.
                old=stands[s]
                if old["chart"]!=panel:raise ValueError("Duplicated stand "+s)
                continue
            stands[s]=entry
    if len(stands)<250 or "D3" not in stands or "601" not in stands or "K57" not in stands:
        raise RuntimeError("Expected chart stand labels missing: "+str(len(stands)))
    return {"airport":"LTFM","cycle":"2621","kind":"individual-chart-stand-label-anchors",
        "routeApproved":False,"simulationOnly":True,
        "warning":"Individual printed label anchors, not surveyed stand positions/lead-out geometry. Never auto-enable taxi routing from proximity.",
        "graticuleFitsMeters":{k:v[2] for k,v in cal.items()},
        "stats":{"chartLabels":len(stands),"perPrefix":dict(Counter(s[0] for s in stands))},
        "stands":list(stands.values())}

if __name__=="__main__":
    if len(sys.argv)!=3:raise SystemExit("Usage: extract_ltfm_stand_anchors.py LTFM.pdf output.json")
    result=build(sys.argv[1]);dst=Path(sys.argv[2]);dst.parent.mkdir(parents=True,exist_ok=True)
    dst.write_text(json.dumps(result,indent=2)+"\n",encoding="utf8")
    print("EXTRACTED",result["stats"])
