#!/usr/bin/env python3
"""OIIE V2621 real printed-line geometry QA, derived only from original PDF.

Proves 103 stand label/source ink associations and connected chart linework
within each independently-georeferenced apron. IMPORTANT: printed linework
connections are NOT certified physical taxi centerlines, apron portals or
runway holding points. Do not promote automatically to active TAXI paths.
"""
import argparse, collections, hashlib, json, math, re
from pathlib import Path
import fitz, networkx as nx
from shapely.geometry import LineString
from shapely.ops import snap, unary_union

GEO={
 'PASSENGER':{'page':382,'lat':(-736.8335169786757,18499.99829702515),'lon':(-598.7819714312784,5835.01130469973)},
 'CARGO':{'page':383,'lat':(-600.1285689217696,14884.185996736778),'lon':(-490.3714310782303,5618.528107743044)},
 'SALAM':{'page':383,'lat':(-798.000030517593,21094.41970316607),'lon':(-762.1199645996053,6317.870123290982)}}
STAND=re.compile(r'^[1234]\d\d[LR]?$')
def chart(doc,plate):
 matches=[i for i in range(len(doc)) if 'OIIE/IKA' in doc[i].get_text() and plate in doc[i].get_text()]
 if len(matches)!=1:raise ValueError('Expected unique source plate '+plate+': '+str(matches))
 return doc[matches[0]]
def geo(region,p):
 a=GEO[region];return [round(35+(p[0]-a['lat'][1])/a['lat'][0]/60,8),
                         round(51+(p[1]-a['lon'][1])/a['lon'][0]/60,8)]
def build_region(region,data,page):
 strokes=[s for s in data['strokes'] if s['region']==region and 9<=s['lengthPt']<550]
 lines=[LineString(s['points']) for s in strokes]
 base=unary_union(lines)
 united=unary_union([snap(line,base,.26) for line in lines])
 segments=list(united.geoms) if hasattr(united,'geoms') else [united]
 graph=nx.Graph()
 for seg in segments:
  if seg.geom_type!='LineString':continue
  for a,b in zip(seg.coords,seg.coords[1:]):
   u=tuple(round(z,2) for z in a);v=tuple(round(z,2) for z in b)
   if u!=v:graph.add_edge(u,v,weight=math.dist(u,v))
 components={node:n for n,group in enumerate(nx.connected_components(graph)) for node in group}
 stands={}
 for w in page.get_text('words'):
  id=w[4].upper()
  if not STAND.fullmatch(id):continue
  if region=='PASSENGER' and id[0] not in '14':continue
  if region=='CARGO' and id[0]!='3':continue
  if region=='SALAM' and id[0]!='2':continue
  label=[(w[0]+w[2])/2,(w[1]+w[3])/2];hits=[]
  for src in strokes:
   if src['lengthPt']>75:continue
   for idx in (0,-1):
    pt=src['points'][idx];d=math.dist(pt,label)
    if d<18:hits.append((d,src,idx))
  if not hits:continue
  distance,source,idx=min(hits,key=lambda x:x[0])
  ink=source['points'][idx]
  vertex=min(graph.nodes,key=lambda n:math.dist(n,ink))
  evidence={'id':'ST'+id,'sourcePage':GEO[region]['page'],'region':region,
    'drawingId':source['drawingId'],'sourceStrokeId':source['id'],
    'printedLabelPdf':[round(z,2) for z in label],
    'associatedInkPointPdf':ink,'associatedInkPointWGS84':geo(region,ink),
    'labelToInkPt':round(distance,2),'inkSnapDeviationPt':round(math.dist(vertex,ink),3),
    'component':components[vertex],'lineConnectionIsTaxiwayApproved':False}
  old=stands.get(id)
  if not old or evidence['labelToInkPt']<old[0]['labelToInkPt']:stands[id]=(evidence,vertex)
 ids=list(stands)
 directed=sum(1 for a in ids for b in ids if a!=b)
 connected=sum(1 for a in ids for b in ids if a!=b and stands[a][0]['component']==stands[b][0]['component'])
 examples=[]
 for a,b in ([('301','314')] if region=='CARGO' else [('204','208')] if region=='SALAM' else [('100','150')]):
  u,v=stands[a],stands[b]
  if u[0]['component']!=v[0]['component']:
   examples.append({'start':'ST'+a,'end':'ST'+b,'connected':False})
  else:
   path=nx.shortest_path(graph,u[1],v[1],weight='weight')
   examples.append({'start':'ST'+a,'end':'ST'+b,'connected':True,
    'sourceInkPolylineWGS84':[geo(region,p) for p in path],
    'sourceInkPolylinePdf':[list(p) for p in path],
    'sourceInkDistancePt':round(nx.path_weight(graph,path,'weight'),2),
    'physicalTaxiRouteApproved':False})
 return {'region':region,'sourcePage':GEO[region]['page'],
   'sourceBlackStrokes':len(strokes),'sourceInkVertices':graph.number_of_nodes(),
   'sourceInkSegments':graph.number_of_edges(),
   'componentCount':nx.number_connected_components(graph),
   'standCount':len(stands),'standMarkers':[v[0] for v in stands.values()],
   'directedInkConnectivityTests':directed,'directedInkConnected':connected,
   'examples':examples,'physicalTaxiRoutesApproved':0,
   'runwayHoldShortsApproved':0,'crossPagePortalsApproved':0}
def main():
 ap=argparse.ArgumentParser()
 ap.add_argument('--pdf',required=True)
 ap.add_argument('--vectors',required=True)
 ap.add_argument('--out',required=True)
 a=ap.parse_args()
 pdf=Path(a.pdf).read_bytes()
 vector=json.loads(Path(a.vectors).read_text(encoding='utf8'))
 if vector['airport']!='OIIE' or str(vector['cycle'])!='2621' or hashlib.sha256(pdf).hexdigest()!=vector['inputPdfSha256']:
  raise RuntimeError('Airport, cycle or raw PDF source fingerprint mismatch')
 d=fitz.open(stream=pdf,filetype='pdf')
 regions={r:build_region(r,vector['pages'][str(GEO[r]['page'])],
    chart(d,'20-9B' if r=='PASSENGER' else '20-9C')) for r in GEO}
 if sum(v['standCount'] for v in regions.values())!=103:raise RuntimeError('Stand source match is incomplete')
 if regions['CARGO']['directedInkConnected']!=420 or regions['SALAM']['directedInkConnected']!=380:
  raise RuntimeError('Source linework continuity changed from V2621 original')
 output={'airport':'OIIE','cycle':'2621','inputPdfSha256':vector['inputPdfSha256'],
 'kind':'ORIGINAL_PDF_NATIVE_INK_NETWORK_UNAPPROVED_FOR_TAXI',
 'sourceMatchedStandCount':103,'regions':regions,'approvedPhysicalTaxiRoutes':0,
 'routeable':False,'safeForRealNavigation':False,
 'remarks':'Printed source ink continuity can be boundaries/leader lines; intersections do not certify taxiway clearance or runway hold-short geometry.'}
 dst=Path(a.out);dst.parent.mkdir(parents=True,exist_ok=True)
 dst.write_text(json.dumps(output,separators=(',',':'))+'\n',encoding='utf-8')
 print('SOURCE VECTORS:',{k:{'stands':v['standCount'],'connectedInkPairs':v['directedInkConnected'],'tested':v['directedInkConnectivityTests']} for k,v in regions.items()})
 print('PASS: native PDF stand and stroke association. TAXI ROUTES STILL REQUIRE physical chart QA.')
if __name__=='__main__':main()
