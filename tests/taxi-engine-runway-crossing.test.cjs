"use strict";
/* Contract test ONLY. Synthetic runway crossing; does NOT imply any real OIIE
 * cross-runway taxi access has been chart-reviewed or ATC-cleared.
 */
const assert=require("node:assert/strict");
const E=require("../web/taxi-engine.js");
const source={provider:"SYNTHETIC",document:"CONTRACT TEST ONLY",feature:"CROSS-1"};
const nodes={
 S204:{lat:35.4,lon:51.1},A:{lat:35.4,lon:51.1001},
 H1:{lat:35.4,lon:51.1002},H2:{lat:35.4,lon:51.1007},
 B:{lat:35.4,lon:51.1008},S314:{lat:35.4,lon:51.1009}
};
const graph={engineVersion:1,airport:"ZZZZ",cycle:"2621",
 simulatorTestOnly:true,verified:false,coordinateSystem:"WGS84",source,
 nodes,edges:[
 {from:"S204",to:"A",label:"STAND",kind:"stand",quality:"mapped",source},
 {from:"A",to:"H1",label:"A",kind:"taxiway",quality:"mapped",source},
 {from:"H1",to:"H2",label:"CROSS11L",kind:"crossing",quality:"mapped",
  physicalRunway:"11L/29R",requiresClearance:true,crossingReviewed:true,
  reviewedHoldShorts:["H1","H2"],source},
 {from:"H2",to:"B",label:"B",kind:"taxiway",quality:"mapped",source},
 {from:"B",to:"S314",label:"STAND",kind:"stand",quality:"mapped",source}
 ],stands:{"204":{node:"S204"},"314":{node:"S314"}},
 taxiways:{A:{terminalNode:"A"},B:{terminalNode:"B"}},
 runways:{"11L":{physicalId:"11L/29R",goalNode:"H1",goalKind:"hold"},
 "29R":{physicalId:"11L/29R",goalNode:"H2",goalKind:"hold"}}
};
assert.equal(E.validate(graph).ok,true,JSON.stringify(E.validate(graph).errors));
const route=E.create(graph);
for(const [a,b] of [["204","314"],["314","204"]]){
 const r=route.plan("ST"+a+" ST"+b);
 assert.ok(r.route,r.error);
 assert.equal(r.route.requiresRunwayCrossingClearance,true);
 assert.equal(r.route.runwayCrossings.length,1);
 assert.equal(r.route.runwayCrossings[0].clearanceRequired,true);
 assert.equal(r.route.runwayCrossings[0].runway,"11L/29R");
 assert.equal(route.linework(r.route).filter(x=>x.style==="dashed-amber").length,1);
}
for(const [field,value] of [
 ["crossingReviewed",false],["requiresClearance",false],
 ["reviewedHoldShorts",["H1","H1"]],["source",null]
]){
 const bad={...graph,edges:graph.edges.map(x=>x.kind==="crossing"?{...x,[field]:value}:x)};
 assert.equal(E.validate(bad).ok,false,"Unreviewed runway entry was accepted: "+field);
}
assert.ok(!E.create({...graph,edges:graph.edges.filter(e=>e.kind!=="crossing")}).plan("ST204 ST314").route,
 "Two source pavement islands must not connect if their only gated runway crossing is removed");
console.log("PASS: two directed source-reviewed ATC-gated crossing routes and four fail-closed absence/source/hold checks (SYNTHETIC ONLY)");
