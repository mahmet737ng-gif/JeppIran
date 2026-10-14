#!/usr/bin/env python3
"""Append source-reviewed, measured non-OIII georefs; protect all existing charts."""
import hashlib,json,sys
from pathlib import Path
sys.path.insert(0,"scripts")
from extract_chart_georef import atomic_json
web=Path("web/data/chart-georef.json")
android=Path("app/src/main/assets/chart-georef.json")
source=Path("/tmp/non-oiii-31-candidates.json")
qa=Path("/tmp/non-oiii-31-qareport.json")
base=json.loads(web.read_text())
local=json.loads(android.read_text())
update=json.loads(source.read_text())
evaluation=json.loads(qa.read_text())
assert base["source"]==local["source"]==update["source"]
assert base["source"]["chartDataVersion"]=="V2621"
assert len(update["charts"])+len(evaluation["blocked"])==31
assert all(v["airport"]!="OIII" for v in update["charts"])
source_index={int(r["page"]):r for r in json.loads(Path("web/data/charts-current.json").read_text())}
old={int(r["page"]):r for r in base["charts"]}
old_native={int(r["page"]):r for r in local["charts"]}
assert old==old_native,"Web and native assets differ; do not clobber either"
before_oiii={page:rec for page,rec in old.items() if rec["airport"]=="OIII"}
before_sha=hashlib.sha256(json.dumps(before_oiii,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
published=[]
existing=[]
for chart in update["charts"]:
    page=int(chart["page"])
    assert source_index[page]["airport"]==chart["airport"]!="OIII"
    assert chart["sourceFingerprint"] and chart["validation"]["sourceTickVerified"]
    assert chart["validation"]["qaTestOnly"] and chart["validation"]["notApprovedForNavigation"]
    assert chart["coordinateSpace"]=="pdf_points"
    if page in old:
        if old[page]!=chart:
            print("PROTECTED EXISTING georef (different source model)",page,chart["airport"],flush=True)
        existing.append(page)
        continue
    old[page]=chart
    published.append(page)
assert all(old[p]==v for p,v in {int(x["page"]):x for x in base["charts"]}.items())
after_oiii={p:chart for p,chart in old.items() if chart["airport"]=="OIII"}
after_sha=hashlib.sha256(json.dumps(after_oiii,sort_keys=True,ensure_ascii=False).encode()).hexdigest()
assert before_oiii==after_oiii and before_sha==after_sha
assert all(x["airport"]!="OIII" for x in update["charts"])
out=dict(base)
out["charts"]=[old[p] for p in sorted(old)]
for target in [web,android]:
    atomic_json(target,out)
    check=json.loads(target.read_text())
    assert {int(c["page"]):c for c in check["charts"] if c["airport"]=="OIII"}==before_oiii
    assert len(check["charts"])==len(old)
doc={
  "source":base["source"],"scope":"visual_review_31_except_OIII",
  "requestedPages":31,"newlyPublishedCount":len(published),"newlyPublishedPages":sorted(published),
  "alreadyPresentCount":len(existing),"alreadyPresentPages":sorted(existing),
  "rejectedCount":len(evaluation["blocked"]),"rejectedPages":evaluation["blocked"],
  "Mehrabad_OIII":{"frozen":True,"beforeSHA256":before_sha,"afterSHA256":after_sha,
                     "recordCount":len(before_oiii),"modified":False},
  "webAndAndroidAssetsIdentical":True,
  "note":"Source-specific graticule QA and boxed-inset masks. Simulator test candidates only; not certified for actual navigation."
}
atomic_json(Path("docs/georeferencing/V2621_31_NON_OIII_PUBLICATION.json"),doc)
print("APPENDED",sorted(published),"unchanged OIII",len(before_oiii),before_sha,flush=True)
print("INCOMPLETE",evaluation["blocked"],flush=True)
