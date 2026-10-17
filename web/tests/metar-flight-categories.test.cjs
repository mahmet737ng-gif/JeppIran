"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const category=require("../metar-flight-category.js");
const report=(wx)=>"METAR OIII 171230Z 20006KT "+wx+" 19/07 Q1015";
const known=[
  ["VFR","9999 FEW040"],
  ["VFR","CAVOK"],
  ["VFR","9999 SCT030"],
  ["MVFR","8000 BKN080"],
  ["MVFR","9999 BKN030"],
  ["MVFR","5000 OVC030"],
  ["IFR","1500 BKN030"],
  ["IFR","9999 OVC008"],
  ["IFR","6000 VV005"],
  ["LIFR","0500 BKN040"],
  ["LIFR","9999 BKN004"],
  ["LIFR","0800 VV002"],
  ["IFR","2SM BKN050"],
  ["MVFR","3SM OVC070"],
  ["VFR","P6SM CLR"],
  ["LIFR","M1/4SM OVC050"],
  ["IFR","1 1/2SM BKN015"],
];
for(const [code,body] of known) {
  test(code+" classified from "+body,()=>{
    const value=category.classify(report(body));
    assert.equal(value.code,code,value.description);
  });
}
test("ceiling determines more restrictive category when visibility is VFR",()=>{
 assert.equal(category.classify(report("9999 BKN007")).code,"IFR");
 assert.equal(category.classify(report("9999 BKN003")).code,"LIFR");
});
test("visibility determines more restrictive category when ceiling is high",()=>{
 assert.equal(category.classify(report("1200 BKN080")).code,"IFR");
});
test("few and scattered clouds are not ceilings",()=>{
 assert.equal(category.classify(report("9999 FEW003 SCT005")).code,"VFR");
});
test("category boundaries use >3000/>5SM, 1000–3000, 500–1000, <500",()=>{
 assert.equal(category.classify(report("9999 BKN030")).code,"MVFR");
 assert.equal(category.classify(report("9999 BKN010")).code,"MVFR");
 assert.equal(category.classify(report("9999 BKN005")).code,"IFR");
 assert.equal(category.classify(report("9999 BKN004")).code,"LIFR");
 assert.equal(category.classify(report("5SM BKN050")).code,"MVFR");
 assert.equal(category.classify(report("1SM BKN050")).code,"IFR");
});
test("ignores runway RVR instead of assuming it is prevailing visibility",()=>{
 assert.equal(category.classify(report("R29/0800U BKN020")).code,"UNKNOWN");
});
test("unknown observation fields must never be advertised as VFR",()=>{
 for(const raw of [
   "", "No cached METAR", "METAR OIII 171230Z 20006KT 9999 BKN/// 19/07 Q1015",
   "METAR OIII 171230Z 20006KT //// BKN050 19/07 Q1015",
   "TAF OIII 171200Z 1712/1818 22005KT 9999 SCT040",
   "METAR OIII 171230Z NIL", "METAR OIII 171230Z 20006KT 9999 19/07 Q1015",
 ]){
   assert.equal(category.classify(raw).code,"UNKNOWN",raw);
 }
});
test("observed definite LIFR remains valid even when ceiling missing",()=>{
 assert.equal(category.classify(report("0400 BKN///")).code,"LIFR");
});
test("does not include trend or remarks data in the current category",()=>{
 assert.equal(category.classify(report("9999 SCT040")+" TEMPO 3000 BKN002").code,"VFR");
 assert.equal(category.classify(report("9999 SCT040")+" RMK BKN001").code,"VFR");
});
test("global UI integration is properly declared and styled",()=>{
 const root=path.resolve(__dirname,"../..");
 const read=p=>fs.readFileSync(path.join(root,p),"utf8");
 const js=read("web/app.js"),html=read("web/index.html"),sw=read("web/service-worker.js");
 const css=read("web/metar-flight-category.css");
 assert.match(js,/JEPPIRAN_FLIGHT_CATEGORY\?\.classify\(raw\)/);
 assert.match(js,/jp-metar-heading/);
 assert.match(js,/jp-flight-category/);
 for(const name of ["metar-flight-category.js?v=2621-wxrules-v1","metar-flight-category.css?v=2621-wxrules-v1"]){
   assert.ok(html.includes(name)&&sw.includes(name),name);
 }
 for(const code of ["vfr","mvfr","ifr","lifr"])
   assert.ok(css.includes(".jp-flight-"+code),code);
});
