#!/usr/bin/env python3
"""Extract reviewed graticules from the actual PDF, never from text-label centres.

Requires PyMuPDF and NumPy. --reviewed-pages records supplementary visual QA.
Each page must pass vector tick pairing, residual and geographic scale checks. A NOT TO SCALE page is never promoted automatically.
Coordinates use PDF points, top-left origin, on the untrimmed source page.
"""
import argparse
import copy
import hashlib
import itertools
import json
import os
import re
import tempfile
from pathlib import Path

import fitz
import numpy as np

from flexible_graticule import match_unframed_axes

GRID = re.compile(r"(\d{2,3})-(\d{2}(?:\.\d+)?)$")


def chart_key(entry):
    """Stable identity across cycles; page numbers are intentionally absent."""
    clean = lambda value: re.sub(r'\s+', ' ', str(value or '').strip().upper())
    return '|'.join(clean(entry.get(key)) for key in
                    ('airport', 'category', 'chart_number', 'name'))


def page_fingerprint(page):
    """Hash canonical visible geometry/text, independent of PDF object IDs."""
    words = [[round(float(value), 2) for value in word[:4]] + [word[4]]
             for word in page.get_text('words')]
    vectors = [[round(float(value), 2) for value in line] for line in segments(page)]
    payload = {'width': round(float(page.rect.width), 2),
               'height': round(float(page.rect.height), 2),
               'words': words, 'segments': sorted(vectors)}
    encoded = json.dumps(payload, ensure_ascii=False, separators=(',', ':'),
                         sort_keys=True).encode()
    return hashlib.sha256(encoded).hexdigest()


def atomic_json(path, data):
    """Publish complete JSON or leave the previous cycle untouched."""
    path.parent.mkdir(parents=True, exist_ok=True)
    handle, temporary = tempfile.mkstemp(prefix=f'.{path.name}.', suffix='.tmp', dir=path.parent)
    try:
        with os.fdopen(handle, 'w', encoding='utf-8') as stream:
            json.dump(data, stream, indent=2, ensure_ascii=False)
            stream.write('\n')
            stream.flush()
            os.fsync(stream.fileno())
        os.replace(temporary, path)
    finally:
        if os.path.exists(temporary):
            os.unlink(temporary)


def decimal_grid(label):
    match = GRID.fullmatch(label)
    if not match or float(match[2]) >= 60:
        raise ValueError(f"Invalid graticule: {label}")
    return int(match[1]) + float(match[2]) / 60


def segments(page):
    result = []
    for path in page.get_drawings():
        if 's' not in path['type']:
            # Some Jeppesen grids use filled narrow rectangles for ticks.
            for item in path['items']:
                if item[0] != 're':
                    continue
                r = item[1]
                if r.width <= 1 and 1.5 <= r.height <= 14:
                    x = (r.x0 + r.x1) / 2
                    result.append((x, r.y0, x, r.y1))
                elif r.height <= 1 and 1.5 <= r.width <= 14:
                    y = (r.y0 + r.y1) / 2
                    result.append((r.x0, y, r.x1, y))
            continue
        for item in path['items']:
            if item[0] == 'l':
                result.append(tuple(float(v) for v in (item[1].x, item[1].y, item[2].x, item[2].y)))
            elif item[0] == 're':
                r = item[1]
                result.extend([(r.x0, r.y0, r.x1, r.y0), (r.x1, r.y0, r.x1, r.y1),
                               (r.x1, r.y1, r.x0, r.y1), (r.x0, r.y1, r.x0, r.y0)])
    return result


def horizontal_borders(page, lines):
    # A full border may be split where an inset meets the main map.
    rows = {}
    for x1, y1, x2, y2 in lines:
        if abs(y1 - y2) < .03 and abs(x1 - x2) >= 35:
            rows.setdefault(round(y1, 3), []).append((min(x1, x2), max(x1, x2)))
    result = []
    for y, spans in rows.items():
        merged = []
        for left, right in sorted(spans):
            if merged and left <= merged[-1][1] + 6:
                merged[-1] = (merged[-1][0], max(merged[-1][1], right))
            else:
                merged.append((left, right))
        result.extend((round(left, 3), y, round(right, 3)) for left, right in merged
                      if right - left > page.rect.width * .52)
    return sorted(set(result))


