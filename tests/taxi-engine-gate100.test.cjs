"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {audit100}=require("../scripts/taxi-engine/gate100.cjs");
const original=JSON.parse(fs.readFileSync("tests/fixtures/taxi-engine/ZZZZ.json","utf8"));
const copy=x=>JSON.parse(JSON.stringify(x));
const sha="a".repeat(64);
const inventory={airport:"ZZZZ",cycle:"2621",source:{sha256:sha},
 stands:[{id:"101"},{id:"109"}],
 taxiways:[{id:"J"},{id:"H"},{id:"B"}],
 runwayPolygons:[
 {physicalId:"13R/31L",ends:["13R","31L"]},
 {physicalId:"13L/31R",ends:["13L","31R"]}
 ]};
const healthy=copy(original);
healthy.enabled=true;
healthy.source={...healthy.source,sha256:sha,reviewStatus:"SIM_QA_REVIEWED"};
healthy.runways["13L"].goalKind="hold";
healthy.runways["31R"].goalNode="H1";
healthy.runways["31R"].goalKind="hold";
// Synthetic fixture: four DISTINCT original-source-reviewed runway hold points,
// two published physical runway axes, and four explicit runway-only BT indices.
const attachments=[
 ["13R","J1",36.000002,59.000301],
 ["31L","J1",36.000003,59.000302],
 ["13L","H1",36.000004,59.000801],
 ["31R","H1",36.000005,59.000802]
];
for(let i=0;i<attachments.length;i++){
 const [end,entry,lat,lon]=attachments[i],node="H_"+end;
 healthy.nodes[node]={lat,lon};
 healthy.edges.push({from:entry,to:node,label:"HOLD"+end,
  kind:"connector",quality:"mapped",
  source:{provider:"Synthetic",document:"TEST-1",feature:"holding-"+end}});
 healthy.runways[end].goalNode=node;
 healthy.runways[end].goalKind="hold";
 healthy.runways[end].holdShortReviewed=true;
 healthy.runways[end].holdSource={verified:true,page:380,sourceDrawingIds:[10+i]};
}
healthy.nodes.RW3={lat:36.001,lon:59.0004};
healthy.nodes.RW4={lat:36.001,lon:59.0006};
for(const [end,from,to,physical] of [
 ["31L","RW1","RW0","13R/31L"],
 ["13L","RW3","RW4","13L/31R"],
 ["31R","RW4","RW3","13L/31R"]
]){
 healthy.edges.push({from,to,label:"BT"+end,kind:"runway",
   quality:"mapped",physicalRunway:physical,
   source:{provider:"Synthetic",document:"TEST-1",feature:"runway-"+end}});
}
const good=audit100({inventory,graph:healthy});
assert.equal(good.readyForSimulatorTest,true,JSON.stringify({fail:good.failures.slice(0,12)}));
assert.equal(good.percent,100);
assert.equal(good.totals.expected,16);
assert.equal(good.totals.passed,16);
assert.equal(good.simulatorCheckPending,true);
assert.equal(good.flightOperationalApproval,false);
// Alter one dimension at a time: no fake 100%-ready claims.
const missingStand=copy(healthy);delete missingStand.stands["109"];
assert.equal(audit100({inventory,graph:missingStand}).readyForSimulatorTest,false);
const missingHold=copy(healthy);missingHold.runways["31R"].goalNode=null;
assert.equal(audit100({inventory,graph:missingHold}).readyForSimulatorTest,false);
const missingTwy=copy(healthy);missingTwy.edges=missingTwy.edges.filter(e=>e.label!=="B");
assert.equal(audit100({inventory,graph:missingTwy}).readyForSimulatorTest,false);
const blockedSource=copy(healthy);blockedSource.source.sha256="b".repeat(64);
assert.equal(audit100({inventory,graph:blockedSource}).readyForSimulatorTest,false);
const noReview=copy(healthy);noReview.source.reviewStatus="NOT REVIEWED";
assert.equal(audit100({inventory,graph:noReview}).readyForSimulatorTest,false);
const noGraph=audit100({inventory,graph:null});
assert.equal(noGraph.readyForSimulatorTest,false);
assert.equal(noGraph.percent,0);
const omitted=copy(inventory);omitted.stands.push({id:"999"});
assert.equal(audit100({inventory:omitted,graph:healthy}).readyForSimulatorTest,false);
const extraRunway=copy(inventory);extraRunway.runwayPolygons.push({physicalId:"03/21",ends:["03","21"]});
assert.equal(audit100({inventory:extraRunway,graph:healthy}).readyForSimulatorTest,false);
console.log("PASS: exhaustive stand x runway x both directions gate, full verified coverage, false-ready rejections");
