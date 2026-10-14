#!/usr/bin/env python3
"""V2621 Ilam ADC/RNAV/ILS source-checked, add-only simulator georeference release."""
import copy,hashlib,json,math
from pathlib import Path
import fitz
import numpy as np
from extract_chart_georef import page_fingerprint,chart_key,segments,decimal_grid

ROOT=Path(__file__).resolve().parents[1]
PDF=ROOT/'Iran2621.pdf'
ASSETS=[ROOT/'app/src/main/assets/chart-georef.json',ROOT/'web/data/chart-georef.json']
PROV=ROOT/'web/data/georef-provisional-v2621.json'
INDEX=ROOT/'web/data/charts-current.json'
MANIFEST=ROOT/'web/data/charts-manifest.json'
REPORT=ROOT/'docs/georeferencing/V2621_OICI_ADC_RNAV_ILS_FLIGHT_QA.json'
PAGES=(208,210,211,212,213,214)
EXPECTED='d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6'
CONTROL={
 'ALTET':(33.5358,47.0131,'FlightPlanDatabase G202 ALTET'),
 'ARP':(33+35.1/60,46+24.3/60,'Source Jeppesen OICI printed ARP rounded to 0.1 minute'),
 'ILM':(33+34/60+42.3/3600,46+24/60+55.4/3600,'Iran AIP ENR 4.1 ILM VOR/DME')}
ANCHOR={208:'ALTET',210:'ALTET',211:'ARP',212:'ILM',213:'ARP',214:'ILM'}
LABELS={208:('ALTET','CI4~3'),210:('ALTET','CI4~4','CI4~5','CI4~8','CI4~9','CI411'),
        211:('ARP','VOR','14','32'),212:('ILM','IILM'),213:('IILM','CI4~3'),214:('ILM','IILM')}

def source_sha(path):
 h=hashlib.sha256()
 with path.open('rb') as f:
  for b in iter(lambda:f.read(1048576),b''):h.update(b)
 return h.hexdigest()

def within(b,x,y,tol=0):
 return b['left']-tol<=x<=b['right']+tol and b['top']-tol<=y<=b['bottom']+tol

def fit(item):
 points=item['points']
 assert len(points)>=4
 a=np.array([[p['lon'],p['lat']] for p in points],dtype=float)
 xy=np.array([[p['x'],p['y']] for p in points],dtype=float)
 assert np.isfinite(a).all() and np.isfinite(xy).all()
 center=a.mean(axis=0)
 design=np.column_stack([a-center,np.ones(len(a))])
 coefficients,_,rank,_=np.linalg.lstsq(design,xy,rcond=None)
 assert rank==3,('non-collinear points',item['page'])
 orient=float(np.linalg.det(coefficients[:2,:2]))
 assert orient<0,('mirrored orientation',item['page'])
 residual=float(np.max(np.linalg.norm(design@coefficients-xy,axis=1)))
 assert residual<=item['maxResidualPdfPoints'] and residual<.76,('bad source residual',item['page'],residual)
 def project(lat,lon):
  p=np.array([lon-center[0],lat-center[1],1])@coefficients
  return float(p[0]),float(p[1])
 return project,residual,orient

def word_locations(words,token):
 return [((w[0]+w[2])/2,(w[1]+w[3])/2) for w in words if str(w[4]).upper()==token.upper()]

def source_axes(page,item):
 words=page.get_text('words')
 source_vectors=np.asarray(segments(page))
 measured={}
 for axis_name in ('latitude','longitude'):
  axis=item['gridAxes'][axis_name]
  assert len(axis)>=2 and len({x['degrees'] for x in axis})==len(axis)
  count=0
  for val in axis:
   if val.get('derived'):
    assert val['derivation']=='orthogonal_conformal_scale'
    continue
   label=val['label']
   assert abs(decimal_grid(label)-val['degrees'])<1e-9
   assert any(w[4]==label for w in words),(item['page'],'missing printed grid',label)
   if val.get('labelBounds') is not None:
    assert any(w[4]==label and max(abs(float(a)-float(b)) for a,b in zip(w[:4],val['labelBounds']))<.03 for w in words),(item['page'],'printed word location',label)
   if val.get('tickSegment') is not None:
    t=np.asarray(val['tickSegment'])
    assert source_vectors.size and float(np.min(np.max(np.abs(source_vectors-t),axis=1)))<.03,(item['page'],'PDF vector tick absent',label)
   count+=1
  measured[axis_name]=count
 assert measured==item['validation']['measuredAxisValueCounts'],(item['page'],'axis count')
 assert min(measured.values())>=2 or (item['validation']['method']=='single_axis_plus_conformal_scale' and min(measured.values())==1 and max(measured.values())>=2)
 return measured

