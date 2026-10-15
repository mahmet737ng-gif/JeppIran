#!/usr/bin/env python3
"""V2621 OIIE pages 376,386,388 source PDF vector/grid/navaid diagnostic (read-only)."""
import fitz, json, math, re, hashlib
from pathlib import Path
from sys import path
path.insert(0,"scripts")
from extract_chart_georef import page_fingerprint,segments,decimal_grid
from flexible_graticule import _candidate,_tick_kind
pdf=Path("Iran2621.pdf")
expected="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==expected
doc=fitz.open(pdf)
out=Path("review-assets/oiie-georef-vector-qa");out.mkdir(parents=True,exist_ok=True)
report={"source":expected,"pages":[]}
names=["RUS","IKA","REVUR","RUSHD","RUDESHUR","PAVET","PAXID","BOXAM","SAV","VR","NASIR","PAROT","EGVEL","KAZ","DHN","ILS","GLIDE","DME","LOC","OIIE","THR","11R","29R"]
for num in [375,376,377,385,386,387,388,389]:
 p=doc[num-1];word=p.get_text("words");v=p.get_drawings()
 entry={"page":num,"fp":page_fingerprint(p),"bounds":list(p.rect),
   "names":{},"gridLabels":{},"grayHalos":[],"smallSymbols":[],"NTS":[]}
 for name in names:
  boxes=p.search_for(name,quads=False)
  if boxes:entry["names"][name]=[[round(z,2) for z in b] for b in boxes[:15]]
 for w in word:
  label=w[4]
  if re.fullmatch(r"\d{2,3}-\d{2}(?:\.\d+)?",label):
   entry["gridLabels"].setdefault(label,[]).append([round(z,2) for z in w[:4]])
 for d in v:
  box=fitz.Rect(d["rect"]);f=d.get("fill")
  if f and len(f)>=3 and max(abs(float(f[i])-.7019) for i in range(3))<.005 and 24<box.width<95 and abs(box.width-box.height)<1:
   entry["grayHalos"].append({"rect":[round(z,2) for z in box],"xy":[round((box.x0+box.x1)/2,3),round((box.y0+box.y1)/2,3)]})
  if 5<box.width<14 and 5<box.height<14 and d.get("type")=="fs":
   entry["smallSymbols"].append({"rect":[round(z,2) for z in box],"xy":[round((box.x0+box.x1)/2,3),round((box.y0+box.y1)/2,3)],"fill":d.get("fill")})
 for b in p.search_for("NOT TO SCALE"):
  entry["NTS"].append([round(z,2) for z in b])
 found=[]
 vlines=[z for z in segments(p) if _tick_kind(z)]
 for w in word:
  label=w[4]
  if not re.fullmatch(r"\d{2,3}-\d{2}(?:\.\d+)?",label):continue
  try:
   numeric=decimal_grid(label)
   axes=["latitude","longitude"] if 20<numeric<60 else ["longitude","latitude"]
   for ax in axes:
    expectedHorizontal=(ax=="latitude" and (w[3]-w[1])<=w[2]-w[0]) or (ax=="longitude" and (w[3]-w[1])>w[2]-w[0])
    possibilities=[]
    for line in vlines:
     kind=_tick_kind(line)
     if (kind=="horizontal")!=expectedHorizontal:continue
     score,primary,gap,pix,pixax=_candidate(w,line,kind)
     if primary>6 or gap>100 or score>23:continue
     possibilities.append({"score":round(score,2),"pdf":round(pix,5),"axis":pixax,"primary":round(primary,3),"gap":round(gap,3),"segment":[round(float(z),3) for z in line]})
    if possibilities:
     found.append({"label":label,"geo":numeric,"interpretation":ax,"positions":sorted(possibilities,key=lambda x:x["score"])[:3],"word":[round(z,2) for z in w[:4]]})
  except Exception as err: pass
 entry["pairedTicks"]=found
 report["pages"].append(entry)
 p.get_pixmap(matrix=fitz.Matrix(2.5,2.5),alpha=False).save(str(out/f"OIIE-{num}.png"))
 print("OIIE_PAGE",num,"fingerprint",entry["fp"],"grids",entry["gridLabels"],"halo",entry["grayHalos"],"names",entry["names"],"NTS",entry["NTS"],flush=True)
 (out/f"OIIE-{num}.json").write_text(json.dumps(entry,indent=2))
(out/"all-source-qa.json").write_text(json.dumps(report,indent=2))
