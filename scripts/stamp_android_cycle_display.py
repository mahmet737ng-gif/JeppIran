#!/usr/bin/env python3
"""Apply the published display cycle to the frozen Android-only WebView shell.

Run after the workflow restores the approved Android UI snapshot, and before
build_android_local_web.py copies it into APK assets. The technical V2621 chart
PDFs, geo-reference keys and all existing layouts remain untouched.
"""
import json
from pathlib import Path
import re

ROOT = Path(__file__).resolve().parents[1]
WEB = ROOT / "web"
DATA = json.loads((ROOT / "app/src/main/assets/charts-manifest.json").read_text(encoding="utf-8"))
cycle = str(DATA["display_cycle"])
version = "V" + cycle
assert cycle == "2623"
assert DATA["display_effective_from"] == "2026-11-05"
assert DATA["display_effective_to"] == "2026-11-19"

def change(path, old, new, required=True):
    target = WEB / path
    text = target.read_text(encoding="utf-8")
    if required and old not in text:
        raise RuntimeError(f"Cannot stamp {path}: missing {old[:90]!r}")
    target.write_text(text.replace(old, new), encoding="utf-8")

index = WEB / "index.html"
html = index.read_text(encoding="utf-8")
html, number = re.subn(r'data-jeppiran-build="[^"]+"',
                       f'data-jeppiran-build="{cycle}-android-cycle-display-r1"', html, count=1)
if number != 1:
    raise RuntimeError("Android shell build marker not found")
html = html.replace('<title>JeppIran V2620</title>', f'<title>JeppIran {version}</title>')
html = html.replace('V2621 • iPad Web', f'{version} • Android')
html = html.replace('id="homeCycle">V2620', f'id="homeCycle">{version}')
html = html.replace('content="JeppIran"', f'content="JeppIran {cycle}"', 1)
if f'id="homeCycle">{version}' not in html or f'<title>JeppIran {version}</title>' not in html:
    raise RuntimeError("Frozen Android HTML layout/version unexpectedly changed")
index.write_text(html, encoding="utf-8")

app = WEB / "app.js"
js = app.read_text(encoding="utf-8")
js, count = re.subn(r'const VERSION="V[0-9]{4}";', f'const VERSION="{version}";', js, count=1)
if count != 1:
    raise RuntimeError("Frozen Android app VERSION not found")
old = 'if($("#homeCycle"))$("#homeCycle").textContent=(m.version||VERSION);'
new = ('if($("#homeCycle"))$("#homeCycle").textContent='
       '("V"+String(m.display_cycle||m.cycle||m.version||VERSION).replace(/^V/i,""));')
if old not in js:
    raise RuntimeError("Frozen Android home cycle update not found")
js = js.replace(old, new)
js = js.replace('$("#updateSubtitle").textContent=(m.version||VERSION)+" data • "',
                '$("#updateSubtitle").textContent=("V"+String(m.display_cycle||m.cycle||m.version||VERSION).replace(/^V/i,""))+" data • "')
old = 'const cycle=String(source?.cycle||source?.version||"").replace(/^V/i,"");'
new = (
    'const cycle=String(source?.display_cycle||source?.cycle||source?.version||"").replace(/^V/i,"");\n'
    '  const from=parseUtcCycleDate(source?.display_effective_from);\n'
    '  const through=parseUtcCycleDate(source?.display_effective_to);\n'
    '  if(from&&through&&through.getTime()>=from.getTime())\n'
    '    return {cycle,from,until:new Date(through.getTime()+86400000)};\n'
    '  if(cycle==="2623")return {cycle,from:new Date(Date.UTC(2026,10,5)),until:new Date(Date.UTC(2026,10,20))};'
)
if old not in js:
    raise RuntimeError("Frozen Android validity calculation not found")
js = js.replace(old, new)
js = js.replace('Cycle 2621: 09 Oct 2026; 2622: 23 Oct 2026.',
                'Cycle 2621: 09 Oct 2026; 2623 display validity: 05–19 Nov 2026.')
app.write_text(js, encoding="utf-8")

change("profile-minimal.js", "<small>V2621 · Select a chart to open</small>",
       f"<small>{version} · Select a chart to open</small>")
manifest = WEB / "manifest.webmanifest"
meta = json.loads(manifest.read_text(encoding="utf-8"))
meta["name"] = f"JeppIran {cycle}"
meta["short_name"] = f"JeppIran {cycle}"
manifest.write_text(json.dumps(meta, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
print(f"Android frozen UI stamped: {version}, validity 05 Nov–19 Nov 2026")
