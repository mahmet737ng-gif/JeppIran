#!/usr/bin/env python3
"""Georegister only independently identified, published WGS84 control features.

Input page measurements MUST identify exact graphical feature positions in the
PDF, not text centres, rough map reading, ARP substitution, pixel interpolation
or assumed scale.  Missing points stay missing. NOT TO SCALE is neither proof
of validity nor an automatic reason to drop a verified local plan.
"""
import argparse
import hashlib
import json
import math
from pathlib import Path

import fitz
import numpy as np

from validate_official_controls import validate
from extract_chart_georef import page_fingerprint, chart_key


def hull(points):
    """Convex hull of the *measured* feature pixels; no extrapolation."""
    p = sorted(set((float(x), float(y)) for x, y in points))
    if len(p) < 3:
        raise ValueError("Cannot construct verified geometric footprint")
    def cross(a, b, c):
        return (b[0] - a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0])
    lower = []
    for x in p:
        while len(lower) >= 2 and cross(lower[-2], lower[-1], x) <= 0:
            lower.pop()
        lower.append(x)
    upper = []
    for x in reversed(p):
        while len(upper) >= 2 and cross(upper[-2], upper[-1], x) <= 0:
            upper.pop()
        upper.append(x)
    polygon = lower[:-1] + upper[:-1]
    area = abs(sum(polygon[i][0]*polygon[(i+1)%len(polygon)][1] -
                   polygon[(i+1)%len(polygon)][0]*polygon[i][1]
                   for i in range(len(polygon))) / 2)
    if area < 100:
        raise ValueError("Independent point geometry is nearly collinear")
    return polygon


