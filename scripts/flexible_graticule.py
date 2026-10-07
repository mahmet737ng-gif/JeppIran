"""Frame-independent matching of printed graticule labels to vector ticks.

Jeppesen plan views do not always draw a closed rectangular frame.  This
module deliberately uses geometric evidence rather than page numbers: label
orientation, the closest collinear vector tick, repeated-value agreement and
monotonic axis scale.  The caller still performs the affine/conformal and
residual checks before publishing a chart.
"""
from collections import defaultdict


def _tick_kind(line):
    x1, y1, x2, y2 = line
    dx, dy = abs(x1 - x2), abs(y1 - y2)
    if dy < .03 and 1.5 <= dx <= 14:
        return "horizontal"
    if dx < .03 and 1.5 <= dy <= 14:
        return "vertical"
    return None


def _candidate(word, line, kind):
    cx, cy = (word[0] + word[2]) / 2, (word[1] + word[3]) / 2
    x1, y1, x2, y2 = line
    if kind == "horizontal":
        primary = abs(cy - y1)
        gap = min(abs(cx - x1), abs(cx - x2))
        pixel, pixel_axis = y1, "y"
    else:
        primary = abs(cx - x1)
        gap = min(abs(cy - y1), abs(cy - y2))
        pixel, pixel_axis = x1, "x"
    # Primary alignment is decisive.  The small gap term only breaks ties
    # between collinear decorative marks and the tick adjacent to the label.
    return primary + .15 * gap, primary, gap, pixel, pixel_axis


def match_unframed_axes(page, lines, anchor, decimal_grid, grid_pattern):
    ticks = [(line, _tick_kind(line)) for line in lines]
    ticks = [(line, kind) for line, kind in ticks if kind]
    raw = {"latitude": [], "longitude": []}
    for word in page.get_text("words"):
        label = word[4]
        if not grid_pattern.fullmatch(label):
            continue
        value = decimal_grid(label)
        lat_distance = abs(value - anchor["lat"])
        lon_distance = abs(value - anchor["lon"])
        if min(lat_distance, lon_distance) > 6:
            continue
        rotated = word[3] - word[1] > word[2] - word[0]
        ambiguous = abs(lat_distance - lon_distance) < .75
        ranked = []
        for line, kind in ticks:
            score, primary, gap, pixel, pixel_axis = _candidate(word, line, kind)
            if primary > 5 or score > 7:
                continue
            if ambiguous:
                axis = ("longitude" if rotated else "latitude") if kind == "horizontal" else (
                    "latitude" if rotated else "longitude")
            else:
                axis = "latitude" if lat_distance < lon_distance else "longitude"
                expected = ((axis == "latitude" and not rotated) or
                            (axis == "longitude" and rotated))
                if expected != (kind == "horizontal"):
                    continue
            ranked.append((score, gap, axis, line, pixel, pixel_axis))
        if not ranked:
            continue
        ranked.sort(key=lambda item: item[:2])
        score, _, axis, line, pixel, pixel_axis = ranked[0]
        # Equal-quality candidates at different locations are not evidence.
        if any(abs(other[0] - score) < .15 and
               (other[2] != axis or other[5] != pixel_axis or abs(other[4] - pixel) > .6)
               for other in ranked[1:]):
            continue
        raw[axis].append({
            "label": label,
            "degrees": value,
            "pdfPoint": pixel,
            "pixelAxis": pixel_axis,
            "labelBounds": [round(float(v), 4) for v in word[:4]],
            "tickSegment": [round(float(v), 4) for v in line],
        })

    axes = {}
    for axis, values in raw.items():
        if not values:
            raise ValueError("No close printed label/vector-tick matches")
        orientation_counts = {key: sum(v["pixelAxis"] == key for v in values) for key in ("x", "y")}
        orientation = max(orientation_counts, key=orientation_counts.get)
        values = [v for v in values if v["pixelAxis"] == orientation]
        groups = defaultdict(list)
        for value in values:
            groups[value["degrees"]].append(value)
        unique = []
        for group in groups.values():
            # Mirrored labels should resolve to the same grid coordinate.  If
            # not, retain only the largest tight cluster rather than averaging.
            clusters = []
            for value in sorted(group, key=lambda item: item["pdfPoint"]):
                if clusters and abs(value["pdfPoint"] - clusters[-1][-1]["pdfPoint"]) <= .8:
                    clusters[-1].append(value)
                else:
                    clusters.append([value])
            clusters.sort(key=lambda cluster: (-len(cluster), min(v["pdfPoint"] for v in cluster)))
            unique.append(clusters[0][0])
        unique.sort(key=lambda item: item["degrees"])
        if len(unique) >= 2:
            slopes = [(b["pdfPoint"] - a["pdfPoint"]) / (b["degrees"] - a["degrees"])
                      for a, b in zip(unique, unique[1:])]
            if not all(s and (s > 0) == (slopes[0] > 0) for s in slopes):
                raise ValueError("Printed grid is not monotonic")
            magnitudes = [abs(s) for s in slopes]
            if max(magnitudes) / min(magnitudes) > 1.08:
                raise ValueError("Printed grid scale is inconsistent")
        axes[axis] = unique
    if axes["latitude"][0]["pixelAxis"] == axes["longitude"][0]["pixelAxis"]:
        raise ValueError("Latitude and longitude resolve to the same PDF axis")
    if max(len(axes["latitude"]), len(axes["longitude"])) < 2:
        raise ValueError("Need two measured values on at least one geographic axis")
    return axes
