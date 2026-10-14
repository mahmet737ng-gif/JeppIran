#!/usr/bin/env python3
import json,math
from pathlib import Path
import fitz
doc=fitz.open("Iran2621.pdf")
pages=[342,365,369,379,386,387,388,389,444,446,448,454,455,456,457,459,501]
for pn in pages:
  p=doc[pn-1]; marks=p.search_for("NOT TO SCALE")
  print("MAP",pn,"size",p.rect,"labels",[list(map(lambda x:round(x,1),q)) for q in marks],flush=True)
  found=[]
  for shape in p.get_drawings():
    box=fitz.Rect(shape["rect"])
    if box.is_empty or box.get_area()>.20*p.rect.get_area() or box.get_area()<1:continue
    dash=str(shape.get("dashes",""))
    for mark in marks:
      if box.contains(mark.tl) or mark.intersects(box) or (abs(box.x0-mark.x0)<65 and abs(box.y0-mark.y0)<65):
        found.append({"rect":[round(q,1) for q in box],"dash":dash,"type":shape["type"],"items":len(shape["items"]),"color":shape.get("color")})
        break
  print("SHAPES",pn,json.dumps(found[:55]),flush=True)