def is_tick(line, axis, border):
    x1, y1, x2, y2 = line
    dx, dy = abs(x1 - x2), abs(y1 - y2)
    if axis == 'latitude':
        return dy < .03 and 1.5 <= dx <= 14 and min(abs(x1 - border), abs(x2 - border)) < .6
    return dx < .03 and 1.5 <= dy <= 14 and min(abs(y1 - border), abs(y2 - border)) < .6


def match_axes(page, lines, top, bottom, anchor, masks):
    left, top_y, right = top
    bottom_y = bottom[1]
    axes = {'latitude': [], 'longitude': []}
    # Grid labels and vector ticks must agree with a real rectangular map frame.
    # Geographic hemispheres in this source (the 36 indexed airports) are N/E.
    for word in page.get_text('words'):
        if not GRID.fullmatch(word[4]):
            continue
        value = decimal_grid(word[4])
        cx, cy = (word[0] + word[2]) / 2, (word[1] + word[3]) / 2
        if any(r['left'] <= cx <= r['right'] and r['top'] <= cy <= r['bottom'] for r in masks):
            continue
        choices = []
        lat_distance, lon_distance = abs(value - anchor['lat']), abs(value - anchor['lon'])
        axis = 'latitude' if lat_distance < lon_distance else 'longitude'
        ambiguous = abs(anchor['lat'] - anchor['lon']) < 1
        text_rotated = word[3] - word[1] > word[2] - word[0]
        if min(lat_distance, lon_distance) > 6:
            continue
        if top_y <= cy <= bottom_y:

            for border, opposite in [(left, right), (right, left)]:
                if abs(cx - border) > 33:
                    continue
                ticks = [l for l in lines if is_tick(l, 'latitude', border)
                         and abs(l[1] - cy) < 6]
                for tick in ticks:
                    # Same tick on opposite map edge rejects inset coordinates
                    # and the nautical-mile scale outside the plan-view frame.
                    paired = [l for l in lines if is_tick(l, 'latitude', opposite)
                              and abs(l[1] - tick[1]) < .4]
                    opposite_masked = any(r['left'] - .6 <= opposite <= r['right'] + .6 and
                                          r['top'] <= tick[1] <= r['bottom'] for r in masks)
                    # Some source charts intentionally omit the mirrored tick
                    # where procedure graphics or an inset interrupt the frame.
                    # A close label-to-tick match on the visible edge is still
                    # a direct measurement; pairing remains preferred below.
                    close_label_match = abs(cx - border) < 25 and abs(tick[1] - cy) < 4
                    if paired or opposite_masked or close_label_match:
                        side_axis = ('longitude' if text_rotated else 'latitude') if ambiguous else axis
                        pairing_penalty = 0 if paired or opposite_masked else .2
                        choices.append((side_axis, abs(tick[1] - cy) + pairing_penalty, tick, 'y'))
        if left <= cx <= right and value <= 180:
            for border in (top_y, bottom_y):
                if abs(cy - border) > 21:
                    continue
                for tick in lines:
                    if is_tick(tick, 'longitude', border) and abs(tick[0] - cx) < 4:
                        choices.append((('latitude' if text_rotated else 'longitude') if ambiguous else axis,
                                        abs(tick[0] - cx), tick, 'x'))
        if not choices:
            continue
        choices.sort(key=lambda x: x[1])
        axis, distance, tick, pixel_axis = choices[0]
        pixel = tick[1] if pixel_axis == 'y' else tick[0]
        # Reject equally near but conflicting tick assignments.
        if any(c[0] != axis or c[3] != pixel_axis or abs((c[2][1] if c[3] == 'y' else c[2][0]) - pixel) > .4
               for c in choices[1:] if abs(c[1] - distance) < .25):
            continue
        axes[axis].append({'label': word[4], 'degrees': value, 'pdfPoint': pixel, 'pixelAxis': pixel_axis,
                           'labelBounds': [round(v, 4) for v in word[:4]],
                           'tickSegment': [round(v, 4) for v in tick]})
    for axis in axes:
        orientation_counts = {key: sum(p['pixelAxis'] == key for p in axes[axis]) for key in ('x', 'y')}
        dominant = max(orientation_counts, key=orientation_counts.get)
        if orientation_counts[dominant] < 1 or orientation_counts['x'] == orientation_counts['y']:
            raise ValueError('Conflicting axis orientation')
        axes[axis] = [p for p in axes[axis] if p['pixelAxis'] == dominant]
        grouped = {}
        for point in axes[axis]:
            grouped.setdefault(point['degrees'], []).append(point)
        unique = []
        for points in grouped.values():
            if max(p['pdfPoint'] for p in points) - min(p['pdfPoint'] for p in points) > .6:
                raise ValueError('Duplicate graticule labels disagree')
            unique.append(points[0])
        axes[axis] = sorted(unique, key=lambda p: p['degrees'])
        if len(axes[axis]) < 1:
            raise ValueError('Need at least one unambiguous value for each geographic axis')
    if axes['latitude'][0]['pixelAxis'] == axes['longitude'][0]['pixelAxis']:
        raise ValueError('Latitude and longitude must span different bitmap axes')
    if max(len(axes['latitude']), len(axes['longitude'])) < 2:
        raise ValueError('Need two measured values on at least one geographic axis')
    return axes


