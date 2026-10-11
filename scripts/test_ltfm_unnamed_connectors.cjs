/* Reusable simulator QA regression for grounded unnamed taxiway connectors.
 * Run with: node scripts/test_ltfm_unnamed_connectors.cjs
 */
"use strict";
const fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const assert=require("node:assert/strict");
const base=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");
const graph=JSON.parse(read("web/data/taxi-networks/LTFM.json"));
const audit=JSON.parse(read("web/data/taxi-audits/LTFM.json"));
const src=read("web/taxi-mode.js"),window={};
vm.runInNewContext(read("web/taxi-unnamed-connectors.js"),{window,globalThis:window});
const bridge=window.JEPPIRAN_TAXI_UNNAMED;
assert(bridge.enabled(graph),"LTFM must opt in to QA-only mapped connectors");
assert(bridge.connected(graph,"N2","C"),"N2 to C uses existing OSM unnamed geometry");
assert(!bridge.connected(graph,"T5","C"),"Long-range shortcut is forbidden");
const links=bridge.scan(graph,"N2","C");
const shortestLink=[...links.values()].flat().sort((a,b)=>a.length-b.length)[0];
assert(shortestLink&&shortestLink.nodes.length===5);
assert(shortestLink.length>60&&shortestLink.length<75,"N2/C mapped gap near 65m");
assert(shortestLink.approved===false);
const helpers=src.slice(src.indexOf("function parse(raw){"),src.indexOf("function graphOk("));
assert(helpers.startsWith("function parse(")&&helpers.includes("function shortest("));
const test=new Function("window","graph","audit",`
 const taxi={airport:"LTFM",graph,networkAudit:audit,standReference:null};
 const name=s=>String(s||"").trim().toUpperCase().replace(/\\s+/g," ");
 ${helpers}
 return {parse,shortest,adjacent,demoFromStandArea,firstUnmappedTransition};
`)(window,graph,audit);
const input=test.parse("STD3 T5 N2 C");
assert.equal(input.startStand,"D3");
assert.deepEqual(Array.from(input.taxiways),["T5","N2","C"]);
assert.equal(test.firstUnmappedTransition(graph,input.taxiways),null);
const route=test.demoFromStandArea(graph,input);
assert(route&&route.path.length>=20,"stand-side mapped portion should calculate");
assert(route.mappedUnnamedTransitions.length===1);
const mapped=route.mappedUnnamedTransitions[0];
assert.equal(mapped.from,"N2");assert.equal(mapped.to,"C");
assert.equal(mapped.edgeCount,4);
assert(mapped.lengthMeters>60&&mapped.lengthMeters<80);
assert(route.path.slice(1).every((id,i)=>graph.edges.some(e=>
 !e.closed&&!e.runway&&[e.from,e.to].includes(id)&&[e.from,e.to].includes(route.path[i])
)),"route must use physical edges, not geometric shortcuts");
const old=test.demoFromStandArea(graph,test.parse("STD3 T5 N2"));
assert.equal(old.length,561,"existing approved QA sample must not be altered");
assert.equal(old.mappedUnnamedTransitions.length,0);
assert.match(test.parse("34L 2A").error,/No space/);
assert.equal(test.parse("34L2A").kind,"procedure");
const disabled={...graph,qaMappedUnnamedConnectors:false};
assert.equal(bridge.scan(disabled,"N2","C").size,0,"disable must fail closed");
assert(test.firstUnmappedTransition(disabled,input.taxiways)?.from==="N2");
console.log("PASS LTFM mapped QA connectors: N2 → C, 4 edges, ~65m; D3 stand NOT connected.");
