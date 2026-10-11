const {test}=require('node:test');const assert=require('node:assert/strict');
const {buildTable}=require('../cdfa-engine.js');const fs=require('node:fs');const path=require('node:path');
const data=JSON.parse(fs.readFileSync(path.join(__dirname,'../data/cdfa-v2621-v14-qa.json'),'utf8'));
const rows=data.charts.filter(c=>Array.isArray(c.table)&&c.table.length>0);
test('164 eligible charts each appear once and no circling-only/Ils/rnp in release set',()=>{
 assert.equal(data.charts.length,164);assert.equal(new Set(data.charts.map(x=>x.sourcePage)).size,164);
 for(const x of data.charts)assert.ok(!/\b(Circling|ILS|LOC|RNP)\b/i.test(x.title),x.title);
});
test('all modeled charts show integer DME increment 1 and threshold coverage >=10 NM',()=>{
 assert.equal(rows.length,117);
 for(const chart of rows){
  for(let i=0;i<chart.table.length;i++){
   assert.ok(Number.isInteger(chart.table[i].dme));
   if(i)assert.equal(chart.table[i].dme-chart.table[i-1].dme,1);
  }
  assert.ok(chart.coverage.meetsThresholdModelCoverage,chart.key);
  assert.ok(chart.coverage.meetsDmeModelCoverage,chart.key);
  assert.ok(chart.coverage.maxModeledThresholdDistanceNm >= 10,chart.key);
  assert.ok(chart.coverage.maxModeledDmeNm >= 10,chart.key);
  assert.match(chart.vdp.dmeDisplay,/^D\d+\.\d$/);
  assert.equal(chart.vdp.published,false);
  assert.notEqual(chart.geometryConfidence,'VERIFIED_FOR_NAVIGATION');
 }
});
test('withheld charts have no invented calculated altitudes or calculated VDP',()=>{
 const blocked=data.charts.filter(x=>x.status==='WITHHELD_MISSING_GEOMETRY');
 assert.equal(blocked.length,47);
 for(const x of blocked){assert.deepEqual(x.table,[]);assert.equal(x.vdp,null);assert.ok(x.blockers.length);}
});
test('at least one source example is computed with published chart angle',()=>{
 const u=data.charts.find(x=>x.sourcePage===827);
 assert.equal(u.angleDeg,3.77);
 assert.equal(u.table[u.table.length-1].dme,13);
 assert.equal(u.vdp.dmeDisplay,'D3.2');
});
test('recalculate all 117 modeled tables using identical engine and compare every row',()=>{
 for(const x of rows){const result=buildTable(x.modelInput);
  assert.equal(result.version,'1.4.0');
  assert.equal(result.rows.length,x.table.length);
  for(let i=0;i<result.rows.length;i++){
   assert.equal(result.rows[i].dmeNm,x.table[i].dme,x.key);
   assert.equal(result.rows[i].roundedAltitudeFt,x.table[i].altitudeFt,x.key);
  }
  assert.equal(result.vdp.dmeDisplay,x.vdp.dmeDisplay,x.key);
 }
});

test('v1.4: airport-elevation fallback is explicitly marked, never produces candidate rows',()=>{
 const fallback=rows.filter(x=>x.usedAirportElevationFallback);
 assert.equal(fallback.length,59);
 for(const x of fallback){
  assert.equal(x.elevationSource,'AIRPORT_ELEVATION_FALLBACK_QA');
  assert.equal(x.sourceExtracted.rwyElevationFt,null);
  assert.equal(x.thresholdElevationFt,x.sourceExtracted.airportElevationFt);
  assert.equal(x.modelInput.thresholdElevationFt,undefined);
  assert.ok(Number.isFinite(x.modelInput.airportElevationFt));
  const r=buildTable(x.modelInput);
  assert.equal(r.parameters.usedAirportElevationFallback,true);
  assert.deepEqual(r.candidateRows,[]);
  assert.ok(r.rows.every(v=>v.reasons.includes('AIRPORT_ELEVATION_USED_INSTEAD_OF_RUNWAY_THRESHOLD_QA') || v.status==='UNRESOLVED'));
 }
});
test('v1.4: manually reviewed OIAA runway 14R elevation from ADC remains preferred',()=>{
 const x=data.charts.find(x=>x.sourcePage===12);
 assert.equal(x.elevationSource,'RUNWAY_THRESHOLD');
 assert.equal(x.sourceExtracted.elevationSource,'RUNWAY_THRESHOLD_FROM_ADC_10-9');
 assert.equal(x.thresholdElevationFt,8);
 assert.equal(x.usedAirportElevationFallback,false);
});