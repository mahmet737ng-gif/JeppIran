"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs");
const {expected,assess}=require("../scripts/taxi-engine/gate-matrix.cjs");
const oiie=JSON.parse(fs.readFileSync("web/data/taxi-surveys/OIIE.json","utf8"));
assert.equal(oiie.stands.length,103);
assert.equal(oiie.taxiways.length,24);
assert.deepEqual(oiie.runwayPolygons.flatMap(x=>x.ends).sort(),["11L","11R","29L","29R"]);
const matrix=expected(103,24,4);
assert.deepEqual(matrix,{standRunway:824,standStand:10506,
 taxiStand:4944,taxiRunway:192,taxiTaxi:552,total:17018});
const safe=assess(oiie,null);
assert.equal(safe.ready,false);
assert.equal(safe.expected.total,17018);
assert.equal(safe.passed,0);
assert.equal(safe.failed,17018);
assert.equal(safe.reason,"NO_SOURCE_REVIEWED_GRAPH");
console.log("PASS: OIIE 17,018 required directed cases; all blocked until reviewed topology exists");
