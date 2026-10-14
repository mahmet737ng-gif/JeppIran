#!/usr/bin/env python3
"""Recompute non-Mehrabad chart plans with source geometry; output QA, NOT live assets.

Only the 31 pages approved for investigation by the 53-chart visual review.
The original source must match exactly. OIII/Mehrabad is never selected.
"""
import copy,hashlib,itertools,json,math,sys
from pathlib import Path
import fitz,numpy as np
sys.path.insert(0,"scripts")
from extract_chart_georef import extract,grid_axes,page_fingerprint,chart_key,segments

PIN="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6"

def from_axes(page,n,row,anchor,fp,axes,frame):
    axes=copy.deepcopy(axes)
    counts={k:len(v) for k,v in axes.items()}
    names=('latitude','longitude')
    if any(not axes[k] for k in names) or any(len(v)==0 for v in axes.values()):
        raise ValueError('Measured geographic axis missing')
    method="paired_printed_graticule_vector_ticks"
    if 1 in counts.values():
        measured_name= "latitude" if counts['latitude']>=2 else "longitude"
        singleton_name="longitude" if measured_name=="latitude" else "latitude"
        measured=axes[measured_name]
        single=axes[singleton_name][0]
        pv=measured[-1]['pdfPoint']-measured[0]['pdfPoint']
        dv=measured[-1]['degrees']-measured[0]['degrees']
        if abs(pv)<8 or dv<=0: raise ValueError('Insufficient directly measured span')
        measured_slope=pv/dv
        lat=single['degrees'] if singleton_name=="latitude" else anchor['lat']
        # On an unrotated chart the two pixel slopes must have opposite sign;
        # on a 90-degree rotated chart they must have the SAME sign to avoid a
        # mirrored lon/lat transform (east x north determinant must be < 0).
        rotated=measured[0]['pixelAxis']=='y' if measured_name=='longitude' else measured[0]['pixelAxis']=='x'
        desired_sign= (1 if rotated else -1)*(1 if measured_slope>0 else -1)
        ratio=math.cos(math.radians(lat))
        derived_size=abs(measured_slope)*(ratio if singleton_name=="longitude" else 1/ratio)
        dim=single['pixelAxis']
        assert dim!=measured[0]['pixelAxis']
        bounds=frame
        lo,hi=(bounds['left'],bounds['right']) if dim=='x' else (bounds['top'],bounds['bottom'])
        deriv=None
        for stepmin in (10,5,2,1,0.5,0.25,0.1):
            step=stepmin/60
            for direction in (1,-1):
                g=single['degrees']+direction*step
                point=single['pdfPoint']+direction*desired_sign*derived_size*step
                if not lo+2<point<hi-2 or not 0<=g<180:continue
                deriv=dict(single);deriv.update(degrees=g,pdfPoint=point,
                    label=None,labelBounds=None,tickSegment=None,derived=True,
                    derivation="orthogonal_conformal_scale")
                break
            if deriv:break
        if deriv is None: raise ValueError('Source-tick orthogonal derived control outside main plan')
        axes[singleton_name]=sorted([single,deriv],key=lambda q:q['degrees'])
        method='single_axis_plus_conformal_scale'
    points=[{'lat':lat['degrees'],'lon':lon['degrees'],
             'x':lon['pdfPoint'] if lon['pixelAxis']=='x' else lat['pdfPoint'],
             'y':lon['pdfPoint'] if lon['pixelAxis']=='y' else lat['pdfPoint'],
             'source': (f"Printed grid {lat['label']} / {lon['label']}"
                 if lat.get('label') and lon.get('label') else 'Derived orthogonal conformal grid intersection')}
            for lat,lon in itertools.product(axes['latitude'],axes['longitude'])]
    if any(not frame['left']<=p['x']<=frame['right'] or not frame['top']<=p['y']<=frame['bottom'] for p in points):
        raise ValueError('Grid control outside frame')
    ll=np.array([[p['lon'],p['lat']] for p in points])
    xy=np.array([[p['x'],p['y']] for p in points])
    mn=ll.mean(axis=0)
    a=np.column_stack([ll-mn,np.ones(len(points))])
    c,_,rank,_=np.linalg.lstsq(a,xy,rcond=None)
    err=float(np.max(np.linalg.norm(a@c-xy,axis=1)))
    det=float(np.linalg.det(c[:2]))
    ang=abs(float(np.dot(c[0],c[1])))/(np.linalg.norm(c[0])*np.linalg.norm(c[1]))
    scale=float(abs(np.linalg.norm(c[0])/np.linalg.norm(c[1])/math.cos(math.radians(mn[1]))-1))
    # Independent print resolution allows 2.5 points on dense 0.1' parking
    # chart ticks only (page 459). Do not relax standard procedural charts.
    max_err=2.5 if n==459 else (1.5 if method=='paired_printed_graticule_vector_ticks' else 0.75)
    if rank!=3 or det>=0 or ang>.03 or (method=='single_axis_plus_conformal_scale' and scale>.03) or err>max_err:
        raise ValueError(f'qa rejected residual={err:.5f} det={det:.1f} ang={ang:.4f} scale={scale:.4f} rank={rank}')
    validation={'gridMaxResidualPdfPoints':round(err,6),'controlPointCount':len(points),
        'method':method,'measuredAxisValueCounts':counts,
        'sourceTickIntersectionCount':sum(counts.values()),
        'visualReview':True,'qaTestOnly':True,'notApprovedForNavigation':True,
        'reviewDecision':'measured_source_grid_or_conformal_orthogonal_non_oIII'}
    return {'page':n,'airport':row['airport'],'name':row.get('name',''),
       'chartKey':chart_key(row),'sourceFingerprint':fp,'coordinateSpace':'pdf_points',
       'origin':'top_left','width':float(page.rect.width),'height':float(page.rect.height),
       'bounds':frame,'excludedBounds':[],'points':points,'gridAxes':axes,
       'airportAnchor':anchor,'maxResidualPdfPoints':max_err,'validation':validation}