def main():
 original_texts=[p.read_text(encoding='utf-8') for p in ASSETS]
 assert original_texts[0]==original_texts[1],'original Web/Android data mismatch'
 stable=json.loads(original_texts[0])
 provisional=json.loads(PROV.read_text(encoding='utf-8'))
 manifest=json.loads(MANIFEST.read_text(encoding='utf-8'))
 index={int(c['page']):c for c in json.loads(INDEX.read_text(encoding='utf-8'))}
 assert stable['source']['sha256']==provisional['source']['sha256']==manifest['source_sha256']==EXPECTED
 assert stable['source']['chartDataVersion']==provisional['source']['chartDataVersion']==manifest['version']=='V2621'
 assert stable['source']['pageCount']==provisional['source']['pageCount']==manifest['pages']==1654
 assert PDF.stat().st_size>1000000 and source_sha(PDF)==EXPECTED
 before={int(c['page']):c for c in stable['charts']}
 assert len(before)==len(stable['charts']),'duplicate old georef'
 candidates={int(c['page']):c for c in provisional['charts'] if int(c['page']) in PAGES}
 assert set(candidates)==set(PAGES)
 assert not set(PAGES)&set(before),'existing models must not be overwritten'
 assert {215,216}<=set(before),'protected OICI VOR A/B references missing'
 protected_oiii={n:c for n,c in before.items() if c['airport']=='OIII'}
 assert protected_oiii,'Mehrabad protected models absent'
 source=fitz.open(PDF)
 changed=original_texts[0]
 report=[]
 for number in PAGES:
  c=candidates[number];row=index[number];page=source[number-1]
  assert c['airport']==row['airport']=='OICI' and c['chartKey']==chart_key(row)
  assert c['sourceFingerprint']==page_fingerprint(page),(number,'source fingerprint mismatch')
  assert c['width']==page.rect.width and c['height']==page.rect.height
  assert c['validation']['qaTestOnly'] and c['validation']['notApprovedForNavigation']
  assert c['origin']=='top_left' and c['coordinateSpace']=='pdf_points'
  b=c['bounds']
  assert 0<=b['left']<b['right']<=c['width'] and 0<=b['top']<b['bottom']<=c['height']
  assert all(within(b,p['x'],p['y']) for p in c['points'])
  projection,residual,orientation=fit(c)
  axes=source_axes(page,c)
  words=page.get_text('words')
  text_source=page.get_text().upper()
  missing=[token for token in LABELS[number] if token.upper() not in text_source]
  assert not missing,(number,'named chart references not found',missing)
  nt=page.search_for('NOT TO SCALE')
  if nt:
   assert number in (212,214) and c.get('excludedBounds'),(number,'unscaled-area masking is missing')
   for m in c['excludedBounds']:
    assert within(b,m['left'],m['top']) and within(b,m['right'],m['bottom'])
    assert (m['right']-m['left'])*(m['bottom']-m['top']) <.20*(b['right']-b['left'])*(b['bottom']-b['top'])
   is_masked=[any(within(m,(r.x0+r.x1)/2,(r.y0+r.y1)/2,3) for m in c['excludedBounds']) for r in nt]
   print('NOT_TO_SCALE',number,'rects',[(tuple(round(v,1) for v in r)) for r in nt],'masked',is_masked,flush=True)
   assert all(is_masked),(number,'NOT TO SCALE text not fully inside measured inset exclusion')
  else:
   assert not c.get('excludedBounds')
  a_name=ANCHOR[number]
  lat,lon,description=CONTROL[a_name]
  x,y=projection(lat,lon)
  assert within(b,x,y),(number,'independent navaid/fix/ARP outside calibrated map',x,y)
  locations=word_locations(words,a_name)
  name_offset=min([math.hypot(x-u,y-v) for u,v in locations],default=None)
  metric={'pdfPage':number,'chartKey':c['chartKey'],
          'sourceGridResidualPdfPoints':round(residual,6),'sourceGridAxes':axes,
          'sourceGcpCount':len(c['points']),'orientation':round(orientation,3),
          'namedLandmark':a_name,'landmarkCoordinateSource':description,
          'landmarkProjectedPdf':[round(x,2),round(y,2)],
          'closestNamedLabelPdfPoints':round(name_offset,2) if name_offset is not None else None,
          'notToScaleRects':len(nt),'excludedBounds':c.get('excludedBounds',[])}
  report.append(metric)
  print('OICI_GEOREF_QA',json.dumps(metric),flush=True)
  c2=copy.deepcopy(c)
  c2['validation']['flightTestOnly']=True
  c2['validation']['ownerFlightTestPending']=True
  c2['validation']['independentNamedLandmarkChecked']=True
  marker='    {\n      "page": 215,'
  assert changed.count(marker)==1,(number,'stable sorted insertion point absent')
  insertion='\n'.join('    '+line for line in json.dumps(c2,ensure_ascii=False,indent=2).splitlines())
  changed=changed.replace(marker,insertion+',\n'+marker,1)
 after=json.loads(changed)
 final={int(c['page']):c for c in after['charts']}
 assert len(final)==len(after['charts'])==len(before)+len(PAGES)
 assert all(final[n]==rec for n,rec in before.items()),'protected existing georeference changed'
 assert set(PAGES)<=set(final)
 assert {n:c for n,c in final.items() if c['airport']=='OIII'}==protected_oiii
 assert final[215]==before[215] and final[216]==before[216]
 for p in ASSETS:p.write_text(changed,encoding='utf-8')
 assert ASSETS[0].read_bytes()==ASSETS[1].read_bytes()
 REPORT.write_text(json.dumps({'cycle':'V2621','pdfSha256':EXPECTED,
   'scope':'OICI Ilam ADC RNAV STAR RNAV SID ILS simulator flight test only',
   'pages':list(PAGES),'previousCount':len(before),'currentCount':len(final),
   'previousReferencesIdentical':True,'mehrabadUnmodified':True,'oiciVorApproaches215and216Preserved':True,
   'simulatorOnly':True,'notForActualNavigation':True,'ownerFlightTestPending':True,
   'sourceGcpAndIndependentLandmarkChecks':report},ensure_ascii=False,indent=2)+'\n')
 print('SUCCESS OICI V2621',list(PAGES),'active chart georeferences',len(final),flush=True)

if __name__=='__main__':
 main()
