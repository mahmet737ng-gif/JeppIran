const assert=require('node:assert/strict'),fs=require('node:fs');
const qa=require('../web/taxi-runway-access.js');
const graph=JSON.parse(fs.readFileSync('web/data/taxi-networks/OIMM.json','utf8'));
assert.equal(graph.simulatorTestOnly,true);
const holders=new Set(Object.keys(graph.holdNodes));
const reported={};
for(const bt of Object.keys(graph.runwayBacktracks)){
 const x=qa.build(graph,bt);
 assert(x.graph&&x.access.length,'no chart-identified runway access for '+bt);
 assert.equal(x.graph.edges.length>=graph.edges.length,true);
 reported[bt]=x.access.map(a=>a.taxiway+' ('+a.distanceMeters+'m)');
 const accessEdges=x.graph.edges.filter(e=>e.runwayAccessCandidate&&e.geometry==="projected-hold-to-runway-AXIS-QA-not-surveyed");
 for(const e of accessEdges){
  assert(holders.has(e.from),'only a published hold point can connect to runway');
  assert(e.runway&&e.requiresExplicitClearance&&e.geometry.includes('QA-not-surveyed'));
  assert(graph.taxiways[e.fromTaxiway]&&!graph.taxiways[e.fromTaxiway].militaryOnly);
  assert(e.distanceMeters<=115,'out of tolerance runway connection');
 }
 assert.equal(new Set(x.access.map(a=>a.holdNode)).size,x.access.length);
 assert.equal(qa.build(graph,bt).graph,x.graph,'re-use cached generated route graph');
}
assert.equal(qa.build(graph,'BT13L').graph,null,'unmapped runway must not become an eligible crossing');
const auto=require('../web/taxi-auto-router.js');
assert.equal(auto.route(graph,{startStand:'109',destination:'31R'}).route,undefined);
const missed={};
for(const bt of ['BT13R','BT31L']){
 const x=qa.build(graph,bt);
 const onRunway=x.graph.edges.filter(e=>e.runway&&e.taxiway===bt&&x.graph.nodes[e.from]&&x.graph.nodes[e.to]);
 missed[bt]={};
 for(const [hold,v] of Object.entries(graph.holdNodes||{})){
  const name=v.taxiway;
  if(!['B','F','C1','C2','G','Q','J','A','H'].includes(name))continue;
  const point=graph.nodes[hold];if(!point)continue;
  const nearest=Math.min(...onRunway.map(e=>{
   const p=qa.nearestOnEdge(point,x.graph.nodes[e.from],x.graph.nodes[e.to]);
   return p?p.distance:Infinity;
  }));
  missed[bt][name]=Math.round(nearest);
 }
}
console.log('OIMM_RUNWAY_SOURCE_GAPS_METERS',JSON.stringify(missed));
console.log('OIMM_RUNWAY_BRIDGES_QA',JSON.stringify(qa.reviewedAxisBridge(graph).map(x=>({from:x.from,to:x.to,way:x.taxiway,metres:x.bridgedLengthMeters}))));
console.log('OIMM_RUNWAY_ACCESS_QA',JSON.stringify(reported));
