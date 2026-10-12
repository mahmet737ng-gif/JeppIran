#!/usr/bin/env python3
"""Native ADC gray-pavement geometry fallback for taxiway names missing a
reviewed black centerline. Gray fill is not a safe centerline; all proposals
are unapproved and do NOT enter a route graph.
Run: python web/tools/adc_pavement_fallback.py --pdf 2621.pdf
     --survey OIII.json --out build/adc/OIII/pavement_fallback.json
"""
import argparse,hashlib,json,math
from pathlib import Path
import fitz

def distance(rect,p):
 x,y=p
 return math.hypot(max(rect.x0-x,0,x-rect.x1),
                   max(rect.y0-y,0,y-rect.y1))

def scan(pdf,survey,names=None):
 p=Path(pdf);d=json.loads(Path(survey).read_text())
 h=hashlib.sha256(p.read_bytes()).hexdigest()
 if h!=d["source"]["sha256"]:raise ValueError("Source PDF hash mismatch")
 doc=fitz.open(p);result=[];cache={}
 for entry in d["taxiways"]:
  for label in entry["sourceLabelPositions"]:
   page=label["page"]
   if page not in cache:cache[page]=doc[page-1].get_drawings()
 for name in d["taxiways"]:
  if names is not None and name["id"] not in names:continue
  candidates=[]
  for label in name["sourceLabelPositions"]:
   number=label["page"];center=(label["x"],label["y"]);items=[]
   for j,shape in enumerate(cache[number]):
    fill=shape.get("fill")
    if not fill or len(fill)<3 or not all(abs(v-.7019)<.035 for v in fill):continue
    rect=shape["rect"];sep=distance(rect,center)
    if sep>24:continue
    items.append({"page":number,"sourceDrawingId":j,
     "bbox":[round(v,3) for v in [rect.x0,rect.y0,rect.x1,rect.y1]],
     "distanceToLabelPdfPt":round(sep,3),"reviewed":False,
     "sourceShape":"GRAY_FILL_PAVEMENT_OR_APRON_NOT_CENTERLINE"})
   candidates.append({"page":number,"labelCenter":center,
       "pavementSources":sorted(items,key=lambda x:x["distanceToLabelPdfPt"])[:8]})
  result.append({"taxiway":name["id"],"sourceLabels":candidates,
     "centerlineTraced":False,"routeable":False})
 return {"airport":d["airport"],"cycle":d["cycle"],"sourceSha256":h,
   "status":"FALLBACK_CONTOURS_UNVERIFIED","results":result,
   "approvedSegments":[],"approvedContacts":[],
   "note":"Gray pavement fills may contain entire aprons/buildings. Never turn a filled polygon or nearby label into a taxi route without audited centerline tracing."}

def main():
 parser=argparse.ArgumentParser()
 parser.add_argument("--pdf",required=True);parser.add_argument("--survey",required=True)
 parser.add_argument("--out",required=True)
 parser.add_argument("--only",help="Comma-separated missing names, or omit for all")
 a=parser.parse_args()
 names=set(a.only.upper().split(",")) if a.only else None
 out=scan(a.pdf,a.survey,names)
 target=Path(a.out);target.parent.mkdir(parents=True,exist_ok=True)
 target.write_text(json.dumps(out,indent=2)+"\n")
 print(out["airport"],len(out["results"]),"gray contour suggestions; 0 routes approved")

if __name__=="__main__":main()
