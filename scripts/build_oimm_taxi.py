#!/usr/bin/env python3
"""Reproduce OIMM simulator graph from the user's Jeppesen V2621 PDF.

Parking curves are extracted from PDF vector paths; other ADC pavement axes are
visually digitized, not surveyed. No OSM, implicit runway crossing or fictional
stand number is used. Requires PyMuPDF and numpy.
"""
import argparse, hashlib, json, math
from pathlib import Path
import fitz
import numpy as np

ROOT = Path(__file__).resolve().parents[1]
NAMES = 'A B C C1 C2 C3 D E F G H J K L M N P Q'.split()
# Reviewed PDF graphics path IDs on page 603. Exclude stop/heading symbols.
MARKS = {308,309,314,315,326,327,335,336,340,341,349,350,356,357,
         365,366,373,374,382,383,390,391,398,399}
PARKING_PATHS = list(range(33,45)) + list(range(50,59)) + list(range(255,418))
PARKING_PATHS = [i for i in PARKING_PATHS if i not in MARKS and i != 54]
ODD_PATHS = {101:36,103:304,105:302,107:299,109:296,111:293,113:290,
             115:287,117:284,119:281,121:278,123:275,125:272,127:269,
             129:266,131:263,133:260,135:255,137:56,130:41}
EVEN_PATHS = {102:397,104:389,106:381,108:372,110:364,112:404,
              114:355,116:348,118:412,120:339,122:334,124:325,126:316,128:311}
INS_GROUPS = [([101,102],13.6,38.8),([103,105],13.6,38.7),([104,106],13.7,38.7),
 ([107],13.6,38.6),([108,109,111],13.7,38.6),([110],13.8,38.6),([112,114,115,117],13.8,38.5),
 ([113],13.7,38.5),([116],13.9,38.5),([118,120,121],13.9,38.4),([119],13.8,38.4),
 ([122,124],14.0,38.3),([123,125,127],13.9,38.3),([126,129,131,133],14.0,38.2),
 ([128],14.1,38.2),([130,135,137],14.1,38.1)]
# PDF points, top-left origin, on 10-9 / page 601. Main apron uses detail page.
# Endpoints stop at pavement / runway boundaries; runway traversal is separately gated.
ADC_AXES = {
 'C':[(401,495),(412,506),(421,514),(427,520)],
 'C1':[(421,514),(422.4,509.5),(426.0,505.6)],
 'C2':[(433.2,526.0),(429.1,521.9),(432.0,517.0)],
 'C3':[(427,520),(433.2,526),(445,537),(457,549),(460,553),(461.4,557.5),(460.3,562.4),(456.6,567),(451,570.2),(442,574.7)],
 'D':[(441.5,502.5),(450.2,493.5)],
 'E':[(379.2,445.7),(379.8,441.5),(383.1,438.3),(387.7,434.6),(391.1,436.0)],
 'F':[(339.7,392.8),(341.9,398.5),(344.0,405.0)],
 'G':[(262.8,324.1),(266.5,324.9),(270.3,325.7)],
 'H':[(154.3,234.3),(159.8,228.9),(168.2,224.4)],
 'K':[(142.2,251.3),(145.8,249.9),(151.8,243.5)],
 'L':[(173.2,216.3),(172.7,210.1),(171.7,193.0),(169.9,182.5)],
 'M':[(173.2,216.3),(176.8,217.3),(178.2,212.7),(178.7,196.0),(181.3,190.0)],
 'N':[(431.9,470.3),(447.9,470.0),(469.8,468.9),(480.5,468.6)],
 'P':[(451.7,486.0),(461.0,485.0),(478.6,483.9),(486.0,480.4),(485.6,475.9),(480.5,468.6)]}

def sample(items):
    out=[]
    for item in items:
        if item[0] not in ('l','c'): continue
        pts=np.array([list(x) for x in item[1:]],dtype=float)
        length=sum(np.linalg.norm(b-a) for a,b in zip(pts,pts[1:]))
        for t in np.linspace(0,1,max(2,math.ceil(length/.75)+1)):
            q=(1-t)*pts[0]+t*pts[1] if item[0]=='l' else ((1-t)**3*pts[0]+3*(1-t)**2*t*pts[1]+3*(1-t)*t*t*pts[2]+t**3*pts[3])
            if not out or np.linalg.norm(q-out[-1])>.001:out.append(q)
    return out

