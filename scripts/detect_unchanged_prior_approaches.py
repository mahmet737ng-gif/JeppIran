#!/usr/bin/env python3
"""Prepare exact chart-identity + PDF-geometry carry-forward review for ANY cycles.

Do not mistake a changed JeppView printing banner for an AIRAC chart change.
Requires both original PDFs, the previously published georef JSON, and the
current chart index. Fails closed when old source provenance does not match.
"""
import argparse
import hashlib
import json
import math
import re
from collections import defaultdict
from pathlib import Path

import fitz
import numpy as np


def sha(path):
    digest = hashlib.sha256()
    with open(path, 'rb') as f:
        for b in iter(lambda: f.read(1024 * 1024), b''):
            digest.update(b)
    return digest.hexdigest()


def chart_body(page):
    t = page.get_text()
    t = re.split(r'\nPrinted from JeppView for Windows|\nPrinted on \d\d \w{3} \d{4}',
                 t, maxsplit=1)[0]
    return t.strip()


def chart_lines(page):
    result = []
    for path in page.get_drawings():
        for op in path['items']:
            if op[0] != 'l':
                continue
            a, b = op[1:3]
            if not (25 <= a.x <= 600 and 25 <= b.x <= 600 and
                    30 <= a.y <= 715 and 30 <= b.y <= 715):
                continue
            if math.hypot(a.x - b.x, a.y - b.y) < 14:
                continue
            endpoints = sorted(((a.x, a.y), (b.x, b.y)))
            result.append((*endpoints[0], *endpoints[1]))
    return np.asarray(result, dtype=np.float32).reshape(-1, 4)


def vector_correspondence(old, new, threshold=0.8):
    if not len(old) or not len(new):
        return 0, 0
    def matched(x, y):
        # Bounded vector comparisons avoid scipy dependency and excessive RAM.
        matched_count = 0
        for chunk in np.array_split(x, max(1, math.ceil(len(x) / 96))):
            distances2 = ((chunk[:, None, :] - y[None, :, :]) ** 2).sum(axis=2)
            matched_count += int(np.count_nonzero(distances2.min(axis=1) <= threshold ** 2))
        return matched_count / len(x)
    return matched(old, new), matched(new, old)


def raster_similarity(old, new):
    def raster(page):
        pix = page.get_pixmap(colorspace=fitz.csGRAY, alpha=False)
        return np.frombuffer(pix.samples, dtype=np.uint8).reshape(pix.height, pix.width)
    a, b = raster(old), raster(new)
    if a.shape != b.shape:
        return 0, 1
    a = a[24:725, 30:583].astype(np.float64)
    b = b[24:725, 30:583].astype(np.float64)
    changed = float(np.mean(np.abs(a - b) > 25))
    a -= a.mean()
    b -= b.mean()
    den = math.sqrt(float((a * a).sum() * (b * b).sum()))
    return float((a * b).sum() / den) if den > 0 else 0, changed


def make_manifest(previous_pdf, current_pdf, old_root, current_index,
                  previous_cycle, current_cycle):
    old_sha, current_sha = sha(previous_pdf), sha(current_pdf)
    if old_sha != old_root['source']['sha256']:
        raise ValueError('Old PDF bytes do not match the previously approved georeference')
    old = fitz.open(previous_pdf)
    current = fitz.open(current_pdf)
    if len(old) != old_root['source']['pageCount']:
        raise ValueError('Old PDF page count disagrees with published georeferencing')
    index = {int(c['page']): c for c in current_index if
             c.get('category', '').upper() == 'APPROACH'}
    text_map = defaultdict(list)
    for n, item in index.items():
        text_map[hashlib.sha256(chart_body(current[n - 1]).encode()).hexdigest()].append(n)
    approved = []
    issues = []
    current_used = set()
    for previous in old_root['charts']:
        key = previous.get('chartKey', '').split('|')
        if len(key) != 4 or key[1] != 'APPROACH':
            continue
        old_page = int(previous['page'])
        body_hash = hashlib.sha256(chart_body(old[old_page - 1]).encode()).hexdigest()
        possibles = [n for n in text_map.get(body_hash, []) if
                     index[n]['airport'] == key[0] and
                     str(index[n].get('chart_number', '')).upper() == key[2] and
                     chart_body(current[n - 1]) == chart_body(old[old_page - 1])]
        if len(possibles) != 1 or possibles[0] in current_used:
            issues.append({'previousPage': old_page, 'reason': 'changed, missing or ambiguous content'})
            continue
        new_page = possibles[0]
        old_geometry, new_geometry = chart_lines(old[old_page-1]), chart_lines(current[new_page-1])
        fw, bw = vector_correspondence(old_geometry, new_geometry)
        correlation, fraction = raster_similarity(old[old_page-1], current[new_page-1])
        if (fw < 0.96 or bw < 0.96 or correlation < 0.84 or fraction > 0.11 or
                previous['width'] != current[new_page-1].rect.width or
                previous['height'] != current[new_page-1].rect.height):
            issues.append({'previousPage': old_page, 'currentCandidatePage': new_page,
                           'reason': 'geometric source comparison did not pass'})
            continue
        approved.append({
            'previousPage': old_page, 'currentPage': new_page,
            'vectorForward': round(fw, 5), 'vectorBackward': round(bw, 5),
            'rasterCorrelation': round(correlation, 5),
            'changedPixelFraction': round(fraction, 5)
        })
        current_used.add(new_page)
    result = {
        'schemaVersion': 1,
        'policy': 'Preserve only previously approved charts with unique same-ICAO/procedure identity and matched source text, geometry and raster; does not independently recertify prior geographic accuracy.',
        'previous': {'cycle': str(previous_cycle), 'pdfSha256': old_sha,
                     'georefSourceSha256': old_root['source']['sha256'], 'pageCount': len(old)},
        'current': {'cycle': str(current_cycle), 'pdfSha256': current_sha,
                    'pageCount': len(current)},
        'verification': {'verifiedPdfPairs': len(approved),
                         'vectorMatchBothDirectionsMinimum': 0.96,
                         'vectorCoordinateTolerancePdfPoints': 0.8,
                         'rasterCorrelationMinimum': 0.84,
                         'rasterDifferentPixelFractionMaximum': 0.11},
        'pageMappings': approved,
        'notReused': issues
    }
    return result


def main():
    ap = argparse.ArgumentParser(description=__doc__)
    for arg in ('previous-pdf', 'current-pdf', 'previous-georef', 'current-index',
                'previous-cycle', 'current-cycle', 'output'):
        ap.add_argument('--' + arg, required=True)
    args = ap.parse_args()
    result = make_manifest(
        args.previous_pdf, args.current_pdf,
        json.loads(Path(args.previous_georef).read_text(encoding='utf-8')),
        json.loads(Path(args.current_index).read_text(encoding='utf-8')),
        args.previous_cycle, args.current_cycle
    )
    Path(args.output).write_text(json.dumps(result, indent=2) + '\n', encoding='utf-8')
    print('Unchanged and eligible:', len(result['pageMappings']),
          '; old georefs requiring review:', len(result['notReused']))


if __name__ == '__main__':
    main()
