#!/usr/bin/env python3
"""Extract reviewed graticules from the actual PDF, never from text-label centres.

Requires PyMuPDF and NumPy. --reviewed-pages records supplementary visual QA.
Each page must pass vector tick pairing, residual and geographic scale checks. A NOT TO SCALE page is never promoted automatically.
Coordinates use PDF points, top-left origin, on the untrimmed source page.
"""
import argparse
import hashlib
import itertools
import json
import re
from pathlib import Path

import fitz
import numpy as np

GRID = re.compile(r"(\d{2,3})-(\d{2}(?:\.\d+)?)$")


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
                    if paired or opposite_masked:
                        side_axis = ('longitude' if text_rotated else 'latitude') if ambiguous else axis
                        choices.append((side_axis, abs(tick[1] - cy), tick, 'y'))
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
        if orientation_counts[dominant] < 2 or orientation_counts['x'] == orientation_counts['y']:
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
        if len(axes[axis]) < 2:
            raise ValueError('Need two distinct, unambiguous axes on a bounded map')
    if axes['latitude'][0]['pixelAxis'] == axes['longitude'][0]['pixelAxis']:
        raise ValueError('Latitude and longitude must span different bitmap axes')
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
    if not candidates:
        raise ValueError('No bounded map with two measured latitude and longitude ticks')
    candidates.sort(key=lambda x: x[:2], reverse=True)
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


def extract(page, number, index_entry, anchor):
    if "NOT TO SCALE" in page.get_text():
        raise ValueError("NOT TO SCALE: a geographic affine transform is not justified")
    axes, lines, top, bottom = grid_axes(page, anchor)
    bounds = {"left": top[0], "top": top[1], "right": top[2], "bottom": bottom[1]}
    points = [{"lat": lat["degrees"], "lon": lon["degrees"],
               "x": lon["pdfPoint"] if lon["pixelAxis"] == "x" else lat["pdfPoint"],
               "y": lon["pdfPoint"] if lon["pixelAxis"] == "y" else lat["pdfPoint"],
               "source": f"Printed grid {lat['label']} / {lon['label']}"}
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
    if (np.linalg.norm(north_vector) < 1 or
            abs(np.linalg.norm(east_vector) / np.linalg.norm(north_vector) / physical_ratio - 1) > .03 or
            abs(np.dot(east_vector, north_vector)) / (np.linalg.norm(east_vector) * np.linalg.norm(north_vector)) > .03):
        raise ValueError('Printed grid has an inconsistent geographic scale or axis angle')
    if rank != 3 or residual > .75:
        raise ValueError(f"Invalid affine fit: rank {rank}, residual {residual:.3f}")
    return {"page": number, "airport": index_entry["airport"], "name": index_entry.get("name", ""),
            "coordinateSpace": "pdf_points", "origin": "top_left",
            "width": page.rect.width, "height": page.rect.height,
            "bounds": bounds, "excludedBounds": inset_bounds(page, lines, bounds),
            "points": points, "gridAxes": axes, "airportAnchor": anchor,
            "maxResidualPdfPoints": .75,
            "validation": {"gridMaxResidualPdfPoints": round(residual, 6),
                           "controlPointCount": len(points),
                           "method": "paired_printed_graticule_vector_ticks"}}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", default="Iran2620.pdf")
    parser.add_argument("--index", default="app/src/main/assets/charts-app-v18.json")
    parser.add_argument("--reviewed-pages", default="",
                        help="Subset of automatically extracted pages visually inspected")
    parser.add_argument("--pages", default="all", help="all, or comma-separated source page numbers")
    parser.add_argument("--output", default="app/src/main/assets/chart-georef.json")
    parser.add_argument("--audit", default="docs/georeferencing/georef-audit.json")
    parser.add_argument("--data-version", default="v18")
    parser.add_argument("--cycle", default="2026-20")
    parser.add_argument("--disable-independent-check", action="store_true")
    args = parser.parse_args()
    pdf_path = Path(args.pdf)
    digest = hashlib.sha256(pdf_path.read_bytes()).hexdigest()
    doc = fitz.open(pdf_path)
    index = {c["page"]: c for c in json.loads(Path(args.index).read_text())}
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
    for number in selected:
        page = doc[number - 1]
        if 'NOT TO SCALE' in page.get_text():
            excluded.append({'page': number, 'airport': index[number]['airport'],
                             'reason': 'NOT TO SCALE printed on source page', 'status': 'not_to_scale'})
            continue
        if not any(GRID.fullmatch(w[4]) for w in page.get_text('words')):
            excluded.append({'page': number, 'airport': index[number]['airport'],
                             'reason': 'No printed graticule labels', 'status': 'no_graticule'})
            continue
        try:
            chart = extract(page, number, index[number], anchors[index[number]['airport']])
            chart['validation']['visualReview'] = number in reviewed
            charts.append(chart)
        except ValueError as error:
            excluded.append({'page': number, 'airport': index[number]['airport'],
                             'reason': str(error), 'status': 'not_to_scale' if 'NOT TO SCALE' in str(error)
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
              "chartDataVersion": args.data_version, "cycle": args.cycle}
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
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_text(json.dumps(data, indent=2, ensure_ascii=False) + "\n")
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
