/* JEPPIRAN screenshot-aligned OIAW inset fail-closed QA tests.
 * Run: node web/tests/taxi-oiaw-inset.test.cjs
 * QA graphics only, not a survey or flight-test validation.
 */
"use strict";
const assert=require("node:assert/strict");
const graph=require("../data/taxi-networks/OIAW.json");
const engine=require("../taxi-engine.js");
const inset=require("../taxi-inset-preview.js");
const plan=engine.create(graph).plan("ST4 A B",{allowProjectedQA:true});
assert.ok(plan.route,"Test graph must provide an opt-in QA route");
assert.deepEqual(plan.route.path,["S4","AA","BA","BH"]);
const view=inset.route(graph,plan.route.path,38);
assert.equal(view.ok,true,view.error);
assert.equal(view.qaOnly,true);
assert.equal(view.dashed,true);
assert.ok(view.points.length>4,"Polyline must follow chart-traced bends, not endpoint chord");
assert.ok(view.points.every(p=>p.x>=view.bounds.left&&p.x<=view.bounds.right&&
  p.y>=view.bounds.top&&p.y<=view.bounds.bottom),"No line outside parking inset");
assert.equal(graph.qaGeometryRevision,"2621-oiaw-inset-registration-r3");
assert.ok(view.bounds.top>=370&&view.bounds.bottom<=510,
  "Inlaid parking image, not outer runway or main-chart whitespace");
assert.ok(view.points.every(p=>p.y>=374&&p.y<=507),
  "Full route must be confined to the actual parking inset PDF y-window");
assert.deepEqual(view.points[0],{x:197,y:459});
assert.deepEqual(view.points.at(-1),{x:160,y:383});
const oldRevision=structuredClone(graph);
oldRevision.qaGeometryRevision="2621-oiaw-inset-registration-r2";
assert.notEqual(oldRevision.qaGeometryRevision,graph.qaGeometryRevision,
  "Stale offline graph must not masquerade as the new inset revision");
const reversed=inset.route(graph,plan.route.path.slice().reverse(),38);
assert.equal(reversed.ok,true);
assert.deepEqual(reversed.points,view.points.slice().reverse());
assert.equal(inset.route(graph,plan.route.path,39).ok,false,"Other pages cannot share this inset");
assert.equal(inset.route(graph,["S3","AA","BA","BH"],38).ok,false,
  "Never draw unregistered stand connectors");
const forged=structuredClone(graph);
forged.previewChartEdgePaths["AA>BA"][1].y=180;
assert.equal(inset.route(forged,plan.route.path,38).ok,false,
  "Tampered line entering white main-chart area must be rejected");
const gap=structuredClone(graph);
gap.previewChartEdgePaths["S4>AA"].at(-1).x-=4;
assert.equal(inset.route(gap,plan.route.path,38).ok,false,
  "Disconnected chart-line segments rejected");
const activated=structuredClone(graph);
activated.enabled=true;
assert.equal(inset.route(activated,plan.route.path,38).ok,false,
  "QA render requires disabled/unapproved network");
assert.equal(!!engine.create(graph).plan("ST4 A B").error,true,
  "Projected paths cannot run in normal routing");
console.log("PASS OIAW inset: QA ST4 A B only, screenshot-registered bends, page + bounds + gaps protected");