def grid_axes(page, anchor):
    lines = segments(page)
    borders = horizontal_borders(page, lines)
    tick_lines = [l for l in lines if (abs(l[0] - l[2]) < .03 and 1.5 <= abs(l[1] - l[3]) <= 14)
                  or (abs(l[1] - l[3]) < .03 and 1.5 <= abs(l[0] - l[2]) <= 14)]
    candidates = []
    for top, bottom in itertools.combinations(borders, 2):
        if not (bottom[1] - top[1] > 100 and top[1] >= 15 and
                abs(top[0] - bottom[0]) < .6 and abs(top[2] - bottom[2]) < .6):
            continue
        try:
            bounds = {'left': top[0], 'top': top[1], 'right': top[2], 'bottom': bottom[1]}
            masks = inset_bounds(page, lines, bounds)
            axes = match_axes(page, tick_lines, top, bottom, anchor, masks)
        except ValueError:
            continue
        # The tight frame with the most actual graticule labels is the plan
        # view; this prevents including the profile or minima below the map.
        score = len(axes['latitude']) + len(axes['longitude'])
        candidates.append((score, -(bottom[1] - top[1]), axes, top, bottom))
    loose = None
    try:
        loose = match_unframed_axes(page, tick_lines, anchor, decimal_grid, GRID)
    except ValueError:
        pass
    candidates.sort(key=lambda x: x[:2], reverse=True)
    if loose is not None and (not candidates or
                              sum(map(len, loose.values())) > candidates[0][0]):
        axes = loose
        # The flexible matcher does not assume a closed frame.  Use the full
        # source page as a conservative clipping envelope; control-point and
        # transform checks remain identical to the framed path.
        top = (0.0, 0.0, float(page.rect.width))
        bottom = (0.0, float(page.rect.height), float(page.rect.width))
        return axes, lines, top, bottom
    if not candidates:
        raise ValueError('No measured latitude/longitude grid could be resolved')
    _, _, axes, top, bottom = candidates[0]
    return axes, lines, top, bottom



def inset_bounds(page, lines, bounds):
    """Mask closed inset maps with their own printed coordinate grids."""
    left, right = bounds['left'], bounds['right']
    top, bottom = bounds['top'], bounds['bottom']
    horizontal = sorted(set((round(min(x1, x2), 3), round(y1, 3), round(max(x1, x2), 3))
                            for x1, y1, x2, y2 in lines if abs(y1 - y2) < .03
                            and 50 <= abs(x1 - x2) <= (right - left) * .85))
    vertical = [(x1, min(y1, y2), max(y1, y2)) for x1, y1, x2, y2 in lines
                if abs(x1 - x2) < .03 and abs(y1 - y2) >= 35]
    labels = [w for w in page.get_text('words') if GRID.fullmatch(w[4])]
    found = []
    for a, b in itertools.combinations(horizontal, 2):
        x1, y1, x2 = a
        y2 = b[1]
        if (abs(x1 - b[0]) > .6 or abs(x2 - b[2]) > .6 or y2 - y1 < 35 or
                x1 < left - .6 or x2 > right + .6 or y1 < top - .6 or y2 > bottom + .6):
            continue
        if not all(any(abs(v[0] - x) < .6 and v[1] <= y1 + .6 and v[2] >= y2 - .6
                       for v in vertical) for x in (x1, x2)):
            continue
        if sum(x1 <= (w[0] + w[2]) / 2 <= x2 and y1 <= (w[1] + w[3]) / 2 <= y2
               for w in labels) >= 3:
            found.append({'left': x1, 'top': y1, 'right': x2, 'bottom': y2})
    return [{**r, 'left': max(left, r['left']), 'top': max(top, r['top']),
             'right': min(right, r['right']), 'bottom': min(bottom, r['bottom'])}
            for r in found if not any(other != r and other['left'] <= r['left'] and
            other['top'] <= r['top'] and other['right'] >= r['right'] and
            other['bottom'] >= r['bottom'] for other in found)]


