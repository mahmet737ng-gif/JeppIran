#!/usr/bin/env python3
"""OIGG 307/308 original PDF source-aligned simulator-only STAR model diagnostic.

No output is approved for navigation and no existing references are overwritten.
Models have an explicit independently measured real-world control residual.
"""
import hashlib,json,math
from pathlib import Path
import fitz,numpy as np
import sys
sys.path.insert(0,'scripts')
from extract_chart_georef import page_fingerprint
PDF=Path("Iran2621.pdf")
PIN="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
assert hashlib.sha256(PDF.read_bytes()).hexdigest()==PIN,"AIRAC source mismatch"
doc=fitz.open(PDF)
RST={"id":"RST VOR", "lat":37+19.58/60,"lon":49+36.95/60,"source":"Iran AIP ENR 4.1"}
KOBUB={"id":"KOBUB","lat":37+6/60+15/3600,"lon":50+10/60+44/3600,"source":"OpenNav IR/KOBUB: secondary cross check"}
TRI={307:(459.72,164.76,467.16,173.28),308:(459.72,164.64,467.04,173.28)}
TICKS={307:[("50-00",324.600006),("49-30",768.0)],308:[("50-00",324.359985),("49-30",767.760071)]}

def halo(page):
    matches=[]
    for d in page.get_drawings():
        r=fitz.Rect(d["rect"]);f=d.get("fill")
        if f and len(f)>=3 and max(abs(float(f[i])-.7019) for i in range(3))<.005 and 24<r.width<90 and abs(r.width-r.height)<1:
            matches.append([(r.x0+r.x1)/2,(r.y0+r.y1)/2])
    if len(matches)!=1:raise ValueError("Cannot independently locate unique RST radar halo")
    return matches[0]

def fixmarker(page,target):
    found=[]
    for d in page.get_drawings():
        r=list(d["rect"]);fill=d.get("fill")
        if d.get("type")=="fs" and fill and all(abs(float(fill[k])-1)<.01 for k in range(3)) and all(abs(float(r[k])-target[k])<.08 for k in range(4)):
            found.append([(r[0]+r[2])/2,(r[1]+r[3])/2])
    if len(found)!=1:raise ValueError("Cannot independently locate unique KOBUB PDF triangle")
    return found[0]

def deg(t):
    a,b=t.split("-");return int(a)+int(b)/60

def model_check(num):
    page=doc[num-1]
    png=Path("review-assets/oigg-source-"+str(num)+".png");png.parent.mkdir(parents=True,exist_ok=True)
    page.get_pixmap(matrix=fitz.Matrix(2.5,2.5),alpha=False).save(str(png))
    assert len(page.search_for("NOT TO SCALE"))==0
    vor_xy=np.array(halo(page))
    fix_xy=np.array(fixmarker(page,TRI[num]))
    lon_grid=[deg(v) for v,p in TICKS[num]]
    pdf_y=[p for v,p in TICKS[num]]
    for label,pixel in TICKS[num]:
        assert page.search_for(label),"No original PDF text graticule label "+label
    lon_slope=(pdf_y[0]-pdf_y[1])/(lon_grid[0]-lon_grid[1])
    lon_base=pdf_y[0]-lon_slope*lon_grid[0]
    # Rotated STAR: latitude is chart x and longitude is chart y.
    # Comply with physical projection scale: latitude px/deg =
    # abs(longitude px/deg) / cos(lat) with negative sign from source.
    scale=-abs(lon_slope)/math.cos(math.radians(RST["lat"]))
    x_base=vor_xy[0]-scale*RST["lat"]
    def printed_grid_projection(c):
        return np.array([scale*c["lat"]+x_base, lon_slope*c["lon"]+lon_base])
    grid_est_rst=printed_grid_projection(RST)
    grid_est_fix=printed_grid_projection(KOBUB)
    print("SOURCE_DIAGNOSTIC",json.dumps({
        "page":num,"sourcePdfHash":PIN,
        "pdfRect":list(page.rect),"sourceVorSymbol":vor_xy.tolist(),
        "sourceKobubSymbol":fix_xy.tolist(),
        "gridLongitudeTicks":TICKS[num],
        "gridSlope":lon_slope,"derivedLatitudeSlope":scale,
        "checkVorErrorPdf":round(float(np.linalg.norm(grid_est_rst-vor_xy)),3),
        "checkKobubErrorPdf":round(float(np.linalg.norm(grid_est_fix-fix_xy)),3),
        "estimatedVor":grid_est_rst.tolist(),"estimatedKobub":grid_est_fix.tolist()
    },ensure_ascii=False),flush=True)
    # Proposed measured-grid model, with RST anchoring x, 2 printed longitude
    # vector ticks, and KOBUB independently withheld. No guessed fixes.
    return {
        "page":num,"sourceFingerprint":page_fingerprint(page),"type":"simulator_source_grid_candidate",
        "vorPixel":vor_xy.tolist(),"fixPixel":fix_xy.tolist(),
        "latitudeSlope":scale,"latitudeIntercept":x_base,
        "longitudeSlope":lon_slope,"longitudeIntercept":lon_base,
        "errorsPdf":{"vor":round(float(np.linalg.norm(grid_est_rst-vor_xy)),3),
                      "kobub":round(float(np.linalg.norm(grid_est_fix-fix_xy)),3)},
        "sourcePdfSha256":PIN,"validation":"UNAPPROVED_FOR_NAVIGATION"
    }

