"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const taxi=require("../web/taxi-engine.js");
const fixture=JSON.parse(fs.readFileSync("tests/fixtures/taxi-engine/ZZZZ.json","utf8"));
const valid=taxi.validate(fixture);
assert(valid.ok,valid.errors.join("\n"));
const engine=taxi.create(fixture);
assert.equal(engine.airport,"ZZZZ");
assert.equal(engine.parse("ST101 J BT13R H 13L").destination.id,"13L");
assert.deepEqual(engine.parse("ST101 J BT13R H RWY 13L").via,["J","BT13R","H"]);
assert.deepEqual(engine.parse("ST101 J BT13R H 13L").via,["J","BT13R","H"]);
assert.equal(engine.parse("ST101").destination.id,"101");
assert.equal(engine.parse("31R").destination.kind,"runway");
assert.equal(engine.plan("ST101 J BT13R H 31R").error?.includes("no reviewed"),true);

// Projected runway/taxiway connectors are NOT silently authorized even
// when an explicit BT token was entered. QA preview requires opt-in.
const strict=engine.plan("ST101 J BT13R H 13L");
assert(!strict.route&&/connected/.test(strict.error),strict.error);
const result=engine.plan("ST101 J BT13R H 13L",{allowProjectedQA:true});
assert(result.route,result.error);
assert.deepEqual(result.route.path,[
  "S101","R0","J0","J1","RW0","RW1","RW2","H0","H1"
]);
assert.deepEqual(result.route.taxiways,["J","BT13R","H"]);
assert.equal(result.route.destination,"RWY 13L · access-qa");
assert.equal(result.route.explicitRunway,true);
assert(result.route.lengthMetres>50);
const linework=engine.linework(result.route);
assert(linework.some(x=>x.style==="dashed-amber"));
assert(linework.some(x=>x.style==="solid-magenta"&&x.kind==="runway"));
assert(linework.some(x=>x.geometry===undefined&&x.coordinates.length>=3),
 "Polyline must retain intermediate vertices; never replace runway with a direct chord.");
const entry=linework.find(x=>x.style==="dashed-amber");
assert(entry.coordinates.length>=2);

// No implicit runway crossing for destination-only travel; solver must
// choose the longer civilian connected B connector.
const stand=engine.plan("ST101 ST109");
assert(stand.route,stand.error);
assert.equal(stand.route.explicitRunway,false);
assert(!stand.route.edges.some(e=>e.kind==="runway"));
assert(stand.route.path.includes("B0")&&stand.route.path.includes("B1"));
assert.equal(stand.route.path.at(-1),"ST109");

// Remove civilian bypass: an inferred runway shortcut must NOT suddenly
// become available just because it is shorter.
const blocked=JSON.parse(JSON.stringify(fixture));
blocked.edges=blocked.edges.filter(e=>e.label!=="B");
const blockedEngine=taxi.create(blocked);
assert(!blockedEngine.plan("ST101 ST109").route);
assert(!blockedEngine.plan("ST101 ST109",{allowProjectedQA:true}).route);

// A destination-only runway request resolves only the chart-provided goal;
// 31R without one must be refused, rather than guessed from other runways.
assert.equal(engine.plan("ST101 13R").route?.path.at(-1),"J1");
assert(/no reviewed/.test(engine.plan("ST101 31R").error));
const d=engine.destinations();
assert.equal(d.stands.length,2);
assert(d.runways.find(x=>x.id==="31R"&&!x.mapped));
assert.equal(fixture.runways["13R"].physicalId,fixture.runways["31L"].physicalId);
assert.notEqual(fixture.runways["13R"].physicalId,fixture.runways["13L"].physicalId);
assert.notDeepEqual(fixture.runways["13R"].axis,fixture.runways["13L"].axis);

// Raw path must be preserved, not modified by plan/render.
assert.equal(fixture.edges[4].geometry.length,3);
assert.equal(fixture.edges[4].geometry[1].lat,36.00002);

