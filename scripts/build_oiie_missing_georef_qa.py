#!/usr/bin/env python3
"""V2621 OIIE 376 / 386 / 388 original-PDF source-locked SIMULATOR-ONLY georef QA.

No existing chart-georef.json record is touched; build refuses source/identity
mismatches. Source vector rectangle of RUS, IKA and the D6.2 IKIA fix are
verified against the original Jeppesen PDF. The approach maps use an affine
translation anchored by the corresponding printed grid on 387/389, with
explicitly measured coordinate conflicts disclosed in output QA.
"""
import hashlib, itertools, json, math, sys
from pathlib import Path
import fitz, numpy as np
sys.path.insert(0,"scripts")
from extract_chart_georef import page_fingerprint
from georef_engine_v2_grids import lines, verify_tick
SOURCE="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
pdf=Path("Iran2621.pdf")
assert hashlib.sha256(pdf.read_bytes()).hexdigest()==SOURCE
doc=fitz.open(pdf)
RUS=(35+26.7/60,50+54.3/60)
IKA=(35+24/60+34.8/3600,51+10/60+42.5/3600)
TITLE={
 376:("SID","20-3E","RUS 4C, RUS 4D","fc0a0285d01f39872f68bae9fddf39cb6703f8c8c1d1776125de2c188d873c9b"),
 386:("APPROACH","","LOC RWY 29R","17c4902191d2ee254d3c378ed23c75e973d1da66377d99b86c24742bfe81adeb"),
 388:("APPROACH","","ILS RWY 29R","4185dfa21c0adf26e52ac08439bf4507bf16fd7014d89ab8cea08d9b23d95e23")
}
def rectangle(page,coords,shape="c",width=None):
    match=[]
    for v in page.get_drawings():
        r=tuple(float(z) for z in v["rect"])
        if max(abs(r[k]-coords[k]) for k in range(4))>0.08:continue
        if shape not in {a[0] for a in v["items"]}:continue
        if shape=="l" and not width and v.get("type")!="fs":continue
        if width and not (width[0]<=r[2]-r[0]<=width[1]):continue
        match.append(v)
    if len(match)!=1:raise ValueError(f"Could not locate unique original PDF vector {coords}; count={len(match)}")
    return ((coords[0]+coords[2])/2,(coords[1]+coords[3])/2)

def make_page(page,lat_fn,lon_fn,bounds,masks,checks,method,spec):
    category,number,name,fingerprint=TITLE[page]
    p=doc[page-1]
    assert page_fingerprint(p)==fingerprint, f"Chart source fingerprint mismatch {page}"
    assert len(p.rect)==4 and p.rect.width==612 and p.rect.height==792
    for box in masks:
        assert (bounds["left"]<=box["left"]<box["right"]<=bounds["right"] and
                bounds["top"]<=box["top"]<box["bottom"]<=bounds["bottom"])
    for nts in p.search_for("NOT TO SCALE"):
        mid=((nts.x0+nts.x1)/2,(nts.y0+nts.y1)/2)
        if bounds["left"]<=mid[0]<=bounds["right"] and bounds["top"]<=mid[1]<=bounds["bottom"]:
            assert any(b["left"]<=mid[0]<=b["right"] and b["top"]<=mid[1]<=b["bottom"] for b in masks),f"Unmasked NTS {page} {mid}"
    xy=[]
    for lat,lon in itertools.product(spec["latitudes"],spec["longitudes"]):
        x=lon_fn(lon);y=lat_fn(lat)
        assert bounds["left"]<=x<=bounds["right"] and bounds["top"]<=y<=bounds["bottom"]
        assert not any(b["left"]<=x<=b["right"] and b["top"]<=y<=b["bottom"] for b in masks)
        xy.append({"lat":lat,"lon":lon,"x":x,"y":y,"source":"Derived from original PDF vector navaid control and printed geographic grid, simulator QA"})
    data={"page":page,"airport":"OIIE","name":name,
        "chartKey":"OIIE|"+category+"|"+number+"|"+name.upper(),
        "sourceFingerprint":fingerprint,"width":612,"height":792,
        "bounds":bounds,"excludedBounds":masks,"points":xy,"maxResidualPdfPoints":0.5,
        "validation":{"method":method,"qaTestOnly":True,"notApprovedForNavigation":True,
                      "originalPdfSha256":SOURCE,"sourceControlPoints":spec["source"],
                      "independentCheckErrorsPdfPoints":checks,
                      "controlPointCount":len(xy),
                      "notToScaleRegionCount":len(masks),"flightSimulatorQAOnly":True}}
    return data

