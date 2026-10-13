#!/usr/bin/env python3
"""OIIE 2621 original Jeppesen 20-9C Cargo and Salam SOURCE taxi-corridor QA.

Cargo: stand stop -> original drawn curved stub -> original drawing 39
spine -> curved destination stub -> destination stand stop.
Salam: stand stop -> its original drawn source curve network, excluding
stand-stub shorts and the FRONT-OF-STANDS shortcut drawing 404 -> original
drawing 337 spine -> counterpart corridor & stand stop.
Other airport/simulator navigation and runway/apron portal acceptance is out
of scope. These are source-drawn provisional SIMULATOR-QA routes only; never
real flight taxi directions or automatic runway-crossing permits.
"""
import argparse,hashlib,json,math,re
from pathlib import Path
import fitz,networkx as nx
from shapely.geometry import Point,LineString
from shapely.ops import unary_union,snap,substring

def page(doc,plate):
 indices=[i for i in range(len(doc)) if "OIIE/IKA" in doc[i].get_text() and plate in doc[i].get_text()]
 if len(indices)!=1:raise ValueError("Original chart page must be unique: "+plate)
 return doc[indices[0]]
def distance(a,b):return math.dist(a,b)
def match_stands(pdf,strokes,region):
 labels=page(pdf,"20-9C").get_text("words")
 result={}
 for w in labels:
  raw=w[4].upper()
  if not re.fullmatch(r"3\d\d" if region=="CARGO" else r"20\d[LR]?",raw):continue
  center=[(w[0]+w[2])/2,(w[1]+w[3])/2]
  if region=="CARGO":
   options=[(distance(center,p["points"][-1]),p) for p in strokes
     if 22<p["lengthPt"]<52 and len(p["points"])<=3 and distance(center,p["points"][-1])<9]
  else:
   options=[(distance(center,p["points"][-1]),p) for p in strokes
     if 20<p["lengthPt"]<60 and distance(center,p["points"][-1])<14]
  if not options:raise ValueError(region+" stand STOP not in source: "+raw)
  best=min(options,key=lambda x:x[0])
  result["ST"+raw]=best[1]
 return result
def source_cargo(strokes,doc):
 index={s["id"]:s for s in strokes}
 trunk=index["P383_D39_S0"]
 axis=LineString(trunk["points"])
 stops=match_stands(doc,strokes,"CARGO")
 if len(stops)!=21:raise ValueError("Expected 21 Cargo original source stops, got "+str(len(stops)))
 start={}
 for stand,stop in stops.items():
  join=stop["points"][0];candidates=[]
  for arc in strokes:
   if arc["id"] in (stop["id"],trunk["id"],"P383_D184_S0") or not 4<arc["lengthPt"]<35:continue
   a,b=arc["points"][0],arc["points"][-1]
   if distance(join,a)<.8 and axis.distance(Point(b))<.9:candidates.append((arc["lengthPt"],arc,"FORWARD",b))
   if distance(join,b)<.8 and axis.distance(Point(a))<.9:candidates.append((arc["lengthPt"],arc,"REVERSE",a))
  if not candidates:raise ValueError("No published Cargo curved stub "+stand)
  arc=next((t for t in candidates if t[2]=="FORWARD"),candidates[0])[1]
  direction=next(t[2] for t in candidates if t[1] is arc)
  portal=arc["points"][-1 if direction=="FORWARD" else 0]
  start[stand]={"stopSource":stop["id"],"curveSource":arc["id"],
    "curveDirection":direction,"station":axis.project(Point(portal)),
    "stopDrawingId":stop["drawingId"],"arcDrawingId":arc["drawingId"]}
 def route(a,b):
  v,w=start[a],start[b]
  sa,sb=v["station"],w["station"]
  mid=[list(p) for p in substring(axis,min(sa,sb),max(sa,sb)).coords]
  if sa>sb:mid.reverse()
  aa=stops[a]["points"];bb=stops[b]["points"]
  c=index[v["curveSource"]]["points"];d=index[w["curveSource"]]["points"]
  if v["curveDirection"]=="REVERSE":c=c[::-1]
  if w["curveDirection"]=="REVERSE":d=d[::-1]
  errors=[distance(aa[0],c[0]),distance(c[-1],mid[0]),
    distance(mid[-1],d[-1]),distance(d[0],bb[0])]
  if max(errors)>.9:raise ValueError("Unconnected true curve "+a+" to "+b+" "+str(errors))
  return {"from":a,"to":b,"page":383,"region":"CARGO",
    "sourceDrawings":[v["stopDrawingId"],v["arcDrawingId"],trunk["drawingId"],
      w["arcDrawingId"],w["stopDrawingId"]],
    "maximumSourceSeamPt":round(max(errors),3),
    "pointsPdf":aa[::-1]+c+mid+d[::-1]+bb}
 routes=[route(a,b) for a in stops for b in stops if a!=b]
 if len(routes)!=420:raise ValueError("Cargo directed inventory incomplete")
 return {"region":"CARGO","sourcePage":383,"standIds":list(stops),"spineSource":"P383_D39_S0",
  "routes":routes,"sourceGeometryContinuous":True,"simulatorOnly":True}
