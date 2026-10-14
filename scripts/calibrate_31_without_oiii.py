#!/usr/bin/env python3
"""Source-bound, additive calibration attempt for 31 V2621 charts; OIII frozen."""
import copy, hashlib, itertools, json, math, re, sys
from pathlib import Path
import fitz
import numpy as np
sys.path.insert(0,"scripts")
from extract_chart_georef import (grid_axes,extract,page_fingerprint,chart_key,segments,decimal_grid)

SOURCE_SHA="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
# Each rectangle independently identified in the source PDF vector drawing.
# All extents are ORIGINAL UNROTATED PDF points, not image screenshot pixels.
MASKS={
342:[(85.44,317.64,211.32,454.68)],
365:[(237,672,345,782),(356,49,419,126)],
369:[(90,315,172,386)],
379:[(80,552,119,654)],
386:[(88,270,152,402),(471,276,534,395)],
387:[(471,327,534,434)],
388:[(88,270,152,402),(471,276,534,395)],
389:[(471,327,534,434)],
444:[(90,173,230,228)],
446:[(90,170,192,274),(461,405,534,495)],
448:[(89,696,156,792)],
454:[(89,667,158,792)],
455:[(89,667,159,792)],
456:[(316,150,396,205)],
457:[(316,150,396,205)],
501:[(88,260,160,345)]
}
# On 387/389 the missed-approach inset and lower vertical profile have their own
# drawing geometry; never project an aircraft indicator into those panels.
EXTRA_MASKS={387:[(89,369,306,474),(85,490,534,792)],
             389:[(89,369,306,474),(85,490,534,792)]}

