'use strict';
const {test}=require('node:test'), assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const dir=path.join(__dirname,'../web/data');
const old=JSON.parse(fs.readFileSync(path.join(dir,'cdfa-v2621-v15-qa.json'),'utf8'));
const now=JSON.parse(fs.readFileSync(path.join(dir,'cdfa-v2621-v16-qa.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(dir,'cdfa-v2621-v16-remaining42-audit.json'),'utf8'));
const found=p=>now.charts.find(x=>x.sourcePage===p);
const selected=now.charts.filter(x=>x.status==='QA_HEADER_REFERENCE_GEOMETRY_MODEL_V16');
const remaining=now.charts.filter(x=>x.status==='WITHHELD_MISSING_GEOMETRY');
test('old release has 164 charts / 42 withheld',()=>{assert.equal(old.charts.length,164);assert.equal(old.counts.WITHHELD_MISSING_GEOMETRY,42)});
test('new release has 164 charts, 26 QA promoted and 16 still withheld',()=>{
 assert.equal(now.charts.length,164);assert.equal(selected.length,26);assert.equal(remaining.length,16);
 assert.equal(Object.values(now.counts).reduce((a,b)=>a+b,0),164);
 assert.equal(audit.promotedQA,26);assert.equal(audit.remainingWithheld,16);
});
test('exact 26 promoted were part of the original 42 withheld',()=>{
 const prev=new Set(old.charts.filter(x=>x.status==='WITHHELD_MISSING_GEOMETRY').map(x=>x.key));
 for(const x of selected)assert.ok(prev.has(x.key),x.key);
});
test('each promoted QA chart has integer grid, >=10NM coverage, valid DME/VDP provenance',()=>{
 for(const c of selected){
  assert.ok(c.table.length>=9,c.key);
  for(let i=0;i<c.table.length;i++){
   const row=c.table[i];assert.equal(row.dme,Math.round(row.dme),c.key);
   if(i)assert.equal(row.dme,c.table[i-1].dme+1,c.key);
  }
  assert.ok(c.coverage.meetsThresholdModelCoverage,c.key);
  assert.ok(c.coverage.meetsDmeModelCoverage,c.key);
  assert.ok(c.coverage.maxModeledThresholdDistanceNm>=10,c.key);
  assert.ok(c.publishedChecks.every(x=>x.ok),c.key);
  assert.ok(c.vdp&&/^D\d+\.\d$/.test(c.vdp.dmeDisplay),c.key);
  assert.equal(c.procedureReference.source,'VISUALLY_TRANSCRIBED_CHART_HEADER',c.key);
  assert.ok(c.sourceAudit.aidFrequencyMHz>=108&&c.sourceAudit.aidFrequencyMHz<=118,c.key);
  assert.equal(c.distanceReference.id,c.referenceDmeId,c.key);
  assert.equal(c.distanceReference.navaidColocationVerified,false,c.key);
  assert.equal(c.geometryConfidence,'SOURCE_CHART_INTERPRETED_NOT_SURVEY_VERIFIED');
  assert.equal(c.usedAirportElevationFallback,c.elevationSource==='AIRPORT_ELEVATION_FALLBACK_QA');
  if(c.usedAirportElevationFallback)assert.equal(c.sourceExtracted.rwyElevationFt,null,c.key);
 }
});
test('all still withheld have no synthetic DME rows',()=>{
 for(const c of remaining)assert.deepEqual(c.table,[],c.key);
});
test('negative airport elevation -37 and -66 is preserved as a valid source',()=>{
 for(const [p,elev] of [[330,-37],[684,-66]]){
  const c=found(p);assert.equal(c.sourceExtracted.airportElevationFt,elev);assert.equal(c.usedAirportElevationFallback,true);
 }
});
test('NDB chart header reference kept independent of DME transmitter',()=>{
 for(const [p,nav,dme] of [[280,'IFN','ISN'],[527,'KHM','KHM'],[540,'RAF','RAF'],[1160,'ANK','ESB'],[1161,'ANK','ESB']]){
  const c=found(p);assert.equal(c.procedureReference.type,'NDB',`${p}`);
  assert.equal(c.procedureReference.id,nav,`${p}`);assert.equal(c.referenceDmeId,dme,`${p}`);
 }
});
test('multiple DME station and mandatory-conflict charts remain withheld',()=>{
 for(const p of [328,541,1155])assert.equal(found(p).status,'WITHHELD_MISSING_GEOMETRY');
});
test('all five approved previous NDB examples retain same data',()=>{
 for(const p of [18,56,57,59,60]){
  const before=old.charts.find(x=>x.sourcePage===p),after=found(p);
  assert.deepEqual(after,before,`p${p} regression`);
 }
});