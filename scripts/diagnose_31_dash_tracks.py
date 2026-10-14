#!/usr/bin/env python3
"""Print source PDF repeated-dash border tracks on inset pages."""
from collections import defaultdict
import json
import fitz

d=fitz.open("Iran2621.pdf")
for pn in (365,369,379,386,387,388,389,444,446,448,454,455,456,457,501):
  p=d[pn-1];g=defaultdict(list)
  for shape in p.get_drawings():
    r=fitz.Rect(shape["rect"])
    if shape["type"] not in ("fs","s"):continue
    if 2<r.width<5.2 and 0<r.height<.8:
      g[("h",round((r.y0+r.y1)/2,1))].append((r.x0,r.x1))
    elif 2<r.height<5.2 and 0<r.width<.8:
      g[("v",round((r.x0+r.x1)/2,1))].append((r.y0,r.y1))
  tracks=[]
  for (kind,axis),rows in g.items():
    rows.sort(); group=[]
    for row in rows:
      if group and row[0]-group[-1][1]>12:
        if len(group)>=3 and group[-1][1]-group[0][0]>18: tracks.append([kind,axis,round(group[0][0],1),round(group[-1][1],1),len(group)])
        group=[]
      group.append(row)
    if len(group)>=3 and group[-1][1]-group[0][0]>18: tracks.append([kind,axis,round(group[0][0],1),round(group[-1][1],1),len(group)])
  print("TRACKS",pn,json.dumps(tracks),flush=True)
