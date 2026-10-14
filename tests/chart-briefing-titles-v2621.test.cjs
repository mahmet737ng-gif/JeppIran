'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>JSON.parse(fs.readFileSync(path.join(__dirname,'..',p),'utf8'));
const titles=read('web/data/chart-briefing-titles-v2621.json');
const android=read('app/src/main/assets/chart-briefing-titles-v2621.json');
const charts=read('web/data/charts-current.json');

test('Both apps have identical, cycle-bound briefing display labels',()=>{
  assert.deepEqual(android,titles);
  assert.equal(titles.cycle,'2621');
  assert.equal(titles.displayOnly,true);
  assert.equal(Object.keys(titles.pages).length,75);
});

test('74 real briefing pages and one corrected 10-9A keep their original identities',()=>{
  const original=charts.filter(c=>c.category==='Airport'&&c.name.startsWith('AIRPORT BRIEFING'));
  assert.equal(original.length,75);
  assert.deepEqual(Object.keys(titles.pages).map(Number).sort((a,b)=>a-b),
    original.map(c=>c.page).sort((a,b)=>a-b));
  for(const [page,review] of Object.entries(titles.pages)){
    const chart=charts.find(c=>String(c.page)===page);
    assert.ok(chart,'Unknown chart page '+page);
    assert.equal(chart.category,'Airport');
    assert.equal(chart.airport,review.icao);
    assert.equal(chart.chart_number,review.chart_number);
    assert.ok(chart.name.startsWith('AIRPORT BRIEFING'));
    assert.match(review.name,page==='431'?/^Additional Runway Information \/ Hot Spots$/:/^Brief: /);
  }
});

test('Long subjects and mid-page transitions have correct page-specific titles',()=>{
  assert.equal(titles.pages['398'].name,'Brief: General 3, Arrival 1');
  assert.equal(titles.pages['399'].name,'Brief: Arrival 2');
  assert.equal(titles.pages['1171'].name,'Brief: Arrival 2, Departure 1');
  assert.equal(titles.pages['1458'].name,'Brief: Arrival 2, Departure 1');
  assert.equal(titles.pages['431'].name,'Additional Runway Information / Hot Spots');
});
