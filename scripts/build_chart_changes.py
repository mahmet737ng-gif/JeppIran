#!/usr/bin/env python3
"""Build JEPPIRAN per-airport cycle changes from actual old/new chart pages.

This deliberately does not trust only page titles. For charts present in both
cycles it compares rendered chart content (while ignoring the generated top
print/cycle strip) so a chart whose identifier stayed the same can still be
reported as REV.

The resulting chart-changes.json is consumed by ChartChangesStore and the
Previous / Current / Changes Overlay viewer.
"""

import argparse
import json
import os
import re
import tempfile
import urllib.request
from collections import defaultdict
from pathlib import Path

import fitz
import numpy as np


def clean(value):
    return re.sub(r"\s+", " ", str(value or "")).strip()


def load_json(path):
    return json.loads(Path(path).read_text(encoding="utf-8"))


def records(value):
    if isinstance(value, list):
        return [x for x in value if isinstance(x, dict)]
    if isinstance(value, dict):
        raw = value.get("charts")
        if isinstance(raw, list):
            return [x for x in raw if isinstance(x, dict)]
        return [x for x in value.values() if isinstance(x, dict)]
    return []


def chart_key(item):
    number = clean(item.get("chart_number")).upper()
    if number:
        return "INDEX:" + number

    category = clean(item.get("category")).upper()
    name = clean(item.get("name")).upper()
    return "TITLE:" + category + "|" + name


def grouped(items, icao):
    out = defaultdict(list)
    for item in items:
        airport = clean(item.get("airport") or item.get("icao")).upper()
        if airport != icao:
            continue
        out[chart_key(item)].append(item)

    for key in out:
        out[key].sort(key=lambda x: int(x.get("pdf_page", 0) or 0))
    return out


def display_item(group):
    item = group[0]
    return {
        "procedure": clean(item.get("name")) or clean(item.get("chart_number")),
        "index": clean(item.get("chart_number")).upper(),
        "category": clean(item.get("category")),
    }