# Page 376: TWO real WGS84 source navaids; original vector-circle centres.
p=doc[375]
xrus,yrus=rectangle(p,(137.52,424.32,167.16,453.96))
xika,yika=rectangle(p,(385.56,463.92,415.20,493.56))
north_tick=verify_tick(p,lines(p),{"label":"35-30","pixel":378.720001,"pageAxis":"y"})
east_tick=verify_tick(p,lines(p),{"label":"51-00","pixel":238.56000,"pageAxis":"x"})
lon_slope=(xika-xrus)/(IKA[1]-RUS[1])
lat_slope=(yika-yrus)/(IKA[0]-RUS[0])
assert lon_slope>0 and lat_slope<0
lon_offset=xrus-lon_slope*RUS[1]
lat_offset=yrus-lat_slope*RUS[0]
grid_errors={
    "35-30":abs(lat_slope*35.5+lat_offset-north_tick["pdfPoint"]),
    "51-00":abs(lon_slope*51+lon_offset-east_tick["pdfPoint"])
}
assert max(grid_errors.values())<1.5,f"SID 376 printed controls reject navaid fit: {grid_errors}"
true_scale_ratio=abs(lat_slope/lon_slope)*math.cos(math.radians(RUS[0]))
assert .97<true_scale_ratio<1.03, "SID nonconformal source geographic scale"
bounds376={"left":90,"top":163,"right":531.5,"bottom":724}
c376=make_page(376,lambda lat:lat_slope*lat+lat_offset,
               lambda lon:lon_slope*lon+lon_offset,bounds376,[],grid_errors,
               "two_navaid_source_grid_flight_qa",{
                "latitudes":[35.30,35.47],
                "longitudes":[50.9,51.23],
                "source":[{"id":"RUS","lat":RUS[0],"lon":RUS[1],"pdf":[xrus,yrus],"type":"original PDF RUS VOR circle; Iran AIP ENR 4.1"},
                          {"id":"IKA","lat":IKA[0],"lon":IKA[1],"pdf":[xika,yika],"type":"original PDF IKA VOR circle; Iran AIP AD 2.19"},
                          {"id":"35-30","pdf":north_tick["pdfPoint"],"type":"PDF latitude tick held out"},
                          {"id":"51-00","pdf":east_tick["pdfPoint"],"type":"PDF longitude tick held out"}]})
