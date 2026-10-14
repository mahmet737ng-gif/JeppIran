#!/usr/bin/env python3
"""Create a fully self-contained JEPPIRAN Android UI and airport chart bundle.

The Android runtime loads ONLY appassets.androidplatform.net (from APK assets),
never the hosted GitHub Pages site. The iPad PWA is built separately.

Run before Gradle: python3 scripts/build_android_local_web.py
"""
import argparse
import hashlib
import json
import re
import shutil
import subprocess
import time
import urllib.request
from pathlib import Path
from urllib.parse import urlparse

ROOT = Path(__file__).resolve().parent.parent
WEB = ROOT / "web"
NATIVE = ROOT / "app/src/main/assets"
OUTPUT = ROOT / "app/build/generated/jeppiran-local-web/jeppiran-web"
CHARTS = json.loads((NATIVE / "charts-manifest.json").read_text())
ALLOWED = {".html", ".js", ".mjs", ".css", ".json", ".png", ".jpg",
           ".jpeg", ".webp", ".gif", ".svg", ".woff", ".woff2", ".webmanifest"}
EXCLUDE = {"charts", "admin-console", "admin-test", "tests", "tools",
           "georef-test", "oimm-ils-y-31r-test", "__pycache__"}
PDFJS_VERSION = "4.10.38"


def sha256(path):
    h = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()


