/* Mehrabad V2621 native-chart source layers, not taxi routing approval.
 * Run: node web/tests/taxi-o3-survey-layers.test.cjs
 */
"use strict";
const assert=require("node:assert/strict");
const o3=require("../data/taxi-surveys/OIII.json");
const layers=require("../taxi-o3-layers.js");
assert.equal(o3.airport,"OIII");
assert.equal(o3.cycle,"2621");
assert.equal(o3.source.sha256,"d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6");
assert.equal(o3.stands.length,53);
assert.equal(new Set(o3.stands.map(s=>s.id)).size,53);
assert.equal(o3.taxiways.length,43);
assert.equal(o3.runwayPolygons.length,2);
assert.deepEqual(o3.runwayPolygons.map(r=>r.physicalId),["11L_29R","11R_29L"]);
assert.deepEqual(o3.runwayPolygons.map(r=>r.sourcePdfDrawingId),[1410,1411]);
const adc=layers.compose(o3,430,"A4"),parking=layers.compose(o3,432,"ST115");
assert.equal(adc.ok,true);
assert.equal(parking.ok,true);
assert.equal(adc.runways.length,2);
assert.equal(adc.stands.length,0);
assert.equal(parking.runways.length,0);
assert.equal(parking.stands.length,53);
assert.equal(parking.stands.filter(s=>s.selected).length,1);
assert.equal(parking.stands.find(s=>s.selected).id,"115");
assert.equal(adc.taxiLabels.filter(s=>s.selected).length,1);
assert.equal(layers.compose(o3,431).ok,false,"Other chart pages have no false overlays");
assert.equal(layers.compose(o3,433).ok,false,"Coordinates list is not a georeferenced stand diagram");
assert.equal(o3.readiness.networkConnectivityValidated,false);
assert.equal(o3.readiness.allStandLeadCurvesTraced,false);
assert.equal(o3.readiness.allTaxiwayCenterlinesTraced,false);
assert.equal(o3.approval,"SOURCE_VISUAL_INVENTORY_ONLY");
const bad=structuredClone(o3);
bad.readiness.networkConnectivityValidated=true;
assert.equal(layers.compose(bad,430).ok,false,"Never upgrade readiness by mere label extraction");
console.log("PASS Mehrabad: exact two original runway strips, 53 printed stands, 43 named taxiways; no guessed route");
