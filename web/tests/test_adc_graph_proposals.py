"""Regression checks for native PDF graph proposals (SIM QA / NEVER navigable).
Run from repo root: python -m pip install shapely
python web/tests/test_adc_graph_proposals.py
"""
import importlib.util
import json
import tempfile
from pathlib import Path

script=Path(__file__).resolve().parents[1]/"tools"/"adc_graph_proposals.py"
spec=importlib.util.spec_from_file_location("adc_graph_proposals",script)
mod=importlib.util.module_from_spec(spec);spec.loader.exec_module(mod)

SH="a"*64
sample={
 "airport":"TEST","cycle":"2621","page":1,"sourceSha256":SH,
 "traces":[
  {"id":"P1_D1_S0","sourceDrawingIds":[1],"points":[[10,10],[20,10]]},
  {"id":"P1_D2_S0","sourceDrawingIds":[2],"points":[[20,10],[30,10]]},
  {"id":"P1_D3_S0","sourceDrawingIds":[3],"points":[[15,5],[15,15]]},
  {"id":"P1_D4_S0","sourceDrawingIds":[4],"points":[[200,200],[210,210]]}
 ]
}
graph=mod.candidate_graph(sample)
assert graph["reviewedContacts"]==0
assert all(q["reviewed"] is False for q in graph["contacts"])
assert any(q["kind"]=="ENDPOINT_ENDPOINT" and set(q["touches"])==
           {"P1_D1_S0","P1_D2_S0"} for q in graph["contacts"])
assert any(q["kind"]=="INTERIOR_CROSSING_UNVERIFIED" for q in graph["contacts"])
assert graph["counts"]["candidates"]>=2
with tempfile.TemporaryDirectory() as folder:
 root=Path(folder)
 survey={"airport":"TEST","cycle":"2621","source":{"sha256":SH},
   "taxiways":[{"id":"A","sourceLabelPositions":[{"page":1,"x":25,"y":11}]}],
   "stands":[{"id":"115","apron":1,"source":{"page":1,"x":10,"y":9}}]}
 (root/"survey.json").write_text(json.dumps(survey))
 (root/"TEST_page_1_line_candidates.json").write_text(json.dumps(sample))
 mod.run(str(root/"survey.json"),str(root),str(root/"out"))
 result=json.loads((root/"out"/"TEST_graph_review_queue.json").read_text())
 assert len(result["stands"])==1
 assert len(result["taxiways"])==1
 assert result["stands"][0]["leadCandidates"]
 assert result["routeable"] is False
 assert result["verifiedStandLinks"]==0
 assert result["verifiedRunwayGates"]==0
print("PASS: native contacts preserve source identity, crossing unverified, taxi/stand unapproved")