// Current ground location must actually snap to a MAPPED node.
const pos={lat:36,lon:59,accuracy:4,groundspeed:0};
assert(engine.plan("ST109",{position:pos}).route===undefined,
  "Do not snap an aircraft to a parked stand as a live position");
const enroute=engine.plan("ST109",{position:{lat:36,lon:59.00021,accuracy:4,groundspeed:2}});
assert(enroute.route,enroute.error);
assert(!engine.plan("ST109",{position:{lat:0,lon:0}}).route);
assert(!engine.plan("ST109",{position:{lat:36,lon:59.0002,accuracy:90}}).route);

// Two sustained deviations. Accurate live routes without runway can
// reroute; named runway routes must seek a NEW clearance, not improvise.
const active={command:"ST109",route:enroute.route,monitor:{count:0,last:0}};
const off={lat:36.0009,lon:59.0003,accuracy:4,groundspeed:3};
assert(["checking","on-route"].includes(engine.monitor(active,off,10000).status));
const next=engine.monitor(active,off,11000);
assert(["replanned","unmapped","on-route"].includes(next.status));
const running={command:"ST101 J BT13R H 13L",route:result.route,monitor:{count:0,last:0}};
const far={lat:36.0009,lon:59.0007,accuracy:4,groundspeed:2};
engine.monitor(running,far,15000);
assert.equal(engine.monitor(running,far,16000).status,"reclearance-required");

// Fail-closed validation: no mystery source, synthetic geometry, or
// no-source edge can be published as verified.
for(const mutate of [
 g=>{g.edges[0].source=null},
 g=>{g.edges[0].to="FAKE"},
 g=>{g.edges[0].kind="runway"},
 g=>{g.edges[4].geometry[0].lon+=.001},
 g=>{g.runways["13L"].goalNode="FAKE"},
 g=>{g.runways["31R"].axis=g.runways["31R"].axis.slice(0,1)}
]){
 const g=JSON.parse(JSON.stringify(fixture));mutate(g);
 assert.equal(taxi.validate(g).ok,false,"Unsafe graph passed validation");
}
// Legacy-compatible converter consumes raw OIMM and LTFM graph data,
// without altering either published graph or the current route implementations.
const oimm=JSON.parse(fs.readFileSync("web/data/taxi-networks/OIMM.json","utf8"));
const ltfm=JSON.parse(fs.readFileSync("web/data/taxi-networks/LTFM.json","utf8"));
const oldSize=oimm.edges.length;
const profile={physicalRunways:{BT13R:"13R/31L",BT31L:"13R/31L"},
 runways:{"13R":{physicalId:"13R/31L",goalNode:oimm.taxiways.J.exitNode,goalKind:"hold"},
 "31L":{physicalId:"13R/31L",goalNode:oimm.taxiways.A.exitNode,goalKind:"hold"},
 "13L":{physicalId:"13L/31R",goalNode:oimm.taxiways.H.nodes.at(-1),goalKind:"access-qa"},
 "31R":{physicalId:"13L/31R"}}};
const converted=taxi.fromLegacy(oimm,profile);
assert.equal(converted.airport,"OIMM");
assert.equal(converted.edges.length,oldSize);
assert.equal(converted.runways["13L"].goalKind,"access-qa");
assert.equal(converted.edges.some(e=>e.quality==="projected"),true);
const convertedLtfm=taxi.fromLegacy(ltfm);
assert.equal(convertedLtfm.airport,"LTFM");
assert(convertedLtfm.edges.length>4000);
assert(!Object.keys(convertedLtfm.runways).length);
assert.equal(oimm.edges.length,oldSize,"Legacy adapter mutated source graph");
console.log("TAXI ENGINE V1: graph validation, stand/runway parser, no implicit BT,");
console.log("explicit projected QA, independent parallel runway goals, preserved");
console.log("source geometry, rerouting, and raw OIMM/LTFM converter: PASS");