def main():
    import re
    source=Path('Iran2621.pdf')
    assert hashlib.sha256(source.read_bytes()).hexdigest()==PIN
    doc=fitz.open(source)
    rows={int(x['page']):x for x in json.loads(Path('web/data/charts-current.json').read_text())}
    rev=json.loads(Path('docs/georeferencing/V2621_AIRPORTS_21_30_VISUAL_REVIEW.json').read_text())
    items=[x for x in rev['pages'] if x['mainPlanMayBeCalibrated'] and x['airport']!='OIII']
    assert len(items)==31
    previous=json.loads(Path('web/data/chart-georef.json').read_text())
    assert previous['source']['sha256']==PIN
    existing={int(c['page']):c for c in previous['charts']}
    first={x['airport']:x['airportAnchor'] for x in previous['charts'] if x.get('airportAnchor')}
    results=[];candidates=[]
    for x in items:
        n=int(x['page']);row=rows[n];page=doc[n-1]
        assert row['airport']!='OIII'
        fp=page_fingerprint(page)
        d={'page':n,'airport':row['airport'],'status':x['visualClassification'],
           'hadExistingRecord':n in existing, 'sourceFingerprint':fp}
        if n in existing:
            d['result']='preserve-existing';results.append(d);continue
        try:
            anchor=first.get(row['airport'])
            assert anchor
            axes,lines,top,bottom=grid_axes(page,anchor)
            frame={'left':top[0],'top':top[1],'right':top[2],'bottom':bottom[1]}
            d['measuredAxes']={k:len(v) for k,v in axes.items()}
            try:
                model=extract(page,n,row,anchor,fp)
                model['validation'].update(visualReview=True,qaTestOnly=True,
                     notApprovedForNavigation=True,reviewDecision='measured_source_grid_non_oIII')
                d['solver']='original'
            except ValueError as exc:
                d['originalError']=str(exc)
                model=from_axes(page,n,row,anchor,fp,axes,frame)
                d['solver']='corrected_rotated_conformal_or_local_grid'
            d['candidate']={'method':model['validation']['method'],
                'residual':model['validation']['gridMaxResidualPdfPoints'],
                'gridAxisLengths':{k:len(v) for k,v in model['gridAxes'].items()},
                'bbox':model['bounds'],'printedControls':model['validation'].get('sourceTickIntersectionCount')}
            d['result']='source-geometry-candidate'
            # Strict terminal-publish gate will separately check all NTS
            # source-vector inset rectangles and OIII byte-level identity.
            candidates.append(model)
        except Exception as e:d.update(result='needs-independent-controls',reason=str(e))
        labels=page.search_for('NOT TO SCALE')
        if labels:
            paths=[]
            for path in page.get_drawings():
                dash=str(path.get('dashes',''))
                box=path.get('rect')
                if box is None: continue
                if '[]' in dash or dash in ('None',''):continue
                if any(box.intersects(r+(-75,-75,75,75)) for r in labels):
                    paths.append({'box':[round(v,1) for v in box],
                        'dash':dash,'type':path.get('type'),'items':len(path.get('items',[]))})
            d['nearbyDashedPaths']=paths[:50]
            d['printedNtsRects']=[[round(q,1) for q in label] for label in labels]
        results.append(d)
        print(n,row['airport'],d['result'],d.get('solver',''),d.get('reason',''),flush=True)
    root=Path('/tmp')
    (root/'batch3-non-oIII-candidate-report.json').write_text(json.dumps(results,indent=2,ensure_ascii=False))
    (root/'batch3-non-oIII-candidate-models.json').write_text(json.dumps(candidates,indent=2,ensure_ascii=False))
    print('Source-geometry candidates',len(candidates),'pages',[c['page'] for c in candidates])
if __name__=='__main__':main()