def download(url, destination, token=""):
    request = urllib.request.Request(
        url,
        headers={
            "User-Agent": "JEPPIRAN chart-cycle comparator",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    with urllib.request.urlopen(request, timeout=90) as response:
        destination.write_bytes(response.read())


def render_gray(document, one_based_page, longest=850):
    index = int(one_based_page) - 1
    if index < 0 or index >= document.page_count:
        return None

    page = document[index]
    width = float(page.rect.width)
    height = float(page.rect.height)
    scale = max(0.7, min(2.0, longest / max(width, height)))

    pix = page.get_pixmap(
        matrix=fitz.Matrix(scale, scale),
        colorspace=fitz.csGRAY,
        alpha=False,
    )

    arr = np.frombuffer(pix.samples, dtype=np.uint8).reshape(
        pix.height,
        pix.width,
    ).copy()

    # Ignore JeppView's generated print/cycle strip and most header date noise.
    cutoff = min(arr.shape[0], max(1, int(arr.shape[0] * 0.055)))
    arr[:cutoff, :] = 255
    return arr


def page_changed(old_doc, old_page, new_doc, new_page):
    old = render_gray(old_doc, old_page)
    new = render_gray(new_doc, new_page)

    if old is None or new is None:
        return True

    if old.shape != new.shape:
        return True

    # Search a very small translation window. It prevents harmless sub-pixel
    # renderer/layout shifts from making the whole chart look "revised".
    best_fraction = 1.0
    best_mean = 255.0

    for dy in range(-3, 4):
        for dx in range(-3, 4):
            y0_old = max(0, dy)
            y0_new = max(0, -dy)
            x0_old = max(0, dx)
            x0_new = max(0, -dx)

            h = min(
                old.shape[0] - y0_old,
                new.shape[0] - y0_new,
            )
            w = min(
                old.shape[1] - x0_old,
                new.shape[1] - x0_new,
            )
            if h <= 40 or w <= 40:
                continue

            # Downsample for speed but retain enough detail for line changes.
            a = old[y0_old:y0_old+h:3, x0_old:x0_old+w:3].astype(np.int16)
            b = new[y0_new:y0_new+h:3, x0_new:x0_new+w:3].astype(np.int16)
            diff = np.abs(a - b)

            fraction = float(np.mean(diff > 42))
            mean_abs = float(np.mean(diff))

            if (fraction, mean_abs) < (best_fraction, best_mean):
                best_fraction = fraction
                best_mean = mean_abs

    # A few anti-aliased pixels or a date glyph should not mark a chart REV.
    return best_fraction > 0.0025 or best_mean > 1.35


def group_changed(old_doc, old_group, new_doc, new_group):
    if len(old_group) != len(new_group):
        return True

    for old_item, new_item in zip(old_group, new_group):
        if page_changed(
            old_doc,
            int(old_item.get("pdf_page", 0) or 0),
            new_doc,
            int(new_item.get("pdf_page", 0) or 0),
        ):
            return True

    return False


def clean_official_notices(raw):
    """Keep only plausibly parsed notices; reject interleaved extraction junk."""
    output = {}
    if not isinstance(raw, dict):
        return output

    airports = raw.get("airports", {})
    if not isinstance(airports, dict):
        return output

    for icao, payload in airports.items():
        notices = payload.get("notices", []) if isinstance(payload, dict) else []
        kept = []
        for notice in notices:
            if not isinstance(notice, dict):
                continue
            text = clean(notice.get("text"))
            upper = text.upper()

            if not text:
                continue
            if len(text) > 1800:
                continue
            if "NO CHART" in upper:
                continue
            if upper.count("CHART CHANGE NOTICES FOR AIRPORT") > 0:
                continue

            kept.append({
                "type": clean(notice.get("type")),
                "effectivity": clean(notice.get("effectivity")),
                "beginDate": clean(notice.get("beginDate")),
                "endDate": clean(notice.get("endDate")),
                "text": text,
            })

        if kept:
            output[icao.upper()] = kept

    return output


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--current-charts", required=True)
    parser.add_argument("--current-airports-dir", required=True)
    parser.add_argument("--previous-charts", required=True)
    parser.add_argument("--previous-manifest", required=True)
    parser.add_argument("--changed-airports", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--source", required=True)
    parser.add_argument("--official", default="")
    parser.add_argument("--output", required=True)
    args = parser.parse_args()

    current = records(load_json(args.current_charts))
    previous = records(load_json(args.previous_charts))
    previous_manifest = load_json(args.previous_manifest)
    change_report = load_json(args.changed_airports)

    changed_airports = set(
        str(x).upper()
        for x in change_report.get("changed_airports", [])
    )
    removed_airports = set(
        str(x).upper()
        for x in change_report.get("removed_airports", [])
    )

    official_notices = {}
    if args.official and Path(args.official).is_file():
        official_notices = clean_official_notices(load_json(args.official))

    current_airports = {
        clean(x.get("airport") or x.get("icao")).upper()
        for x in current
        if clean(x.get("airport") or x.get("icao"))
    }

    previous_airports = {
        clean(x.get("airport") or x.get("icao")).upper()
        for x in previous
        if clean(x.get("airport") or x.get("icao"))
    }

    candidate_airports = sorted(
        changed_airports
        | removed_airports
        | set(official_notices)
    )

    result = {}

    token = os.environ.get("GH_TOKEN", "")

    with tempfile.TemporaryDirectory(prefix="jeppiran-old-cycle-") as tmp:
        tmp_path = Path(tmp)

        for icao in candidate_airports:
            old_groups = grouped(previous, icao)
            new_groups = grouped(current, icao)

            summary = []

            old_doc = None
            new_doc = None

            current_pdf = Path(args.current_airports_dir) / f"{icao}.pdf"

            old_manifest_item = (
                previous_manifest
                .get("airports", {})
                .get(icao, {})
            )

            old_url = clean(old_manifest_item.get("url"))
            old_path = tmp_path / f"{icao}-previous.pdf"

            can_compare_pages = (
                current_pdf.is_file()
                and bool(old_url)
                and icao in previous_airports
                and icao in current_airports
            )

            if can_compare_pages:
                try:
                    download(old_url, old_path, token)
                    old_doc = fitz.open(old_path)
                    new_doc = fitz.open(current_pdf)
                except Exception as exc:
                    print(f"WARN {icao}: previous PDF unavailable: {exc}")
                    if old_doc:
                        old_doc.close()
                    if new_doc:
                        new_doc.close()
                    old_doc = None
                    new_doc = None

            all_keys = sorted(set(old_groups) | set(new_groups))

            for key in all_keys:
                old_group = old_groups.get(key, [])
                new_group = new_groups.get(key, [])

                if not old_group:
                    info = display_item(new_group)
                    summary.append({
                        "action": "ADD",
                        **info,
                        "revisionDate": "",
                        "effectiveDate": "",
                    })
                    continue

                if not new_group:
                    info = display_item(old_group)
                    summary.append({
                        "action": "DEL",
                        **info,
                        "revisionDate": "",
                        "effectiveDate": "",
                    })
                    continue

                changed = False

                # Metadata rename itself is a revision.
                if clean(old_group[0].get("name")) != clean(new_group[0].get("name")):
                    changed = True

                if (
                    not changed
                    and old_doc is not None
                    and new_doc is not None
                ):
                    changed = group_changed(
                        old_doc,
                        old_group,
                        new_doc,
                        new_group,
                    )

                if changed:
                    info = display_item(new_group)
                    summary.append({
                        "action": "REV",
                        **info,
                        "revisionDate": "",
                        "effectiveDate": "",
                    })

            if old_doc is not None:
                old_doc.close()
            if new_doc is not None:
                new_doc.close()

            notices = official_notices.get(icao, [])

            if summary or notices:
                result[icao] = {
                    "summary": summary,
                    "notices": notices,
                }

    output = {
        "version": 1,
        "chartDataVersion": args.version,
        "source": args.source,
        "airports": result,
    }

    Path(args.output).write_text(
        json.dumps(output, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps({
        "airports": len(result),
        "added": sum(
            1
            for item in result.values()
            for change in item.get("summary", [])
            if change.get("action") == "ADD"
        ),
        "revised": sum(
            1
            for item in result.values()
            for change in item.get("summary", [])
            if change.get("action") == "REV"
        ),
        "deleted": sum(
            1
            for item in result.values()
            for change in item.get("summary", [])
            if change.get("action") == "DEL"
        ),
        "officialNotices": sum(
            len(item.get("notices", []))
            for item in result.values()
        ),
    }, indent=2))


if __name__ == "__main__":
    main()
