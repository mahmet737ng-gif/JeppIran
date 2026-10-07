#!/usr/bin/env python3

import argparse
import hashlib
import json
import re
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

import fitz


VALID_CATEGORIES = {"Airport", "STAR", "SID", "Approach", "Other"}


def sha256_file(path):
    h = hashlib.sha256()
    with open(path, "rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def safe_icao(value):
    value = str(value or "").strip().upper()
    if not re.fullmatch(r"[A-Z]{4}", value):
        raise ValueError("Invalid ICAO: " + value)
    return value


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--pdf", required=True)
    parser.add_argument("--charts", required=True)
    parser.add_argument("--version", required=True)
    parser.add_argument("--cycle", required=True)
    parser.add_argument("--effective-from", default="")
    parser.add_argument("--effective-to", default="")
    parser.add_argument("--release-tag", required=True)
    parser.add_argument("--repo", default="mahmet737ng-gif/JeppIran")
    parser.add_argument("--out-dir", default="cycle-build")
    parser.add_argument("--previous-manifest", default="")
    args = parser.parse_args()

    pdf_path = Path(args.pdf)
    out = Path(args.out_dir)
    airport_dir = out / "airports"
    airport_dir.mkdir(parents=True, exist_ok=True)

    source = fitz.open(pdf_path)
    records = json.loads(Path(args.charts).read_text(encoding="utf-8"))
    if isinstance(records, dict):
        records = records.get("charts", list(records.values()))
    if not isinstance(records, list) or not records:
        raise ValueError("Chart database is empty")

    by_airport = defaultdict(list)
    seen_pages = set()

    for raw in records:
        if not isinstance(raw, dict):
            continue
        page = int(raw.get("page", 0))
        if page <= 0 or page > len(source):
            raise ValueError("Page outside source PDF: " + str(page))
        if page in seen_pages:
            raise ValueError("Duplicate global page: " + str(page))
        seen_pages.add(page)

        icao = safe_icao(raw.get("airport") or raw.get("icao"))
        category = str(raw.get("category") or "Other")
        if category not in VALID_CATEGORIES:
            category = "Other"

        item = dict(raw)
        item["page"] = page
        item["airport"] = icao
        item["category"] = category
        item.pop("pdf_page", None)
        by_airport[icao].append(item)

    if len(seen_pages) < max(1, int(len(source) * 0.90)):
        raise ValueError(
            "Too few indexed pages: " + str(len(seen_pages)) +
            " of " + str(len(source))
        )

    generated = datetime.now(timezone.utc).isoformat()
    base_url = (
        "https://github.com/" + args.repo +
        "/releases/download/" + args.release_tag + "/"
    )

    final_records = []
    airports_manifest = {}

    for icao in sorted(by_airport):
        items = sorted(by_airport[icao], key=lambda x: x["page"])
        output_pdf = airport_dir / (icao + ".pdf")

        document = fitz.open()
        for local_index, item in enumerate(items, start=1):
            document.insert_pdf(
                source,
                from_page=item["page"] - 1,
                to_page=item["page"] - 1,
            )
            item["pdf_page"] = local_index
            final_records.append(item)

        document.set_metadata({})
        document.save(
            output_pdf,
            garbage=4,
            deflate=True,
            clean=True,
        )
        document.close()

        airports_manifest[icao] = {
            "file": output_pdf.name,
            "url": base_url + output_pdf.name,
            "sha256": sha256_file(output_pdf),
            "size": output_pdf.stat().st_size,
            "pages": len(items),
            "global_pages": [item["page"] for item in items],
        }

    final_records.sort(key=lambda x: x["page"])

    (out / "charts-current.json").write_text(
        json.dumps(final_records, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    manifest = {
        "version": args.version,
        "release_tag": args.release_tag,
        "base_url": base_url,
        "source": pdf_path.name,
        "source_sha256": sha256_file(pdf_path),
        "cycle": args.cycle,
        "effective_from": args.effective_from,
        "effective_to": args.effective_to,
        "generated_at": generated,
        "pages": len(source),
        "airports": airports_manifest,
    }

    (out / "manifest.json").write_text(
        json.dumps(manifest, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    previous = {}
    if args.previous_manifest:
        previous_path = Path(args.previous_manifest)
        if previous_path.is_file():
            previous = json.loads(
                previous_path.read_text(encoding="utf-8")
            ).get("airports", {})

    changed = []
    for icao, item in airports_manifest.items():
        old = previous.get(icao, {})
        if old.get("sha256") != item["sha256"]:
            changed.append(icao)

    removed = sorted(set(previous) - set(airports_manifest))

    change_report = {
        "version": args.version,
        "cycle": args.cycle,
        "effective_from": args.effective_from,
        "effective_to": args.effective_to,
        "changed_airports": sorted(changed),
        "removed_airports": removed,
        "changed_count": len(changed),
        "removed_count": len(removed),
    }

    (out / "changed-airports.json").write_text(
        json.dumps(change_report, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

    print(json.dumps({
        "version": args.version,
        "source_pages": len(source),
        "indexed_pages": len(final_records),
        "airports": len(airports_manifest),
        "changed_airports": len(changed),
        "removed_airports": len(removed),
    }, indent=2))


if __name__ == "__main__":
    main()
