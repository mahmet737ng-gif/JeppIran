/* JEPPIRAN — V2621 Airport Information physical runway dimensions QA.
 * Original source: Iran2621.pdf, SHA-256 pinned in charts-manifest.json.
 * Do not conflate published physical Length x Width with runway TORA/LDA. */
"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
test("every active airport and runway end has Airport Information length and width",()=>{
 const source=read("app/src/main/assets/airport-runways.json");
 const manifest=read("app/src/main/assets/charts-manifest.json");
 assert.equal(source.cycle,manifest.version);
 assert.equal(source.runway_dimensions_summary.source_sha256,manifest.source_sha256);
 assert.equal(Object.keys(manifest.airports).length,78);
 assert.deepEqual(Object.keys(source.airports).sort(),Object.keys(manifest.airports).sort());
 assert.equal(Object.values(source.airports).flat().length,215);
 for(const [icao,runways] of Object.entries(source.airports)){
  assert.ok(runways.length>=1,icao);
  const names=new Set();
  for(const row of runways){
   assert.ok(!names.has(row.name),icao+"/"+row.name+" duplicate");
   names.add(row.name);
   assert.ok(row.lengthFt>=500 && row.lengthFt<=22000,icao+"/"+row.name+" length");
   assert.ok(row.widthFt>=30 && row.widthFt<=250,icao+"/"+row.name+" width");
   assert.equal(row.length,Math.round(row.lengthFt*.3048),icao+"/"+row.name+" length m");
   assert.equal(row.width,Math.round(row.widthFt*.3048),icao+"/"+row.name+" width m");
   assert.match(row.dimensionsSource,/Jeppesen Airport Information V2621/);
   assert.ok(Number.isInteger(row.dimensionsPage) && row.dimensionsPage>0,icao+"/"+row.name);
   assert.ok(["asphalt","concrete"].includes(row.surface),icao+"/"+row.name);
   if(row.headingAdc!==null)assert.equal(row.headingSourceType,"Jeppesen ADC");
  }
  const lookup=Object.fromEntries(runways.map(x=>[x.name,x]));
  for(const row of runways){
   const parts=/^([0-3][0-9])([LRC]?)$/.exec(row.name);
   if(!parts)continue;
   const opposite=String((Number(parts[1])+17)%36+1).padStart(2,"0")+({L:"R",R:"L",C:"C","":""}[parts[2]]);
   if(!lookup[opposite])continue;
   assert.equal(row.lengthFt,lookup[opposite].lengthFt,icao+" opposite length "+row.name);
   assert.equal(row.widthFt,lookup[opposite].widthFt,icao+" opposite width "+row.name);
  }
 }
});
test("known physical runway dimensions match printed Airport Information, not usable landing/take-off lengths",()=>{
 const d=read("app/src/main/assets/airport-runways.json").airports;
 const get=(icao,name)=>d[icao].find(r=>r.name===name);
 assert.deepEqual([get("OIII","11R").lengthFt,get("OIII","11R").widthFt],[13238,197]);
 assert.deepEqual([get("OIII","11L").lengthFt,get("OIII","11L").widthFt],[12717,148]);
 assert.deepEqual([get("OIIE","11L").lengthFt,get("OIIE","11L").widthFt],[13773,148]);
 assert.deepEqual([get("OIMM","13R").lengthFt,get("OIMM","13R").widthFt],[12861,148]);
 assert.deepEqual([get("LTAC","03C").lengthFt,get("LTAC","03C").widthFt],[12310,197]);
 assert.deepEqual([get("LTFM","17L").lengthFt,get("LTFM","17L").widthFt],[13451,197]);
 assert.deepEqual([get("OICZ","10").lengthFt,get("OICZ","10").widthFt],[8632,98]);
 assert.equal(get("OIII","11R").headingAdc,105);
 assert.equal(get("OIAA","14R").headingAdc,141);
 for(const airport of ["LTFM","OIFE","OIFP"])for(const r of d[airport]){
  assert.equal(r.headingAdc,null,"no invented ADC heading for "+airport);
 }
});
