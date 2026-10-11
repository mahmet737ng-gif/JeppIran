/* OIAW SIM-QA partial-data regression; NOT operational validation.
 * Run: node web/tests/taxi-oiaw-qa.test.cjs
 */
"use strict";
const assert=require("node:assert/strict");
const api=require("../taxi-engine.js");
const g=require("../data/taxi-networks/OIAW.json");
assert.equal(g.airport,"OIAW");
assert.equal(g.cycle,"2621");
assert.equal(g.enabled,false);
assert.equal(g.qaPreviewOnly,true);
assert.equal(g.verified,false);
assert.equal(g.source.reviewStatus,"SIM_QA_PARTIAL");
assert.equal(Object.keys(g.stands).length,6);
assert.deepEqual(Object.keys(g.taxiways),["A","B","C","D","E"]);
assert.equal(api.validate(g).ok,true,api.validate(g).errors.join("; "));
const engine=api.create(g);
const qa=engine.plan("ST4 A B",{allowProjectedQA:true});
assert.ok(qa.route,qa.error);
assert.deepEqual(qa.route.path,["S4","AA","BA","BH"]);
assert.deepEqual(qa.route.taxiways,["A","B"]);
assert.equal(qa.route.edges.every(edge=>edge.quality==="projected"),true);
assert.equal(qa.route.explicitRunway,false);
assert.equal(qa.route.terminalKind,"taxiway-end");
assert.ok(qa.route.lengthMetres>0);
const blocked=engine.plan("ST4 A B");
assert.equal(Boolean(blocked.error),true,"Non-QA default must block projected links");
const implicitRunway=engine.plan("ST4 A 12",{allowProjectedQA:true});
assert.equal(Boolean(implicitRunway.error),true,"Do not infer runway access from a stand");
const runwayMeters=api.distance(g.nodes.R12,g.nodes.R30);
assert.ok(Math.abs(runwayMeters-3397)<10,"Check official THR-to-THR distance");
assert.equal(Boolean(g.runways["12"].goalNode),false);
assert.equal(Boolean(g.runways["30"].goalNode),false);
assert.ok(g.edges.filter(e=>e.kind==="runway").every(e=>e.physicalRunway==="12_30"));
assert.equal(g.edges.filter(e=>e.kind!=="runway").every(e=>e.quality==="projected"),true);
const runwayNodes=new Set(["R12","RB","RC","RD","RE","R30"]);
assert.equal(g.edges.filter(e=>e.kind!=="runway").some(e=>runwayNodes.has(e.from)||runwayNodes.has(e.to)),false,"No fake hold-to-runway access");
console.log("PASS OIAW: 6 stands, 5 taxiways, 12/30 axis and opt-in preview ST4 A B; unreviewed links blocked");
