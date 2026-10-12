#!/usr/bin/env python3
"""Generate the deployed JEPPIRAN offline package after Pages assets are assembled."""
import argparse
import hashlib
import json
from pathlib import Path
from urllib.parse import quote

WEB = Path("web")
CHART_MANIFEST = Path("app/src/main/assets/charts-manifest.json")
OUT = WEB / "offline-assets.json"
ALLOWED = {".html", ".js", ".mjs", ".css", ".json", ".png", ".jpg", ".jpeg",
           ".webp", ".svg", ".gif", ".webmanifest", ".woff", ".woff2"}
SKIP_DIRS = {"tests", "tools", "georef-test", "oimm-ils-y-31r-test"}
SKIP_FILES = {"offline-assets.json"}

def record(path, kind, icao=None):
    rel = path.relative_to(WEB).as_posix()
    content = path.read_bytes()
    entry = {"url": "./" + quote(rel, safe="/"), "kind": kind,
             "size": len(content), "sha256": hashlib.sha256(content).hexdigest()}
    if icao is not None:
        entry["icao"] = icao
    return entry

def make_manifest():
    chart_data = json.loads(CHART_MANIFEST.read_text(encoding="utf-8"))
    assets = []
    for f in sorted(WEB.rglob("*")):
        if not f.is_file() or f.name in SKIP_FILES or f.suffix.lower() not in ALLOWED:
            continue
        parts = f.relative_to(WEB).parts
        if parts[0] == "charts" or any(part in SKIP_DIRS for part in parts[:-1]):
            continue
        assets.append(record(f, "asset"))
    index = WEB / "index.html"
    if not index.is_file():
        raise RuntimeError("Missing index.html")
    root = record(index, "asset")
    root["url"] = "./"
    assets.insert(0, root)
    pdfs = []
    for icao, info in sorted(chart_data["airports"].items()):
        filename = info.get("file") or icao + ".pdf"
        if Path(filename).name != filename:
            raise RuntimeError("Unsafe chart filename: " + filename)
        path = WEB / "charts" / filename
        if not path.is_file():
            raise RuntimeError("Missing deployed PDF: " + filename)
        entry = record(path, "pdf", icao)
        if entry["size"] != info["size"] or entry["sha256"].lower() != info["sha256"].lower():
            raise RuntimeError("Manifest hash or byte size mismatch: " + filename)
        pdfs.append(entry)
    return {"schema": 1, "cycle": chart_data["version"],
            "release_tag": chart_data.get("release_tag", ""),
            "assets": assets, "pdfs": pdfs,
            "totalBytes": sum(x["size"] for x in assets + pdfs)}

def main():
    p = argparse.ArgumentParser()
    p.add_argument("--check", action="store_true")
    args = p.parse_args()
    data = make_manifest()
    serialized = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
    if args.check:
        if not OUT.is_file() or OUT.read_text(encoding="utf-8") != serialized:
            raise SystemExit("Offline manifest out of date")
    else:
        OUT.write_text(serialized, encoding="utf-8")
    print("Offline package:", len(data["assets"]), "app assets,",
          len(data["pdfs"]), "airport PDFs,",
          round(data["totalBytes"] / 1048576, 1), "MiB")

if __name__ == "__main__":
    main()
