#!/usr/bin/env python3
"""ADC vector candidates: raw source PDF strokes -> review queues, NEVER routes.
Run: python web/tools/adc_trace_candidates.py --raw PAGE430.json PAGE432.json --out OUTPUT
Supports both get_drawings JSON and JEPPIRAN scan_adc_vectors.py JSON.
No external dependencies. Coordinates are PDF page-local, NOT WGS84.
"""
import argparse,json,math
from collections import defaultdict
from pathlib import Path

def dist(a,b): return math.hypot(a[0]-b[0],a[1]-b[1])
def seg(op):
    if op[0]=='l':return op[1:3]
    if op[0]=='c':
        a,b,c,d=op[1:5];result=[]
        for i in range(13):
            t=i/12;u=1-t
            result.append([round(u**3*a[k]+3*u*u*t*b[k]+3*u*t*t*c[k]+t**3*d[k],4)
                           for k in (0,1)])
        return result
    return []
def extract(raw,min_len):
    page=int(raw.get('globalPage',raw.get('page',0)))
    drawing=raw.get('drawings',raw.get('sourceStrokes',[]))
    result=[]
    for item in drawing:
        if item.get('fill') is not None:continue
        ink=item.get('stroke')
        if ink is None or any(float(v)>.14 for v in ink):continue
        width=item.get('width') or 0
        if not .18<=width<=1.81:continue
        box=item.get('bbox',item.get('bounds'))
        if box is None or box[0]<40 or box[1]<46 or box[2]>580 or box[3]>758:continue
        id=item.get('id',item.get('pdfDrawingId'))
        paths=item.get('paths',item.get('commands',[]))
        chunks=[];current=[]
        for op in paths:
            pts=seg(op)
            if len(pts)<2:continue
            if current and dist(current[-1],pts[0])>.25:
                chunks.append(current);current=[]
            current.extend(pts if not current else pts[1:])
        if current:chunks.append(current)
        for j,pts in enumerate(chunks):
            length=sum(dist(pts[i-1],pts[i]) for i in range(1,len(pts)))
            if length<min_len:continue
            result.append({'id':f'P{page}_D{id}_S{j}',
               'page':page,'source':'SOURCE_PDF','sourceDrawingIds':[id],
               'kind':'UNCLASSIFIED_STROKE','label':None,'reviewed':False,
               'width':round(float(width),3),'lengthPt':round(length,2),'points':pts})
    return result
def touches(lines,tolerance=.6):
    # Grid-bucket near-endpoint candidate generation; NEVER assert a connection.
    entries=[]
    for p in lines:
        entries.extend([(p['id'],p['points'][0]),(p['id'],p['points'][-1])])
    bins=defaultdict(list);touch=defaultdict(set)
    for identity,pt in entries:
        cell=(int(math.floor(pt[0]/tolerance)),int(math.floor(pt[1]/tolerance)))
        for x in range(cell[0]-1,cell[0]+2):
            for y in range(cell[1]-1,cell[1]+2):
                for other,coords in bins.get((x,y),[]):
                    if identity==other or dist(pt,coords)>tolerance:continue
                    midpoint=(round((pt[0]+coords[0])/.5)/4,
                              round((pt[1]+coords[1])/.5)/4)
                    touch[midpoint].update([identity,other])
        bins[cell].append((identity,pt))
    page=lines[0]['page'] if lines else 0
    return [{'id':f'C{i+1}','page':page,'point':list(key),
             'touches':sorted(ids),'kind':'ENDPOINT_PROXIMITY_ONLY',
             'reviewed':False,'requiresVisualReview':True} for i,(key,ids) in enumerate(touch.items())]
def main():
    ap=argparse.ArgumentParser(description=__doc__)
    ap.add_argument('--raw',nargs='+',required=True)
    ap.add_argument('--out',required=True)
    ap.add_argument('--min-length',type=float,default=6.5)
    a=ap.parse_args();folder=Path(a.out);folder.mkdir(parents=True,exist_ok=True)
    report={'schemaVersion':2,'engine':'JEPPIRAN_ADC_WORKFLOW',
        'stage':'SOURCE_VECTOR_CANDIDATES_ONLY','routeable':False,
        'nextActions':['Review real centerlines vs text/terminal/artwork',
                       'Label taxiway segments by actual ADC names',
                       'Verify crossings and endpoint touch nodes',
                       'Trace individual stand-to-taxiway leads',
                       'Confirm runway axes, hold lines and gate connections',
                       'Register different chart pages with matched points',
                       'Run graph QA and only then authorize routing'],
        'pages':[]}
    for fp in a.raw:
        raw=json.loads(Path(fp).read_text())
        page=int(raw.get('globalPage',raw.get('page',0)))
        arr=extract(raw,a.min_length);near=touches(arr)
        output={'airport':raw.get('airport',raw.get('icao')),
            'cycle':raw.get('cycle'),'page':page,
            'sourceSha256':raw.get('sourceSha256',raw.get('sha256')),
            'coordinateSystem':'PDF_POINTS_TOP_LEFT','status':'UNREVIEWED',
            'traces':arr,'junctions':near}
        airport=raw.get('airport',raw.get('icao','UNKNOWN'))
        name=f'{airport}_page_{page}_line_candidates.json'
        (folder/name).write_text(json.dumps(output,separators=(',',':'))+'\n')
        report['pages'].append({'page':page,'sourceDrawings':len(raw.get('drawings',raw.get('sourceStrokes',[]))),
             'candidateLines':len(arr),'candidateTouches':len(near),
             'approvedEdges':0,'approvedContacts':0,'routable':False,'file':name})
        print(page,len(arr),'unreviewed centerline candidates;',len(near),'unreviewed contact candidates')
    (folder/'adc_pipeline_status.json').write_text(json.dumps(report,indent=2)+'\n')
if __name__=='__main__':main()