report={"airport":"OIGG","cycle":"V2621","originalPdfSha256":PIN,
        "charts":[model_check(p) for p in (307,308)],
        "flightQAOnly":True,"notApprovedForNavigation":True}
p=Path("review-assets/oigg-star-source-fit.json");p.parent.mkdir(parents=True,exist_ok=True)
p.write_text(json.dumps(report,indent=2)+"\n")


# Source-PDF independent inspection of user-provided simulator fixes.
# This report is a diagnostic: coordinates measured from FSX are *not*
# PDF control points until a chart symbol can be positively identified.
FSX_CONTROLS = {
    "D20_R113": {"lat": 37+10.65/60, "lon":49+59.21/60,
                  "note":"FSX 19.885 NM from RST on inbound 293 magnetic"},
    "D15_EAST": {"lat":37+18.34/60, "lon":49+55.72/60,
                 "note":"FSX 15.024 NM from RST east, inbound heading 271 magnetic"}
}
def nearby_white_triangles(page, target):
    hits=[]
    for draw in page.get_drawings():
        fill=draw.get("fill")
        if not fill or len(fill)<3 or not all(abs(float(z)-1)<.015 for z in fill[:3]):
            continue
        r=fitz.Rect(draw["rect"])
        if draw.get("type")!="fs" or not (2<r.width<20 and 2<r.height<20):
            continue
        x,y=(r.x0+r.x1)/2,(r.y0+r.y1)/2
        dist=float(np.hypot(x-target[0],y-target[1]))
        if dist<110:
            hits.append({"centerPdf":[round(x,3),round(y,3)],
                         "boundsPdf":[round(float(z),3) for z in r],
                         "distanceFromOldFitPdf":round(dist,3)})
    return sorted(hits,key=lambda c:c["distanceFromOldFitPdf"])[:25]
pdf_controls=[]
old_geos=json.loads(Path("web/data/oigg-star-flightqa-v2621.json").read_text())
for entry in old_geos["charts"]:
    page_num=entry["page"]
    s=entry["points"];mlat=sum(p["lat"] for p in s)/len(s);mlon=sum(p["lon"] for p in s)/len(s)
    mx=sum(p["x"] for p in s)/len(s);my=sum(p["y"] for p in s)/len(s)
    mat=np.array([[p["lon"]-mlon,p["lat"]-mlat] for p in s])
    coeffx=np.linalg.lstsq(mat,np.array([p["x"]-mx for p in s]),rcond=None)[0]
    coeffy=np.linalg.lstsq(mat,np.array([p["y"]-my for p in s]),rcond=None)[0]
    page=doc[page_num-1]
    controls=[]
    for name,c in FSX_CONTROLS.items():
        ll=np.array([c["lon"]-mlon,c["lat"]-mlat])
        target=[float(mx+ll@coeffx),float(my+ll@coeffy)]
        words=[{"text":w[4],"rect":[round(float(t),2) for t in w[:4]]} for w in page.get_text("words")
               if any(k in w[4].upper() for k in ("D20","20.0","D15","15.0","RST"))]
        controls.append({"id":name,"fsxWgs84":c,"oldModelPredictionPdf":target,
                         "sourcePdfWhiteTriangleCandidates":nearby_white_triangles(page,target),
                         "nearbyRelevantSourceText":words[:35],
                         "status":"MEASURED_CANDIDATES_ONLY_NOT_GCP"})
    pdf_controls.append({"page":page_num,"controls":controls})
inspection_path=Path("review-assets/oigg-star-user-fsx-source-controls.json")
inspection_path.write_text(json.dumps({"sourceSha256":PIN,"flightQAOnly":True,
                                       "notForActualNavigation":True,
                                       "pages":pdf_controls},indent=2)+"\n")
for item in pdf_controls:
    print("OIGG_FSX_SOURCE_PDF_CANDIDATES",json.dumps(item,ensure_ascii=False),flush=True)
