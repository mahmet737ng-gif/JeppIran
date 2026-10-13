"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const engine=require("../web/taxi-engine.js");
const graph=JSON.parse(fs.readFileSync("tests/fixtures/taxi-engine/ZZZZ.json","utf8"));
const e=engine.create(graph);
const position={lat:36,lon:59.0002,accuracy:3,groundspeed:0};
function success(command,options,origin,end){
 const result=e.plan(command,options);
 assert.ok(result.route,command+" → "+(result.error||"no route"));
 assert.equal(result.route.path[0],origin,command+" wrong source");
 assert.equal(result.route.path.at(-1),end,command+" wrong target");
 assert.ok(result.route.edges.every(x=>x.kind!=="runway"),
   command+" silently crossed a runway");
 return result;
}
success("ST101 ST109",{},"S101","ST109");
success("ST101 RWY13R",{},"S101","J1");
success("13R ST109",{},"J1","ST109");
success("RWY13R ST109",{},"J1","ST109");
success("ST101",{position},"J0","S101");
success("RWY31L",{position},"J0","J1");
assert.equal(engine.parse("RWY13R ST109",graph).startRunway,"13R");
assert.equal(engine.parse("ST101 ST109",graph).startStand,"101");
assert.equal(engine.parse("ST109",graph).destination.id,"109");
assert.equal(engine.parse("31L",graph).destination.id,"31L");
for(const query of ["ST999","RWY03","RWY03 ST109"]){
 assert.ok(!e.plan(query,{position}).route,
   "Unknown/unreviewed destination must be blocked: "+query);
}
assert.match(e.plan("ST101",{position:{lat:0,lon:0,accuracy:3,groundspeed:0}}).error,/No mapped start/);
console.log("PASS current position → stand/runway, stand ↔ stand, runway hold → stand, and source-only route gates");
