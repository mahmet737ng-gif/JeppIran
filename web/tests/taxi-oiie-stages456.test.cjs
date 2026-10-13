/* JEPPIRAN OIIE cycle 2621 stages 4-6: no guessed joins and gated two-way QA. */
"use strict";
const assert=require("node:assert/strict");
const api=require("../taxi-oiie-stages456.js");
const source=require("../data/charts-manifest.json").source_sha256;
assert.equal(source,api.sourceSha256);
const base={airport:"OIIE",cycle:"2621",sourceSha256:source};
const empty=api.evaluate(base);
assert.equal(empty.ok,true);
assert.equal(empty.routeable,false);
assert.equal(empty.phase4.regions.length,4);
assert.equal(empty.phase5.approvedGates,0);
assert.equal(empty.phase6.bidirectionalPairs,0);
assert.equal(api.evaluate({...base,cycle:"2622"}).routeable,false);
for(const r of api.regions){
 const lat=35+(r.lat[0]+r.lat[1])/120;
 const lon=51+(r.lon[0]+r.lon[1])/120;
 const p=api.fromGeo(r,lat,lon);
 assert.ok(p,"printed-grid central control "+r.id);
 assert.equal(api.regionAt(r.page,p).id,r.id);
 const geo=api.toGeo(r,p);
 assert.ok(Math.abs(geo.lat-lat)<1e-10&&Math.abs(geo.lon-lon)<1e-10);
 const toAdc=api.register(r.page,p,380,"ADC");
 assert.ok(toAdc.ok&&toAdc.targetRegion==="ADC");
 const back=api.register(380,toAdc.point,r.page,r.id);
 assert.ok(back.ok&&Math.hypot(back.point[0]-p[0],back.point[1]-p[1])<1e-5);
}
assert.equal(api.register(383,[420,700],383,"CARGO").ok,false,
 "Salam inset cannot be extrapolated into Cargo registration");
assert.equal(api.register(380,[1,1],382).ok,false);
const nodes=[
 {id:"ST100",kind:"stand",page:380,region:"ADC",point:[292,530],sourceDrawingIds:[120],reviewed:true},
 {id:"HOLD_A",kind:"hold-short",page:380,region:"ADC",point:[312,502],sourceDrawingIds:[121],reviewed:true},
 {id:"R11L",kind:"runway",label:"11L",page:380,region:"ADC",point:[321,480],sourceDrawingIds:[122],reviewed:true}];
const edges=[
 {id:"LEAD",from:"ST100",to:"HOLD_A",kind:"stand-lead",reviewed:true,bidirectional:true,sourceDrawingIds:[123]},
 {id:"ACCESS",from:"HOLD_A",to:"R11L",kind:"runway-connector",gateId:"GATE1",
  reviewed:true,bidirectional:true,sourceDrawingIds:[124]}];
const gates=[{id:"GATE1",physicalRunway:"11L_29R",runwayEnd:"11L",holdNode:"HOLD_A",
 runwayNode:"R11L",connectorEdgeIds:["ACCESS"],reviewed:true,holdShortReviewed:true,holdShortDrawingIds:[125]}];
const graph={nodes,edges,gates};
assert.equal(api.evaluate({...base,graph}).routeable,true,"synthetic reviewed sample ONLY tests route logic");
assert.equal(api.evaluate({...base,graph}).phase6.bidirectionalPairs,1);
assert.equal(api.evaluate({...base,graph:{nodes,edges,gates:[]}}).routeable,false);
assert.equal(api.evaluate({...base,graph:{nodes,edges:[...edges.slice(0,1),{...edges[1],sourceDrawingIds:[]}],gates}}).routeable,false);
assert.equal(api.evaluate({...base,graph:{nodes,edges:[{...edges[0],bidirectional:false},edges[1]],gates}}).routeable,false,
 "one-way clearance cannot pass the bidirectional release test");
const shortcut=api.evaluate({...base,graph:{nodes,edges:[{...edges[0],to:"R11L"}],gates}});
assert.equal(shortcut.routeable,false);
assert.ok(shortcut.phase6.issues.some(e=>e.code==="RUNWAY_SHORTCUT_BLOCKED"));
const fakeCross=api.evaluate({...base,graph:{nodes:[...nodes.slice(0,1),{...nodes[1],page:382,region:"PASSENGER",point:[300,310]}],
 edges:[{...edges[0]}],gates:[]}});
assert.equal(fakeCross.routeable,false);
assert.ok(fakeCross.phase6.issues.some(e=>e.code==="ILLEGAL_CROSS_PAGE_EDGE"));
console.log("PASS OIIE stages 4-6: 4 source-grid regions, inverse mapping, Cargo/Salam isolation, gated two-way positive/negative tests, no live OIIE routes");