def download(url, destination, expected_size=None, expected_sha=None):
    if urlparse(url).scheme != "https":
        raise RuntimeError("Only HTTPS downloads allowed: " + url)
    destination.parent.mkdir(parents=True, exist_ok=True)
    if destination.exists() and (expected_size is None or destination.stat().st_size == expected_size) and (
        expected_sha is None or sha256(destination) == expected_sha.lower()
    ):
        return
    last = None
    for attempt in range(1, 5):
        temp = destination.with_suffix(destination.suffix + ".partial")
        try:
            req = urllib.request.Request(url, headers={"User-Agent": "JEPPIRAN-Android-Local-Bundle/1.0"})
            with urllib.request.urlopen(req, timeout=120) as response, temp.open("wb") as out:
                shutil.copyfileobj(response, out, length=1024 * 1024)
            if temp.stat().st_size < 1024:
                raise RuntimeError("Download too small")
            if expected_size is not None and temp.stat().st_size != expected_size:
                raise RuntimeError("Size mismatch: " + destination.name)
            if expected_sha is not None and sha256(temp) != expected_sha.lower():
                raise RuntimeError("SHA-256 mismatch: " + destination.name)
            temp.replace(destination)
            return
        except Exception as exc:
            last = exc
            temp.unlink(missing_ok=True)
            time.sleep(attempt * 2)
    raise RuntimeError(f"Could not download {destination.name}: {last}")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--verify-only", action="store_true")
    args = parser.parse_args()
    if not args.verify_only:
        if OUTPUT.exists():
            shutil.rmtree(OUTPUT)
        OUTPUT.mkdir(parents=True)
        for source in WEB.rglob("*"):
            if not source.is_file() or source.suffix.lower() not in ALLOWED:
                continue
            relative = source.relative_to(WEB)
            if any(x in EXCLUDE for x in relative.parts[:-1]):
                continue
            dest = OUTPUT / relative
            dest.parent.mkdir(parents=True, exist_ok=True)
            shutil.copy2(source, dest)

        # Local APK data must match the signed Android chart-data cycle, not
        # an independent copy of an earlier web deployment.
        (OUTPUT / "data").mkdir(exist_ok=True)
        for name in ("charts-current.json", "charts-manifest.json",
                     "enroute-manifest.json", "chart-georef.json",
                     "airport-runways.json", "chart-changes.json",
                     "changed-airports.json"):
            shutil.copy2(NATIVE / name, OUTPUT / "data" / name)
        subprocess.run(["python3", "scripts/build_airport_profiles.py",
                        "--output", str(OUTPUT / "data/airport-profiles.json")],
                       cwd=ROOT, check=True)

        images = OUTPUT / "airport-images"
        images.mkdir(exist_ok=True)
        for f in (ROOT / "app/src/main/res/drawable-nodpi").glob("airport_card_*.webp"):
            shutil.copy2(f, images / f.name)

        vendor = OUTPUT / "vendor"
        for name in ("pdf.min.mjs", "pdf.worker.min.mjs"):
            download(f"https://cdn.jsdelivr.net/npm/pdfjs-dist@{PDFJS_VERSION}/build/{name}",
                     vendor / name)

        # Bundle and verify EVERY airport PDF for genuine offline operation.
        # Never silently fall back to a server on a missing chart.
        pdfs = OUTPUT / "charts"
        for icao, spec in sorted(CHARTS["airports"].items()):
            filename = spec.get("file") or f"{icao}.pdf"
            if Path(filename).name != filename:
                raise RuntimeError("Unsafe PDF filename: " + filename)
            url = spec.get("url")
            if not url:
                raise RuntimeError("Missing PDF download URL for " + icao)
            download(url, pdfs / filename, spec["size"], spec["sha256"])
            print("Verified local chart", icao, filename, flush=True)

        # Android uses installed files directly, never a browser offline cache.
        # This alteration affects ONLY the bundled Android copy, never the PWA.
        index = OUTPUT / "index.html"
        html = index.read_text(encoding="utf-8")
        offline_script = re.sub(
            r'<script src="\./offline-manager\.js\?[^"]+" defer></script>',
            "", html, count=1)
        if html == offline_script:
            raise RuntimeError("Offline manager reference changed")
        html = offline_script.replace(
            "</head>",
            '<meta name="jeppiran-runtime" content="android-local-apk">\n'
            '<link rel="stylesheet" href="./android-phone.css">\n'
            '<script>document.documentElement.classList.add("jp-android-phone")</script>\n'
            "</head>")
        html = html.replace(
            "</body>", '<script src="./android-bundled.js" defer></script>\n</body>')
        index.write_text(html, encoding="utf-8")
        shutil.copy2(NATIVE / "phone-layout.css", OUTPUT / "android-phone.css")
        (OUTPUT / "android-bundled.js").write_text(
            """// Bundled Android runtime: no browser-cache downloads or hosted-app dependency.
document.addEventListener("DOMContentLoaded", () => {
  const text = document.getElementById("offlinePackStatus");
  const count = document.getElementById("offlinePackCount");
  const btn = document.getElementById("goOfflineBtn");
  const section = document.querySelector(".offline-settings-section");
  if (section) {
    const note = section.querySelector("p");
    if (note) note.textContent = "Charts and application files are installed on this device with the APK. Live METAR/TAF still require internet. Chart cycle changes arrive through Android app updates.";
  }
  if (text) text.textContent = "READY OFFLINE · Bundled Android charts";
  if (count) count.textContent = "All bundled airport PDF files are stored locally";
  if (btn) btn.hidden = true;
  const stop = document.getElementById("stopOfflineBtn");
  if (stop) stop.hidden = true;
});
""", encoding="utf-8")

    # Fail closed: incomplete bundles are not publishable APKs.
    index = (OUTPUT / "index.html").read_text(encoding="utf-8")
    if 'content="android-local-apk"' not in index:
        raise RuntimeError("Not an Android-local shell")
    if "offline-manager.js?" in index:
        raise RuntimeError("Android offline browser-cache loader must not run")
    refs = re.findall(r'(?:src|href)="(\./[^"]+)"', index)
    from urllib.parse import unquote
    for ref in refs:
        path = unquote(ref.split("?")[0][2:])
        if not (OUTPUT / path).exists():
            raise RuntimeError("Required local shell asset missing: " + path)
    pdfs = OUTPUT / "charts"
    if len(CHARTS["airports"]) < 70:
        raise RuntimeError("Unexpected airport count")
    for icao, spec in CHARTS["airports"].items():
        p = pdfs / (spec.get("file") or f"{icao}.pdf")
        if not p.is_file() or p.stat().st_size != spec["size"] or sha256(p) != spec["sha256"]:
            raise RuntimeError("Unverified local PDF for " + icao)
    print(f"READY: Android local-only shell + {len(CHARTS['airports'])} verified airport PDFs, {OUTPUT}")


if __name__ == "__main__":
    main()
