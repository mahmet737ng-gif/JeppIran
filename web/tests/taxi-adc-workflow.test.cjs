/* ADC->routable workflow regression: named connections, gates, cross-page
 * registration and no proximity-only routes. Run: node web/tests/taxi-adc-workflow.test.cjs
 */
"use strict";
const assert=require("node:assert/strict");
const api=require("../taxi-adc-workflow.js");
const oiii=require("../data/taxi-surveys/OIII.json");
const live=api.compile(api.fromSurvey(oiii));
assert.equal(live.airport,"OIII");
assert.equal(live.summary.runways,2);
assert.equal(live.summary.taxiways,43);
assert.equal(live.summary.stands,53);
assert.equal(live.summary.routeable,false);
assert.equal(live.summary.reviewedGraphEdges,0);
assert.equal(live.jobs.find(x=>x.status==="PENDING").id,"geometry");
assert.ok(live.issues.some(x=>x.code==="RUNWAY_AXIS_UNTRACED"));
assert.ok(live.issues.some(x=>x.code==="PAGE_ALIGNMENT_PENDING"));
const trace=(id,kind,label,points,extra={})=>({
 id,kind,label,points,page:1,source:"SOURCE_PDF",sourceDrawingIds:[20+id.charCodeAt(0)],reviewed:true,...extra});
function fixture(){
 return {airport:"TEST",cycle:"2621",source:{sha256:"a".repeat(64)},
 pages:[{page:1,width:612,height:792}],
 inventory:{runways:[{physicalId:"11_29",ends:["11","29"],publishedLengthM:3200}],
   taxiways:[{id:"A"},{id:"B"}],stands:[{id:"ST1"}]},
 traces:[trace("S","stand-lead","ST1",[[10,10],[20,10]],{standId:"ST1"}),
   trace("A","taxiway","A",[[20,10],[30,10]]),
   trace("B","taxiway","B",[[30,10],[40,10]]),
   trace("G","runway-connector","G",[[40,10],[50,10]]),
   trace("R","runway-axis","11_29",[[50,10],[60,10]],{physicalRunway:"11_29"})],
 junctions:[{id:"SA",page:1,point:[20,10],touches:["S","A"],reviewed:true},
   {id:"AB",page:1,point:[30,10],touches:["A","B"],reviewed:true},
   {id:"BG",page:1,point:[40,10],touches:["B","G"],reviewed:true},
   {id:"GR",page:1,point:[50,10],touches:["G","R"],reviewed:true}],
 runwayGates:[{id:"G1",reviewed:true,page:1,taxiTraceId:"B",
   connectorTraceId:"G",runwayTraceId:"R",physicalRunway:"11_29",
   holdShortReviewed:true,holdPoint:[40,10],runwayPoint:[50,10]}],
 routingPages:[1],pageLinks:[],releaseReviewed:true};
}
const approved=api.compile(fixture());
assert.equal(approved.summary.routeable,true,approved.issues.map(i=>i.code).join(","));
assert.equal(approved.summary.reviewedGraphEdges,5);
assert.equal(approved.issues.length,0);
const badJunction=fixture();
badJunction.junctions=badJunction.junctions.filter(x=>x.id!=="GR");
const blocked=api.compile(badJunction);
assert.equal(blocked.summary.routeable,false);
assert.ok(blocked.issues.some(x=>x.code==="RUNWAY_GATE_INVALID"));
assert.ok(blocked.issues.some(x=>x.code==="DISCONNECTED_STAND"));
const missingCurve=fixture();missingCurve.traces[0].reviewed=false;
assert.equal(api.compile(missingCurve).summary.routeable,false);
const runwayNotApproved=fixture();runwayNotApproved.runwayGates[0].holdShortReviewed=false;
assert.ok(api.compile(runwayNotApproved).issues.some(i=>i.code==="RUNWAY_GATE_INVALID"));
const noAxis=fixture();noAxis.traces.pop();
assert.ok(api.compile(noAxis).issues.some(i=>i.code==="RUNWAY_AXIS_UNTRACED"));
const extraPage=fixture();
extraPage.pages.push({page:2,width:612,height:792});extraPage.routingPages=[1,2];
assert.ok(api.compile(extraPage).issues.some(i=>i.code==="PAGE_ALIGNMENT_PENDING"));
const fakeNamed=fixture();fakeNamed.traces[2].label="C";
assert.ok(api.compile(fakeNamed).issues.some(i=>i.code==="TRACE_LABEL"));
console.log("PASS ADC v2 workflow: OIII blocked; synthetic reviewed graph routeable; failed hold/curve/junction/page gates blocked");
