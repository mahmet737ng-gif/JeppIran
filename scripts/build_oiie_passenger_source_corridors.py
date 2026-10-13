#!/usr/bin/env python3
"""OIIE V2621 Passenger source-ink corridors (simulator inspection, NOT taxi clearance).
Extracts 59 connected original stand markings. ST403/ST405/ST407 NOT inferred.
"""
import argparse,hashlib,json,math,re
from pathlib import Path
import fitz,networkx as nx
from shapely.geometry import LineString,Point
from shapely.ops import snap,unary_union,substring

def build(pdf_file,vector_file):
    raw=Path(pdf_file).read_bytes()
    data=json.loads(Path(vector_file).read_text(encoding="utf8"))
    sha=hashlib.sha256(raw).hexdigest()
    if data.get("airport")!="OIIE" or str(data.get("cycle"))!="2621" or \
       (data.get("inputPdfSha256") or data.get("sourceOriginalPdfSha256"))!=sha:
        raise ValueError("OIIE cycle/source fingerprint mismatch")
    paths=data["pages"]["382"].get("strokes",data["pages"]["382"].get("paths",[]))
    P=[p for p in paths if p["region"]=="PASSENGER" and 9<p["lengthPt"]<550]
    idx={p["id"]:p for p in P}
    trunks=[idx["P382_D%d_S0"%j] for j in range(85,92)]
    spine=LineString([trunks[0]["points"][0]]+[p["points"][-1] for p in trunks])
    doc=fitz.open(stream=raw,filetype="pdf")
    pp=[i for i in range(len(doc)) if "OIIE/IKA" in doc[i].get_text() and
        "20-9B" in doc[i].get_text()]
    if len(pp)!=1:raise ValueError("Unique 20-9B plate not found")
    words=doc[pp[0]].get_text("words")
    stands={}
    for w in words:
        if not re.fullmatch(r"(?:1\d\d|4\d\d)[LR]?",w[4]):continue
        name="ST"+w[4]
        center=[(w[0]+w[2])/2,(w[1]+w[3])/2]
        opts=[(math.dist(center,p["points"][side]),p,side) for p in P
          if 12<p["lengthPt"]<75 for side in (0,-1)
          if math.dist(center,p["points"][side])<22]
        if not opts:continue
        best=min(opts,key=lambda x:x[0])
        if name not in stands or stands[name]["distance"]>best[0]:
            stands[name]={"source":best[1],"side":best[2],"distance":best[0]}
    if len(stands)!=62:raise ValueError("Original 62 Passenger stand labels not mapped")
    # Label pointer is NOT a parking lead at stand 164L.
    p=idx["P382_D251_S0"]
    word=next(w for w in words if w[4]=="164L")
    q=[(word[0]+word[2])/2,(word[1]+word[3])/2]
    side=min((0,-1),key=lambda z:math.dist(q,p["points"][z]))
    stands["ST164L"].update(source=p,side=side,distance=math.dist(q,p["points"][side]))
    banned={x["source"]["id"] for x in stands.values()}
    remaining=[x for x in P if x["id"] not in banned]
    lines=[LineString(x["points"]) for x in remaining]
    whole=unary_union(lines)
    split=unary_union([snap(l,whole,.65) for l in lines])
    G=nx.Graph()
    for path in split.geoms:
        if path.geom_type!="LineString":continue
        for a,b in zip(path.coords,path.coords[1:]):
            u=tuple(round(float(v),2) for v in a)
            v=tuple(round(float(v),2) for v in b)
            if u!=v:G.add_edge(u,v,weight=math.dist(u,v))
    roots=[v for v in G if spine.distance(Point(v))<.25]
    paths=nx.multi_source_dijkstra_path(G,roots,weight="weight")
    reached={}
    for stand,entry in stands.items():
        root=entry["source"]["points"][-1 if entry["side"]==0 else 0]
        closest=min(G,key=lambda v:math.dist(root,v))
        delta=math.dist(closest,root)
        if delta>.91 or closest not in paths:continue
        source_path=list(reversed(paths[closest]))
        if spine.distance(Point(source_path[-1]))>.3:continue
        entry["path"]=[list(p) for p in source_path]
        entry["station"]=spine.project(Point(source_path[-1]))
        entry["rootSeam"]=delta
        reached[stand]=entry
    unresolved=sorted(set(stands)-set(reached))
    if len(reached)!=59 or unresolved!=["ST403","ST405","ST407"]:
        raise ValueError("Passenger physical candidate geometry changed: "+repr(unresolved))
    routes=[]
    for a,A in reached.items():
      for b,B in reached.items():
        if a==b:continue
        sa,sb=A["station"],B["station"]
        mid=[list(p) for p in substring(spine,min(sa,sb),max(sa,sb)).coords]
        if sa>sb:mid.reverse()
        pa,pb=A["source"]["points"],B["source"]["points"]
        start=pa[::-1] if A["side"]==-1 else pa
        end=pb if B["side"]==-1 else pb[::-1]
        errs=[math.dist(start[-1],A["path"][0]),math.dist(A["path"][-1],mid[0]),
          math.dist(mid[-1],B["path"][-1]),math.dist(B["path"][0],end[0])]
        if max(errs)>.95:raise ValueError("Gap in Passenger curved source ink: "+a+"->"+b)
        routes.append({"from":a,"to":b,"page":382,"region":"PASSENGER",
          "sourceDrawings":[A["source"]["drawingId"],B["source"]["drawingId"]],
          "maximumSourceSeamPt":round(max(errs),3),
          "pointsPdf":start+A["path"]+mid+B["path"][::-1]+end})
    if len(routes)!=3422:raise ValueError("Passenger bidirectional candidate inventory incomplete")
    return {"airport":"OIIE","cycle":"2621","originalAirportPdfSha256":sha,
      "kind":"ORIGINAL_PDF_PRINTED_PASSENGER_INK_CORRIDOR_SIM_QA_ONLY",
      "region":"PASSENGER","page":382,
      "standIds":sorted(reached),"unmatchedStandIds":unresolved,
      "sourceMatchedStandCount":62,"sourceCorridorConnectedStandCount":59,
      "directedOriginalCurvedCorridorCases":3422,"routes":routes,
      "sourceGeometryContinuous":True,"simulatorOnly":True,
      "approvedPhysicalTaxiRoutes":0,"approvedPagePortals":0,
      "approvedRunwayHoldShorts":0,"readyForFullAirportRouting":False}
if __name__=="__main__":
    ap=argparse.ArgumentParser()
    ap.add_argument("--pdf",required=True)
    ap.add_argument("--vectors",required=True)
    ap.add_argument("--out",required=True)
    a=ap.parse_args()
    data=build(a.pdf,a.vectors)
    out=Path(a.out);out.parent.mkdir(parents=True,exist_ok=True)
    out.write_text(json.dumps(data,separators=(",",":"))+"\n",encoding="utf8")
    print("PASS 3422 original Passenger source-ink curve pairs; ST403/405/407 fail closed.")
