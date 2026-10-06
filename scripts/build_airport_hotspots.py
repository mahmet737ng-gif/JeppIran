#!/usr/bin/env python3
import argparse
import json
import math
import re
from pathlib import Path

import fitz


def clean(text: str) -> str:
    return re.sub(r"\s+", " ", text or "").strip()


def solve3(matrix, vector):
    a = [list(map(float, row)) + [float(vector[i])] for i, row in enumerate(matrix)]
    for col in range(3):
        pivot = max(range(col, 3), key=lambda r: abs(a[r][col]))
        if abs(a[pivot][col]) < 1e-12:
            return None
        a[col], a[pivot] = a[pivot], a[col]
        p = a[col][col]
        a[col] = [v / p for v in a[col]]
        for row in range(3):
            if row == col:
                continue
            factor = a[row][col]
            a[row] = [a[row][k] - factor * a[col][k] for k in range(4)]
    return [a[i][3] for i in range(3)]


def fit_affine(points):
    # x/y = a + b*lon + c*lat, matched to the runtime georef model.
    if len(points) < 4:
        return None
    rows = [(1.0, float(p["lon"]), float(p["lat"])) for p in points]
    ata = [[sum(r[i] * r[j] for r in rows) for j in range(3)] for i in range(3)]
    atx = [sum(rows[k][i] * float(points[k]["x"]) for k in range(len(rows))) for i in range(3)]
    aty = [sum(rows[k][i] * float(points[k]["y"]) for k in range(len(rows))) for i in range(3)]
    cx = solve3(ata, atx)
    cy = solve3(ata, aty)
    if cx is None or cy is None:
        return None
    return cx, cy


def inverse_project(transform, x, y):
    cx, cy = transform
    # x-a = b*lon + c*lat
    # y-d = e*lon + f*lat
    b, c = cx[1], cx[2]
    e, f = cy[1], cy[2]
    det = b * f - c * e
    if abs(det) < 1e-12:
        return None
    rx = x - cx[0]
    ry = y - cy[0]
    lon = (rx * f - c * ry) / det
    lat = (b * ry - rx * e) / det
    if not (-90 <= lat <= 90 and -180 <= lon <= 180):
        return None
    return lat, lon


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", default="Iran2620.pdf")
    parser.add_argument("--index", default="app/src/main/assets/charts-current.json")
    parser.add_argument("--georef", default="app/src/main/assets/chart-georef.json")
    parser.add_argument("--output", default="app/src/main/assets/airport-hotspots.json")
    args = parser.parse_args()

    index = json.loads(Path(args.index).read_text())
    georef_root = json.loads(Path(args.georef).read_text())
    georef_by_page = {
        int(item.get("page", -1)): item
        for item in georef_root.get("charts", [])
        if int(item.get("page", -1)) > 0
    }

    doc = fitz.open(args.pdf)
    output = []
    seen = set()
    hotspot_re = re.compile(r"\b(?:HOT\s*SPOT|HS\s*\d+[A-Z]?)\b", re.I)

    for chart in index:
        category = str(chart.get("category", "")).strip().upper()
        if category != "AIRPORT":
            continue
        page_no = int(chart.get("page", 0) or 0)
        if page_no <= 0 or page_no > len(doc):
            continue

        page = doc[page_no - 1]
        text = page.get_text("text")
        geo = georef_by_page.get(page_no)
        transform = fit_affine(geo.get("points", [])) if geo else None

        for match in hotspot_re.finditer(text):
            label = clean(match.group(0)).upper()
            start = max(0, match.start() - 120)
            end = min(len(text), match.end() + 280)
            snippet = clean(text[start:end])
            if not snippet:
                continue

            lat = None
            lon = None
            if transform is not None:
                rects = page.search_for(match.group(0))
                if rects:
                    rect = rects[0]
                    center_x = (rect.x0 + rect.x1) / 2.0
                    center_y = (rect.y0 + rect.y1) / 2.0
                    result = inverse_project(transform, center_x, center_y)
                    if result:
                        lat, lon = result

            key = (chart.get("airport", ""), page_no, label, snippet)
            if key in seen:
                continue
            seen.add(key)

            item = {
                "airport": chart.get("airport", ""),
                "page": page_no,
                "chart_number": chart.get("chart_number", ""),
                "chart_name": chart.get("name", ""),
                "label": label,
                "snippet": snippet,
                "source": "printed_airport_chart_text"
            }
            if lat is not None and lon is not None:
                item["lat"] = round(lat, 7)
                item["lon"] = round(lon, 7)
                item["position_source"] = "printed_label_position_plus_validated_chart_georef"
            output.append(item)

    Path(args.output).parent.mkdir(parents=True, exist_ok=True)
    Path(args.output).write_text(json.dumps(output, indent=2, ensure_ascii=False) + "\n")
    positioned = sum(1 for item in output if "lat" in item and "lon" in item)
    print(json.dumps({
        "hotspots": len(output),
        "positionedHotspots": positioned,
        "output": args.output
    }, indent=2))


if __name__ == "__main__":
    main()
