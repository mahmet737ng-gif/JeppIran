"""Source-vector graticule regional models for JEPPIRAN V2 QA.

The registry specifies ONLY measurable, printed ticks and independent source
symbols. Every tick is matched to the original PDF text AND a nearby vector
stroke; image/screenshot label centers are never substituted for map marks.
No model is automatically activated in production.
"""
import itertools
import math
import re
import numpy as np
from extract_chart_georef import page_fingerprint

GRID=re.compile(r"(\d{2,3})-(\d{2}(?:\.\d+)?)$")
METRE_PER_DEG=111319.49079327358


def decimal(label):
    m=GRID.fullmatch(label)
    if not m or float(m[2])>=60: raise ValueError("Invalid printed graticule: "+label)
    return int(m[1])+float(m[2])/60


def lines(page):
    found=[]
    for drawing in page.get_drawings():
        for item in drawing["items"]:
            if item[0]=="l":
                a,b=item[1:3]
                found.append((float(a.x),float(a.y),float(b.x),float(b.y)))
            elif item[0]=="re":
                r=item[1]
                found.extend(((r.x0,r.y0,r.x1,r.y0),(r.x1,r.y0,r.x1,r.y1),
                              (r.x1,r.y1,r.x0,r.y1),(r.x0,r.y1,r.x0,r.y0)))
    return found


def point_in(rect,x,y):
    return rect["left"]<=x<=rect["right"] and rect["top"]<=y<=rect["bottom"]


def verify_tick(page,all_lines,tick):
    coordinate=float(tick["pixel"])
    axis=tick["pageAxis"]
    label=tick["label"]
    words=[w for w in page.get_text("words") if w[4]==label]
    if not words: raise ValueError("Printed grid label missing: "+label)
    for w in words:
        cx,cy=(w[0]+w[2])/2,(w[1]+w[3])/2
        if abs((cx if axis=="x" else cy)-coordinate)>3.5: continue
        for x1,y1,x2,y2 in all_lines:
            delta=abs(y2-y1) if axis=="x" else abs(x2-x1)
            pos=x1 if axis=="x" else y1
            aligned=abs(x1-x2)<0.04 if axis=="x" else abs(y1-y2)<0.04
            if not aligned or not 1.5<=delta<=14 or abs(pos-coordinate)>.15: continue
            other_min=min(y1,y2) if axis=="x" else min(x1,x2)
            other_max=max(y1,y2) if axis=="x" else max(x1,x2)
            label_min=w[1] if axis=="x" else w[0]
            label_max=w[3] if axis=="x" else w[2]
            gap=max(0,other_min-label_max,label_min-other_max)
            if gap<=32: return {"label":label,"degrees":decimal(label),
                 "pixelAxis":axis,"pdfPoint":coordinate,
                 "labelBounds":[float(v) for v in w[:4]],
                 "tickSegment":[float(x1),float(y1),float(x2),float(y2)]}
    raise ValueError("No source PDF vector tick at "+label+" / "+axis+"="+str(coordinate))


def fitted_axis(entries):
    z=np.array([e["degrees"] for e in entries],float)
    p=np.array([e["pdfPoint"] for e in entries],float)
    if len(entries)<2 or len(set(z))!=len(entries):
        raise ValueError("Two distinct graticule values required")
    A=np.column_stack((z-z.mean(),np.ones(len(z))))
    out,_,rank,_=np.linalg.lstsq(A,p,rcond=None)
    if rank!=2: raise ValueError("Grid axis is degenerate")
    slope=float(out[0])
    intercept=float(out[1]-slope*z.mean())
    error=float(np.max(np.abs(slope*z+intercept-p)))
    if error>.20: raise ValueError("Printed tick axis is inconsistent")
    return slope,intercept


def independent_symbol(page,check):
    rect=check["sourceSymbolRect"]
    wanted=[rect["left"],rect["top"],rect["right"],rect["bottom"]]
    matches=[d for d in page.get_drawings() if
             max(abs(float(v)-u) for v,u in zip(d["rect"],wanted))<.08]
    if len(matches)!=1:
        raise ValueError("Independent navaid vector symbol not unique")
    if not check.get("coordinateSource") or not check.get("id"):
        raise ValueError("Independent control lacks published coordinate source")
    return (rect["left"]+rect["right"])/2,(rect["top"]+rect["bottom"])/2