def make_model(page,n,row,anchor,fp,axes,frame,custom=False):
    axes=copy.deepcopy(axes)
    measured_counts={k:len(v) for k,v in axes.items()}
    # 459: inspect main apron coordinate tick trains only; two edge ticks
    # demonstrably snap to displaced graphic details, leaving 3+3 printed lines.
    removed=[]
    if n==459:
        for key,labels in (("latitude",{"27-12.4"}),("longitude",{"56-22.3"})):
            removed.extend(v["label"] for v in axes[key] if v["label"] in labels)
            axes[key]=[v for v in axes[key] if v["label"] not in labels]
    if not all(axes.values()) or max(map(len,axes.values()))<2:
        raise ValueError("Cannot determine page scale from one printed coordinate per axis")
    bounds={"left":frame[0][0],"top":frame[0][1],"right":frame[0][2],"bottom":frame[1][1]}
    method="paired_printed_graticule_vector_ticks"
    if min(map(len,axes.values()))==1:
        measured_key=max(axes,key=lambda k:len(axes[k]))
        derived_key="latitude" if measured_key=="longitude" else "longitude"
        m=axes[measured_key]
        singleton=axes[derived_key][0]
        dgeo=m[-1]["degrees"]-m[0]["degrees"]
        dpix=m[-1]["pdfPoint"]-m[0]["pdfPoint"]
        if dgeo<=0 or abs(dpix)<8:raise ValueError("No independent measurable degree scale")
        lat=singleton["degrees"] if derived_key=="latitude" else anchor["lat"]
        cos=math.cos(math.radians(lat))
        scale=abs(dpix/dgeo)*(1/cos if derived_key=="latitude" else cos)
        sign_measured=1 if dpix>0 else -1
        rotated=(axes["latitude"][0]["pixelAxis"]=="x")
        # Physical east/north determinant must be negative in PDF coordinates.
        # A 90-degree-rotated diagram requires same rather than opposite signs.
        sign_derived=sign_measured if rotated else -sign_measured
        pixel_low=bounds["left"] if singleton["pixelAxis"]=="x" else bounds["top"]
        pixel_high=bounds["right"] if singleton["pixelAxis"]=="x" else bounds["bottom"]
        candidate=None
        for step in (min(dgeo,10/60),5/60,2/60,1/60,.5/60,.25/60):
            for direction in (-1,1):
                px=singleton["pdfPoint"]+direction*sign_derived*step*scale
                if pixel_low+2<px<pixel_high-2 and abs(px-singleton["pdfPoint"])>8:
                    candidate=(step,direction,px);break
            if candidate:break
        if not candidate:raise ValueError("Cannot source-derive axis inside scaled map")
        step,direction,px=candidate
        new=dict(singleton,degrees=singleton["degrees"]+direction*step,pdfPoint=px,
                 label=None,labelBounds=None,tickSegment=None,derived=True,
                 derivation="orthogonal_conformal_scale")
        axes[derived_key]=sorted([singleton,new],key=lambda a:a["degrees"])
        method="single_axis_plus_conformal_scale"
    pts=[{"lat":la["degrees"],"lon":lo["degrees"],
          "x":lo["pdfPoint"] if lo["pixelAxis"]=="x" else la["pdfPoint"],
          "y":lo["pdfPoint"] if lo["pixelAxis"]=="y" else la["pdfPoint"],
          "source":("Printed grid %s / %s"%(la["label"],lo["label"])
                    if la.get("label") and lo.get("label") else "Derived orthogonal conformal grid intersection")}
          for la,lo in itertools.product(axes["latitude"],axes["longitude"])]
    if not all(bounds["left"]<=p["x"]<=bounds["right"] and bounds["top"]<=p["y"]<=bounds["bottom"] for p in pts):
        raise ValueError("Derived grid exceeds source chart plan frame")
    ll=np.asarray([[p["lon"],p["lat"]] for p in pts]);xy=np.asarray([[p["x"],p["y"]] for p in pts])
    center=ll.mean(axis=0);design=np.column_stack([ll-center,np.ones(len(ll))])
    coef,_,rank,_=np.linalg.lstsq(design,xy,rcond=None)
    err=float(max(np.linalg.norm(design@coef-xy,axis=1)))
    east,north=coef[0],coef[1]
    determinant=float(east[0]*north[1]-east[1]*north[0])
    orth=float(abs(np.dot(east,north))/(np.linalg.norm(east)*np.linalg.norm(north)))
    ratio=float(abs(np.linalg.norm(east)/np.linalg.norm(north)/math.cos(math.radians(center[1]))-1))
    limit=1.5 if method=="paired_printed_graticule_vector_ticks" else .75
    if rank!=3 or determinant>=0 or orth>.03 or err>limit:
        raise ValueError("Geometric control gate failed (rank, handedness, orthogonality, or fit): %.3f"%err)
    if method!="paired_printed_graticule_vector_ticks" and ratio>.03:
        raise ValueError("Source-derived conformal scale check failed")
    # All measured controls MUST correspond exactly to a printed tick segment
    # AND the original location of its source PDF label.
    words=page.get_text("words");vectors=segments(page)
    for values in axes.values():
        for c in values:
            if c.get("derived"):continue
            if not any(w[4]==c["label"] and max(abs(w[i]-c["labelBounds"][i]) for i in range(4))<.01 for w in words):
                raise ValueError("Control label not found in original PDF")
            if not any(max(abs(a-b) for a,b in zip(v,c["tickSegment"]))<.01 for v in vectors):
                raise ValueError("Measured tick is not a source vector segment")
            if abs(decimal_grid(c["label"])-c["degrees"])>1e-7:
                raise ValueError("Incorrect printed coordinate")
    return {"page":n,"airport":row["airport"],"name":row.get("name",""),
            "chartKey":chart_key(row),"sourceFingerprint":fp,"coordinateSpace":"pdf_points",
            "origin":"top_left","width":page.rect.width,"height":page.rect.height,
            "bounds":bounds,"excludedBounds":[],"points":pts,"gridAxes":axes,
            "airportAnchor":anchor,"maxResidualPdfPoints":limit,
            "validation":{"method":method,"gridMaxResidualPdfPoints":round(err,6),
              "controlPointCount":len(pts),"measuredAxisValueCounts":measured_counts,
              "rejectedSpuriousEdgeTicks":removed,"physicalAxisDeterminant":round(determinant,4),
              "sourceTickVerified":True,"qaTestOnly":True,
              "notApprovedForNavigation":True,"visualReview":"V2621_AIRPORTS_21_30_VISUAL_REVIEW"}}

