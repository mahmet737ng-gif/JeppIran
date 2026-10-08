#!/usr/bin/env python3
"""Check delivered georeferences against the source PDF and index."""
import argparse
import hashlib
import itertools
import json
import math
from pathlib import Path

import fitz
import numpy as np

from extract_chart_georef import chart_key, decimal_grid, page_fingerprint, segments


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', default='Iran2620.pdf')
    parser.add_argument('--georef', default='app/src/main/assets/chart-georef.json')
    parser.add_argument('--audit', default='docs/georeferencing/georef-audit.json')
    parser.add_argument('--reviewed-pages', default='docs/georeferencing/reviewed-pages.json')
    parser.add_argument('--index', default='app/src/main/assets/charts-app-v18.json')
    parser.add_argument('--manifest', default='app/src/main/assets/charts-manifest.json')
    args = parser.parse_args()
    source = Path(args.pdf)
    root = json.loads(Path(args.georef).read_text())
    audit = json.loads(Path(args.audit).read_text())
    review = json.loads(Path(args.reviewed_pages).read_text())
    index = {p['page']: p for p in json.loads(Path(args.index).read_text())}
    manifest = json.loads(Path(args.manifest).read_text())
    document = fitz.open(source)
    assert root['version'] == 2 and root['origin'] == 'top_left'
    assert root['coordinateSystem'] == 'WGS84' and root['coordinateSpace'] == 'pdf_points'
    assert root['source']['sha256'] == hashlib.sha256(source.read_bytes()).hexdigest()
    assert root['source']['chartDataVersion'] == manifest['version']
    assert root['source']['pageCount'] == len(document)
    assert audit['source'] == root['source'] and audit['processedPages'] == len(index)
    assert review['sourceSha256'] == root['source']['sha256']
    assert set(review['pages']) <= {chart['page'] for chart in root['charts']}
    assert len(audit['airports']) == len({p['airport'] for p in index.values()})

    pages = [chart['page'] for chart in root['charts']]
    assert len(pages) == len(set(pages))
    exclusions = [entry['page'] for entry in audit['excludedCharts']]
    assert set(pages).isdisjoint(exclusions)
    assert len(exclusions) == len(set(exclusions))
    assert set(pages) | set(exclusions) == set(index)
    assert {c['airport'] for c in root['charts']} == {c['airport'] for c in index.values()}
    assert 32 not in pages  # EGVAX 1B is explicitly NOT TO SCALE.

    maximum_residual = 0.0
    for chart in root['charts']:
        page = document[chart['page'] - 1]
        assert chart['airport'] == index[chart['page']]['airport']
        assert chart['chartKey'] == chart_key(index[chart['page']])
        assert chart['sourceFingerprint'] == page_fingerprint(page)
        has_not_to_scale = 'NOT TO SCALE' in page.get_text()
        assert chart['validation']['notToScaleTextPresentElsewhereOnPage'] == has_not_to_scale
        if has_not_to_scale:
            # Distinguish checked source geometry from independently confirmed
            # geographic accuracy. Provisional Approach/Airport records are
            # never counted as independently verified.
            provisional = chart['validation'].get('notToScaleOverrideApplied') is True
            if provisional:
                assert index[chart['page']]['category'] in {'Approach', 'Airport'}
                assert chart['validation'].get('verificationStatus') == 'provisional_geometry_only'
                assert chart['validation'].get('requiresIndependentFeatureCheck') is True
            else:
                assert chart['validation'].get('reviewDecision') == 'allow_measured_plan' or \
                    chart['validation'].get('reusedUnchangedSource') is True
        assert chart['width'] == page.rect.width and chart['height'] == page.rect.height
        assert chart['coordinateSpace'] == 'pdf_points' and chart['origin'] == 'top_left'
        assert len(chart['points']) >= 4
        words = page.get_text('words')
        paths = np.array(segments(page))
        bounds = chart['bounds']
        assert 0 <= bounds['left'] < bounds['right'] <= page.rect.width
        assert 0 <= bounds['top'] < bounds['bottom'] <= page.rect.height
        for area in chart['excludedBounds']:
            assert bounds['left'] <= area['left'] < area['right'] <= bounds['right']
            assert bounds['top'] <= area['top'] < area['bottom'] <= bounds['bottom']
        assert chart['validation']['visualReview'] == (chart['page'] in review['pages'])
        latitude_axis = chart['gridAxes']['latitude']
        longitude_axis = chart['gridAxes']['longitude']
        assert len(latitude_axis) >= 2 and len(longitude_axis) >= 2
        assert len({p['degrees'] for p in latitude_axis}) == len(latitude_axis)
        assert len({p['degrees'] for p in longitude_axis}) == len(longitude_axis)
        assert len({p['pixelAxis'] for p in latitude_axis}) == 1
        assert len({p['pixelAxis'] for p in longitude_axis}) == 1
        assert latitude_axis[0]['pixelAxis'] != longitude_axis[0]['pixelAxis']
        for axis in chart['gridAxes'].values():
            for control in axis:
                if control.get('derived'):
                    assert control['label'] is None and control['labelBounds'] is None
                    assert control['tickSegment'] is None
                    assert control['derivation'] == 'orthogonal_conformal_scale'
                    continue
                assert control['degrees'] == decimal_grid(control['label'])
                coordinate = 0 if control['pixelAxis'] == 'x' else 1
                assert abs(control['pdfPoint'] - control['tickSegment'][coordinate]) < .001
                assert abs(control['tickSegment'][coordinate] - control['tickSegment'][coordinate + 2]) < .03
                assert any(word[4] == control['label'] and
                           max(abs(float(x) - y) for x, y in zip(word[:4], control['labelBounds'])) < .001
                           for word in words), f"Source label missing on {chart['page']}"
                assert np.min(np.max(np.abs(paths - control['tickSegment']), axis=1)) < .001
        measured_counts = {axis: sum(not value.get('derived') for value in values)
                           for axis, values in chart['gridAxes'].items()}
        assert measured_counts == chart['validation']['measuredAxisValueCounts']
        if chart['validation']['method'] == 'single_axis_plus_conformal_scale':
            assert 1 in measured_counts.values() and max(measured_counts.values()) >= 2
        else:
            assert min(measured_counts.values()) >= 2

        measured = []
        for lat, lon in itertools.product(latitude_axis, longitude_axis):
            location = {lat['pixelAxis']: lat['pdfPoint'], lon['pixelAxis']: lon['pdfPoint']}
            measured.append((location['x'], location['y'], lat['degrees'], lon['degrees']))
        delivered = [(p['x'], p['y'], p['lat'], p['lon']) for p in chart['points']]
        assert len(delivered) == len(measured)
        assert np.max(np.abs(np.array(sorted(delivered)) - np.array(sorted(measured)))) < .001
        assert all(bounds['left'] <= p['x'] <= bounds['right'] and
                   bounds['top'] <= p['y'] <= bounds['bottom'] for p in chart['points'])

        lonlat = np.array([[p['lon'], p['lat']] for p in chart['points']])
        xy = np.array([[p['x'], p['y']] for p in chart['points']])
        assert np.isfinite(lonlat).all() and np.isfinite(xy).all()
        mean = lonlat.mean(axis=0)
        design = np.column_stack([lonlat - mean, np.ones(len(lonlat))])
        matrix, _, rank, _ = np.linalg.lstsq(design, xy, rcond=None)
        assert rank == 3
        residual = float(np.max(np.linalg.norm(design @ matrix - xy, axis=1)))
        residual_limit = (
            1.5
            if chart['validation']['method'] == 'paired_printed_graticule_vector_ticks'
            else .75
        )
        assert residual <= chart['maxResidualPdfPoints'] <= residual_limit
        assert abs(residual - chart['validation']['gridMaxResidualPdfPoints']) < .00001
        east_vector, north_vector = matrix[0], matrix[1]
        orientation_determinant = (
            east_vector[0] * north_vector[1] -
            east_vector[1] * north_vector[0]
        )
        assert orientation_determinant < 0, (
            f"Mirrored georeference on page {chart['page']}"
        )
        maximum_residual = max(maximum_residual, residual)
        for check in chart['validation'].get('independentChecks', []):
            actual = np.array([check['lon'] - mean[0], check['lat'] - mean[1], 1]) @ matrix
            assert np.linalg.norm(actual - [check['x'], check['y']]) <= check['tolerancePdfPoints']
        # Every row must report the same active and excluded pages as the asset.
        airport = next(a for a in audit['airports'] if a['icao'] == chart['airport'])
        assert chart['page'] in airport['calibratedPages']

    for airport in audit['airports']:
        assert airport['pageCount'] == sum(p['airport'] == airport['icao'] for p in index.values())
        assert set(airport['calibratedPages']) == {c['page'] for c in root['charts']
                                                  if c['airport'] == airport['icao']}
        assert set(airport['notToScalePages']) == {c['page'] for c in audit['excludedCharts']
                                                  if c['airport'] == airport['icao'] and c['status'] == 'not_to_scale'}
        assert set(airport['otherExcludedPages']) == {c['page'] for c in audit['excludedCharts']
                                                    if c['airport'] == airport['icao'] and c['status'] != 'not_to_scale'}

    print(json.dumps({'validatedCharts': len(pages), 'airports': len(audit['airports']),
                      'classifiedSourcePages': len(index),
                      'maximumGridResidualPdfPoints': round(maximum_residual, 6)}, indent=2))


if __name__ == '__main__':
    main()
