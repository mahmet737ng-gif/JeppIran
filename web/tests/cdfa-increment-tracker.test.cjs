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
 assert.match(html,/cdfa-increment-tracker\.js\?v=2621-cdfa-increment-qa-r2/);
 assert.match(html,/cdfa-increment-tracker\.css\?v=2621-cdfa-increment-qa-r2/);
 assert.match(sw,/cdfa-increment-tracker\.js\?v=2621-cdfa-increment-qa-r2/);
 assert.match(overlay,/\.observe\(panel,\{childList:true,subtree:true\}\)/);
 assert.match(overlay,/line\.setAttribute\("y1"/);
 assert.match(overlay,/Number\(line\.getAttribute\("x1"\)\)===0/);
 assert.match(css,/transition:transform 730ms cubic-bezier/);
 assert.match(css,/prefers-reduced-motion:reduce/);
 assert.match(overlay,/cdfa_increment_qa/);
 assert.doesNotMatch(overlay,/georefByPage|publishedConstraints|altitudeFt\s*=/);
});