def run():
    pdf=Path("Iran2621.pdf")
    if hashlib.sha256(pdf.read_bytes()).hexdigest()!=SOURCE_SHA:raise ValueError("Unexpected V2621 source")
    doc=fitz.open(pdf)
    report=json.loads(Path("docs/georeferencing/V2621_AIRPORTS_21_30_VISUAL_REVIEW.json").read_text())
    assert report["sourceSha256"]==SOURCE_SHA
    rows={int(x["page"]):x for x in json.loads(Path("web/data/charts-current.json").read_text())}
    selection=[x for x in report["pages"] if x["mainPlanMayBeCalibrated"] and x["airport"]!="OIII"]
    assert len(selection)==31 and all(rows[x["page"]]["airport"]==x["airport"]!="OIII" for x in selection)
    printed=re.compile(r"Lat/Long:\s*N(\d+)°\s*([\d.]+).*?E(\d+)°\s*([\d.]+)")
    airport_groups={}
    for row in rows.values():airport_groups.setdefault(row["airport"],[]).append(row["page"])
    anchors={}
    for x in selection:
        if x["airport"] in anchors:continue
        for pn in airport_groups[x["airport"]]:
            match=printed.search(doc[pn-1].get_text())
            if match:
                anchors[x["airport"]]={"sourcePage":pn,"lat":int(match[1])+float(match[2])/60,"lon":int(match[3])+float(match[4])/60}
                break
    good=[];bad=[]
    for item in selection:
        n=item["page"];page=doc[n-1];fp=page_fingerprint(page)
        try:
            axes,lines,top,bottom=grid_axes(page,anchors[item["airport"]])
            c=make_model(page,n,rows[n],anchors[item["airport"]],fp,axes,(top,bottom))
            masks=MASKS.get(n,[])
            labels=page.search_for("NOT TO SCALE")
            if labels:
                if not masks or not all(any(fitz.Rect(*q).contains(label) for q in masks) for label in labels):
                    raise ValueError("A NOT TO SCALE area has no source-bound mask")
            if item["visualClassification"]=="scaled_main_with_not_to_scale_insets" and not masks:
                raise ValueError("Visual report requires inset protection")
            c["excludedBounds"]=[dict(left=float(a),top=float(b),right=float(c_),bottom=float(d))
                 for a,b,c_,d in masks+EXTRA_MASKS.get(n,[])]
            assert all(fitz.Rect(0,0,page.rect.width,page.rect.height).contains(fitz.Rect(*q)) for q in masks)
            if any(all(fitz.Rect(*q).contains(fitz.Point(p["x"],p["y"])) for p in c["points"]) for q in masks):
                raise ValueError("Mask would cover entire georeferenced area")
            c["validation"]["notToScaleRegionsMasked"]=len(masks)
            c["validation"]["reviewDecision"]="source_locked_full_scale_except_insets"
            c["validation"]["candidateForSimulatorQA"]=True
            good.append(c)
            print("ACCEPT",n,item["airport"],len(c["points"]),c["validation"]["method"],flush=True)
        except Exception as err:
            bad.append({"page":n,"airport":item["airport"],"reason":str(err)})
            print("BLOCKED",n,item["airport"],str(err),flush=True)
    output={"source":{"file":"Iran2621.pdf","sha256":SOURCE_SHA,"pageCount":len(doc),"chartDataVersion":"V2621","cycle":"2621"},"charts":good}
    Path("/tmp/non-oiii-31-candidates.json").write_text(json.dumps(output,indent=2))
    Path("/tmp/non-oiii-31-qareport.json").write_text(json.dumps({"requested":31,"sourceMeasured":len(good),"blocked":bad,
      "excludedAirport":"OIII","sourceSHA256":SOURCE_SHA,"note":"SIMULATOR QA ONLY; not actual navigation."},indent=2))
    print("TOTAL",len(good),"BLOCKED",len(bad),flush=True)

if __name__=="__main__":run()
