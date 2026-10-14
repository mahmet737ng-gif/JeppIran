#!/usr/bin/env python3
"""JEPPIRAN owner-locked georeferencing: NO DELETE, NO OVERWRITE, ALL CHARTS.

Within one PDF/AIRAC source, previously accepted chart models are immutable.
Between source cycles, preserve the complete previous JSON in a committed,
lossless archive and revalidate source fingerprints before reactivation.
"""
import argparse
import hashlib
import json
import subprocess
from pathlib import Path

CHART_FILES=("app/src/main/assets/chart-georef.json","web/data/chart-georef.json")
ARCHIVE=Path("docs/georeferencing/archived-sources")

class GeorefProtectionError(ValueError):
    pass

def source_id(root):
    source=root.get("source") or {}
    sha=source.get("sha256")
    if not isinstance(sha,str) or len(sha)!=64 or any(c not in "0123456789abcdef" for c in sha):
        raise GeorefProtectionError("Missing/invalid PDF SHA-256")
    if not isinstance(source.get("pageCount"),int) or not source.get("chartDataVersion"):
        raise GeorefProtectionError("Incomplete AIRAC source identity")
    return sha,source["pageCount"],source["chartDataVersion"]

def chart_index(root,label="asset"):
    charts=root.get("charts")
    if not isinstance(charts,list):
        raise GeorefProtectionError(label+": no charts array")
    indexed={}
    for c in charts:
        p=c.get("page")
        if type(p) is not int or p<=0 or p in indexed:
            raise GeorefProtectionError(label+": invalid/duplicate page "+str(p))
        if not c.get("airport") or not c.get("chartKey") or not c.get("sourceFingerprint"):
            raise GeorefProtectionError(label+": missing source identity "+str(p))
        if not isinstance(c.get("points"),list) or len(c["points"])<4:
            raise GeorefProtectionError(label+": missing controls "+str(p))
        indexed[p]=c
    return indexed

def verify_additive(before,after):
    prev=chart_index(before,"previous")
    cur=chart_index(after,"candidate")
    if source_id(before)!=source_id(after):
        raise GeorefProtectionError("PDF/AIRAC changed: archive old references before regenerating")
    for k in ("version","coordinateSystem","coordinateSpace","origin"):
        if before.get(k)!=after.get(k):
            raise GeorefProtectionError("Protected georeference schema altered: "+k)
    lost=sorted(set(prev)-set(cur))
    if lost:
        raise GeorefProtectionError("DELETED existing georeferences: "+str(lost[:30]))
    changed=sorted(p for p in prev if prev[p]!=cur[p])
    if changed:
        raise GeorefProtectionError("OVERWRITTEN existing georeferences: "+str(changed[:30]))
    return {"oldPreserved":len(prev),"newAdded":len(cur)-len(prev),"total":len(cur)}

def archive_path_for(old_text,archive=ARCHIVE):
    sha=hashlib.sha256(old_text.encode("utf-8")).hexdigest()
    return Path(archive)/("georef-"+sha+".json")

def protect_migration(old_text,new_text,archive=ARCHIVE):
    old=json.loads(old_text);new=json.loads(new_text)
    if source_id(old)==source_id(new):
        return verify_additive(old,new)
    chart_index(old,"older AIRAC")
    chart_index(new,"new AIRAC")
    name=archive_path_for(old_text,archive)
    if not name.exists():
        raise GeorefProtectionError("PDF change blocked: immutable old asset not archived: "+str(name))
    if name.read_text(encoding="utf-8")!=old_text:
        raise GeorefProtectionError("Archived source changed or damaged: "+str(name))
    return {"sourceChanged":True,"oldArchived":str(name),"oldMapsNotReusedWithoutSourceQA":True}

def git_text(revision,path):
    p=subprocess.run(["git","show",revision+":"+path],capture_output=True,text=True)
    if p.returncode:
        raise GeorefProtectionError("Cannot inspect git georeferences: "+revision+" "+path)
    return p.stdout

def guard_git(baseline="HEAD^",candidate=None):
    b=[git_text(baseline,p) for p in CHART_FILES]
    c=[git_text(candidate,p) if candidate else Path(p).read_text(encoding="utf-8") for p in CHART_FILES]
    if b[0]!=b[1]:
        raise GeorefProtectionError("Approved Web/Android source assets differ")
    if c[0]!=c[1]:
        raise GeorefProtectionError("New Web/Android source assets differ")
    return protect_migration(b[0],c[0])

def main():
    a=argparse.ArgumentParser(description=__doc__)
    a.add_argument("--baseline-ref",default="HEAD^")
    a.add_argument("--candidate-ref",default="")
    a.add_argument("--archive-ref",default="",help="Export lossless snapshot before switching the AIRAC source")
    args=a.parse_args()
    if args.archive_ref:
        before=git_text(args.archive_ref,CHART_FILES[0])
        if before!=git_text(args.archive_ref,CHART_FILES[1]):
            raise GeorefProtectionError("Source assets differ; cannot archive")
        chart_index(json.loads(before));source_id(json.loads(before))
        path=archive_path_for(before)
        path.parent.mkdir(parents=True,exist_ok=True)
        if path.exists() and path.read_text(encoding="utf-8")!=before:
            raise GeorefProtectionError("Refuse to modify existing immutable archive")
        if not path.exists():
            path.write_text(before,encoding="utf-8")
        print(json.dumps({"sourceArchived":str(path),"commitBeforeCycleSwitch":True}))
    else:
        print(json.dumps({"georeferencesProtected":True,**guard_git(args.baseline_ref,args.candidate_ref or None)}))

if __name__=="__main__":
    main()
