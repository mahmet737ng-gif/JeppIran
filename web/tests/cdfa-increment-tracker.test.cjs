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
 assert.match(html,/cdfa-increment-core\.js\?v=2621-cdfa-increment-qa-r2/);
 assert.match(html,/cdfa-increment-tracker\.js\?v=2621-cdfa-live-dme-r1/);
 assert.match(html,/cdfa-increment-tracker\.css\?v=2621-cdfa-increment-colors-r3/);
 assert.match(sw,/cdfa-increment-tracker\.js\?v=2621-cdfa-increment-qa-r2/);
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
 assert.match(tracker,/core\.validatedReading\(packet,record\(\)\)/);
 assert.match(tracker,/const qa=new URLSearchParams\(location\.search\)\.get\("cdfa_increment_qa"\)==="1"/);
});