def register(page, index_entry, match, published, *, max_ground_error_m=10.0):
    if index_entry['airport'] != match.get('airport'):
        raise ValueError("Chart ICAO identity mismatch")
    if index_entry.get('category') not in ('Airport', 'Approach'):
        raise ValueError("Exact-control registration only supports Airport/Approach")
    if match.get('chartKey') != chart_key(index_entry):
        raise ValueError("Chart identity mismatch")
    if match.get('sourceFingerprint') != page_fingerprint(page):
        raise ValueError("Source page fingerprint mismatch")
    width, height = float(page.rect.width), float(page.rect.height)
    if match.get('coordinateSpace') != 'pdf_points' or match.get('origin') != 'top_left':
        raise ValueError("Pixel measurements must use actual source PDF points")
    bounds = match.get('bounds', {})
    if not (0 <= bounds['left'] < bounds['right'] <= width and
            0 <= bounds['top'] < bounds['bottom'] <= height):
        raise ValueError("Unverified plan-view bounds")
    entries = match.get('controlPoints', [])
    if len(entries) < 4:
        raise ValueError("Need at least four distinct published control points")
    seen = set()
    points = []
    for entry in entries:
        feature_key = (index_entry['airport'], entry.get('featureType'), entry.get('featureId'))
        if feature_key in seen:
            raise ValueError("Duplicate graphic/survey feature")
        seen.add(feature_key)
        source = published.get(feature_key)
        if not source:
            raise ValueError("No published exact WGS84 coordinate for " + str(feature_key))
        if not source['precisionEligibleForGroundMap']:
            raise ValueError("Published coordinate too coarse for exact ground map " + str(feature_key))
        # The source chart graphic symbol, not the geographic label or
        # nearby runway name, must be measured and explicitly peer-reviewed.
        if entry.get('pixelMethod') != 'verified_actual_feature_symbol' or not entry.get('pixelVerifiedBy'):
            raise ValueError("Feature pixel centre not independently inspected: " + str(feature_key))
        x, y = float(entry['x']), float(entry['y'])
        if not all(math.isfinite(v) for v in (x, y)):
            raise ValueError("Non-finite PDF geometry")
        if not (bounds['left'] <= x <= bounds['right'] and
                bounds['top'] <= y <= bounds['bottom']):
            raise ValueError("GCP outside explicitly recorded plan area")
        points.append({'lat': source['latitudeDecimal'], 'lon': source['longitudeDecimal'],
                       'x': x, 'y': y, 'source': source['sourceDocument'] +
                       ' / ' + source['sourceLocation'],
                       'featureId': entry['featureId'], 'featureType': entry['featureType']})
    polygon = hull([(p['x'], p['y']) for p in points])
    geo = np.array([[p['lon'], p['lat']] for p in points])
    xy = np.array([[p['x'], p['y']] for p in points])
    # Affine alignment is based on independently *measured* pixel positions,
    # never an invented grid line or a fictional geographic coordinate.
    mean = geo.mean(axis=0)
    A = np.column_stack((geo - mean, np.ones(len(points))))
    coefficients, _, rank, _ = np.linalg.lstsq(A, xy, rcond=None)
    if rank < 3:
        raise ValueError("Insufficient non-collinear ground control geometry")
    east, north = coefficients[0], coefficients[1]
    if east[0]*north[1] - east[1]*north[0] >= 0:
        raise ValueError("Mirrored geographic orientation")
    page_residual = float(np.max(np.linalg.norm(A@coefficients - xy, axis=1)))
    if page_residual > .75:
        raise ValueError("Feature graphic positions cannot be fit consistently")
    # Truly independent leave-one-out checks: each anchor must be projected
    # by an affine fit that has NOT seen the anchor under test.
    holdouts_m = []
    for i in range(len(points)):
        keep = [j for j in range(len(points)) if j != i]
        if np.linalg.matrix_rank(A[keep]) < 3:
            raise ValueError("Cannot independently check a control point")
        fit = np.linalg.lstsq(A[keep], xy[keep], rcond=None)[0]
        predicted = A[i] @ fit
        # Page error measured in PDF points; rejecting discordant
        # geometry avoids pretending a schematic is georeferenced.
        if float(np.linalg.norm(predicted - xy[i])) > 2.0:
            raise ValueError("Leave-one-out pixel check failed")
        # Convert inverse-model geographic difference to local metres.
        backward = np.linalg.lstsq(np.column_stack((
            xy[keep]-xy[keep].mean(axis=0), np.ones(len(keep)))),
            geo[keep]-geo[keep].mean(axis=0), rcond=None)[0]
        xdelta = np.array([*(xy[i]-xy[keep].mean(axis=0)), 1.0])
        projected_geo = geo[keep].mean(axis=0) + xdelta @ backward
        lon_err, lat_err = projected_geo - geo[i]
        dist = 111132.0 * math.hypot(lat_err, lon_err*math.cos(math.radians(geo[i][1])))
        holdouts_m.append(float(dist))
        if not math.isfinite(dist) or dist > max_ground_error_m:
            raise ValueError("Independent geodetic feature check failed")
    return {
        'page': int(index_entry['page']), 'airport': index_entry['airport'],
        'name': index_entry.get('name', ''), 'chartKey': chart_key(index_entry),
        'sourceFingerprint': match['sourceFingerprint'],
        'coordinateSpace': 'pdf_points', 'origin': 'top_left',
        'width': width, 'height': height, 'bounds': bounds,
        'excludedBounds': match.get('excludedBounds', []),
        'verifiedFootprint': [{'x': x, 'y': y} for x, y in polygon],
        'points': points, 'maxResidualPdfPoints': .75,
        'validation': {
            'method': 'published_wgs84_control_points_affine',
            'groundControlCount': len(points), 'sourceType': 'official_aip',
            'verificationStatus': 'passed_independent_control_checks',
            'maxIndependentCheckMetres': round(max(holdouts_m), 3),
            'maxPdfResidual': round(page_residual, 5),
            'pixelMeasurementsReviewed': True,
        }
    }


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--pdf', required=True)
    parser.add_argument('--index', required=True)
    parser.add_argument('--published-controls', required=True)
    parser.add_argument('--measured-features', required=True)
    parser.add_argument('--output', required=True)
    parser.add_argument('--report', required=True)
    args = parser.parse_args()
    document = fitz.open(args.pdf)
    index = json.loads(Path(args.index).read_text(encoding='utf-8'))
    if isinstance(index, dict):
        index = index['charts']
    indexed = {int(c['page']): c for c in index}
    published_root = json.loads(Path(args.published_controls).read_text(encoding='utf-8'))
    published = { (p['airport'], p['featureType'], p['featureId']): p
                 for p in validate(published_root) }
    measured_root = json.loads(Path(args.measured_features).read_text(encoding='utf-8'))
    digest = hashlib.sha256(Path(args.pdf).read_bytes()).hexdigest()
    if measured_root.get('sourcePdfSha256') != digest:
        raise ValueError("Measurement source PDF SHA does not match")
    accepted, rejected = [], []
    for item in measured_root.get('charts', []):
        number = int(item['page'])
        try:
            if number not in indexed or number > len(document):
                raise ValueError("No matching indexed PDF page")
            accepted.append(register(document[number-1], indexed[number], item, published))
        except (ValueError, TypeError, KeyError, np.linalg.LinAlgError) as error:
            rejected.append({'page': number, 'airport': item.get('airport'),
                             'reason': str(error)})
    root = {
        'version': 2, 'coordinateSystem': 'WGS84', 'coordinateSpace': 'pdf_points',
        'origin': 'top_left',
        'source': {'file': Path(args.pdf).name, 'sha256': digest,
                   'chartDataVersion': measured_root['chartDataVersion'],
                   'cycle': measured_root['cycle'], 'pageCount': len(document)},
        'charts': accepted
    }
    Path(args.output).write_text(json.dumps(root, indent=2)+"\n", encoding='utf-8')
    report = {'accepted': len(accepted), 'rejected': rejected,
              'unmeasuredPagesAreUngeoreferenced': True,
              'noGuessedCoordinates': True}
    Path(args.report).write_text(json.dumps(report, indent=2)+"\n", encoding='utf-8')
    print(json.dumps(report, indent=2))


if __name__ == '__main__':
    main()
