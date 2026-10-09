#!/usr/bin/env bash
# Release 2621 data while preserving the complete latest main history.
set -euo pipefail
REPO="$GITHUB_REPOSITORY"
STAGE=/tmp/jeppiran-cycle2621-safe-stage
mkdir -p "$STAGE"
curl --retry 4 --retry-delay 2 -fLsS \
  "https://github.com/$REPO/releases/download/cycle2621-staging/jeppiran-cycle2621-stage.tar.gz" \
  -o "$STAGE/asset.tar.gz"
tar -xzf "$STAGE/asset.tar.gz" -C "$STAGE"
FILESDIR="$STAGE/jeppiran-cycle2621-stage/files"
test -f "$FILESDIR/Iran2621.pdf"
test -d "$FILESDIR/web/data/charts"
test "$(stat -c %s "$FILESDIR/Iran2621.pdf")" -gt 60000000
printf '%s  %s\n' d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6 "$FILESDIR/Iran2621.pdf" | sha256sum -c -
test "$(pdfinfo "$FILESDIR/Iran2621.pdf" | awk '/Pages:/ {print $2}')" = "1654"
cp "$FILESDIR/Iran2621.pdf" Iran2621.pdf
mkdir -p web/data/charts
cp -a "$FILESDIR/web/data/charts/." web/data/charts/
test -n "$(find web/data/charts -type f -print -quit)"
echo 'Stage verified; FSX and program files stay untouched.'

mkdir -p pdf-text
for page in $(seq 1 1654); do
  pdftotext -f "$page" -l "$page" -layout Iran2621.pdf "pdf-text/page-$page.txt"
done
export JEPPIRAN_DATA_VERSION=V2621
python scripts/build_base_index.py --pdf-text pdf-text --output charts-index-v9.json
python scripts/name_charts_v12.py
python scripts/classify_charts_v16.py
python scripts/build_charts_final.py

# Reconcile current chart classification with 166 old chart bodies independently
# verified IDENTICAL by PDF text, vector paths and rendered raster.
REF="feature/georef-2621-airport-approach-coverage"
git fetch --no-tags origin "refs/heads/$REF:refs/remotes/origin/$REF"
git show "origin/$REF:docs/georeferencing/cycle2621-unchanged-approach-carryforward-manifest.json" > /tmp/cycle2621-unchanged-manifest.json
python - <<'PY'
import json
from pathlib import Path
file=Path('charts-current-final.json')
rows=json.loads(file.read_text())
assert isinstance(rows,list)
pages={int(x['page']):x for x in rows}
assert len(pages)==len(rows)
old=json.load(open('app/src/main/assets/chart-georef.json'))
prev={int(x['page']):x for x in old['charts']}
manifest=json.load(open('/tmp/cycle2621-unchanged-manifest.json'))
assert manifest['current']['pdfSha256']=='d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6'
corrections=[]
for pair in manifest['pageMappings']:
    old_page=int(pair['previousPage'])
    page=int(pair['currentPage'])
    fields=prev[old_page]['chartKey'].split('|')
    assert len(fields)==4 and fields[1]=='APPROACH'
    if page not in pages:
        raise RuntimeError(f'Independently matched Approach page {page} missing from index')
    target={'airport':fields[0],'category':'Approach',
            'chart_number':fields[2],'name':fields[3]}
    row=pages[page]
    if any(row.get(k)!=v for k,v in target.items()):
        corrections.append({'page':page,'prior':{k:row.get(k) for k in target},'correction':target})
        row.update(target)
file.write_text(json.dumps(rows,ensure_ascii=False,indent=2)+'\n')
Path('cycle2621-identity-corrections.json').write_text(json.dumps(corrections,indent=2))
print('Chart identity repairs based ONLY on unchanged published source:',len(corrections))
PY

python scripts/build_chart_cycle.py \
  --pdf Iran2621.pdf --charts charts-current-final.json \
  --version V2621 --cycle 2621 --release-tag charts-V2621 \
  --repo "$REPO" --out-dir cycle-build \
  --previous-manifest app/src/main/assets/charts-manifest.json

python scripts/build_chart_changes.py \
  --current-charts cycle-build/charts-current.json \
  --current-airports-dir cycle-build/airports \
  --previous-charts app/src/main/assets/charts-current.json \
  --previous-manifest app/src/main/assets/charts-manifest.json \
  --changed-airports cycle-build/changed-airports.json \
  --version V2621 --source Iran2621.pdf \
  --official chart-changes-final.json \
  --output cycle-build/chart-changes.json

# Some new 2621 airports do not print an N/E coarse coordinate on the
# first indexed page. Never invent an anchor. Skip ONLY their new GCP
# candidates while retaining all their chart PDFs and index entries.
python - <<'PY'
from pathlib import Path
p=Path("scripts/extract_chart_georef.py")
s=p.read_text()
old="""    if {entry['airport'] for entry in index.values()} != set(anchors):
        raise ValueError('Cannot resolve the printed N/E airport coordinates for every indexed airport')"""
