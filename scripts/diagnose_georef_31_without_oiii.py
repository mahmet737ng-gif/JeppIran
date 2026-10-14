#!/usr/bin/env python3
"""Review source PDF grids on owner-authorized 31 pages (never touch OIII)."""
import json, hashlib, re, sys
from pathlib import Path
import fitz
sys.path.insert(0,"scripts")
from extract_chart_georef import extract, grid_axes, page_fingerprint

source=Path("Iran2621.pdf")
reviews=json.loads(Path("docs/georeferencing/V2621_AIRPORTS_21_30_VISUAL_REVIEW.json").read_text())
manifest=json.loads(Path("web/data/charts-manifest.json").read_text())
assert hashlib.sha256(source.read_bytes()).hexdigest()==manifest["source_sha256"]==reviews["sourceSha256"]
targets=[r for r in reviews["pages"] if r["mainPlanMayBeCalibrated"] and r["airport"]!="OIII"]
assert len(targets)==31
doc=fitz.open(source)
index={int(x["page"]):x for x in json.loads(Path("web/data/charts-current.json").read_text())}
airports={}
for row in index.values():airports.setdefault(row["airport"],[]).append(row["page"])
anchors={}
pattern=re.compile(r"Lat/Long:\s*N(\d+)°\s*([\d.]+).*?E(\d+)°\s*([\d.]+)")
for row in targets:
    ap=row["airport"]
    if ap not in anchors:
        for p in airports[ap]:
            m=pattern.search(doc[p-1].get_text())
            if m:
                anchors[ap]={"sourcePage":p,"lat":int(m[1])+float(m[2])/60,"lon":int(m[3])+float(m[4])/60}
                break
assert len(anchors)==len({r["airport"] for r in targets}), anchors
print("ANCHORS",json.dumps(anchors),flush=True)
out=[]
for row in targets:
    n=row["page"];pg=doc[n-1]
    info={"page":n,"airport":row["airport"],"visualClass":row["visualClassification"],"fp":page_fingerprint(pg)}
    info["labels"]=[{"name":w[4],"box":[round(v,2) for v in w[:4]]} for w in pg.get_text("words") if re.fullmatch(r"\d{2,3}-\d{2}(?:\.\d+)?",w[4])]
    info["NTS"]=[[round(v,2) for v in b] for b in pg.search_for("NOT TO SCALE")]
    try:
        axes,lines,top,bottom=grid_axes(pg,anchors[row["airport"]])
        info["axes"]={name:[{"label":v["label"],"value":v["degrees"],"pixel":round(v["pdfPoint"],3),"pixelAxis":v["pixelAxis"]} for v in vals] for name,vals in axes.items()}
        info["frame"]=[top,bottom]
    except ValueError as e:info["axisError"]=str(e)
    try:
        model=extract(pg,n,index[n],anchors[row["airport"]],info["fp"])
        info["model"]={"method":model["validation"]["method"],"points":len(model["points"]),"residual":model["validation"]["gridMaxResidualPdfPoints"],"bounds":model["bounds"],"excludedBounds":model["excludedBounds"]}
    except ValueError as e:info["modelError"]=str(e)
    print("PAGE",json.dumps(info,separators=(",",":"),ensure_ascii=False),flush=True)
    out.append(info)
Path("georef31-diagnostic.json").write_text(json.dumps({"anchors":anchors,"pages":out},indent=2,ensure_ascii=False))
