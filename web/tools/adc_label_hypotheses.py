#!/usr/bin/env python3
"""Taxiway-name to source-PDF line hypotheses; NEVER auto-approves a name.
Usage: python web/tools/adc_label_hypotheses.py --survey OIII.json
       --candidates OUT_FOLDER --out OUT_FOLDER/name_candidates.json
"""
import argparse,json,math
from pathlib import Path
def point_to_poly(p,poly):
    best=float("inf")
    for a,b in zip(poly,poly[1:]):
        dx=b[0]-a[0];dy=b[1]-a[1]
        den=dx*dx+dy*dy
        t=max(0,min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/den)) if den else 0
        best=min(best,math.hypot(a[0]+t*dx-p[0],a[1]+t*dy-p[1]))
    return best
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--survey',required=True)
    parser.add_argument('--candidates',required=True)
    parser.add_argument('--out',required=True)
    args=parser.parse_args()
    survey=json.loads(Path(args.survey).read_text())
    cache={}
    for page in survey["source"]["pages"]:
        files=list(Path(args.candidates).glob(f"*page_{page}*candidates.json"))
        if not files:continue
        data=json.loads(files[0].read_text())
        if data["sourceSha256"]!=survey["source"]["sha256"] or data["page"]!=page:
            raise SystemExit("PDF source fingerprint mismatch")
        cache[page]=data["traces"]
    output=[]
    for twy in survey["taxiways"]:
        spots=[]
        for pos in twy["sourceLabelPositions"]:
            page=pos["page"]
            label=[pos["x"],pos["y"]]
            guesses=[]
            for line in cache.get(page,[]):
                distance=point_to_poly(label,line["points"])
                if distance>24:continue
                guesses.append({"traceId":line["id"],"distanceToLabelPt":round(distance,2),
                   "sourceDrawingIds":line["sourceDrawingIds"],
                   "candidateStart":line["points"][0],"candidateEnd":line["points"][-1],
                   "reviewed":False})
            spots.append({"page":page,"labelPdfPoint":label,
                "nearestCandidateStrokes":sorted(guesses,key=lambda e:e["distanceToLabelPt"])[:4],
                "status":"LABEL_PROXIMITY_ONLY"})
        output.append({"taxiway":twy["id"],"labelOccurrences":spots,"geometryApproved":False,
            "junctionsApproved":False,"standConnectionsApproved":False})
    result={"schemaVersion":1,"airport":survey["airport"],"cycle":survey["cycle"],
       "sourceSha256":survey["source"]["sha256"],
       "status":"UNREVIEWED_LABEL_TO_VECTOR_PROPOSALS",
       "note":"Printed taxiway label is not a centreline. Text, pavement boundaries, or unrelated nearby strokes may rank highest.",
       "taxiwayCount":len(output),"suggestions":output,"authorizedConnections":[]}
    target=Path(args.out);target.parent.mkdir(parents=True,exist_ok=True)
    target.write_text(json.dumps(result,indent=2)+"\n")
    print(result["airport"],len(output),"taxis with unreviewed candidate geometries")
if __name__=="__main__":main()
