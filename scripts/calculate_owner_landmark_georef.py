#!/usr/bin/env python3
"""Independent 11-chart landmark QA against the ORIGINAL V2621 PDF.

Only source vector shapes, published positions, and printed graticules are used.
This outputs measured simulator candidates and REJECTIONS, never guesses a flight
approval and never changes OIII records.
"""
import hashlib, json, math, os
from pathlib import Path
import fitz
import numpy as np

PIN="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"
PDF=Path("Iran2621.pdf")
assert hashlib.sha256(PDF.read_bytes()).hexdigest()==PIN
doc=fitz.open(PDF)

def dm(d,m,s=0):return d+m/60+s/3600
# Fix coordinates from OpenNav Iranian waypoint directory; check AIRAC before flight use.
# Navaid positions from Iran AIP ENR 4.1, as independently noted in the repo.
SITES={
 "KOBUB": (dm(37,6,15),dm(50,10,44),"OpenNav IR/KOBUB"),
 "MODIL": (dm(37,49,25),dm(49,41,17),"OpenNav IR/MODIL"),
 "ALGUV": (dm(30,45,7),dm(56,58,19),"OpenNav IR/ALGUV"),
 "RST": (dm(37,19.58),dm(49,36.95),"Iran AIP RST VOR"),
 "IKA": (dm(35,24,34.8),dm(51,10,42.5),"Iran AIP IKA VOR"),
 "RUS": (dm(35,26.7),dm(50,54.3),"Iran AIP RUS VOR"),
 "KER": (dm(30,16,58.1),dm(56,56,32.3),"Iran AIP KER VOR"),
 "BND": (dm(27,11,49.4),dm(56,22,.3),"Iran AIP BND VOR"),
 "OIKP": (27.1583,56.1725,"OurAirports OIKP ARP (non-official cross-check)"),
 "OIII": (35.6926,51.3175,"OIII published ARP cross-check; OIII models never changed")
}
# Each source marker is a uniquely recoverable 7-to-10 pt vector triangle.
# The bounds identify the source drawing, not a screenshot / text centre.
TRI={
 307:("KOBUB",(459.72,164.76,467.16,173.28),"RST"),
 308:("KOBUB",(459.72,164.64,467.04,173.28),"RST"),
 323:("MODIL",(438.96,125.28,447.60,132.60),"RST"),
 497:("ALGUV",(425.04,77.88,433.68,85.20),"KER")
}
# Measured PDF-axis graticule marks previously located by PDF line+label pairing.
# The graphic scale is independently checked against their printed degree.
TICKS={
 307:[("longitude","50-00","y",324.600006),("longitude","49-30","y",768.000000)],
 308:[("longitude","50-00","y",324.359985),("longitude","49-30","y",767.760071)],
 323:[("latitude","37-30","y",491.279999),("longitude","49-30","x",276.600006)],
 497:[("latitude","30-30","y",399.720001),("longitude","57-00","x",468.480011)]
}
# Site-specific source-pinned illustration symbol location; a single circle
# was measured as the midpoint of an outlined raster-like PDF vector graphic.
OIKP_SYMBOL={
 456:(128.16,613.26,138.60,623.16),
 457:(128.16,613.26,138.60,623.16)
}

def rectclose(a,b,tol=.05):
 return all(abs(float(x)-float(y))<=tol for x,y in zip(a,b))

def site_marker(page,rect):
 match=[d for d in page.get_drawings() if d.get("type")=="fs" and
   d.get("fill") and all(abs(float(x)-1)<.01 for x in d["fill"][:3])
   and rectclose(d["rect"],rect)]
 if len(match)!=1:raise ValueError(f"Expected one printed white triangle: {len(match)}")
 r=fitz.Rect(match[0]["rect"])
 return (r.x0+r.x1)/2,(r.y0+r.y1)/2

def halo(page):
 data=[]
 for d in page.get_drawings():
  r=fitz.Rect(d["rect"]);f=d.get("fill")
  if f and len(f)>=3 and max(abs(float(f[i])-.7019) for i in range(3))<.005 and 24<r.width<90 and abs(r.width-r.height)<1:
   data.append(((r.x0+r.x1)/2,(r.y0+r.y1)/2))
 if len(data)!=1:raise ValueError("No unique source VOR halo")
 return data[0]

def tangent(site,origin):
 # local WGS84 linear east/north metres (far fewer than 100 nm)
 return np.array([(site[1]-origin[1])*111319.4908*math.cos(math.radians(origin[0])),
    (site[0]-origin[0])*111319.4908])

def similarity(refsite,other,refxy,otherxy):
 d=tangent(other,refsite)
 dx=float(otherxy[0]-refxy[0]);dy=float(otherxy[1]-refxy[1])
 den=float(d@d)
 if den<1e6:raise ValueError("Anchor baseline too short")
 a=(dx*d[0]-dy*d[1])/den
 b=(dx*d[1]+dy*d[0])/den
 if not .0002<math.hypot(a,b)<.2:raise ValueError("Implausible pdf-per-metre scale")
 return dict(a=a,b=b,anchor=np.asarray(refxy),site=refsite,metresPerPdfPoint=1/math.hypot(a,b),
  baselineMetres=math.sqrt(den),pixelDistance=math.hypot(dx,dy))

