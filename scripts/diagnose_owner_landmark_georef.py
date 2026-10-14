#!/usr/bin/env python3
"""Read-only geometrical inspection of 11 owner-specified source maps.

Original V2621 PDF points. Does not alter production georeferences.
"""
import hashlib, json, math
from pathlib import Path
import fitz
PAGES={307:["KOBUB","RASHT"],308:["KOBUB","RASHT"],323:["MODIL","RASHT"],376:["RUDESHUR","KHOMAINI","Mehrabad"],386:["REVUR","KHOMAINI","RUDESHUR","VARAMIN"],388:["REVUR","KHOMAINI","RUDESHUR","VARAMIN"],446:["BANDAR ABBAS","Havadarya","D25.0"],456:["BANDAR ABBAS","Havadarya","TAVNO"],457:["BANDAR ABBAS","Havadarya","TAVNO"],497:["ALGUV","KERMAN"],502:["GETIS","KERMAN"]}
PDF=Path("Iran2621.pdf")
assert hashlib.sha256(PDF.read_bytes()).hexdigest()=="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
doc=fitz.open(PDF)
out=[]
for n,names in PAGES.items():
 page=doc[n-1];drawings=page.get_drawings();entry={"page":n,"rect":list(page.rect),"labels":{},"objects":[]}
 for name in names:
  boxes=page.search_for(name)
  entry["labels"][name]=[[round(v,2) for v in b] for b in boxes[:10]]
  for box in boxes[:4]:
   center=fitz.Point((box.x0+box.x1)/2,(box.y0+box.y1)/2)
   near=[]
   for d in drawings:
    r=fitz.Rect(d["rect"])
    dx=max(r.x0-center.x,center.x-r.x1,0)
    dy=max(r.y0-center.y,center.y-r.y1,0)
    if math.hypot(dx,dy)<34 and .04<r.get_area()<900 and r.width<35 and r.height<35:
     near.append({"rect":[round(v,2) for v in r],"type":d.get("type"),"fill":d.get("fill"),"stroke":d.get("color"),"items":len(d["items"]),"distance":round(math.hypot(dx,dy),2)})
   entry["objects"].append({"label":name,"center":[round(center.x,2),round(center.y,2)],"near":sorted(near,key=lambda x:x["distance"])[:20]})
 # canonical gray VOR beacon halos (center is published AIP navaid site)
 entry["halo"]=[]
 for d in drawings:
  r=fitz.Rect(d["rect"]);f=d.get("fill")
  if f and len(f)>=3 and max(abs(f[i]-.7019) for i in range(3))<.005 and 24<r.width<90 and abs(r.width-r.height)<1:
   entry["halo"].append([round((r.x0+r.x1)/2,3),round((r.y0+r.y1)/2,3)])
 # Red stroked chart geometry: identify curves and their bounding rects; some are BND R25
 entry["redCurves"]=[]
 for d in drawings:
  rgb=d.get("color")
  if rgb and len(rgb)>=3 and rgb[0]>.35 and rgb[0]>rgb[1]*1.5 and rgb[0]>rgb[2]*1.5:
   r=fitz.Rect(d["rect"])
   if r.width>40 and r.height>40:
    entry["redCurves"].append({"box":[round(v,2) for v in r],"items":len(d["items"]),"types":sorted(set(it[0] for it in d["items"])),"stroke":rgb})
 out.append(entry)
 print("OWNER11",json.dumps(entry,ensure_ascii=False),flush=True)
Path("/tmp/jeppiran-owner11-landmark-diagnostic.json").write_text(json.dumps({"charts":out},indent=2))
