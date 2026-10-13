#!/usr/bin/env python3
"""OIIE published ADC pavement connected-components QA.

Identifies distinct simulator ground-movement pavement islands from the
original Jeppesen 20-9 gray-paved surface, registers the separately printed
Passenger/Cargo/Salam chart linework on the ADC and REFUSES to infer a legal
runway crossing merely because two pieces of pavement are geographically
close. This output does not certify taxi centreline, runway holding position,
runway clearance or operational navigation accuracy.
"""
import argparse,hashlib,json,math,re
from pathlib import Path
import fitz,numpy as np
from scipy.ndimage import label
from scipy.spatial import cKDTree
from skimage.morphology import skeletonize,closing,disk,remove_small_objects

AFFINE={
 "ADC":{"x":(-187.80000305175741,5001.018987019847),"y":(-154.09422050924874,1825.246164658491)},
 "PASSENGER":{"x":(-736.8335169786757,18499.99829702515),"y":(-598.7819714312784,5835.01130469973)},
 "CARGO":{"x":(-600.1285689217696,14884.185996736778),"y":(-490.3714310782303,5618.528107743044)},
 "SALAM":{"x":(-798.000030517593,21094.41970316607),"y":(-762.1199645996053,6317.870123290982)}
}
PRINTED_CONTROLS={
 "CARGO":[(110.64,691.08),(278.52,220.32)],
 "SALAM":[(396.6,765.36),(502.08,457.8)],
 "PASSENGER":[(379.92,89.16),(357.36,155.76),(272.28,402.72),(152.64,753.24)]
}
def to_adc(region,pt):
 a=AFFINE[region];z=AFFINE["ADC"]
 latm=(pt[0]-a["x"][1])/a["x"][0]
 lonm=(pt[1]-a["y"][1])/a["y"][0]
 return [z["x"][0]*latm+z["x"][1],z["y"][0]*lonm+z["y"][1]]
def find_adc(d):
 matches=[]
 for i in range(len(d)):
  t=d[i].get_text()
  if "OIIE/IKA" in t and re.search(r"\b20-9\b",t) and not re.search(r"\b20-9[A-Z]\b",t):
   matches.append(i)
 if len(matches)!=1:raise RuntimeError("Source ADC 20-9 not unique: "+str(matches))
 return d[matches[0]]
def build(pdf):
 raw=Path(pdf).read_bytes();doc=fitz.open(stream=raw,filetype="pdf")
 page=find_adc(doc)
 pix=page.get_pixmap(matrix=fitz.Matrix(2,2),alpha=False)
 arr=np.frombuffer(pix.samples,dtype=np.uint8).reshape(pix.height,pix.width,pix.n)
 gray=arr[:,:,0];mask=(gray>155)&(gray<210)
 mask=closing(mask,disk(4))
 mask=remove_small_objects(mask,min_size=280)
 blobs,n=label(mask);sizes=np.bincount(blobs.ravel())
 mainland=np.argsort(sizes[1:])[-3:]+1
 mask=np.isin(blobs,mainland)
 ink=skeletonize(mask)
 ink[:175,:]=False;ink[1510:,:]=False;ink[:,:190]=False;ink[:,1060:]=False
 regions,n=label(ink,structure=np.ones((3,3),dtype=int))
 counts=np.bincount(regions.ravel());pixels=np.argwhere(ink)
 if len(pixels)<1500:raise RuntimeError("ADC pavement skeleton unexpectedly empty")
 kd=cKDTree(pixels[:,::-1]/2)
 attach={}
 for region,points in PRINTED_CONTROLS.items():
  a=[]
  for p in points:
   target=to_adc(region,p);d,idx=kd.query(target)
   y,x=pixels[int(idx)]
   island=int(regions[y,x])
   a.append({"regionPdfPoint":list(p),"projectedADCPdfPoint":[round(z,3) for z in target],
      "sourceGraySkeletonPdfPoint":[round(float(x/2),3),round(float(y/2),3)],
      "offsetPdfPt":round(float(d),3),"sourcePavementIsland":island,
      "islandRasterNodeCount":int(counts[island]),
      "crossPageConnectionReviewed":False})
  attach[region]=a
 islands={r:sorted(set(p["sourcePavementIsland"] for p in pts)) for r,pts in attach.items()}
 if any(len(x)!=1 for x in islands.values()):
  raise RuntimeError("Source printed trunk does not register to a unique island")
 if islands["CARGO"]!=islands["PASSENGER"] or islands["SALAM"]==islands["CARGO"]:
  raise RuntimeError("Published distinct runway-bounded pavement island invariant changed")
 return {"schemaVersion":1,"airport":"OIIE","cycle":"2621",
  "pdfSha256":hashlib.sha256(raw).hexdigest(),
  "map":"Jeppesen 20-9 ADC","sourceRasterScale":2,
  "originalPavedSkeletonNodeCount":len(pixels),
  "sourceRasterIslandCount":int(n),
  "sourceRasterIslandLargestSizes":sorted((int(z) for z in counts[1:]),reverse=True)[:7],
  "registration":attach,"distinctApronIslandIds":islands,
  "passengerCargoSamePavementIsland":True,
  "salamIsSeparatedFromCargoByRunwayArea":True,
  "publishedRunwayCrossingPermissionRequired":True,
  "approvedCrossRunwayLinks":0,"approvedADCToApronPortals":0,
  "routeable":False,"realNavigationAuthorized":False,
  "warning":"Gray-pavement medial axes and adjacent pages are source-derived CANDIDATES, not certified taxiway centerlines or authorized runway crossings."}
def main():
 p=argparse.ArgumentParser();p.add_argument("--pdf",required=True);p.add_argument("--out",required=True);a=p.parse_args()
 result=build(a.pdf);dest=Path(a.out);dest.parent.mkdir(parents=True,exist_ok=True)
 dest.write_text(json.dumps(result,separators=(",",":"))+"\n")
 print("PASS OIIE ADC mapped pavement islands:",result["distinctApronIslandIds"],
 "No automatic Salam/Cargo runway crossing authorized")
if __name__=="__main__":main()