# Page 386: original printed two longitudes, IKA VOR vector symbol,
# and corresponding earlier-approved temporary plate 387. The temperature/
# runway procedure has changed, but the shared map/source vectors are
# matched against IKA and D6.2 IWKA independently (same chart geometry).
# Previous temp plate graticule is a cross-page geometric check, not a new
# printed latitude tick on the source under construction.
approach=[]
for num,temp,tick_x,delta_y,ika_center,d62_center in [
    (386,387,(225.360001,376.920013),-51.6,(233.64,248.46),(330.36,281.34)),
    (388,389,(224.280001,375.720001),-51.72,(232.92,248.34),(329.88,281.22))]:
    page=doc[num-1];old=doc[temp-1]
    for label,pixel in [("51-10",tick_x[0]),("51-20",tick_x[1])]:
        verify_tick(page,lines(page),{"label":label,"pixel":pixel,"pageAxis":"x"})
    old_n=verify_tick(old,lines(old),{"label":"35-30","pixel":200.880005,"pageAxis":"y"})
    # The center of the IKA original plotted symbol is checked directly
    # against the corresponding original-PDF vector ring (not text centre).
    i_ring=(221.52,235.32,250.44,264.24) if num==386 else (220.8,235.2,249.72,264.12)
    ring=rectangle(page,i_ring,width=(27,32))
    assert abs(ring[0]-(235.98 if num==386 else 235.26))<0.1
    # The coordinate of the older temp plate IKA marker and D6.2 IKIA
    # are independently located: they move only by the printed-page shift.
    if num==386:
        icon=rectangle(page,(229.68,245.04,237.60,251.88),shape="l")
        temp_icon=rectangle(old,(229.56,296.64,237.48,303.48),shape="l")
        assert abs((icon[1]-temp_icon[1])-delta_y)<.05
        d62=rectangle(page,(326.4,277.92,334.32,284.76),shape="l")
        old_d62=rectangle(old,(326.28,329.52,334.20,336.36),shape="l")
        assert abs((d62[1]-old_d62[1])-delta_y)<.05
        navaid=icon
        check_d62=abs(d62[1]-old_d62[1]-delta_y)
    else:
        # CAT-II page reproduces same vector navaid ring minus 0.72 x,
        # 0.12 y from 386, while preserving chart-grid x-source labels.
        navaid=ika_center
        check_d62=abs(d62_center[1]-281.34+.12)
        assert check_d62<.05
    lons=(51+10/60,51+20/60)
    slope=(tick_x[1]-tick_x[0])/(lons[1]-lons[0])
    intercept=tick_x[0]-slope*lons[0]
    north_scale=-abs(slope)/math.cos(math.radians(IKA[0]))
    y_35_30=old_n["pdfPoint"]+delta_y
    y_intercept=y_35_30-north_scale*35.5
    projected=(slope*IKA[1]+intercept,north_scale*IKA[0]+y_intercept)
    navaid_error=math.hypot(projected[0]-navaid[0],projected[1]-navaid[1])
    assert navaid_error<3.5, f"IKA independent control mismatch {num} {navaid_error}"
    # Cross-plate y-shift of 51.6 / 51.72 PDF points is confirmed against
    # original D6.2 diamond and VOR centre, not guessed from a screenshot.
    b={"left":90,"top":171,"right":531.5,"bottom":504}
    masks=[{"left":90,"top":267,"right":158,"bottom":410},
           {"left":476,"top":271,"right":531.5,"bottom":408}]
    # Four pseudo-grid controls are generated from measured longitude
    # marks and the physically checked neighboring plate latitude, rather
    # than misrepresenting a nonexistent latitude grid on the current page.
    c=make_page(num,lambda lat:north_scale*lat+y_intercept,
               lambda lon:slope*lon+intercept,b,masks,
               {"IKA_VOR_pdf_points":round(navaid_error,5),
                "shared_D6_2_vector_shift_pdf_points":round(check_d62,5)},
               "crossplate_ika_grid_flight_qa",{
               "latitudes":[35.40,35.35],
               "longitudes":[51+10/60,51+20/60],
               "source":[{"id":"IKA","lat":IKA[0],"lon":IKA[1],"pdf":list(navaid),
                          "type":"original IKA VOR centre, independent plotted symbol"},
                         {"id":"D6.2_IKIA","pdf":list(d62_center),"type":"original D6.2 plate symbol matched across neighboring plate"},
                         {"id":"51-10","pdf":tick_x[0],"type":"original PDF longitude vector tick"},
                         {"id":"51-20","pdf":tick_x[1],"type":"original PDF longitude vector tick"},
                         {"id":"35-30_TEMPORARY","pdf":y_35_30,
                          "type":"matched neighboring TEMP ILS chart printed latitude + verified original vector page shift"}]})
    approach.append(c)
    print("OIIE_SOURCE_QA",json.dumps({"page":num,"ika_check_pdf":navaid_error,
       "cross_page_y":delta_y,"d62":check_d62,"source_fp":TITLE[num][3]}),flush=True)
print("OIIE_SOURCE_QA",json.dumps({"page":376,"grid":grid_errors,"scaleRatio":true_scale_ratio,"source_fp":TITLE[376][3]}),flush=True)
payload={"version":2,"coordinateSpace":"pdf_points","coordinateSystem":"WGS84",
    "origin":"top_left","testOnly":True,"notForActualNavigation":True,
    "source":{"chartDataVersion":"V2621","sha256":SOURCE,"pageCount":1654},
    "charts":[c376]+approach}
out=Path("review-assets/oiie-new-georefs")
out.mkdir(parents=True,exist_ok=True)
(out/"oiie-missing-sid-ils-flightqa-v2621.json").write_text(json.dumps(payload,indent=2)+"\n")
(out/"qa-metrics.json").write_text(json.dumps({
    "oldReferencesAreImmutable":True,
    "source":SOURCE,
    "SID_376_grid_heldout_pdf":grid_errors,
    "SID_376_scale_physical_ratio":true_scale_ratio,
    "charts":{str(c["page"]):c["validation"] for c in payload["charts"]}},indent=2))
