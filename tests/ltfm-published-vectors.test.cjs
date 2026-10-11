"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const vectors=load("web/data/taxi-procedure-traces/LTFM.json");
const labels=load("web/data/taxi-chart-labels/LTFM.json");
const catalog=load("web/data/taxi-procedures/LTFM.json");
test("All 35 chart-derived procedures are source-traced and cycle matched",()=>{
  assert.equal(vectors.airport,"LTFM");assert.equal(vectors.cycle,"2621");
  assert.equal(vectors.procedures.length,35);
  assert.equal(catalog.procedures.length,35);
  for(const p of vectors.procedures){
    assert(p.sourceChart.startsWith("30-9"));
    assert(p.printedSegments.length>0);
    assert.equal(p.nodeGeometryVerified,false);
    assert.equal(p.standConnectorMapped,false);
    for(const v of p.printedSegments){
      assert(v.length===4&&v.every(Number.isFinite));
      assert(v.every(x=>x>=0&&x<=792));
    }
  }
});
test("Published RWY17R DEP2F route is exact and distinct from stand pushback",()=>{
  const hit=vectors.procedures.filter(p=>p.key==="17R2F"&&p.operation==="DEPARTURE");
  assert.equal(hit.length,1);
  assert.deepEqual(hit[0].taxiways,["G","N2","D","B","B9A"]);
  assert.equal(hit[0].holdShortOf,"17R");
  assert.equal(hit[0].sourceChart,"30-9G3");
  assert(hit[0].printedSegments.length>=40);
});
test("All 41 chart-label-only locations remain unverified as route geometry",()=>{
  assert.equal(labels.airport,"LTFM");assert.equal(labels.cycle,"2621");
  const entries=Object.entries(labels.missingCenterlineLabels);
  assert.equal(entries.length,41);
  assert(entries.every(([,entry])=>entry.labelPoints.length>0));
  assert(entries.every(([,entry])=>entry.routingApproved===false));
  assert(entries.every(([,entry])=>entry.geometryStatus==="LABEL_ONLY_NO_CENTERLINE"));
});
test("Procedure number duplicate requires explicit ARR/DEP",()=>{
  const hits=vectors.procedures.filter(p=>p.key==="183F");
  assert.equal(hits.length,2);
  assert.deepEqual(hits.map(p=>p.operation).sort(),["ARRIVAL","DEPARTURE"]);
});
