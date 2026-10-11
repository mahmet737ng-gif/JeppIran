#!/usr/bin/env python3
"""Join chart-issued pushback taxiway references with actual nearest OSM edges.
A match between printed name and proximity is corroboration, NOT proof of
continuous lead-out geometry or ATC permission.
"""
import json,sys
from pathlib import Path
if len(sys.argv)!=4:raise SystemExit("Usage: enrich_ltfm_stand_candidates.py candidates.json pushback.json output.json")
c=json.loads(Path(sys.argv[1]).read_text())
p=json.loads(Path(sys.argv[2]).read_text())
assert c["airport"]==p["airport"]=="LTFM" and str(c["cycle"])==str(p["cycle"])=="2621"
official=0;matched=0;namedlinks=0;unmatched=[]
for sid,entry in c["stands"].items():
    matching=[p["rows"][i] for i in p["standRows"].get(sid,[])]
    targets=list(dict.fromkeys(t for row in matching for t in row["publishedTaxiwaysMentioned"]))
    entry["publishedPushbackTaxiways"]=targets
    entry["pushbackSourceCharts"]=sorted(set(row["sourceChart"] for row in matching))
    entry["publishedPushbackKnown"]=bool(matching)
    if matching:official+=1
    valid=0
    for candidate in entry["candidates"]:
        is_named=candidate.get("taxiway") in targets
        candidate["chartNamedTaxiwayMatch"]=is_named
        candidate["evidence"]="PUBLISHED_NAME_AND_NEARBY_EDGE" if is_named else "PROXIMITY_ONLY"
        # APPROVAL IS NEVER INFERRED FROM THIS MATCH:
        candidate["connectorVerified"]=False
        candidate["routingApproved"]=False
        valid+=int(is_named);namedlinks+=int(is_named)
    entry["chartNameAndProximityAgree"]=valid>0
    entry["candidateOnlyNotTaxiClearance"]=True
    matched+=int(valid>0)
    if matching and not valid:unmatched.append(sid)
c["pushbackSource"]="Jeppesen LTFM 30-9J2..J12 cycle 2621"
c["stats"]["standsWithPublishedPushback"]=official
c["stats"]["standsWithMatchedPublishedTaxiwayCandidate"]=matched
c["stats"]["candidateEdgesAgreeingWithChartPushbackNames"]=namedlinks
c["stats"]["standsWithPublishedInstructionsButNoNearbyNamedEdge"]=len(unmatched)
c["unmatchedPublishedStandIds"]=unmatched
c["routingApproved"]=False
Path(sys.argv[3]).write_text(json.dumps(c,indent=2)+"\n",encoding="utf8")
print(c["stats"])
