#!/usr/bin/env python3
"""Cross-page endpoint seam candidates; source vectors are NOT runway/taxi portals.

OIIE V2621 pages 380/382/383, with independent Cargo and Salam transforms.
Only original PDF endpoints are considered; candidate proximity to an ADC line
never establishes a physical taxiway junction or legal route.
"""
import argparse,json,math
from pathlib import Path

GRID={
 "ADC":{"page":380,"x":(-187.8,5001.01899),"y":(-154.09422,1825.24616)},
 "PASSENGER":{"page":382,"x":(-736.8335169786757,18499.99829702515),"y":(-598.7819714312784,5835.01130469973)},
 "CARGO":{"page":383,"x":(-600.1285689217696,14884.185996736778),"y":(-490.3714310782303,5618.528107743044)},
 "SALAM":{"page":383,"x":(-798.000030517593,21094.41970316607),"y":(-762.1199645996053,6317.870123290982)}
}
def coords(area,pt):
    d=GRID[area];return [(pt[0]-d["x"][1])/d["x"][0],(pt[1]-d["y"][1])/d["y"][0]]
def project(area,geo):
    d=GRID[area];return [d["x"][0]*geo[0]+d["x"][1],d["y"][0]*geo[1]+d["y"][1]]
def scan(src,cutoff=4):
    if src["airport"]!="OIIE" or str(src["cycle"])!="2621":
        raise RuntimeError("source/cycle mismatch")
    adc=[]
    for dr in src["pages"]["380"]["strokes"]:
        if dr["region"]!="ADC":continue
        for side,p in enumerate((dr["points"][0],dr["points"][-1])):
            adc.append((dr["id"],side,p))
    candidates=[]
    for page in ("382","383"):
        for dr in src["pages"][page]["strokes"]:
            area=dr["region"]
            if area not in ("PASSENGER","CARGO","SALAM"):continue
            for side,p in enumerate((dr["points"][0],dr["points"][-1])):
                g=coords(area,p)
                target=project("ADC",g)
                if not(84<target[0]<525 and 83<target[1]<782):
                    continue
                dist,near=min(((math.dist(target,q),ref,which,q)
                    for ref,which,q in adc),key=lambda x:x[0])
                if dist>cutoff:continue
                candidates.append({"fromPage":int(page),"fromRegion":area,
                    "fromSourceStroke":dr["id"],"fromSide":side,
                    "adcSourceStroke":near,"adcSide":which,
                    "adcTargetXY":[round(x,2) for x in target],
                    "adcSourceXY":q,"endpointDistancePdfPt":round(dist,3),
                    "physicalContactReviewed":False,"legalTaxiPortal":False,
                    "reviewStatus":"ENDPOINT_PROXIMITY_ONLY"})
    candidates.sort(key=lambda x:(x["fromRegion"],x["endpointDistancePdfPt"]))
    result={"schemaVersion":1,"airport":"OIIE","cycle":"2621",
        "coordinateSystem":"PDF_POINTS_ADC_TARGET",
        "sourcePdfSha256":src["inputPdfSha256"],
        "regions":["ADC","PASSENGER","CARGO","SALAM"],
        "matchingThresholdPdfPt":cutoff,
        "candidateCount":len(candidates),
        "candidates":candidates,
        "approvedPhysicalPortals":0,
        "allowAutomaticTaxiRouting":False,
        "note":"A projected endpoint may be a stand leader or printing decoration. Candidates require named centerlines, actual touching geometry, turning restrictions and independent review."}
    return result
if __name__=="__main__":
    p=argparse.ArgumentParser()
    p.add_argument("--source",required=True)
    p.add_argument("--output",required=True)
    a=p.parse_args()
    doc=json.loads(Path(a.source).read_text(encoding="utf-8"))
    out=scan(doc);target=Path(a.output);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(out,separators=(",",":"))+"\n",encoding="utf-8")
    totals={r:sum(x["fromRegion"]==r for x in out["candidates"]) for r in ("PASSENGER","CARGO","SALAM")}
    print("OIIE independent regional endpoint pairs:",totals)
    print("Physical taxi portals approved:",out["approvedPhysicalPortals"])
