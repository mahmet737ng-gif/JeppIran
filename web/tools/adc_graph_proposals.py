#!/usr/bin/env python3
"""Native-PDF ADC contacts + taxi/stand source hypotheses; ALL UNREVIEWED.

Requires shapely and reviewable output from adc_trace_candidates.py.
Run: python web/tools/adc_graph_proposals.py --survey OIII.json
  --candidates build/adc/OIII --out build/adc/OIII
NO marker is a taxi clearance, verified junction, or usable route.
"""
import argparse,json,math
from pathlib import Path
from collections import Counter
from shapely.geometry import Point,LineString
from shapely.ops import nearest_points
from shapely.strtree import STRtree

def distance(a,b):return math.dist(a,b)
def rnd(v):return round(float(v),3)

def candidate_graph(doc,tol=.9):
    page=int(doc["page"]);items=[]
    for src in doc["traces"]:
        pts=src["points"]
        if len(pts)<2:continue
        line=LineString(pts)
        if line.is_empty or line.length<.25:continue
        items.append(dict(src=src,line=line,
            start=Point(pts[0]),end=Point(pts[-1]),
            closed=distance(pts[0],pts[-1])<.7))
    tree=STRtree([x["line"] for x in items]);nodes=[];cells={}
    for i,a in enumerate(items):
        for index in tree.query(a["line"].buffer(tol)):
            j=int(index)
            if j<=i:continue
            b=items[j]
            if a["closed"] or b["closed"] or a["line"].length>240 or b["line"].length>240:continue
            d=a["line"].distance(b["line"])
            if d>tol:continue
            p,q=nearest_points(a["line"],b["line"])
            pos=((p.x+q.x)*.5,(p.y+q.y)*.5)
            x=min(a["start"].distance(p),a["end"].distance(p))
            y=min(b["start"].distance(q),b["end"].distance(q))
            if x<=1.25 and y<=1.25:kind="ENDPOINT_ENDPOINT"
            elif x<=1.25 or y<=1.25:kind="ENDPOINT_ON_SEGMENT"
            elif d<=.15:kind="INTERIOR_CROSSING_UNVERIFIED"
            else:kind="NEAR_MISS_UNVERIFIED"
            cell=(round(pos[0]/.4),round(pos[1]/.4))
            ids=[a["src"]["id"],b["src"]["id"]]
            drawings=[a["src"]["sourceDrawingIds"][0],b["src"]["sourceDrawingIds"][0]]
            if cell in cells:
                old=nodes[cells[cell]]
                old["touches"]=sorted(set(old["touches"]+ids))
                old["sourceDrawingIds"]=sorted(set(old["sourceDrawingIds"]+drawings))
                old["minGapPt"]=min(old["minGapPt"],rnd(d))
                old["kind"]="MULTI_LINE_CONTACT_UNREVIEWED"
            else:
                cells[cell]=len(nodes)
                nodes.append(dict(id="",page=page,point=[rnd(n) for n in pos],
                    kind=kind,touches=ids,sourceDrawingIds=drawings,
                    minGapPt=rnd(d),reviewed=False,
                    isTaxiwayJunction=None))
    for i,n in enumerate(nodes,1):n["id"]=f"P{page}_CONTACT_{i:04d}"
    counts=Counter(n["kind"] for n in nodes)
    return dict(schemaVersion=1,airport=doc["airport"],cycle=doc["cycle"],
        page=page,sourceSha256=doc["sourceSha256"],
        coordinateSystem="PDF_POINTS_TOP_LEFT",reviewedContacts=0,
        status="SOURCE_STROKES_ONLY_UNREVIEWED",
        contacts=nodes,counts=dict(sourceStrokes=len(doc["traces"]),
            candidates=len(nodes),byKind=dict(counts)))

def nearby(geom,point,threshold=28):
    out=[]
    for source in geom["traces"]:
        path=LineString(source["points"])
        d=path.distance(Point(point))
        if d<=threshold:
            out.append(dict(traceId=source["id"],sourceDrawingIds=source["sourceDrawingIds"],
                distanceToPrintedLabelPt=rnd(d),verified=False))
    return sorted(out,key=lambda x:x["distanceToPrintedLabelPt"])[:5]

def run(surveyfile,folder,destination):
    survey=json.loads(Path(surveyfile).read_text())
    root=Path(folder);out=Path(destination);out.mkdir(parents=True,exist_ok=True)
    raw={}
    for filename in sorted(root.glob("*_page_*_line_candidates.json")):
        item=json.loads(filename.read_text());page=int(item["page"])
        if (item["airport"]!=survey["airport"] or
            str(item["cycle"])!=str(survey["cycle"]) or
            item["sourceSha256"]!=survey["source"]["sha256"]):
            raise ValueError("PDF source mismatch: "+str(filename))
        raw[page]=item
    if not raw:raise ValueError("No source PDF candidate files")
    page_stats=[]
    for page,src in raw.items():
        proposals=candidate_graph(src)
        (out/f"{survey['airport']}_page_{page}_geometry_contacts.json").write_text(
            json.dumps(proposals,separators=(",",":"))+"\n")
        page_stats.append(dict(page=page,**proposals["counts"]))
    taxiways=[]
    for t in survey["taxiways"]:
        occurrences=[]
        for point in t.get("sourceLabelPositions",[]):
            page=int(point["page"])
            occurrences.append(dict(page=page,sourceLabel=[point["x"],point["y"]],
                geometryCandidates=nearby(raw[page],[point["x"],point["y"]])
                if page in raw else []))
        taxiways.append(dict(id=t["id"],sourceLabels=occurrences,
            startVerified=False,endVerified=False,neighboursVerified=False))
    stands=[]
    for s in survey["stands"]:
        page=int(s["source"]["page"]);at=[s["source"]["x"],s["source"]["y"]]
        stands.append(dict(id="ST"+str(s["id"]),apron=s.get("apron"),
            labelPoint=at,page=page,
            leadCandidates=nearby(raw[page],at,40) if page in raw else [],
            leadVerified=False,connectedTaxiway=None,routeable=False))
    result=dict(airport=survey["airport"],cycle=survey["cycle"],
        sourceSha256=survey["source"]["sha256"],stages="GEOMETRY_JUNCTION_QA",
        pages=page_stats,taxiways=taxiways,stands=stands,
        verifiedStandLinks=0,verifiedRunwayGates=0,routeable=False,
        warning="Source PDF geometry proposals only; physical junctions and stand leads need chart review.")
    (out/f"{survey['airport']}_graph_review_queue.json").write_text(json.dumps(result,indent=2)+"\n")
    print(survey["airport"],[(p["page"],p["candidates"]) for p in page_stats],
        len(taxiways),"taxis",len(stands),"stands; NONE ROUTE APPROVED")

def main():
    parser=argparse.ArgumentParser()
    parser.add_argument("--survey",required=True)
    parser.add_argument("--candidates",required=True)
    parser.add_argument("--out",required=True)
    a=parser.parse_args();run(a.survey,a.candidates,a.out)
if __name__=="__main__":main()