def source_salam(strokes,doc):
 index={s["id"]:s for s in strokes}
 spine=index["P383_D337_S0"];axis=LineString(spine["points"])
 stops=match_stands(doc,strokes,"SALAM")
 if len(stops)!=20:raise ValueError("Expected 20 Salam original source stops")
 excluded={p["id"] for p in stops.values()}|{"P383_D404_S0"}
 lines=[LineString(s["points"]) for s in strokes if s["id"] not in excluded and s["lengthPt"]>9]
 merged=unary_union(lines)
 geometries=unary_union([snap(line,merged,.45) for line in lines])
 graph=nx.Graph()
 for path in geometries.geoms:
  if path.geom_type!="LineString":continue
  for a,b in zip(path.coords,path.coords[1:]):
   x=tuple(round(z,2) for z in a);y=tuple(round(z,2) for z in b)
   if x!=y:graph.add_edge(x,y,weight=distance(x,y))
 roots=[n for n in graph if axis.distance(Point(n))<.25]
 if len(roots)<8:raise ValueError("Original Salam taxi spine not traced")
 mapped=nx.multi_source_dijkstra_path(graph,roots,weight="weight")
 exits={}
 for stand,stop in stops.items():
  point=stop["points"][0]
  node=min(graph,key=lambda p:distance(p,point))
  if distance(point,node)>.4 or node not in mapped:
   raise ValueError("Missing physical curved source connector for "+stand)
  path=list(reversed(mapped[node]))
  exits[stand]={"path":[list(p) for p in path],
    "station":axis.project(Point(path[-1]))}
 def route(a,b):
  A,B=exits[a],exits[b];x,y=A["station"],B["station"]
  center=[list(q) for q in substring(axis,min(x,y),max(x,y)).coords]
  if x>y:center.reverse()
  stopA=stops[a]["points"];stopB=stops[b]["points"]
  errors=[distance(stopA[0],A["path"][0]),distance(A["path"][-1],center[0]),
    distance(center[-1],B["path"][-1]),distance(B["path"][0],stopB[0])]
  if max(errors)>.6:raise ValueError("Broken Salam source connector "+a+"→"+b)
  return {"from":a,"to":b,"page":383,"region":"SALAM",
    "sourceDrawings":[stops[a]["drawingId"],spine["drawingId"],stops[b]["drawingId"]],
    "maximumSourceSeamPt":round(max(errors),3),
    "pointsPdf":stopA[::-1]+A["path"]+center+B["path"][::-1]+stopB}
 routes=[route(a,b) for a in stops for b in stops if a!=b]
 if len(routes)!=380:raise ValueError("Salam directed source corridor count changed")
 return {"region":"SALAM","sourcePage":383,"standIds":list(stops),"spineSource":"P383_D337_S0",
  "routes":routes,"sourceGeometryContinuous":True,"simulatorOnly":True}
def build(pdf,vector):
 raw=Path(pdf).read_bytes()
 src=json.loads(Path(vector).read_text(encoding="utf8"))
 if src["airport"]!="OIIE" or str(src["cycle"])!="2621" or hashlib.sha256(raw).hexdigest()!=src["inputPdfSha256"]:
  raise ValueError("Source original PDF fingerprint/cycle mismatch")
 original=fitz.open(stream=raw,filetype="pdf")
 strokes=src["pages"]["383"]["strokes"]
 cargo=source_cargo([x for x in strokes if x["region"]=="CARGO"],original)
 salam=source_salam([x for x in strokes if x["region"]=="SALAM"],original)
 return {"airport":"OIIE","cycle":"2621","originalAirportPdfSha256":src["inputPdfSha256"],
 "kind":"SOURCE_DRAWN_APRON_ROUTE_PREVIEW_NOT_APPROVED_TAXI_NETWORK",
 "sourceCorridors":{"CARGO":cargo,"SALAM":salam},
 "standCount":41,"directedOriginalCurvedCorridorCases":800,
 "testedSourceContinuity":True,
 "crossApronRoutesTested":0,"approvedADCPagePortals":0,
 "approvedRunwayHoldShorts":0,"readyForFullAirportRouting":False,
 "simulatorOnly":True,"approvedForRealWorldNavigation":False}
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument("--pdf",required=True);ap.add_argument("--vectors",required=True);ap.add_argument("--out",required=True)
 args=ap.parse_args()
 result=build(args.pdf,args.vectors)
 target=Path(args.out);target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(json.dumps(result,separators=(",",":"))+"\n")
 print("PASS: 21 Cargo stands + 20 Salam stands, 800 drawn-stub→spine→stub source route directions.")
 print("NO unauthorized runway crossing, no estimated ADC portals, no full-airport claim.")
if __name__=="__main__":main()
