"use strict";
const {test}=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const core=require("../cdfa-increment-core.js");
test("next DME row is selected inbound, including terminating VDP",()=>{
 const rows=[{dme:10},{dme:9},{dme:8},{dme:7},{dme:6},{dme:2.6}];
 assert.equal(core.targetIndex(rows,7.4),3);
 assert.equal(core.targetIndex(rows,6.8),4);
 assert.equal(core.targetIndex(rows,2.9),5);
 assert.equal(core.targetIndex(rows,2.3),-1);
 assert.equal(core.targetIndex(rows,NaN),-1);
});
test("simulator signal requires both station ident and chart identity",()=>{
 const record={referenceDmeId:"ABD",icao:"OIAA",sourcePage:12};
 assert.equal(core.validatedReading({dmeNm:7.4,dmeId:"ABD",cdfaIcao:"OIAA",cdfaPage:12},record),7.4);
 assert.equal(core.validatedReading({dmeNm:7.4,dmeId:"NDB",cdfaIcao:"OIAA",cdfaPage:12},record),null);
 assert.equal(core.validatedReading({dmeNm:7.4,dmeId:"ABD",cdfaIcao:"OIII",cdfaPage:12},record),null);
 assert.equal(core.validatedReading({lat:30.3,lon:48.2},record),null);
});
test("visual addition preserves locked table and PDF-georeference assets",()=>{
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const css=fs.readFileSync(path.join(root,"cdfa-increment-tracker.css"),"utf8");
 const overlay=fs.readFileSync(path.join(root,"cdfa-increment-tracker.js"),"utf8");
 const sw=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
 assert.match(html,/cdfa-increment-core\.js\?v=2621-cdfa-gps-distance-r1/);
 assert.match(html,/cdfa-increment-tracker\.js\?v=2621-cdfa-gps-distance-r1/);
 assert.match(html,/cdfa-increment-tracker\.css\?v=2621-cdfa-increment-colors-r3/);
 assert.match(sw,/cdfa-increment-tracker\.js\?v=2621-cdfa-gps-distance-r1/);
 assert.match(overlay,/\.observe\(panel,\{childList:true,subtree:true\}\)/);
 assert.match(overlay,/line\.setAttribute\("y1"/);
 assert.match(overlay,/Number\(line\.getAttribute\("x1"\)\)===0/);
 assert.match(css,/transition:transform 730ms cubic-bezier/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(overlay,/cdfa_increment_qa/);
 assert.doesNotMatch(overlay,/georefByPage|publishedConstraints|altitudeFt\s*=/);
});

test("DME crossing uses 0.035 NM deadband, avoiding jumpy highlight at the row boundary",()=>{
 const rows=[{dme:9},{dme:8},{dme:7},{dme:6},{dme:2.6}];
 // D7 currently selected while inbound. Noise at 6.99 must keep D7,
 // but crossing to 6.94 must move to D6 and remain there until outbound 7.035.
 assert.equal(core.targetIndex(rows,6.99,2),2);
 assert.equal(core.targetIndex(rows,6.94,2),3);
 assert.equal(core.targetIndex(rows,7.02,3),3);
 assert.equal(core.targetIndex(rows,7.05,3),2);
});

test("CDFA moving guides are pink on normal paper and keep approved yellow on INVERT",()=>{
 const css=fs.readFileSync(path.join(root,"cdfa-increment-tracker.css"),"utf8");
 const preview=fs.readFileSync(path.join(root,"cdfa-increment-preview.html"),"utf8");
 assert.match(css,/stroke:#FF4FA0;stroke-width:5\.4/);
 assert.match(css,/stroke:#FF7AB8;stroke-width:11/);
 assert.match(css,/body\.chart-inverted[\s\S]*?\.jp-inc-line\{\s*stroke:#F7CB6D;/);
 assert.match(css,/body\.chart-inverted[\s\S]*?\.jp-inc-line\.jp-inc-halo\{\s*stroke:#E99B0A;/);
 assert.match(preview,/id="previewInvertBtn"/);
 assert.doesNotMatch(preview,/#jpCdfaSide \.jp-inc-line\{stroke:#f8b63e/);
});

test("live bridge DME is forwarded only when a real identifier and numeric NM are present",()=>{
 const vm=require("node:vm");
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const tracker=fs.readFileSync(path.join(root,"cdfa-increment-tracker.js"),"utf8");
 const start=app.indexOf("function simulatorDmePacket(packet){");
 const end=app.indexOf("function updatePositionUi(p,source){",start);
 assert.ok(start>=0&&end>start,"a single safe telemetry parser must exist");
 const read=vm.runInNewContext("(function(){"+app.slice(start,end)+"return simulatorDmePacket;})()",{});
 assert.equal(read({dme:{id:"abd",nm:7.41}})?.id,"ABD");
 assert.equal(read({dmeId:"ABD",dmeNm:7.41})?.nm,7.41);
 assert.equal(read({dmeId:"ABD",dmeNm:"7.41"}),null);
 assert.equal(read({dmeId:"ABD",dmeNm:NaN}),null);
 assert.equal(read({lat:30.3,lon:48.2}),null);
 assert.equal((app.match(/dme:simulatorDmePacket\(d\)/g)||[]).length,2,
  "relay and direct simulator websocket must both preserve true DME");
 assert.match(tracker,/cdfaIcao:current\?\.airport/);
 assert.match(tracker,/cdfaPage:current\?\.page/);
 assert.match(tracker,/core\.validatedReading\(\{\.\.\.position/);
 assert.match(tracker,/core\.estimatedReading\(position,r,stationSites\)/);
 assert.match(tracker,/const qa=new URLSearchParams\(location\.search\)\.get\("cdfa_increment_qa"\)==="1"/);
});

test("GPS and simulator position compute station-bound distance, without altering published CDFA rows",()=>{
 const stations=JSON.parse(fs.readFileSync(path.join(root,"data/cdfa-dme-stations-v2621.json"),"utf8"));
 const site=stations.stations.ABD;
 assert.equal(stations.country,"IR");
 assert.ok(Object.keys(stations.stations).length>=50);
 const reference={icao:"OIAA",sourcePage:12,referenceDmeId:"ABD",dmeStationCandidate:"ABD"};
 const siteLat=30+22/60+31.1/3600,siteLon=48+13/60+14.2/3600;
 const flat=core.estimatedReading({lat:siteLat,lon:siteLon,alt:150,source:"gps",timestamp:Date.now(),accuracy:9},reference,stations.stations);
 assert.equal(flat.mode,"ground_estimate"); // no antenna elevation, not assumed to be zero
 assert.ok(flat.nm<0.00001);
 const farther=core.estimatedReading({lat:siteLat+0.1,lon:siteLon,alt:150},reference,stations.stations);
 assert.ok(farther.nm>5.95&&farther.nm<6.05);
 const elevated=core.estimatedReading({lat:siteLat,lon:siteLon,alt:304.8},reference,
   {ABD:{...site,elevationFt:0}});
 assert.equal(elevated.mode,"slant_estimate");
 assert.ok(Math.abs(elevated.nm-304.8/1852)<0.000001);
 assert.equal(core.estimatedReading({lat:siteLat,lon:siteLon,source:"gps",accuracy:2000},reference,stations.stations),null);
 assert.equal(core.estimatedReading({lat:siteLat,lon:siteLon}, {...reference,icao:"UGTB"},stations.stations),null);
 assert.equal(core.estimatedReading({lat:siteLat,lon:siteLon},
   {...reference,distanceReference:{navaidColocationVerified:false}},stations.stations),null);
 assert.equal(core.estimatedReading({lat:siteLat,lon:siteLon},
   {...reference,referenceDmeId:"WRONG"},stations.stations),null);
 assert.equal(core.estimatedReading({lat:siteLat,lon:siteLon},reference,{}),null);
 assert.deepEqual(core.targetIndex([{dme:10},{dme:8},{dme:6}],8.5),1);
});
test("simulator panel renders feet, internal metres and GPS altitude input are preserved",()=>{
 const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
 const html=fs.readFileSync(path.join(root,"index.html"),"utf8");
 const sw=fs.readFileSync(path.join(root,"service-worker.js"),"utf8");
 assert.match(html,/ALT \(ft\)/);
 assert.match(app,/p\.alt\*3\.280839895/);
 assert.match(app,/alt:Number\.isFinite\(c\.altitude\)\?c\.altitude:null/);
 assert.match(app,/jeppiran-position",\{detail:\{\.\.\.p,source\}\}/);
 assert.match(sw,/cdfa-dme-stations-v2621\.json/);
});
