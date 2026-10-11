"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const adj=require("../web/taxi-adjacency.js");
function sample(){
  return {airport:"TEST",cycle:"2621",verified:false,simulatorTestOnly:true,
    nodes:{a:{lat:41,lon:28},b:{lat:41,lon:28.0001},c:{lat:41,lon:28.0002},
      d:{lat:41,lon:28.0003},far:{lat:41,lon:28.00031},r:{lat:41,lon:28.0004}},
    edges:[
      {from:"a",to:"b",taxiway:"A",bidirectional:true},
      {from:"b",to:"c",taxiway:"B",bidirectional:false},
      {from:"c",to:"d",taxiway:"C",bidirectional:true},
      {from:"far",to:"r",taxiway:"X",bidirectional:true},
      {from:"d",to:"r",taxiway:"BT18",runway:true,bidirectional:true}
    ],runwayBacktracks:{BT18:{requiresExplicitClearance:true}}};
}
test("Only an actual shared node makes two taxiways neighbors",()=>{
  const g=sample();
  assert.deepEqual(adj.neighbors(g,"A").map(x=>x.taxiway),["B"]);
  assert.deepEqual(adj.neighbors(g,"B").map(x=>x.taxiway),["A","C"]);
  assert.deepEqual(adj.neighbors(g,"C").map(x=>x.taxiway),["B"]);
  assert.deepEqual(adj.neighbors(g,"X"),[]);
  assert.deepEqual(adj.labelPath(g,"A","C"),["A","B","C"]);
  assert.equal(adj.labelPath(g,"A","X"),null);
  assert.equal(adj.taxiway(g,"A").endpoints.length,2);
});
test("One-way restrictions and runway clearance are preserved",()=>{
  const g=sample(),links=adj.nodeLinks(g);
  assert(links.b.some(edge=>edge.to==="c"));
  assert(!links.c.some(edge=>edge.to==="b"));
  assert(!links.d.some(edge=>edge.to==="r"));
  const allowed=adj.nodeLinks(g,{runwayWay:"BT18"});
  assert(allowed.d.some(edge=>edge.to==="r"));
  assert.strictEqual(adj.nodeLinks(g),links);
});
test("Unmapped chart text names are not silently connected",()=>{
  const result=adj.snapshot(sample(),{"Z":{chart:"ADC"}});
  assert.equal(result.taxiways.Z,undefined);
  assert.deepEqual(result.chartOnlyWithoutMappedCenterline,["Z"]);
  assert.equal(result.verifiedForNavigation,false);
});
test("Saved LTFM map has named network and unresolved labels",()=>{
  const graphPath=path.join(__dirname,"../web/data/taxi-networks/LTFM.json");
  const cachePath=path.join(__dirname,"../web/data/taxi-adjacency/LTFM.json");
  if(!fs.existsSync(graphPath)||!fs.existsSync(cachePath))return;
  const graph=JSON.parse(fs.readFileSync(graphPath,"utf8"));
  const cached=JSON.parse(fs.readFileSync(cachePath,"utf8"));
  assert.equal(cached.airport,"LTFM");
  assert.equal(cached.cycle,graph.cycle);
  assert.equal(cached.stats.namedTaxiways,adj.inspect(graph).ways.size);
  assert(cached.stats.chartOnlyLabels>0);
  assert(cached.taxiways.G.neighbors.some(n=>n.taxiway==="N1"));
});
