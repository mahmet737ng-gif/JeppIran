#!/usr/bin/env python3
"""Build an additive V2621 georeferencing update for NON-OIII airports only.

Source pages and visual decisions are locked to the source PDF fingerprint.
Only the geographic main view is mapped; NOT TO SCALE diagrams are excluded.
Never writes or modifies any Mehrabad reference, region, status or file.
"""
import hashlib, itertools, json, math, sys
from pathlib import Path
import fitz
import numpy as np
sys.path.insert(0,'scripts')
from extract_chart_georef import extract,grid_axes,page_fingerprint,chart_key

SOURCE_SHA='d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6'
REPORT='docs/georeferencing/V2621_AIRPORTS_21_30_VISUAL_REVIEW.json'
RELEASE_PATH='/tmp/v2621-non-oiii-approved-georef.json'
AUDIT_PATH='/tmp/v2621-non-oiii-geo-results.json'

# Pixel regions transcribed from the large V2621 source PDF (PDF points,
# NOT thumbnail pixels). They are conservative masks around the *entire*
# disconnected schematic, not merely the text characters.
# All coordinates source-locked to SOURCE_SHA and page_fingerprint.
NTS_MASKS={
 365: [(299,694,377,791),(390,37,452,137)],
 369: [(89,319,179,406)],
 379: [(86,538,163,629)],
 386: [(90,313,158,405),(462,315,544,404)],
 387: [(463,313,544,451),(90,372,316,489)],
 388: [(90,313,158,405),(462,315,544,404)],
 389: [(463,313,544,451),(90,372,316,489)],
 444: [(90,170,230,238)],
 446: [(89,170,237,282),(453,438,543,503)],
 448: [(91,677,237,791)],
 454: [(90,655,227,791)],
 455: [(90,655,227,791)],
 456: [(300,153,422,218)],
 457: [(300,153,422,218)],
 501: [(89,280,178,364)],
}
# Separately scaled diagram and approach-profile views must never inherit
# the main georeference. Source PDF positions are locked to cycle 2621.
EXTRA_MASKS={
 342: [(85,317,211.4,455)],
 387: [(91,390,333,490)],
 389: [(91,390,333,490)],
 446: [(231,171,421,284)],
}
PLAN_BOUNDS={
 342:(85.44,83.52,531.0,454.80),
 386:(90,168,532,505),
 387:(90,186,532,489),
 388:(90,168,532,505),
 389:(90,186,532,489),
 459:(85.44,54.24,531.0,672.84),
}
REVIEW_PAGES=[307,308,309,310,313,323,342,365,366,369,371,376,379,386,387,388,389,444,446,448,454,455,456,457,459,497,498,499,500,501,502]
ROTATED_SINGLETON={309,310,313,342,366,371,454,455}
GRID_SUBSET={459:{'longitude':['56-22','56-22.1','56-22.2']}}
NO_MORE_THAN=1.5

def rect(v):
 return {'left':float(v[0]),'top':float(v[1]),'right':float(v[2]),'bottom':float(v[3])}

def inside(pt,box):
 return box['left']<=pt['x']<=box['right'] and box['top']<=pt['y']<=box['bottom']

