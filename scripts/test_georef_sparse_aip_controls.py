#!/usr/bin/env python3
"""Sparse source-grid+navaid fit diagnostics: no chart status mutation."""
import math,re,json,fitz,numpy as np
from pathlib import Path
from sys import path
path.insert(0,"scripts")
from extract_chart_georef import segments,decimal_grid
from flexible_graticule import _candidate,_tick_kind
NAVAID={
  "OIGG":("RST VOR-DME",37+19.58/60,49+36.95/60,"oibk.ir AIP ENR 3.1 2026"),
  "OIIE":("IKA VOR-DME",35+24/60+34.8/3600,51+10/60+42.5/3600,"Iran AIP ENR 4.1-3 2024"),
  "OIKB":("BND VOR-DME",27+11/60+49.4/3600,56+22/60+0.3/3600,"Iran AIP ENR 4.1-2 2024"),
  "OIKK":("KER VOR-DME",30+16/60+58.1/3600,56+56/60+32.3/3600,"Iran AIP ENR 4.1-5 2023")
}
targets={"OIGG":[307,308,323],"OIIE":[376,386,388],"OIKB":[446,456],"OIKK":[497,498,499,500,501,502]}
source=fitz.open("Iran2621.pdf")
for ap,nums in targets.items():
 label,navlat,navlon,src=NAVAID[ap]
 for pn in nums:
  pg=source[pn-1]
  halo=[]
  for d in pg.get_drawings():
   r=fitz.Rect(d["rect"]);fill=d.get("fill")
   if fill and len(fill)>=3 and max(abs(fill[i]-.7019) for i in range(3))<.005 and 25<r.width<80 and abs(r.width-r.height)<1:
    halo.append(((r.x0+r.x1)/2,(r.y0+r.y1)/2))
  if len(halo)!=1:
   print("SPARSE",pn,json.dumps({"reason":"No unique source beacon halo","halos":halo}),flush=True);continue
  center=np.array(halo[0])
  lines=[l for l in segments(pg) if _tick_kind(l)]
  axes={"latitude":[],"longitude":[]}
  for w in pg.get_text("words"):
   if not re.fullmatch(r"\d{2,3}-\d{2}(?:\.\d+)?",w[4]):continue
   val=decimal_grid(w[4]);ax="latitude" if abs(val-navlat)<abs(val-navlon) else "longitude"
   vertical_text=(w[3]-w[1])>(w[2]-w[0])
   expected_horizontal=(ax=="latitude" and not vertical_text) or (ax=="longitude" and vertical_text)
   options=[]
   for line in lines:
    kind=_tick_kind(line)
    if (kind=="horizontal")!=expected_horizontal:continue
    score,primary,gap,pix,pixax=_candidate(w,line,kind)
    if primary>6 or gap>100:continue
    options.append((score,primary,gap,pix,pixax,line))
   if not options:continue
   score,primary,gap,pix,pixax,seg=min(options,key=lambda z:z[0])
   if score>23:continue
   axes[ax].append({"label":w[4],"value":val,"pdf":pix,"pax":pixax,"cost":round(score,1),"gap":round(gap,1)})
  axes={key:list({round(v["value"],6):v for v in sorted(vals,key=lambda v:v["cost"],reverse=True)}.values()) for key,vals in axes.items()}
  latx=(axes["latitude"] or [{"pax":"x"}])[0]["pax"]
  lonx=(axes["longitude"] or [{"pax":"y"}])[0]["pax"]
  if latx==lonx:
   print("SPARSE",pn,json.dumps({"reason":"Axes collide","axes":axes,"halo":halo}),flush=True);continue
  rotated=latx=="x"
  def positive(geo,key):
    if key=="latitude":return (center[0] if latx=="x" else center[1])-geo["pdf"]
    return (center[0] if lonx=="x" else center[1])-geo["pdf"]
  axis_data=[]
  for key,vals in axes.items():
   for e in vals:
    factor=(math.cos(math.radians(navlat)) if key=="longitude" else 1.)
    deg=(navlat if key=="latitude" else navlon)-e["value"]
    axis_data.append((key,e["label"],float(deg*factor),float(positive(e,key))))
  if len(axes["latitude"])==0 and len(axes["longitude"])<2 or len(axes["longitude"])==0 and len(axes["latitude"])<2:
    print("SPARSE",pn,json.dumps({"reason":"Less than two independent source ticks","axes":axes,"halo":halo}),flush=True);continue
  results=[]
  for sl in (-1,1):
   for so in (-1,1):
    if (sl==so)!=rotated:continue
    a=np.array([v[2]*(sl if v[0]=="latitude" else so) for v in axis_data])
    b=np.array([v[3] for v in axis_data])
    if np.linalg.norm(a)<.001:continue
    s=float((a@b)/(a@a))
    if not 100<s<30000:continue
    residuals=(b-s*a)
    rm=float(np.sqrt(np.mean(residuals**2)))
    maxres=float(np.max(abs(residuals)))
    m_per_point=111200/s
    results.append({"northPxPerDeg":round(s,2),"latSign":sl,"lonSign":so,"residualPdf":round(rm,2),"maxPdf":round(maxres,2),"worstApproxMetres":round(maxres*m_per_point),"grid":axis_data})
  results.sort(key=lambda x:x["residualPdf"])
  print("SPARSE",pn,json.dumps({"nav":label,"AIPsrc":src,"halo":halo,"axes":axes,"fits":results[:2]}),flush=True)