def extract(page, number, index_entry, anchor, fingerprint=None):
    not_to_scale_text = "NOT TO SCALE" in page.get_text()
    axes, lines, top, bottom = grid_axes(page, anchor)
    bounds = {"left": top[0], "top": top[1], "right": top[2], "bottom": bottom[1]}
    measured_axis_counts = {axis: len(values) for axis, values in axes.items()}
    method = "paired_printed_graticule_vector_ticks"
    if 1 in measured_axis_counts.values():
        # Many approach plates print only one value on one side of the plan
        # view.  A second value is derived from the measured orthogonal scale
        # using the local conformal relationship dx/dlon = cos(lat)*dy/dlat.
        # The derived point is explicit in the output and is never presented
        # as another measured source tick.
        measured_name = 'latitude' if len(axes['latitude']) >= 2 else 'longitude'
        derived_name = 'longitude' if measured_name == 'latitude' else 'latitude'
        measured = axes[measured_name]
        singleton = axes[derived_name][0]
        delta_geo = abs(measured[-1]['degrees'] - measured[0]['degrees'])
        delta_pdf = abs(measured[-1]['pdfPoint'] - measured[0]['pdfPoint'])
        if delta_geo <= 0 or delta_pdf < 8:
            raise ValueError('Measured axis is too short for conformal scale derivation')
        latitude = singleton['degrees'] if derived_name == 'latitude' else anchor['lat']
        physical_ratio = np.cos(np.deg2rad(latitude))
        measured_scale = delta_pdf / delta_geo
        derived_scale = (measured_scale / physical_ratio if derived_name == 'latitude'
                         else measured_scale * physical_ratio)
        lower = bounds['left'] if singleton['pixelAxis'] == 'x' else bounds['top']
        upper = bounds['right'] if singleton['pixelAxis'] == 'x' else bounds['bottom']
        # Preserve geographic handedness. PDF y grows downward, so an
        # unmirrored chart transform from (east, north) into page (x, y)
        # must have a negative determinant. The measured orthogonal axis
        # establishes its positive page direction; the derived axis must
        # use the opposite page-direction sign.
        measured_by_degrees = sorted(measured, key=lambda item: item['degrees'])
        measured_geo_delta = (
            measured_by_degrees[-1]['degrees'] -
            measured_by_degrees[0]['degrees']
        )
        measured_pdf_delta = (
            measured_by_degrees[-1]['pdfPoint'] -
            measured_by_degrees[0]['pdfPoint']
        )
        if abs(measured_geo_delta) <= 1e-12 or abs(measured_pdf_delta) <= 1e-9:
            raise ValueError('Measured axis direction is indeterminate')

        measured_page_sign = (
            1 if measured_pdf_delta / measured_geo_delta > 0 else -1
        )
        derived_page_sign = -measured_page_sign

        candidate = None
        preferred_geo_directions = (
            (-1, 1) if derived_name == 'latitude' else (1, -1)
        )
        for wanted_step in (10 / 60, 5 / 60, 2 / 60, 1 / 60):
            step = min(delta_geo, wanted_step)
            for geo_direction in preferred_geo_directions:
                pixel_direction = geo_direction * derived_page_sign
                pixel = (
                    singleton['pdfPoint'] +
                    pixel_direction * derived_scale * step
                )
                if lower <= pixel <= upper:
                    candidate = (step, geo_direction, pixel)
                    break
            if candidate:
                break
        if not candidate:
            raise ValueError('Conformal scale derivation falls outside the plan view')
        step, geo_direction, candidate_pixel = candidate
        derived = dict(singleton)
        derived['degrees'] = singleton['degrees'] + geo_direction * step
        derived['pdfPoint'] = candidate_pixel
        derived['label'] = None
        derived['labelBounds'] = None
        derived['tickSegment'] = None
        derived['derived'] = True
        derived['derivation'] = 'orthogonal_conformal_scale'
        axes[derived_name] = sorted([singleton, derived], key=lambda item: item['degrees'])
        method = 'single_axis_plus_conformal_scale'
    points = [{"lat": lat["degrees"], "lon": lon["degrees"],
               "x": lon["pdfPoint"] if lon["pixelAxis"] == "x" else lat["pdfPoint"],
               "y": lon["pdfPoint"] if lon["pixelAxis"] == "y" else lat["pdfPoint"],
               "source": (f"Printed grid {lat['label']} / {lon['label']}"
                          if lat.get('label') and lon.get('label')
                          else 'Derived orthogonal conformal grid intersection')}
              for lat, lon in itertools.product(axes["latitude"], axes["longitude"])]
    for point in points:
        if not (bounds["left"] <= point["x"] <= bounds["right"] and
                bounds["top"] <= point["y"] <= bounds["bottom"]):
            raise ValueError("A control point lies outside the plan view")
    mean = np.mean([[p["lon"], p["lat"]] for p in points], axis=0)
    a = np.array([[p["lon"] - mean[0], p["lat"] - mean[1], 1] for p in points])
    xy = np.array([[p["x"], p["y"]] for p in points])
    coefficients, _, rank, _ = np.linalg.lstsq(a, xy, rcond=None)
    residual = float(np.max(np.linalg.norm(a @ coefficients - xy, axis=1)))
    east_vector, north_vector = coefficients[0], coefficients[1]
    physical_ratio = np.cos(np.deg2rad(mean[1]))
    orientation_determinant = (
        east_vector[0] * north_vector[1] -
        east_vector[1] * north_vector[0]
    )
    scale_error = abs(
        np.linalg.norm(east_vector) /
        np.linalg.norm(north_vector) /
        physical_ratio - 1
    )
    angle_error = abs(
        np.dot(east_vector, north_vector)
    ) / (np.linalg.norm(east_vector) * np.linalg.norm(north_vector))

    # When both latitude and longitude axes are directly measured from the
    # printed grid, the affine fit itself is authoritative. Some approach
    # plates intentionally use slightly different horizontal/vertical scales
    # to fit the procedure. Conformal scale is required only when we had to
    # derive one axis from the other.
    if (np.linalg.norm(north_vector) < 1 or
            angle_error > .03 or
            orientation_determinant >= 0 or
            (method == 'single_axis_plus_conformal_scale' and scale_error > .03)):
        raise ValueError(
            'Printed grid has an inconsistent scale, angle, or mirrored orientation'
        )
    # Fully measured latitude+longitude grids are stronger evidence than
    # a derived orthogonal axis. Allow a small amount of source-chart affine
    # distortion for measured grids while keeping inferred-axis records strict.
    residual_limit = (
        1.5
        if method == "paired_printed_graticule_vector_ticks"
        else .75
    )
    if rank != 3 or residual > residual_limit:
        raise ValueError(
            f"Invalid affine fit: rank {rank}, residual {residual:.3f}"
        )
    return {"page": number, "airport": index_entry["airport"], "name": index_entry.get("name", ""),
            "chartKey": chart_key(index_entry),
            "sourceFingerprint": fingerprint or page_fingerprint(page),
            "coordinateSpace": "pdf_points", "origin": "top_left",
            "width": page.rect.width, "height": page.rect.height,
            "bounds": bounds, "excludedBounds": inset_bounds(page, lines, bounds),
            "points": points, "gridAxes": axes, "airportAnchor": anchor,
            "maxResidualPdfPoints": residual_limit,
            "validation": {"gridMaxResidualPdfPoints": round(residual, 6),
                           "controlPointCount": len(points),
                           "method": method,
                           "measuredAxisValueCounts": measured_axis_counts,
                           "notToScaleTextPresentElsewhereOnPage": not_to_scale_text}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", default="Iran2620.pdf")
    parser.add_argument("--index", default="app/src/main/assets/charts-app-v18.json")
    parser.add_argument("--reviewed-pages", default="",
                        help="Subset of automatically extracted pages visually inspected")
    parser.add_argument("--pages", default="all", help="all, or comma-separated source page numbers")
    parser.add_argument("--output", default="app/src/main/assets/chart-georef.json")
    parser.add_argument("--audit", default="docs/georeferencing/georef-audit.json")
    parser.add_argument("--manifest", default="app/src/main/assets/charts-manifest.json")
    parser.add_argument("--data-version", default="", help="Override manifest version")
    parser.add_argument("--cycle", default="", help="Override manifest cycle")
    parser.add_argument("--previous-georef", default="",
                        help="Previous chart-georef.json; unchanged page fingerprints are safely reused")
    parser.add_argument("--review-decisions", default="",
                        help="JSON decisions keyed by sourceFingerprint for exceptional pages")
    parser.add_argument("--disable-independent-check", action="store_true")
    args = parser.parse_args()
    pdf_path = Path(args.pdf)
    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    doc = fitz.open(pdf_path)
    manifest = json.loads(Path(args.manifest).read_text())
    data_version = args.data_version or manifest['version']
    cycle = args.cycle or manifest['cycle']
    if manifest.get('pages') != len(doc):
        raise ValueError('Manifest page count does not match the source PDF')
    index = {c["page"]: c for c in json.loads(Path(args.index).read_text())}
    previous = {}
    if args.previous_georef:
        previous_root = json.loads(Path(args.previous_georef).read_text())
        for old in previous_root.get('charts', []):
            if old.get('chartKey') and old.get('sourceFingerprint'):
                previous[(old['chartKey'], old['sourceFingerprint'])] = old
    decisions = {}
    if args.review_decisions:
        decision_root = json.loads(Path(args.review_decisions).read_text())
        decisions = {item['sourceFingerprint']: item
                     for item in decision_root.get('decisions', [])}
    coordinate_pattern = re.compile(r"Lat/Long:\s*N(\d+)°\s*([\d.]+).*?E(\d+)°\s*([\d.]+)")
    anchors = {}
    for entry in index.values():
        if entry['airport'] in anchors:
            continue
        match = coordinate_pattern.search(doc[entry['page'] - 1].get_text())
        if match:
            anchors[entry['airport']] = {'sourcePage': entry['page'],
                                        'lat': int(match[1]) + float(match[2]) / 60,
                                        'lon': int(match[3]) + float(match[4]) / 60}
    if {entry['airport'] for entry in index.values()} != set(anchors):
        raise ValueError('Cannot resolve the printed N/E airport coordinates for every indexed airport')
    reviewed = {int(n) for n in args.reviewed_pages.split(',') if n}
    selected = sorted(index) if args.pages == 'all' else sorted({int(n) for n in args.pages.split(',')})
    charts, excluded = [], []
    reused_count = 0
    for number in selected:
        page = doc[number - 1]
        fingerprint = page_fingerprint(page)
        reuse = previous.get((chart_key(index[number]), fingerprint))
        if reuse and reuse.get('width') == page.rect.width and reuse.get('height') == page.rect.height:
            chart = copy.deepcopy(reuse)
            chart.update({'page': number, 'airport': index[number]['airport'],
                          'name': index[number].get('name', ''),
                          'chartKey': chart_key(index[number]),
                          'sourceFingerprint': fingerprint})
            chart.setdefault('validation', {})['reusedUnchangedSource'] = True
            charts.append(chart)
            reused_count += 1
            continue
        decision = decisions.get(fingerprint, {})
        not_to_scale = 'NOT TO SCALE' in page.get_text()
        if not any(GRID.fullmatch(w[4]) for w in page.get_text('words')):
            excluded.append({'page': number, 'airport': index[number]['airport'],
                             'reason': ('NOT TO SCALE printed on source page' if not_to_scale
                                        else 'No printed graticule labels'),
                             'status': 'not_to_scale' if not_to_scale else 'no_graticule'})
            continue
        try:
            chart = extract(page, number, index[number], anchors[index[number]['airport']], fingerprint)
            if not_to_scale and decision.get('action') != 'allow_measured_plan':
                excluded.append({'page': number, 'airport': index[number]['airport'],
                                 'sourceFingerprint': fingerprint,
                                 'reason': 'NOT TO SCALE page requires a fingerprint-bound review decision',
                                 'status': 'review_required_not_to_scale',
                                 'candidateMethod': chart['validation']['method']})
                continue
            chart['validation']['visualReview'] = number in reviewed
            if decision:
                chart['validation']['reviewDecision'] = decision.get('action')
            charts.append(chart)
        except ValueError as error:
            excluded.append({'page': number, 'airport': index[number]['airport'],
                             'reason': str(error), 'status': 'not_to_scale' if not_to_scale
                             else 'needs_additional_control_points_or_review'})
        if number % 100 == 0:
            print(f'Scanned {number}/{len(doc)} pages; {len(charts)} calibrated', flush=True)

    # Independent station check: printed on page 32; centre measured from the
    # AWZ VOR-DME symbol (not from its label) on page 42. Coarse coordinates on
    # the source are only specified to 0.1 arcminute.
    check = {"name": "AWZ VOR", "lat": 31 + 20.3 / 60, "lon": 48 + 45.9 / 60,
             "x": 261.48, "y": 295.56, "coordinateSourcePage": 32,
             "symbolSourcePage": 42, "tolerancePdfPoints": 1.6}
    chart42 = next((c for c in charts if c["page"] == 42), None)
    if chart42 and not args.disable_independent_check:
        check_projection(chart42, check)
        chart42["validation"]["independentChecks"] = [check]
    source = {"file": pdf_path.name, "sha256": digest, "pageCount": len(doc),
              "chartDataVersion": data_version, "cycle": cycle}
    root = {"version": 2, "coordinateSystem": "WGS84", "coordinateSpace": "pdf_points",
            "origin": "top_left", "source": source, "charts": charts}
    airports = []
    for airport in sorted({entry['airport'] for entry in index.values()}):
        available = [entry for entry in index.values() if entry['airport'] == airport]
        active = [entry for entry in charts if entry['airport'] == airport]
        failures = [entry for entry in excluded if entry['airport'] == airport]
        airports.append({'icao': airport, 'pageCount': len(available),
                         'calibratedPages': [entry['page'] for entry in active],
                         'notToScalePages': [entry['page'] for entry in failures if entry['status'] == 'not_to_scale'],
                         'otherExcludedPages': [entry['page'] for entry in failures if entry['status'] != 'not_to_scale']})
    audit = {'source': source, 'processedPages': len(selected), 'airportCount': len(airports),
             'reusedUnchangedPageCount': reused_count,
             'newlyExtractedPageCount': len(charts) - reused_count,
             'calibratedPageCount': len(charts), 'airports': airports, 'excludedCharts': excluded,
             'anchors': [{'page': 32, 'name': 'AWZ VOR', 'lat': check['lat'],
                          'lon': check['lon'], 'printed': 'N31 20.3 E048 45.9',
                          'usableForWholePageGeoreferencing': False}],
             'notes': ['EGVAX 1B is a SID on page 32 (10-3), not a STAR.',
                       'Only bounded graticules with mirrored side ticks and resolved axis orientation are automatically accepted.',
                       'Graticule points are intersections of the measured printed axes.',
                       'NOT TO SCALE pages are excluded, including mixed charts pending region review.',
                       'A small fitting residual is not a navigation accuracy certification.',
                       'Re-extract and review after replacing the PDF or chart index.']}
    for path, data in [(Path(args.output), root), (Path(args.audit), audit)]:
        atomic_json(path, data)
    print(json.dumps({'charts': len(charts), 'airports': len(airports),
                      'airportsWithoutCalibration': [a['icao'] for a in airports if not a['calibratedPages']],
                      'independentCheckPdfPoints': check.get('residualPdfPoints')}, indent=2))



def check_projection(chart, check):
    points = chart["points"]
    mean = np.mean([[p["lon"], p["lat"]] for p in points], axis=0)
    a = np.array([[p["lon"] - mean[0], p["lat"] - mean[1], 1] for p in points])
    xy = np.array([[p["x"], p["y"]] for p in points])
    coefficients = np.linalg.lstsq(a, xy, rcond=None)[0]
    x, y = np.array([check["lon"] - mean[0], check["lat"] - mean[1], 1]) @ coefficients
    error = float(np.linalg.norm([x - check["x"], y - check["y"]]))
    if error > check["tolerancePdfPoints"]:
        raise ValueError(f"Independent station check failed: {error:.3f} PDF points")
    check["projectedX"], check["projectedY"] = round(float(x), 6), round(float(y), 6)
    check["residualPdfPoints"] = round(error, 6)


if __name__ == "__main__":
    main()
