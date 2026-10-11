/* Source-PDF vector tracing QA on 2621.pdf Ahwaz ADC page 38.
 * Run: node web/tests/taxi-oiaw-pdf-vector.test.cjs
 * The approved information here is CHART-SPACE tracing only, not runway
 * clearance, geographical stand registration or operational taxi routing.
 */
"use strict";
const assert=require("node:assert/strict");
const vector=require("../taxi-pdf-vector-engine.js");
const survey=require("../taxi-survey-engine.js");
const traces=require("../data/taxi-chart-traces/OIAW-2621.json");
const source=require("../data/taxi-surveys/OIAW.json");
const network=survey.index(source),renderer=vector.build(traces);
assert.equal(traces.chart.globalPage,38);
assert.equal(traces.chart.width,612);
assert.equal(traces.chart.height,792);
assert.equal(traces.source.sha256,"d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6");
assert.equal(traces.qaOnly,true);
assert.equal(traces.runwayAccessApproved,false);
for(let n=1;n<=6;n++){
  const cmd="ST"+n+" A B";
  const named=network.parse(cmd);
  assert.equal(named.ok,true,"Topology should exist: "+cmd);
  const route=renderer.route(named.tokens,38);
  assert.equal(route.ok,true,route.error);
  assert.equal(route.qaOnly,true);
  assert.equal(route.runwayAccessApproved,false);
  assert.ok(route.points.length>30);
  assert.ok(route.points.every(p=>p[0]>115&&p[0]<230&&p[1]>330&&p[1]<427));
  assert.ok(route.maxStandJoinGapPdfPoints<1.85);
}
assert.equal(renderer.route(["ST2","A","B"],39).ok,false);
assert.equal(renderer.route(["ST2","A","C"],38).ok,false);
assert.equal(renderer.route(["ST2","A","RWY12"],38).ok,false);
assert.equal(network.parse("ST2 A E").ok,false);
const forged=structuredClone(traces);
forged.qaOnly=false;
assert.throws(()=>vector.build(forged),/provenance or QA-only status/);
const missing=structuredClone(traces);
delete missing.vector.primitives["200"];
assert.throws(()=>vector.build(missing),/Missing original PDF primitive/);
console.log("PASS V2621 OIAW: six chart-PDF Bezier routes ST1–6 A B; no invented E, runway, or non-traced taxiway geometry");
