#!/usr/bin/env python3
"""Publish an isolated admin-QA *preview* at /admin-test/ (no privileged backend)."""
import importlib.util
import json
import pathlib
import re
import shutil
import tempfile

ROOT = pathlib.Path("web")
PREVIEW = ROOT / "admin-test"
assert (ROOT / "offline-assets.json").is_file(), "Build production manifest first"
assert (ROOT / "charts").is_dir(), "Build downloadable charts first"


def change(path, old, new):
    text = path.read_text(encoding="utf-8")
    if old not in text:
        raise RuntimeError("Preview source unexpectedly changed: " + str(path) + " / " + old)
    path.write_text(text.replace(old, new), encoding="utf-8")


with tempfile.TemporaryDirectory(prefix="jeppiran-admin-preview-") as tempdir:
    draft = pathlib.Path(tempdir) / "admin-test"
    shutil.copytree(ROOT, draft, ignore=shutil.ignore_patterns("admin-test"))
    index = draft / "index.html"
    change(index, "</head>", '<script>window.JEPPIRAN_TEST_ADMIN = true;</script>\n</head>')
    change(index, "</body>", '<script src="./admin-test-controls.js" defer></script>\n</body>')
    change(index, "<title>JeppIran", "<title>ADMIN TEST · JeppIran")

    # Admin QA is intentionally ONLINE-ONLY: do not sync PDFs to browser storage.
    html = index.read_text(encoding="utf-8")
    html, removed = re.subn(r'<script src="\./offline-manager\.js\?[^"]+" defer></script>', '', html, count=1)
    if removed != 1:
        raise RuntimeError("Admin preview offline-manager script was not found")
    index.write_text(html, encoding="utf-8")
    change(draft / "manifest.webmanifest", '"name": "JeppIran"', '"name": "JeppIran · Admin QA Preview"')
    change(draft / "manifest.webmanifest", '"short_name": "JeppIran"', '"short_name": "JeppIran TEST"')
    for path in (draft / "service-worker.js", draft / "offline-manager.js", draft / "app.js"):
        source = path.read_text(encoding="utf-8")
        for before, after in [
            ("jeppiran-offline-meta-v2", "jeppiran-test-offline-meta-v2"),
            ("jeppiran-offline-layer-v2-", "jeppiran-test-offline-layer-v2-"),
            ("jeppiran-all-offline-assets-v1", "jeppiran-test-all-offline-assets-v1"),
            ("jeppiran-chart-pdfs-v2621-printclean-3", "jeppiran-test-chart-pdfs-v2621-printclean-3"),
        ]:
            source = source.replace(before, after)
        if path.name == "app.js":
            previous = 'if("serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){'
            if previous not in source:
                raise RuntimeError("Admin QA service-worker registration source changed")
            source = source.replace(previous, 'if(false&&"serviceWorker" in navigator){')
        if path.name == "service-worker.js":
            source = source.replace('const CACHE="jeppiran-pwa-', 'const CACHE="jeppiran-test-pwa-')
            source = source.replace('key.startsWith("jeppiran-pwa-")', 'key.startsWith("jeppiran-test-pwa-")')
            source = source.replace(
                '"./offline-assets.json",',
                '"./offline-assets.json","./admin-test-controls.js",',
            )
        path.write_text(source, encoding="utf-8")
    qa = pathlib.Path("scripts/admin-test-controls.js").read_text(encoding="utf-8")
    (draft / "admin-test-controls.js").write_text(qa, encoding="utf-8")
    # Recreate checksums after changing the preview files; do not alter live manifest.
    spec = importlib.util.spec_from_file_location("offline_manifest", "scripts/build_offline_manifest.py")
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    module.WEB = draft
    module.OUT = draft / "offline-assets.json"
    manifest = module.make_manifest()
    module.OUT.write_text(json.dumps(manifest, ensure_ascii=False, separators=(",", ":")) + "\n",
                          encoding="utf-8")
    assert manifest["pdfs"] and any(x["url"] == "./admin-test-controls.js" for x in manifest["assets"])
    assert manifest["totalBytes"] > 1_000_000
    if PREVIEW.exists():
        shutil.rmtree(PREVIEW)
    shutil.copytree(draft, PREVIEW)
    print("JEPPIRAN admin QA preview ready at /admin-test/:",
          len(manifest["assets"]), "assets and", len(manifest["pdfs"]), "PDFs")
