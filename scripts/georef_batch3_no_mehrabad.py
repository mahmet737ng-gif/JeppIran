#!/usr/bin/env python3
"""Reproduce per-page chart geo QA for the 31 visually screened non-OIII pages.

Diagnosis mode reads source only. The audit runs on GitHub Actions against
the pinned LFS PDF and NEVER mutates the production chart georeference JSON.
"""
import json, sys, traceback, math
from pathlib import Path
import fitz
sys.path.insert(0, 'scripts')
from extract_chart_georef import (extract, grid_axes, page_fingerprint, decimal_grid,
    segments, chart_key, check_projection)
from flexible_graticule import match_unframed_axes

PIN = 'd86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6'

def main():
    import hashlib
    pdf=Path('Iran2621.pdf')
    assert pdf.exists() and hashlib.sha256(pdf.read_bytes()).hexdigest()==PIN
    doc=fitz.open(pdf)
    rows={int(x['page']):x for x in json.loads(Path('web/data/charts-current.json').read_text())}
    rev=json.loads(Path('docs/georeferencing/V2621_AIRPORTS_21_30_VISUAL_REVIEW.json').read_text())
    targets=[x for x in rev['pages'] if x['mainPlanMayBeCalibrated'] and x['airport']!='OIII']
    assert len(targets)==31
    base=json.loads(Path('web/data/chart-georef.json').read_text())
    assert base['source']['sha256']==PIN
    prior={x['page']:x for x in base['charts']}
    assert not any(x['airport']=='OIII' for x in targets)
    anchors={}
    import re
    pat=re.compile(r"Lat/Long:\s*N(\d+)°\s*([\d.]+).*?E(\d+)°\s*([\d.]+)")
    for row in rows.values():
        if row['airport'] in anchors: continue
        m=pat.search(doc[int(row['page'])-1].get_text())
        if m:
            anchors[row['airport']]={'sourcePage':row['page'],'lat':int(m[1])+float(m[2])/60,
            'lon':int(m[3])+float(m[4])/60}
    results=[]
    for info in targets:
        n=info['page'];page=doc[n-1];airport=info['airport']
        anchor=anchors[airport]
        words=page.get_text('words')
        labels=[w for w in words if re.fullmatch(r'\d{2,3}-\d{2}(?:\.\d+)?',w[4])]
        out={'page':n,'airport':airport,'name':info['chartName'],
            'visualStatus':info['visualClassification'],'alreadyActive':n in prior,
            'sourceFingerprint':page_fingerprint(page),
            'anchor':anchor,'gridLabels':list(dict.fromkeys(w[4] for w in labels)),
            'labels':[{'value':w[4],'center':[(w[0]+w[2])/2,(w[1]+w[3])/2],
                'bounds':[round(float(x),2) for x in w[:4]]} for w in labels],
            'notToScaleTextBoxes':[[round(float(v),2) for v in x] for x in page.search_for('NOT TO SCALE')]}
        try:
            axes,lines,top,bottom=grid_axes(page,anchor)
            out['rawGridAxes']=axes
            out['rawGridBounds']={'left':top[0],'top':top[1],'right':top[2],'bottom':bottom[1]}
            out['lineCount']=len(lines)
        except (ValueError,AssertionError) as e:
            out['rawGridError']=str(e)
            out['lineCount']=len(segments(page))
        try:
            c=extract(page,n,rows[n],anchor,out['sourceFingerprint'])
            out['extracted']={'bounds':c['bounds'],'gridAxes':c['gridAxes'],
                'pointCount':len(c['points']),'maxResidual':c['validation']['gridMaxResidualPdfPoints'],
                'validation':c['validation'],'excludedBounds':c['excludedBounds']}
        except (ValueError,AssertionError) as e:
            out['extractError']=str(e)
        print(n,airport,('ACTIVE' if n in prior else '-'),out.get('extractError','EXTRACT OK'),
              out.get('rawGridError','GRID OK'),flush=True)
        results.append(out)
    Path('/tmp/batch3-non-oIII-diagnostics.json').write_text(json.dumps(results,ensure_ascii=False,indent=2))
    print('SOURCE-LOCKED DIAGNOSTIC COMPLETE',len(results))
if __name__=='__main__': main()