def build(pdf):
    doc=fitz.open(pdf)
    assert len(doc)==1654, 'Expected 1654-page V2621 source'
    assert '10-9B' in doc[602].get_text() and 'OIMM' in doc[602].get_text()
    source_hash=hashlib.sha256(Path(pdf).read_bytes()).hexdigest()
    georefs=json.loads((ROOT/'app/src/main/assets/chart-georef.json').read_text())['charts']
    matrices={}
    for page in (601,603):
        ref=next(x for x in georefs if x['page']==page)
        ps=ref['points'];xy=np.array([[p['x'],p['y'],1] for p in ps]);ll=np.array([[p['lon'],p['lat']] for p in ps])
        matrices[page]=np.linalg.lstsq(xy,ll,rcond=None)[0]
    def geo(p,page):
        lon,lat=np.array([*p,1])@matrices[page]
        return {'lat':round(float(lat),9),'lon':round(float(lon),9)}
    graph={'schemaVersion':1,'airport':'OIMM','cycle':'2621','coordinateSystem':'WGS84',
      'verified':False,'simulatorTestOnly':True,'geometryMethod':'Jeppesen PDF vectors and reviewed ADC pavement-axis digitization',
      'source':{'provider':'Jeppesen','document':'2621(2).pdf','sha256':source_hash,'pages':[574,575,601,602,603,604],
                'charts':['10-1P','10-1P1','10-9','10-9A','10-9B','10-9S']},
      'nodes':{},'edges':[],'stands':{},'taxiways':{},'holdNodes':{},'procedures':[],
      'notes':['Parking positions use printed vector lead-in endpoints, not label centres.',
               'Published INS coordinates have 0.1 minute resolution and remain a separate field.',
               'L, M, N, P are military-only per 10-1P; shown but excluded from civilian automatic routing.',
               'Explicit BT13R J-to-H runway backtrack is a chart-derived simulator-only segment. It requires an explicit runway token and ATC clearance; no implicit runway crossing or construction-area shortcut.',
               'South apron stands require push-back before start-up per 10-1P1; extracted guidelines are geometric test paths, not a push-back clearance.',
               'Other aprons have no numbered stands in these supplied charts.']}
    def node(p,page):
        ll=geo(p,page);key=f"{ll['lat']:.9f},{ll['lon']:.9f}"
        if key not in ids:
            ids[key]='n'+str(len(ids));graph['nodes'][ids[key]]={**ll,'sourcePage':page,'pdfPoint':[round(float(x),4) for x in p]}
        return ids[key]
    ids={};segments=[];paths={}
    def edge(a,b,way,page,**extra):
        if a!=b:graph['edges'].append({'from':a,'to':b,'taxiway':way,'sourcePage':page,'bidirectional':extra.pop('bidirectional',True),**extra})
    def add_path(points,way,page,key=None,**extra):
        ns=[node(p,page) for p in points]
        for a,b,pa,pb in zip(ns,ns[1:],points,points[1:]):
            edge(a,b,way,page,**extra)
            if page==603:segments.append((np.array(pa),np.array(pb),a,b,key,way))
        if key is not None:paths[key]=(points,ns,way)
        return ns
    ds=doc[602].get_drawings()
    for i in PARKING_PATHS:
        points=sample(ds[i]['items'])
        if not points:continue
        way={39:'J',42:'Q',50:'A',409:'B'}.get(i,'APRON')
        add_path(points,way,603,i,allowStandAccess=True,geometry='pdf-vector',sourcePath=i)
    # Snap only touching vector-path endpoints, within the printed stroke scale.
    # Preserve the exact path and record each short join for audit.
    starts=np.array([s[0] for s in segments]);delta=np.array([s[1]-s[0] for s in segments]);den=np.sum(delta*delta,axis=1)
    joins=[]
    for key,(ps,ns,way) in paths.items():
        for p,n in [(ps[0],ns[0]),(ps[-1],ns[-1])]:
            u=np.clip(np.sum((p-starts)*delta,axis=1)/np.maximum(den,1e-12),0,1)
            qs=starts+u[:,None]*delta;distances=np.linalg.norm(qs-p,axis=1)
            distances=np.where(np.array([s[4]==key for s in segments]),np.inf,distances)
            ix=int(np.argmin(distances))
            if distances[ix]<=.85:
                q=qs[ix];qn=node(q,603);seg=segments[ix]
                edge(n,qn,'APRON',603,allowStandAccess=True,geometry='vector-endpoint-join',joinDistancePdfPoints=round(float(distances[ix]),4))
                edge(qn,seg[2],seg[5],603,allowStandAccess=True,geometry='pdf-vector')
                edge(qn,seg[3],seg[5],603,allowStandAccess=True,geometry='pdf-vector')
                joins.append(float(distances[ix]))
    # Complete detail-chart exits to the printed holding bars, before runways.
    for way,pathid,which,hold in [('J',39,-1,(187.44,67.74)),('Q',42,-1,(309,186.66)),('A',50,-1,(428.16,301.32)),('B',409,0,(523.3,390.6))]:
        start=paths[pathid][0][which];ns=add_path(sample([('l',start,hold)]),way,603,geometry='reviewed-printed-centerline')
        graph['taxiways'][way]={'exitNode':ns[-1],'sourcePage':603,'holdShortOf':'13R/31L'}
        graph['holdNodes'][ns[-1]]={'taxiway':way,'runway':'13R/31L','hotspot':'HS1','sourcePage':602}
    adc_nodes={}
    for way,points in ADC_AXES.items():
        ns=add_path(sample([('l',a,b) for a,b in zip(points,points[1:])]),way,601,geometry='reviewed-pavement-axis',military=way in ['L','M','N','P'])
        adc_nodes[way]=ns
        graph['taxiways'][way]={'nodes':[ns[0],ns[-1]],'sourcePage':601,'militaryOnly':way in ['L','M','N','P']}
        if way in ['C1','C2','F','G']:
            hold=ns[-1] if way.startswith('C') else ns[0]
            graph['holdNodes'][hold]={'taxiway':way,'runway':'13R/31L','hotspot':'HS1' if way.startswith('C') else 'HS2','sourcePage':602}
    # The ADC depicts J entering RWY 13R/31L and H linking its north-west
    # end toward RWY 13L/31R. This one-way simulator backtrack is reachable
    # ONLY when the clearance explicitly contains BT13R.
    j=graph['taxiways']['J']['exitNode'];h=adc_nodes['H'][0]
    jgeo=graph['nodes'][j]
    p_j=np.linalg.lstsq(matrices[601][:2,:],np.array([jgeo['lon'],jgeo['lat']])-matrices[601][2],rcond=None)[0]
    p_h=np.array(ADC_AXES['H'][0]);centre_offset=np.array([7.5,-7.5])
    # The J and H points are at the runway edge; the intermediate legs follow
    # the centre of the 13R pavement on 10-9, not its heavy printed edge.
    points=sample([('l',p_j,p_j+centre_offset),
                   ('l',p_j+centre_offset,p_h+centre_offset),
                   ('l',p_h+centre_offset,p_h)])
    bt=[j]+[node(p,601) for p in points[1:-1]]+[h]
    for a,b in zip(bt,bt[1:]):
        edge(a,b,'BT13R',601,bidirectional=False,runway=True,runwayUse='13R/31L',
             geometry='reviewed-ADC-runway-axis',requiresExplicitClearance=True)
    graph['runwayBacktracks']={'BT13R':{'fromTaxiway':'J','toTaxiway':'H','runway':'13R/31L',
        'direction':'north-west toward RWY 13R threshold','sourcePage':601,
        'requiresExplicitClearance':True,'simulatorTestOnly':True}}
    ins={str(i):{'lat':36+lat/60,'lon':59+lon/60,'published':f'N36 {lat:.1f} E059 {lon:.1f}','resolutionMinutes':.1} for group,lat,lon in INS_GROUPS for i in group}
    labels={w[4]:list(w[:4]) for w in doc[602].get_text('words') if w[4].isdigit() and 100<int(w[4])<140 and w[3]<456}
    for stand,pathid in {**ODD_PATHS,**EVEN_PATHS}.items():
        p=paths[pathid][0][0];n=paths[pathid][1][0]
        graph['stands'][str(stand)]={'node':n,**geo(p,603),'sourcePage':603,'sourcePath':pathid,
          'pdfPoint':[round(float(x),4) for x in p],'labelBounds':labels[str(stand)],'publishedINS':ins[str(stand)],
          'positionMethod':'printed parking-guideline endpoint','surveyed':False,
          'pushbackRequired':stand%2==1,'apron':'MAIN'}
    assert len(graph['stands'])==34 and set(graph['taxiways'])==set(NAMES)
    assert set(labels)==set(graph['stands'])
    graph['labelInventory']={}
    for w in doc[600].get_text('words'):
        if w[4] in NAMES:
            graph['labelInventory'][w[4]]={'sourcePage':601,'labelBounds':list(w[:4]),'labelCentre':geo(((w[0]+w[2])/2,(w[1]+w[3])/2),601)}
    graph['validation']={'standLabelsMatched':34,'taxiwayLabelsMatched':18,'maximumVectorJoinPdfPoints':round(max(joins),4),
       'standPositionAccuracy':'Graphic-derived. INS table is rounded to 0.1 minute; no metre-accuracy claim.',
       'reviewedLayoutPages':[601,603],'reviewedSupportingPages':[574,575,602,604],'flightTestPassed':False}
    return graph

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('pdf');ap.add_argument('--output',default=str(ROOT/'web/data/taxi-networks/OIMM.json'));a=ap.parse_args()
    graph=build(a.pdf);target=Path(a.output);target.parent.mkdir(parents=True,exist_ok=True);target.write_text(json.dumps(graph,ensure_ascii=False,separators=(',',':'))+'\n')
    print(json.dumps({'output':str(target),'nodes':len(graph['nodes']),'edges':len(graph['edges']),'stands':len(graph['stands']),'taxiways':len(graph['taxiways'])}))