def grid_region(page,chart,region):
    area=region["bounds"]
    if not (0<=area["left"]<area["right"]<=page.rect.width and
            0<=area["top"]<area["bottom"]<=page.rect.height):
        raise ValueError("Map bounds invalid")
    masks=region.get("excludedBounds",[])
    for mask in masks:
        if not point_in(area,mask["left"],mask["top"]) or not point_in(area,mask["right"],mask["bottom"]):
            raise ValueError("Mask extends beyond map")
    for label in page.search_for("NOT TO SCALE"):
        x,y=(label.x0+label.x1)/2,(label.y0+label.y1)/2
        if point_in(area,x,y) and not any(point_in(m,x,y) for m in masks):
            raise ValueError("NOT TO SCALE label is unmasked")

    vector_lines=lines(page)
    lat=[verify_tick(page,vector_lines,t) for t in region["latitudeTicks"]]
    lon=[verify_tick(page,vector_lines,t) for t in region["longitudeTicks"]]
    axes={"latitude":lat,"longitude":lon}
    if len({x["pixelAxis"] for x in lat})!=1 or len({x["pixelAxis"] for x in lon})!=1 or lat[0]["pixelAxis"]==lon[0]["pixelAxis"]:
        raise ValueError("Map axes overlap")
    measured_counts={"latitude":len(lat),"longitude":len(lon)}
    checks=[]
    if len(lat)>=2 and len(lon)>=2:
        lat_slope,lat_b=fitted_axis(lat)
        lon_slope,lon_b=fitted_axis(lon)
        method="paired_printed_graticule_vector_ticks"
    elif len(lat)==1 and len(lon)>=2:
        lon_slope,lon_b=fitted_axis(lon)
        # A single printed north/south line needs an independent datum.
        # The candidate compass sign is resolved from the verified VOR symbol,
        # not from guessing that the top of the page is geographic north.
        if not region.get("independent"): raise ValueError("No independent point for derived north axis")
        inferred_abs=abs(lon_slope)/math.cos(math.radians(lat[0]["degrees"]))
        if abs(inferred_abs)<1 or abs(inferred_abs)>200000: raise ValueError("Conformal scale out of range")
        choices=[]
        for sign in (-1,1):
            candidate=sign*inferred_abs
            base=lat[0]["pdfPoint"]-candidate*lat[0]["degrees"]
            residuals=[]
            for check in region["independent"]:
                x,y=independent_symbol(page,check)
                px=candidate*check["lat"]+base
                py=lon_slope*check["lon"]+lon_b
                residuals.append(math.hypot(px-x,py-y))
            choices.append((max(residuals),candidate,base))
        residual,lat_slope,lat_b=min(choices,key=lambda c:c[0])
        if residual>1.5: raise ValueError("Independent VOR calibration check exceeds tolerance")
        checks=[{"id":r["id"],"lat":r["lat"],"lon":r["lon"],
                  "source":r["coordinateSource"],
                  "referencePdfCenter":list(independent_symbol(page,r)),
                  "residualMaxPdfPoints":round(residual,5)} for r in region["independent"]]
        # Construct a geometrically derived second latitude, distinguish it
        # unambiguously from physically measured printed graticule ticks.
        delta=float(region.get("derivedLatitudeStep",-0.1))
        next_lat=lat[0]["degrees"]+delta
        coord=lat_slope*next_lat+lat_b
        if not (area["left"]<=coord<=area["right"] if lat[0]["pixelAxis"]=="x" else area["top"]<=coord<=area["bottom"]):
            raise ValueError("Derived control is outside scaled plan")
        lat.append({"label":None,"degrees":next_lat,"pdfPoint":coord,
                    "pixelAxis":lat[0]["pixelAxis"],"labelBounds":None,
                    "tickSegment":None,"derived":True,
                    "derivation":"orthogonal_conformal_scale"})
        method="single_axis_plus_conformal_scale"
    else:
        raise ValueError("Insufficient printed axis evidence")
    # Verify source tick axes under the fitted transform; the chart is never
    # treated as a global full-page map if it contains an independent inset.
    px_for_lat=lat[0]["pixelAxis"]
    px_for_lon=lon[0]["pixelAxis"]
    points=[]
    for a,b in itertools.product(lat,lon):
        pos={px_for_lat:lat_slope*a["degrees"]+lat_b,
             px_for_lon:lon_slope*b["degrees"]+lon_b}
        if not point_in(area,pos["x"],pos["y"]) or any(point_in(m,pos["x"],pos["y"]) for m in masks):
            raise ValueError("Graticule control is outside active map region")
        points.append({"lat":a["degrees"],"lon":b["degrees"],"x":pos["x"],"y":pos["y"],
                       "source":"Printed vector graticule or explicitly derived conformal axis"})
    longitude_mean=np.mean([p["lon"] for p in points])
    latitude_mean=np.mean([p["lat"] for p in points])
    A=np.array([[p["lon"]-longitude_mean,p["lat"]-latitude_mean,1] for p in points])
    B=np.array([[p["x"],p["y"]] for p in points])
    coeff,_,rank,_=np.linalg.lstsq(A,B,rcond=None)
    if rank!=3: raise ValueError("Degenerate affine transform")
    residual=max(float(np.linalg.norm(pred-real)) for pred,real in zip(A@coeff,B))
    det=float(coeff[0,0]*coeff[1,1]-coeff[1,0]*coeff[0,1])
    if det>=0: raise ValueError("Mirrored geographic orientation")
    if residual>1.5: raise ValueError("Affine control-point fit exceeds tolerance")
    return {
        "page":chart["page"],"airport":chart["airport"],"name":chart["name"],
        "chartKey":"|".join(str(chart.get(k,"")).strip().upper() for k in ("airport","category","chart_number","name")),
        "sourceFingerprint":page_fingerprint(page),
        "coordinateSpace":"pdf_points","origin":"top_left",
        "width":float(page.rect.width),"height":float(page.rect.height),
        "bounds":area,"excludedBounds":masks,"points":points,
        "gridAxes":{"latitude":lat,"longitude":lon},
        "maxResidualPdfPoints":1.5 if method=="paired_printed_graticule_vector_ticks" else 0.75,
        "validation":{"method":method,"gridMaxResidualPdfPoints":round(residual,6),
                      "measuredAxisValueCounts":measured_counts,
                      "independentChecks":checks,
                      "qaTestOnly":True,"notApprovedForNavigation":True,
                      "v2Region":region["id"]}
    }