def source_vector_model(page,p,row,anchor,fp):
 axes,lines,top,bottom=grid_axes(page,anchor)
 if p==459:
  axes['longitude']=[c for c in axes['longitude'] if c['label'] in GRID_SUBSET[459]['longitude']]
 if min(map(len,axes.values()))==1:
  measured_name='latitude' if len(axes['latitude'])>=2 else 'longitude'
  derived_name='longitude' if measured_name=='latitude' else 'latitude'
  measured=sorted(axes[measured_name],key=lambda x:x['degrees'])
  singleton=axes[derived_name][0]
  scale=(measured[-1]['pdfPoint']-measured[0]['pdfPoint'])/(measured[-1]['degrees']-measured[0]['degrees'])
  if abs(scale)<10:raise ValueError('Measured geographic grid span too small')
  lat=singleton['degrees'] if derived_name=='latitude' else anchor['lat']
  coslat=math.cos(math.radians(lat))
  dscale=abs(scale)/coslat if derived_name=='latitude' else abs(scale)*coslat
  measured_sign=1 if scale>0 else -1
  # Correct for rotated sheet; (lon->Y,lat->X) orientation determinant
  # reverses the normal handedness of unrotated (lon->X,lat->Y).
  derived_sign=measured_sign if singleton['pixelAxis']!=measured[0]['pixelAxis'] and measured[0]['pixelAxis']=='y' else -measured_sign
  if measured[0]['pixelAxis']=='x' and singleton['pixelAxis']=='y':derived_sign=measured_sign
  assert singleton['pixelAxis']!=measured[0]['pixelAxis']
  candidates=[]
  for step in ((.5/60,.25/60) if p==342 else ((5/60,2/60,1/60,.5/60) if p in (387,389) else (10/60,5/60,2/60,1/60,.5/60,.25/60))):
   for direction in [-1,1]:
    q=singleton['pdfPoint']+direction*derived_sign*dscale*step
    if 12<=q<=(page.rect.width-12 if singleton['pixelAxis']=='x' else page.rect.height-12):
     candidates.append((step,direction,q))
   if candidates:break
  if not candidates:raise ValueError('Unable to derive an in-bounds physical orthogonal scale')
  # More conservative: select the geographically closer point to airport
  # anchor, which is independently copied from the current stable airport.
  candidates.sort(key=lambda r:(abs((singleton['degrees']+r[1]*r[0])-anchor['lat' if derived_name=='latitude' else 'lon']), abs(r[2]-singleton['pdfPoint'])))
  step,direction,pos=candidates[0]
  derived=dict(singleton)
  derived.update({'degrees':singleton['degrees']+direction*step,'pdfPoint':pos,
   'label':None,'labelBounds':None,'tickSegment':None,'derived':True,
   'derivation':'orthogonal_conformal_scale'})
  axes[derived_name]=sorted([singleton,derived],key=lambda x:x['degrees'])
  method='single_axis_plus_conformal_scale'
 else: method='paired_printed_graticule_vector_ticks'
 points=[{'lat':lat['degrees'],'lon':lon['degrees'],
   'x':lon['pdfPoint'] if lon['pixelAxis']=='x' else lat['pdfPoint'],
   'y':lon['pdfPoint'] if lon['pixelAxis']=='y' else lat['pdfPoint'],
   'source':f"Printed grid {lat['label']} / {lon['label']}" if lat.get('label') and lon.get('label') else 'Derived orthogonal conformal grid intersection'}
   for lat,lon in itertools.product(axes['latitude'],axes['longitude'])]
 return {'page':p,'airport':row['airport'],'name':row.get('name',''),
    'chartKey':chart_key(row),'sourceFingerprint':fp,
    'coordinateSpace':'pdf_points','origin':'top_left','width':float(page.rect.width),'height':float(page.rect.height),
    'bounds':{'left':0.0,'top':0.0,'right':float(page.rect.width),'bottom':float(page.rect.height)},
    'excludedBounds':[], 'points':points,'gridAxes':axes,'airportAnchor':anchor,
    'maxResidualPdfPoints':.75 if method=='single_axis_plus_conformal_scale' else 1.5,
    'validation':{'method':method,'measuredAxisValueCounts':{k:sum(not x.get('derived',False) for x in v) for k,v in axes.items()},
      'recovery':'physical-geographic-grid-handedness-corrected'}}

def evaluate(page,p,c,visual):
 if 'NOT TO SCALE' in page.get_text().upper() and p not in NTS_MASKS:
  raise ValueError('NOT TO SCALE without reviewed isolated crop')
 if p in NTS_MASKS and visual['visualClassification']!='scaled_main_with_not_to_scale_insets':
  raise ValueError('Source visual class changed')
 blocks=[rect(v) for v in NTS_MASKS.get(p,[])+EXTRA_MASKS.get(p,[])]
 for b in blocks:
  if b['left']<0 or b['top']<0 or b['right']>page.rect.width or b['bottom']>page.rect.height:
   raise ValueError('Unscaled crop outside original source page')
 for t in page.search_for('NOT TO SCALE'):
  if not any(fitz.Rect(b['left'],b['top'],b['right'],b['bottom']).contains(t) for b in blocks):
   raise ValueError('A printed NOT TO SCALE label was not covered by a region mask')
 if p in PLAN_BOUNDS:
  c['bounds']=rect(PLAN_BOUNDS[p])
  if p in [386,387,388,389]:
   # Source plan view is above the profile panels.
   assert c['bounds']['bottom']<550
 c['excludedBounds']=blocks
 # Cartesian grid intersections are modeled points (not all directly printed
 # as intersections). Discard those inside a non-geographic inset.
 c['points']=[pt for pt in c['points'] if not any(inside(pt,b) for b in blocks)]
 if len(c['points'])<4:raise ValueError('Inset masking left insufficient point intersections')
 if any(not (c['bounds']['left']-1<=pt['x']<=c['bounds']['right']+1 and
             c['bounds']['top']-1<=pt['y']<=c['bounds']['bottom']+1) for pt in c['points']):
  raise ValueError('Geographic grid intersection lies outside calibrated plan bounds')
 ll=np.array([[x['lon'],x['lat']] for x in c['points']],dtype=float)
 xy=np.array([[x['x'],x['y']] for x in c['points']],dtype=float)
 mean=ll.mean(axis=0)
 design=np.column_stack((ll-mean,np.ones(len(ll))))
 coef,_,rank,_=np.linalg.lstsq(design,xy,rcond=None)
 residual=float(np.max(np.linalg.norm(design@coef-xy,axis=1)))
 east,north=coef[0],coef[1]
 determinant=east[0]*north[1]-east[1]*north[0]
 angle=abs(np.dot(east,north))/(np.linalg.norm(east)*np.linalg.norm(north))
 scale_error=abs(np.linalg.norm(east)/np.linalg.norm(north)/math.cos(math.radians(mean[1]))-1)
 assert np.isfinite(residual)
 if rank!=3 or residual>c['maxResidualPdfPoints']+1e-6 or determinant>=0 or angle>.03:
  raise ValueError(f'Geography inconsistent residual={residual:.3f} det={determinant:.1f} angle={angle:.4f}')
 if c['validation']['method']=='single_axis_plus_conformal_scale' and scale_error>.03:
  raise ValueError(f'Nonconformal source grid {scale_error:.3f}')
 # All measured control labels and actual printed source vector ticks must
 # match, so a mistaken OCR or inferred label centre cannot be accepted.
 from extract_chart_georef import segments,decimal_grid
 segs=np.array(segments(page),dtype=float)
 words=page.get_text('words')
 for axis,controls in c['gridAxes'].items():
  for x in controls:
   if x.get('derived'):continue
   assert abs(decimal_grid(x['label'])-x['degrees'])<1e-7
   assert any(w[4]==x['label'] and max(abs(float(a)-float(b)) for a,b in zip(w[:4],x['labelBounds']))<.003 for w in words)
   assert np.min(np.max(np.abs(segs-np.array(x['tickSegment'])),axis=1))<.003
 c['validation'].update({'gridMaxResidualPdfPoints':round(residual,6),
    'controlPointCount':len(c['points']),'reviewDecision':'full_visual_source_page_grid_plus_schematic_inset_isolation',
    'notToScaleRegionsMasked':len(NTS_MASKS.get(p,[])),
    'qaTestOnly':True,'notApprovedForNavigation':True})
 return c

