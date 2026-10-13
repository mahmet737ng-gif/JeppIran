"use strict";
/* Airport-sized SYNTHETIC router regression.
 * Real OIIE inventory IDs; FAKE star network geometry, never publish this as an airport graph.
 * Pass of this test is code-QA only; OIIE live source-routing remains UNVERIFIED.
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const {assess,expected}=require("../scripts/taxi-engine/gate-matrix.cjs");
const inv=JSON.parse(fs.readFileSync("web/data/taxi-surveys/OIIE.json","utf8"));
const fake={
 engineVersion:1,airport:"OIIE",cycle:String(inv.cycle),
 coordinateSystem:"WGS84",simulatorTestOnly:true,verified:false,enabled:true,
 source:{provider:"SYNTHETIC-TEST-ONLY",document:"FAKE STAR NETWORK — NEVER DEPLOY",
  sha256:inv.source.sha256,reviewStatus:"SIM_QA_REVIEWED"},
 nodes:{HUB:{lat:35.41,lon:51.15}},edges:[],stands:{},taxiways:{},runways:{}
};
function node(id,lat,lon){fake.nodes[id]={lat,lon}}
function edge(from,to,label,kind="taxiway",props={}){
 fake.edges.push({from,to,label,kind,quality:"mapped",
  source:{provider:"SYNTHETIC",document:"CODE TEST ONLY",feature:label+":"+from+":"+to},...props});
}
inv.stands.forEach((stand,i)=>{
 const id="S"+i;
 node(id,35.41001+i*.00004,51.1501);
 edge("HUB",id,"STAND","stand");
 fake.stands[stand.id]={node:id};
});
inv.taxiways.forEach((t,i)=>{
 const id="T"+i;
 node(id,35.412+i*.00005,51.1503);
 edge("HUB",id,t.id);
 fake.taxiways[t.id]={terminalNode:id};
});
inv.runwayPolygons.flatMap(r=>r.ends.map(end=>({end,physical:r.physicalId})))
 .forEach(({end,physical},i)=>{
  const hold="H"+i,runwayNode="RW"+i;
  node(hold,35.42+i*.0002,51.151);
  node(runwayNode,35.4201+i*.0002,51.151);
  edge("HUB",hold,"CONNECTOR","connector");
  edge(hold,runwayNode,"BT"+end,"runway",{physicalRunway:physical});
  fake.runways[end]={goalNode:hold,goalKind:"hold",physicalId:physical,
   axis:[fake.nodes[hold],fake.nodes[runwayNode]],
   axisSource:{provider:"SYNTHETIC",document:"NOT REAL"}};
 });
const totals=expected(inv.stands.length,inv.taxiways.length,4);
assert.equal(totals.total,17018);
const result=assess(inv,fake);
assert.equal(result.passed,17018,JSON.stringify(result.failures.slice(0,8)));
assert.equal(result.executed,17018);
assert.equal(result.failed,0);
assert.equal(result.ready,true);
for(const family of ["standRunway","standStand","taxiStand","taxiRunway","taxiTaxi"])
 assert.ok(result.cases.some(c=>c.kind===family&&c.ok),family+" never exercised");
// Example specific requested stand-to-stand command, both directions.
for(const [a,b] of [["204","314"],["314","204"]]){
 const row=result.cases.find(c=>c.kind==="standStand"&&c.from==="ST"+a&&c.to==="ST"+b);
 assert.equal(row?.ok,true,"Synthetic parser failed ST"+a+" ST"+b);
}
// Remove a physical taxiway leg: matrix MUST reject formerly connected endpoints.
const broken={...fake,edges:fake.edges.filter(e=>!(e.from==="HUB"&&e.to==="T0"))};
const failure=assess(inv,broken);
assert.equal(failure.ready,false,"Disconnection must never be marked READY");
assert.ok(failure.failed>0,"Missing taxiway edge should block affected routes");
assert.ok(failure.failures.some(x=>/taxiTaxi|taxiStand|taxiRunway/.test(x)));
assert.equal(assess(inv,null).passed,0,"Missing real OIIE graph must fail closed");
console.log("SYNTHETIC CODE QA PASS: all 17,018 directions, 103 source IDs, 24 taxiway labels, four runway holds.");
console.log("SYNTHETIC NEGATIVE QA PASS: deleting one link prevents release; real OIIE graph remains absent.");
