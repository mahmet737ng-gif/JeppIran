// OIMM destination-only taxi graph QA. No manual edge, runway crossing,
// arbitrary "nearest stand" shortcut, or assumed runway-entry connection.
const fs=require("node:fs"),assert=require("node:assert/strict");
const auto=require("../web/taxi-auto-router.js");
const graph=JSON.parse(fs.readFileSync("web/data/taxi-networks/OIMM.json","utf8"));
assert.equal(graph.airport,"OIMM");
assert.equal(Object.keys(graph.stands).length,34);
const originalEdges=new Set(graph.edges.filter(e=>!e.closed&&!e.military&&!e.runway)
  .flatMap(e=>[e.from+">"+e.to,...(e.bidirectional===false?[]:[e.to+">"+e.from])]));
function verify(result,goal,desc){
  assert(result.route,desc+": "+result.error);
  assert.equal(result.route.path.at(-1),goal,desc+": wrong destination");
  assert(result.route.length>=0);
  for(let i=1;i<result.route.path.length;i++){
    const edge=result.route.path[i-1]+">"+result.route.path[i];
    assert(originalEdges.has(edge),desc+": fabricated or restricted link "+edge);
  }
}
let tested=0;
for(const id of Object.keys(graph.stands)){
  for(const rwy of ["13R","31L"]){
    const result=auto.route(graph,{startStand:id,destination:rwy});
    const target=auto.goal(graph,rwy);
    assert.equal(target.kind,"runway-hold");
    assert(graph.holdNodes[target.node],"runway ends at a reviewed hold short");
    verify(result,target.node,"ST"+id+" → "+rwy);
    assert.equal(result.route.path[0],graph.stands[id].node);
    assert(result.route.holds.includes(result.route.path.length-1));
    tested++;
  }
}
for(const id of ["101","109","113","137"]){
  const result=auto.route(graph,{position:graph.nodes[graph.stands[id].node],destination:"ST130"});
  verify(result,graph.stands["130"].node,"live position "+id+" → ST130");
  assert.equal(result.route.path[0],graph.stands[id].node);
}
for(const rwy of ["13L","31R"]){
  const d=auto.goal(graph,rwy);assert(d.error&& !d.node,"missing runway hold must not be guessed");
}
assert.equal(auto.route(graph,{destination:"ST109",position:{lat:0,lon:0}}).route,undefined);
assert.equal(auto.route(graph,{destination:"ST109",startStand:"999"}).route,undefined);
// Verify no implicit crossing, even if a direct one-way runway edge exists.
const fixture={
 airport:"OIMM",simulatorTestOnly:true,
 nodes:{A:{lat:36,lon:59},B:{lat:36,lon:59.0005},
        C:{lat:36.0007,lon:59.0005},D:{lat:36,lon:59.001}},
 edges:[
  {from:"A",to:"B",taxiway:"A",bidirectional:true},
  {from:"B",to:"D",taxiway:"B",bidirectional:true},
  {from:"A",to:"C",taxiway:"C",bidirectional:true},
  {from:"C",to:"D",taxiway:"D",bidirectional:true},
  {from:"A",to:"D",taxiway:"BT13R",runway:true,bidirectional:true}
 ],
 stands:{"101":{node:"A"},"109":{node:"D"}}
};
const first=auto.route(fixture,{startStand:"101",destination:"ST109"});
assert.deepEqual(first.route.path,["A","B","D"]);
const active={target:first.target,route:first.route,monitor:{count:0,last:0}};
assert.equal(auto.reroute(fixture,active,fixture.nodes.C,10000).action,"checking");
const rerouted=auto.reroute(fixture,active,fixture.nodes.C,11000);
assert.equal(rerouted.action,"replanned");
assert.deepEqual(rerouted.route.path,["C","D"]);
assert.equal(auto.reroute(fixture,active,{...fixture.nodes.C,accuracy:90},20000).action,"uncertain");
console.log(JSON.stringify({connectedStandRunwayHoldPairs:tested,
  arrivalStandsChecked:4,unmappedRunwaysRefused:true,
  alternateReroute:"C → D",implicitRunwayCrossing:"blocked"}));
