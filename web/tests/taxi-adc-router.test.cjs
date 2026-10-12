/* Gated ADC source-chart router regressions.
 * Run: node web/tests/taxi-adc-router.test.cjs
 */
"use strict";
const assert=require("node:assert/strict");
const workflow=require("../taxi-adc-workflow.js"),router=require("../taxi-adc-router.js");
const tr=(id,kind,label,points,extra={})=>({
 id,kind,label,points,page:1,source:"SOURCE_PDF",sourceDrawingIds:[20+id.charCodeAt(0)],reviewed:true,...extra});
const fixture=()=>({
 airport:"TEST",cycle:"2621",source:{sha256:"b".repeat(64)},
 pages:[{page:1,width:612,height:792}],
 inventory:{runways:[{physicalId:"11_29",ends:["11","29"],publishedLengthM:3200}],
   stands:[{id:"ST1"}],taxiways:[{id:"A"},{id:"B"}]},
 traces:[tr("S","stand-lead","ST1",[[10,10],[20,10]],{standId:"ST1"}),
   tr("A","taxiway","A",[[20,10],[30,10]]),
   tr("B","taxiway","B",[[30,10],[40,10]]),
   tr("G","runway-connector","G",[[40,10],[50,10]]),
   tr("R","runway-axis","11_29",[[50,10],[60,10]],{physicalRunway:"11_29"})],
 junctions:[{id:"SA",page:1,point:[20,10],touches:["S","A"],reviewed:true},
   {id:"AB",page:1,point:[30,10],touches:["A","B"],reviewed:true},
   {id:"BG",page:1,point:[40,10],touches:["B","G"],reviewed:true},
   {id:"GR",page:1,point:[50,10],touches:["G","R"],reviewed:true}],
 runwayGates:[{id:"G1",reviewed:true,page:1,physicalRunway:"11_29",runwayEnd:"11",
   taxiTraceId:"B",connectorTraceId:"G",runwayTraceId:"R",
   holdShortReviewed:true,holdPoint:[40,10],runwayPoint:[50,10]}],
 routingPages:[1],pageLinks:[],releaseReviewed:true});
const graph=workflow.compile(fixture());
assert.equal(graph.summary.routeable,true);
const toTaxi=router.plan(graph,"ST1 A B");
assert.equal(toTaxi.ok,true,toTaxi.error);
assert.deepEqual(toTaxi.edges.map(e=>e.label),["ST1","A","B"]);
const toHold=router.plan(graph,"ST1 A B RWY11");
assert.equal(toHold.ok,true,toHold.error);
assert.equal(toHold.destination.kind,"runway-hold");
assert.match(router.plan(graph,"ST1 A B RWY29").error,/No reviewed hold-short/,
 "Opposite end of the same black strip MUST NOT use RWY11's gate");
assert.equal(toHold.edges.some(e=>e.kind==="runway-connector"),false);
assert.equal(toHold.edges.some(e=>e.kind==="runway-axis"),false);
assert.deepEqual(toHold.edges.at(-1).points.at(-1),[40,10]);
assert.equal(router.plan(graph,"ST1 A 11").ok,undefined,
 "No shortcut from A through unrequested B");
assert.match(router.plan(graph,"ST1 C B").error,/Unrecognized taxiway/);
const fake=fixture();
fake.junctions=fake.junctions.filter(j=>j.id!=="GR");
const blocked=workflow.compile(fake);
assert.equal(blocked.summary.routeable,false);
assert.match(router.plan(blocked,"ST1 A B 11").error,/not routeable/);
console.log("PASS chart-PDF ADC router: source-connected named path, RWY means HOLD, no invented crossing");
