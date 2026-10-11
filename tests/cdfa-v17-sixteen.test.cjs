'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const prev=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/data/cdfa-v2621-v16-qa.json'),'utf8'));
const next=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/data/cdfa-v2621-v17-qa.json'),'utf8'));
const audit=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/data/cdfa-v17-16-audit.json'),'utf8'));
const find=p=>next.charts.find(c=>c.sourcePage===p);
test('v17 has 164 charts, 13 new provisional QA tables, 2 mandatory conflicts and 1 unmodified dual-aid chart',()=>{
 assert.equal(next.charts.length,164);assert.equal(audit.qaPromoted,13);assert.equal(audit.held,3);
 assert.equal(next.counts.QA_V17_GEOMETRIC_TABLE_NOT_NAVIGATION_APPROVED,13);
 assert.equal(next.counts.WITHHELD_MANDATORY_FIX_CONFLICT_V17,2);
 assert.equal(next.counts.WITHHELD_MISSING_GEOMETRY,1);
 assert.equal(Object.values(next.counts).reduce((a,b)=>a+b,0),164);
});
test('exactly 15 originally held records were re-evaluated; others are unchanged',()=>{
 const modified=new Set([328,438,541,663,664,665,682,683,716,991,992,1019,1020,1034,1035]);
 for(const c of next.charts){const p=prev.charts.find(x=>x.key===c.key);assert.ok(p);
 if(!modified.has(c.sourcePage))assert.deepEqual(c,p,c.key);
 }
 assert.equal(find(1155).status,'WITHHELD_MISSING_GEOMETRY');
});
test('mandatory altitude intersection does not move or cancel D10 mandatory FIX',()=>{
 for(const [page,publishedFix,expected] of [[328,10,'D5.3'],[541,10,'D8.4']]){
 const c=find(page);
 assert.equal(c.status,'WITHHELD_MANDATORY_FIX_CONFLICT_V17');
 assert.deepEqual(c.table,[]);assert.ok(c.diagnosticTable.length>0);
 assert.equal(c.coverage.mandatoryAltitudeStop.publishedFixDmeNm,publishedFix);
 assert.equal(c.coverage.mandatoryAltitudeStop.calculatedIntersectionDmeDisplay,expected);
 assert.ok(c.publishedChecks.some(q=>q.type==='mandatory'&&!q.ok&&q.dmeNm===10));
 }
});
test('integer DME grid, DME-specific extension to D13/D15, VDP with one decimal and model-only flags',()=>{
 const pages=[438,663,664,665,682,683,716,991,992,1019,1020,1034,1035];
 for(const p of pages){const c=find(p);assert.equal(c.status,'QA_V17_GEOMETRIC_TABLE_NOT_NAVIGATION_APPROVED');
 assert.ok(c.table.length>0);assert.ok(c.table.every((r,i)=>Number.isInteger(r.dme)&&(!i||r.dme===c.table[i-1].dme+1)));
 assert.ok(/^D\d+\.\d$/.test(c.vdp.dmeDisplay));assert.ok(c.publishedChecks.every(q=>q.ok));
 assert.equal(c.coverage.meetsThresholdModelCoverage,true);
 assert.equal(c.distanceReference.navaidColocationVerified,false);
 }
 for(const p of [438])assert.equal(find(p).table.at(-1).dme,13);
 for(const p of [663,664,665,1019,1020])assert.equal(find(p).table.at(-1).dme,15);
 for(const p of [991,992,1034,1035])assert.ok(find(p).table.at(-1).dme>=10);
});
test('missing TCH is default 50, clearly marked assumed; approximate RSR 0.7 and LAM fitted 0.53 offsets not conflated',()=>{
 for(const p of [682,683,716]){
 const c=find(p);assert.equal(c.tchFt,50);assert.equal(c.tchSource,'DEFAULT_ASSUMED_50_FT_QA');
 assert.ok(c.table.some(r=>r.reasons.includes('DEFAULT_50_FT_TCH_ASSUMED_NOT_PUBLISHED')));
 }
 assert.ok(Math.abs(find(682).stationOffsetNm-0.7)<.02);
 assert.ok(Math.abs(find(683).stationOffsetNm-0.7)<.02);
 assert.ok(Math.abs(find(716).stationOffsetNm-0.53)<.02);
});
test('original chart altitude restrictions stay exact without rounding source values',()=>{
 for(const c of next.charts.filter(x=>x.reviewVersion==='1.7.0')){
 for(const f of c.modelInput.publishedConstraints){if(f.type==='mandatory')assert.ok([328,541].includes(c.sourcePage));}
 assert.ok(c.qaWarnings.some(x=>/NOT|not|QA|geometric/i.test(x)));
 }
});