def project(m,site):
 e,n=tangent(site,m["site"])
 return np.array([m["anchor"][0]+m["a"]*e+m["b"]*n,
   m["anchor"][1]+m["b"]*e-m["a"]*n])

def control_line_residual(m,site,value,axis,pax,measured):
 point=list(site[:2])
 point[0 if axis=="latitude" else 1]=value
 pred=project(m,point)
 return abs(pred[0 if pax=="x" else 1]-measured)

def curve_points(path):
 pts=[]
 for item in path["items"]:
  if item[0]!="c":continue
  vertices=item[1:5]
  if len(vertices)!=4:continue
  v=np.asarray([[p.x,p.y] for p in vertices],float)
  for t in np.linspace(0,1,31):
   pts.append(((1-t)**3*v[0]+3*t*(1-t)**2*v[1]+3*t*t*(1-t)*v[2]+t**3*v[3]).tolist())
 return pts

def ring_radius(page,center):
 arr=[]
 for d in page.get_drawings():
  rgb=d.get("color");r=fitz.Rect(d["rect"])
  if not(rgb and len(rgb)>=3 and rgb[0]>.62 and rgb[1]<.3 and rgb[2]<.3):continue
  if not(any(z[0]=="c" for z in d["items"]) and r.width>150):continue
  coords=curve_points(d)
  if len(coords)<20:continue
  rr=np.asarray([math.hypot(x-center[0],y-center[1]) for x,y in coords])
  arr.append(dict(rect=list(r),samples=len(coords),radiusPdfMean=float(rr.mean()),
    radiusPdfStd=float(rr.std()),radiusRange=[float(rr.min()),float(rr.max())]))
 return sorted(arr,key=lambda x:-x["samples"])

def compact(m):
 return {k:(round(float(v),6) if isinstance(v,(float,np.floating)) else v)
  for k,v in m.items() if k not in ("anchor","site")}

report=[]
for num in [307,308,323,376,386,388,446,456,457,497,502]:
 pg=doc[num-1];out={"page":num,"sourcePdfSha256":PIN}
 try:
  if num in TRI:
   ident,r,nav=TRI[num]
   m=similarity(SITES[nav],SITES[ident],halo(pg),site_marker(pg,r))
   errs=[]
   for axis,lab,pax,pix in TICKS[num]:
    d,mn=map(float,lab.split("-"))
    value=d+mn/60
    source_labels=[w[4] for w in pg.get_text("words")]
    assert lab in source_labels
    residual=control_line_residual(m,SITES[nav],value,axis,pax,pix)
    errs.append({"axis":axis,"sourceLabel":lab,"pixelAxis":pax,
       "sourceTickPdf":pix,"errorPdf":round(residual,3),
       "errorMetres":round(residual*m["metresPerPdfPoint"],1)})
   out["geometricFit"]=compact(m)
   out["fix"]=ident;out["vor"]=nav;out["gridCheck"]=errs
   out["controls"]={"navaidSite":SITES[nav],"namedFix":SITES[ident]}
   out["acceptedForPublish"]=all(t["errorMetres"]<=100 for t in errs)
   out["reason"]="grid_independent_check_passed" if out["acceptedForPublish"] else "independent_grid_exceeds_100m"
  elif num in (446,456,457):
   vor=halo(pg); arcs=ring_radius(pg,vor)
   out["control"]={"BND":SITES["BND"],"BNDsourcePix":vor,"nominalNm":25,
     "arcEvidence":arcs[:4]}
   if num in OIKP_SYMBOL:
    r=OIKP_SYMBOL[num]
    drawn=[d for d in pg.get_drawings() if rectclose(d["rect"],r)]
    if not drawn: raise ValueError("Published OIKP symbol graphic missing")
    oikp=((r[0]+r[2])/2,(r[1]+r[3])/2)
    m=similarity(SITES["BND"],SITES["OIKP"],vor,oikp)
    expected=25*1852/m["metresPerPdfPoint"]
    out["OIKPfit"]=compact(m);out["ringExpectedPdf"]=round(expected,3)
    out["ringDeviationMetres"]=round(abs(arcs[0]["radiusPdfMean"]-expected)*m["metresPerPdfPoint"],1) if arcs else None
   out["acceptedForPublish"]=False
   out["reason"]="radius_and_threshold_cross_checks_not_yet_confirmed"
  else:
   out["acceptedForPublish"]=False
   out["reason"]="additional_independent_vector_control_or_named_fix_coordinates_required"
  print("OWNER_GEOMETRIC_QA",json.dumps(out,ensure_ascii=False),flush=True)
 except Exception as exc:
  out["acceptedForPublish"]=False;out["reason"]=str(exc)
  print("OWNER_GEOMETRIC_QA_ERROR",num,str(exc),flush=True)
 report.append(out)
Path("docs/georeferencing/V2621_OWNER_11_LANDMARK_QA.json").write_text(json.dumps(
 {"sourceSha256":PIN,"MehrabadGeorefsFrozen":True,
 "note":"Independent source-view geometry only. This is not a flight accuracy certificate. Unverified controls are not added to moving map.",
 "pageResults":report},ensure_ascii=False,indent=2)+"\n")
