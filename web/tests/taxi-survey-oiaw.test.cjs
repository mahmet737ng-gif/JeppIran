/* OIAW ADC-FIRST survey regression tests.
 * Run: node web/tests/taxi-survey-oiaw.test.cjs
 * This test validates the NAMED adjacency inventory only. It deliberately
 * asserts that no centreline rendering, runway clearance or real-world taxi
 * routing is approved or inferred from this document.
 */
"use strict";
const assert=require("node:assert/strict");
const survey=require("../taxi-survey-engine.js");
const raw=require("../data/taxi-surveys/OIAW.json");
const doc=survey.index(raw);
assert.equal(raw.airport,"OIAW");
assert.equal(raw.chart.globalPage,38);
assert.equal(raw.chart.chartNumber,"10-9");
assert.equal(raw.routeGeometryApproved,false);
assert.equal(raw.geometry.approval,"BLOCKED");
assert.equal(doc.stands.length,6);
assert.deepEqual(doc.taxiways,["A","B","C","D","E"]);
assert.deepEqual(doc.runways,["12","30"]);
assert.deepEqual(doc.neighbors("A"),["B","C","D","ST1","ST2","ST3","ST4","ST5","ST6"]);
assert.deepEqual(doc.neighbors("E"),[],"Isolated E must not acquire an invented apron connection");
for(const n of [1,2,3,4,5,6]){
  const p=doc.parse("ST"+n+" A B");
  assert.equal(p.ok,true,"Stand "+n+" named adjacency should be detected");
  assert.equal(p.canDraw,false);
  assert.equal(p.canRoute,false);
  assert.equal(p.geometryStatus,"NOT_VECTOR_TRACED");
  assert.equal(p.segments.length,2);
}
assert.equal(doc.parse("ST4 A E").ok,false);
assert.equal(doc.parse("ST2 C").ok,false);
assert.match(doc.parse("ST2 A RWY12").error,/not chart-verified/);
assert.match(doc.parse("ST2 A 30").error,/not chart-verified/);
assert.equal(doc.parse("ST9 A B").ok,false);
const bad=structuredClone(raw);
bad.connections[0].evidence="";
assert.throws(()=>survey.index(bad),/Invalid observed ADC connection/);
const fake=structuredClone(raw);
fake.routeGeometryApproved=true;
assert.throws(()=>survey.index(fake),/may not be marked route approved/);
console.log("PASS OIAW ADC inventory: all six stand branches, A/B/C/D topology, E isolated; runway gates and drawable paths remain BLOCKED");
