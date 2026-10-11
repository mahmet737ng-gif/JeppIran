#!/usr/bin/env python3
"""Extract labels on LTFM ADC for uncharted/missing OSM centerlines.
Labels are NOT physical taxiway geometry or routable stand connections.
Requires pymupdf; independently fits graticule of the exact airport ADC.
"""
import fitz,json,re,sys
from pathlib import Path

def fit(coords):
    n=len(coords)
    if n<2:raise ValueError("Insufficient chart graticule labels")
    mx=sum(x for x,y in coords)/n;my=sum(y for x,y in coords)/n
    slope=sum((x-mx)*(y-my) for x,y in coords)/sum((x-mx)**2 for x,y in coords)
    intercept=my-slope*mx
    return intercept,slope,max(abs(intercept+slope*x-y) for x,y in coords)

def extract(pdfpath,auditpath):
    missing=json.loads(Path(auditpath).read_text())["chartOnlyTaxiwayLabels"]
    chart=None;pageNo=None
    for i,page in enumerate(fitz.open(pdfpath),1):
        t=page.get_text("text")
        if re.search(r"\b30-9\b",t) and "LTFM/IST" in t and "HOT SPOTS" in t and \
           "17R" in t and "G2M" in t and "B9A" in t and "STANDARD TAXI ROUTES" not in t:
            chart=page;pageNo=i;break
    if chart is None:raise ValueError("Cannot locate original cycle 2621 LTFM 30-9")
    words=chart.get_text("words")
    lat=[];lon=[]
    for w in words:
        x=(w[0]+w[2])/2;y=(w[1]+w[3])/2;txt=w[4]
        if re.fullmatch(r"41-\d{2}",txt) and (y<45 or y>755):
            lat.append((x,41+int(txt[3:])/60))
        if re.fullmatch(r"28-\d{2}",txt) and (x<115 or x>530):
            lon.append((y,28+int(txt[3:])/60))
    ia,sa,erra=fit(lat);ib,sb,errb=fit(lon)
    if max(erra,errb)>0.0002:raise RuntimeError("Graticule calibration unreliable")
    labels={}
    for label in missing:
        locations=[]
        for w in words:
            x=(w[0]+w[2])/2;y=(w[1]+w[3])/2
            if w[4].upper()!=label or not (145<=x<=538 and 130<=y<=730):continue
            locations.append({"x":round(x,2),"y":round(y,2),
                "lat":round(ia+sa*x,7),"lon":round(ib+sb*y,7)})
        labels[label]={"sourcePdfPage":pageNo,"sourceChart":"30-9",
            "labelPoints":locations,"geometryStatus":"LABEL_ONLY_NO_CENTERLINE",
            "routingApproved":False}
    return {"airport":"LTFM","cycle":"2621","kind":"taxiway-chart-label-spatial-index",
        "coordinateSpace":"pdf_points","sourcePdfPage":pageNo,
        "calibration":{"latitudeTickCount":len(lat),"longitudeTickCount":len(lon),
            "maxGridResidualDegrees":round(max(erra,errb),8)},
        "warning":"Printed label coordinates are NOT taxiway centerlines, endpoints, junctions, pushback routes or runnable taxi edges.",
        "missingCenterlineLabels":labels}

if __name__=="__main__":
    if len(sys.argv)!=4:raise SystemExit("Usage: script.py charts.pdf taxi-audits/LTFM.json output.json")
    result=extract(sys.argv[1],sys.argv[2])
    dest=Path(sys.argv[3]);dest.parent.mkdir(parents=True,exist_ok=True)
    dest.write_text(json.dumps(result,separators=(",",":")),encoding="utf8")
    count=sum(bool(x["labelPoints"]) for x in result["missingCenterlineLabels"].values())
    print("Chart-only name anchors:",count,"/",len(result["missingCenterlineLabels"]))
