"use strict";
/* Real V2621 PDF runway-only axes. Do not accept an apron taxi clearance.
 * Usage: node web/tests/taxi-oiie-runway-axes.test.cjs <generated-json>
 */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const qa=require("../taxi-oiie-stages456.js");
const path=process.argv[2];
if(!path)throw Error("Provide source-generated runway axes JSON path");
const src=JSON.parse(fs.readFileSync(path,"utf8"));
const reviewed=qa.reviewRunwayAxes(src);
assert.equal(reviewed.ok,true,reviewed.reason);
assert.equal(reviewed.routeableForStand,false);
assert.equal(reviewed.routeableForRunwayOnly,true);
assert.equal(reviewed.axes.length,2);
assert.equal(reviewed.runwayOnlyPairs,4);
assert.deepEqual(reviewed.axes.map(v=>v.physicalId),["11L_29R","11R_29L"]);
assert.deepEqual(reviewed.axes.map(v=>v.sourceDrawingId),[41,457]);
for(const a of reviewed.axes){
 assert.equal(a.requiresExplicitRunwayClearance,true);
 assert.equal(a.page,380);
 assert.ok(a.lengthM>4000&&a.lengthM<4300);
 for(const p of a.points)assert.equal(qa.regionAt(380,p)?.id,"ADC");
}
const reject=bad=>assert.equal(qa.reviewRunwayAxes(bad).ok,false);
reject({...src,safeForNavigation:true});
reject({...src,approvedRunwayGates:1});
reject({...src,originalSourceSha256:"0000"});
reject({...src,runways:[{...src.runways[0],drawingId:999},src.runways[1]]});
reject({...src,runways:[{...src.runways[0],relativeLengthErrorPct:2},src.runways[1]]});
reject({...src,runways:[{...src.runways[0],entryOrExitTaxiGatesApproved:true},src.runways[1]]});
console.log("PASS real OIIE 11L/29R + 11R/29L source runway-only axes: two-way, ATC clearance required; 0 unverified stand/runway gates");
