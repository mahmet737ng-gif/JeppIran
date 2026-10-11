/* Regression tests: run from repo root with:
 * node web/tests/taxi-backtrack-shorthand.test.cjs
 * Fixture is synthetic. It does NOT assert any real airport's taxi geometry.
 */
"use strict";
const assert=require("node:assert/strict");
const engine=require("../taxi-engine.js");
const src={provider:"Synthetic fixture",document:"Connected QA test graph"};
const nodes={};
["S","A","B","C","D","E","F","X","Y"].forEach((id,i)=>{
  nodes[id]={lat:36.1+i*0.0001,lon:59.6};
});
function edge(from,to,label,kind,extra={}){
  return {from,to,label,kind,quality:"mapped",source:src,...extra};
}
const runwayEdge=edge("C","D","BT13R","runway",
  {physicalRunway:"13R_31L",bidirectional:false});
const data={
  engineVersion:1,airport:"OIMM",cycle:"2621",
  coordinateSystem:"WGS84",simulatorTestOnly:true,verified:false,
  source:src,nodes,stands:{"115":{node:"S"}},
  taxiways:{J:{terminalNode:"C"},H:{terminalNode:"F"}},
  runways:{
    "13R":{physicalId:"13R_31L",goalNode:"C",goalKind:"threshold"},
    "13L":{physicalId:"13L_31R",goalNode:"F",goalKind:"hold"}
  },
  edges:[
    edge("S","A","STAND","stand"),
    edge("A","B","J","taxiway"),
    edge("B","C","J","connector"),
    runwayEdge,
    edge("D","E","H","connector"),
    edge("E","F","H","taxiway")
  ]
};
const compact="ST115 J 13R H 13L";
const explicit="ST115 J BT13R H 13L";
assert.equal(engine.validate(data).ok,true);
const compactParsed=engine.parse(compact,data);
assert.deepEqual(compactParsed,engine.parse(explicit,data));
assert.deepEqual(compactParsed.via,["J","BT13R","H"]);
assert.deepEqual(compactParsed.destination,{kind:"runway",id:"13L"});
const compactPlan=engine.create(data).plan(compact);
const explicitPlan=engine.create(data).plan(explicit);
assert.ok(compactPlan.route);
assert.deepEqual(compactPlan.route.path,explicitPlan.route.path);
assert.equal(compactPlan.route.explicitRunway,true);
assert.equal(compactPlan.route.terminalKind,"hold");
assert.deepEqual(engine.parse("ST115 J RWY13R H RWY13L",data),compactParsed);
assert.deepEqual(engine.parse("ST115 J RUNWAY 13R H RUNWAY 13L",data),compactParsed);
const missing={...data,edges:data.edges.filter(e=>e!==runwayEdge)};
assert.match(engine.parse(compact,missing).error,/Unknown explicit runway-use segment/);
const disconnected={...data,edges:[
  ...missing.edges,edge("X","Y","BT13R","runway",{physicalRunway:"13R_31L"})
]};
assert.match(engine.create(disconnected).plan(compact).error,/No source-connected ground path/);
assert.match(engine.parse("ST115 J 31R H 13L",data).error,/not mapped/);
console.log("PASS taxi backtrack shorthand: equivalent paths, no invented connectivity");