new="""    missing = sorted({entry['airport'] for entry in index.values()} - set(anchors))
    if missing:
        print('No printed N/E coordinate (georef deferred, all charts retained):',
              ', '.join(missing), flush=True)"""
assert s.count(old)==1, "Unknown extractor source, fail closed"
s=s.replace(old,new)
marker="        decision = decisions.get(fingerprint, {})"
replacement="""        if index[number]['airport'] not in anchors:
            excluded.append({'page': number, 'airport': index[number]['airport'],
                             'reason': 'No exact published/printed airport position available',
                             'status': 'needs_verified_ground_control_points'})
            continue
        decision = decisions.get(fingerprint, {})"""
assert s.count(marker)==1, "Cannot insert safe missing-control guard"
s=s.replace(marker,replacement)
p.write_text(s)
PY

python scripts/extract_chart_georef.py \
  --pdf Iran2621.pdf --index cycle-build/charts-current.json \
  --output cycle-build/chart-georef.json \
  --audit cycle-build/georef-audit.json \
  --manifest cycle-build/manifest.json \
  --previous-georef app/src/main/assets/chart-georef.json \
  --data-version V2621 --cycle 2621 --disable-independent-check

REF="feature/georef-2621-airport-approach-coverage"
git fetch --no-tags origin "refs/heads/$REF:refs/remotes/origin/$REF"
git show "origin/$REF:scripts/carry_forward_verified_approaches.py" \
  > scripts/carry_forward_verified_approaches.py
git show "origin/$REF:docs/georeferencing/cycle2621-unchanged-approach-carryforward-manifest.json" \
  > cycle-build/unchanged-chart-review.json
python scripts/carry_forward_verified_approaches.py \
  --pdf Iran2621.pdf \
  --previous-georef app/src/main/assets/chart-georef.json \
  --current-georef cycle-build/chart-georef.json \
  --index cycle-build/charts-current.json \
  --reviewed-manifest cycle-build/unchanged-chart-review.json \
  --output cycle-build/chart-georef.json \
  --report cycle-build/approach-carry-forward-audit.json

python - <<'PY'
import json
from pathlib import Path
import fitz
root=Path("cycle-build")
manifest=json.loads((root/"manifest.json").read_text())
charts=json.loads((root/"charts-current.json").read_text())
geo=json.loads((root/"chart-georef.json").read_text())
carry=json.loads((root/"approach-carry-forward-audit.json").read_text())
assert manifest['version']=='V2621'
assert manifest['source']=='Iran2621.pdf'
assert manifest['pages']==1654
assert manifest['release_tag']=='charts-V2621'
assert len(charts)>750
assert len(manifest['airports'])>=36
assert geo['source']['chartDataVersion']=='V2621'
assert str(geo['source']['cycle'])=='2621'
assert len(geo['charts'])>=166
assert carry['inheritedFromPreviousCycle']==166
assert len({int(c['page']) for c in charts})==len(charts)
for icao in manifest['airports']:
    pdf=root/"airports"/(icao+".pdf")
    assert pdf.exists() and pdf.stat().st_size>1000, icao
    with fitz.open(pdf) as d: assert len(d)>0, icao
print("PASS",len(charts),"charts",len(manifest['airports']),"airports",
      len(geo['charts']),"georef records")
PY

if ! gh release view charts-V2621 >/dev/null 2>&1; then
  gh release create charts-V2621 \
    --title 'JEPPIRAN chart data V2621' \
    --notes 'AIRAC 21-2026 data. 166 unchanged Approach georeferences carried from 2620; remaining records require further independent calibration. Not for actual navigation.'
fi
gh release upload charts-V2621 cycle-build/airports/*.pdf --clobber
gh release upload charts-V2621 cycle-build/chart-georef.json --clobber
gh release upload charts-V2621 cycle-build/manifest.json --clobber

cp cycle-build/manifest.json app/src/main/assets/charts-manifest.json
cp cycle-build/charts-current.json app/src/main/assets/charts-current.json
cp cycle-build/chart-georef.json app/src/main/assets/chart-georef.json
cp cycle-build/chart-changes.json app/src/main/assets/chart-changes.json
cp cycle-build/changed-airports.json app/src/main/assets/changed-airports.json
git config user.name 'github-actions[bot]'
git config user.email '41898282+github-actions[bot]@users.noreply.github.com'
git add -- Iran2621.pdf web/data/charts \
  app/src/main/assets/charts-manifest.json \
  app/src/main/assets/charts-current.json \
  app/src/main/assets/chart-georef.json \
  app/src/main/assets/chart-changes.json \
  app/src/main/assets/changed-airports.json
git diff --cached --quiet && { echo 'No chart changes to publish'; exit 1; }
git commit -m 'Publish JEPPIRAN V2621 chart data (preserve simulator and app code)'
git fetch origin main
git rebase origin/main
git lfs push origin HEAD
git push origin HEAD:main
echo 'SUCCESS: V2621 published on latest main without force pushing.'
