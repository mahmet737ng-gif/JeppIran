#!/usr/bin/env python3
"""Source-locked chart georef triage. DOES NOT alter installed references.
Specifically excludes and integrity-protects OIII/Mehrabad.
"""
import sys,json,hashlib,traceback
from pathlib import Path
import fitz
sys.path.insert(0,'scripts')
from extract_chart_georef import extract,grid_axes,page_fingerprint

PAGES=[307,308,309,310,313,323,342,365,366,369,371,376,379,386,387,388,389,444,446,448,454,455,456,457,459,497,498,499,500,501,502]
FULL_NTS=[337,338,339,340,341,350,351,352,353,471,472,473,474,475,476,477,510,511,512,513]
SOURCE_SHA='d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6'

def main():
 pdf=Path('Iran2621.pdf')
 assert hashlib.sha256(pdf.read_bytes()).hexdigest()==SOURCE_SHA
 rows={int(r['page']):r for r in json.loads(Path('web/data/charts-current.json').read_text())}
 base=json.loads(Path('web/data/chart-georef.json').read_text())
 existing={int(x['page']):x for x in base['charts']}
 visual=json.loads(Path('docs/georeferencing/V2621_AIRPORTS_21_30_VISUAL_REVIEW.json').read_text())
 reviewed={int(x['page']):x for x in visual['pages']}
 assert len(PAGES)==31 and len(set(PAGES))==31 and len(reviewed)==53
 assert all(rows[p]['airport']!='OIII' for p in PAGES)
 assert {p for p in reviewed if reviewed[p]['visualClassification']=='whole_sheet_not_to_scale'}==set(FULL_NTS)
 assert set(PAGES)=={p for p in reviewed if reviewed[p]['mainPlanMayBeCalibrated'] and reviewed[p]['airport']!='OIII'}
 doc=fitz.open(pdf)
 reports=[]
 for p in PAGES:
  row=rows[p];page=doc[p-1]
  fingerprint=page_fingerprint(page)
  out={'page':p,'airport':row['airport'],'chartName':row['name'],'fingerprint':fingerprint,
       'visualType':reviewed[p]['visualClassification'],'alreadyPresent':p in existing,
       'pageRect':list(page.rect),'notToScaleRects':[list(r) for r in page.search_for('NOT TO SCALE')]}
  # Explicit anchors are from same source dataset as the existing georeferencing;
  # selection is never by a different airport's approximate location.
  sample=next((x for x in existing.values() if x['airport']==row['airport']),None)
  anchor=sample.get('airportAnchor') if sample else None
  if not anchor:
   out['reason']='No source-verified airport anchor';reports.append(out);continue
  out['anchor']=anchor
  try:
   axes,lines,top,bottom=grid_axes(page,anchor)
   out['extractedAxes']=axes;out['mapFrame']={'top':top,'bottom':bottom}
  except Exception as e:out['axesError']=str(e)
  try:
   model=extract(page,p,row,anchor,fingerprint)
   out['model']={'method':model['validation']['method'],'residual':model['validation']['gridMaxResidualPdfPoints'],'pointCount':len(model['points']),
    'gridAxes':model['gridAxes'],'excludedBounds':model['excludedBounds'],
    'bounds':model['bounds'],'scale':model['validation']['method']}
  except Exception as e:out['modelError']=str(e)
  reports.append(out)
  print(p,row['airport'],out.get('modelError','CALIBRATABLE'),'NTS',len(out['notToScaleRects']),flush=True)
 Path('review-assets/v2621-other-airports-extraction').mkdir(exist_ok=True,parents=True)
 Path('review-assets/v2621-other-airports-extraction/triage.json').write_text(json.dumps(reports,indent=2,ensure_ascii=False)+'\n')
 print('CALIBRATABLE', [x['page'] for x in reports if 'model' in x])
if __name__=='__main__':main()
