/* OIIE source-PDF audit regression: all 103 printed stand callouts have
 * source drawing lineage, but this is NOT a taxi-clearance graph.
 * Run: node web/tests/taxi-oiie-stage1to3-source.test.cjs
 */
"use strict";
const assert=require("node:assert/strict");
const review=require("../data/taxi-surveys/OIIE-3step-source-review-2621.json");
const baseline=require("../data/taxi-surveys/OIIE.json");
const manifest=require("../data/charts-manifest.json");
const fs=require("node:fs"),path=require("node:path");
const mode=fs.readFileSync(path.resolve(__dirname,"../taxi-mode.js"),"utf8");
assert.equal(review.airport,"OIIE");
assert.equal(review.cycle,"2621");
assert.equal(review.sourceSha256,manifest.source_sha256);
assert.equal(review.routeable,false);
assert.equal(review.reviewedCenterlines,0);
assert.equal(review.reviewedStandLeads,0);
assert.equal(review.reviewedPhysicalTaxiJunctions,0);
assert.equal(review.stands.length,103);
assert.equal(review.taxiways.length,24);
assert.equal(baseline.stands.length,103);
assert.equal(new Set(review.stands.map(s=>s.id)).size,103);
assert.equal(new Set(review.taxiways.map(t=>t.name)).size,24);
assert.deepEqual(new Set(review.stands.map(s=>s.id)),new Set(baseline.stands.map(s=>"ST"+s.id)));
assert.deepEqual(new Set(review.taxiways.map(t=>t.name)),new Set(baseline.taxiways.map(t=>t.id)));
assert.ok(review.stands.every(s=>s.nearestNativeDrawingId>=0&&
  s.labelPointPdf.length===2&&s.labelPointPdf.every(Number.isFinite)&&
  s.leadVerified===false&&s.physicalConnectionApproved===false));
assert.ok(review.taxiways.every(t=>t.centerlineApproved===false&&
  t.neighborTaxiwayIdsApproved.length===0));
assert.ok(review.taxiways.some(t=>t.name==="Z"&&t.nearestNativeDrawingId===null),
 "Taxiway Z native text exists, but no black centerline can be invented");
assert.equal(review.sourceStrokeScan[380].candidateStrokes,258);
assert.equal(review.sourceStrokeScan[382].candidateStrokes,259);
assert.equal(review.sourceStrokeScan[383].candidateStrokes,208);
assert.equal([380,382,383].reduce((n,k)=>n+review.sourceStrokeScan[k].candidateContacts,0),926);
assert.equal(review.knownInkComponents.reduce((n,c)=>n+c.printedStands,0),103);
assert.equal(review.knownInkComponents.length,3);
assert.ok(mode.includes('if(icao==="OIIE")'));
assert.ok(mode.includes("taxi.oiieReview=review"));
assert.ok(mode.includes("taxi-oiie-source-stand-anchor-qa"));
assert.ok(mode.includes("taxi-oiie-source-taxi-label-qa"));
assert.match(mode,/An incomplete airport graph must NOT draw a guessed route/);
console.log("PASS OIIE 3-step audit: 103 source-located stand callouts, 24 labels, 725 lines, 926 unreviewed contacts, zero fabricated taxi edges");