def main():
 pdf=Path('Iran2621.pdf')
 digest=hashlib.sha256(pdf.read_bytes()).hexdigest()
 assert digest==SOURCE_SHA and pdf.stat().st_size>1000000
 visual=json.loads(Path(REPORT).read_text())
 review={int(x['page']):x for x in visual['pages']}
 assert len(review)==53
 expect={p for p,v in review.items() if v['mainPlanMayBeCalibrated'] and v['airport']!='OIII'}
 assert expect==set(REVIEW_PAGES) and len(expect)==31
 base=json.loads(Path('web/data/chart-georef.json').read_text())
 assert base['source']['sha256']==SOURCE_SHA
 rows={int(r['page']):r for r in json.loads(Path('web/data/charts-current.json').read_text())}
 existing={int(x['page']):x for x in base['charts']}
 before_oiii={p:val for p,val in existing.items() if val['airport']=='OIII'}
 doc=fitz.open(pdf)
 assert len(doc)==1654
 approved=[];statuses=[]
 for p in sorted(expect):
  page=doc[p-1];row=rows[p];v=review[p];fp=page_fingerprint(page)
  assert row['airport']==v['airport'] and row['airport']!='OIII'
  if p in existing:
   statuses.append({'page':p,'status':'already_present_unchanged'})
   continue
  source_anchor=next((c.get('airportAnchor') for c in existing.values()
    if c['airport']==row['airport'] and c.get('airportAnchor')),None)
  if not source_anchor:
   statuses.append({'page':p,'status':'unresolved','reason':'No existing stable airport anchor'})
   continue
  try:
   if p in ROTATED_SINGLETON or p in (387,389,459):
    c=source_vector_model(page,p,row,source_anchor,fp)
   else:
    c=extract(page,p,row,source_anchor,fp)
   c=evaluate(page,p,c,v)
   assert c['airport']!='OIII'
   approved.append(c)
   statuses.append({'page':p,'status':'source_grid_validated','method':c['validation']['method'],
     'sourceControlCount':len(c['points']),'maskedRegionCount':len(c['excludedBounds']),
     'maxResidualPdfPoints':c['validation']['gridMaxResidualPdfPoints']})
  except (ValueError,KeyError,AssertionError,IndexError,TypeError) as exc:
   statuses.append({'page':p,'status':'needs_manual_survey','reason':str(exc)})
 assert len({c['page'] for c in approved})==len(approved)
 assert all(c['airport']!='OIII' for c in approved)
 assert {p:x for p,x in existing.items() if x['airport']=='OIII'}==before_oiii
 Path(RELEASE_PATH).write_text(json.dumps({'source':base['source'],'charts':approved},indent=2,ensure_ascii=False)+'\n')
 Path(AUDIT_PATH).write_text(json.dumps({'source_sha256':SOURCE_SHA,'requestedSourcePages':31,
 'excludedFullSheetNotToScalePages':20,'protectedOIIIPageCount':len(before_oiii),
 'proposedValidated':len(approved),'approvedPages':[c['page'] for c in approved],
 'notYetRecoverablePages':[x['page'] for x in statuses if x['status']=='needs_manual_survey'],
 'statuses':statuses},indent=2,ensure_ascii=False)+'\n')
 for item in statuses:print(item,flush=True)
 print('ADDITIVE NON-OIII SOURCE-GRID-PASSED:',[x['page'] for x in approved])
if __name__=='__main__':main()
