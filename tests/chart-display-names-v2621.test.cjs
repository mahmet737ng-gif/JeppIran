
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const titles=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/data/chart-display-names-v2621.json'),'utf8'));
const charts=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/charts-current.json'),'utf8'));
test('all 49 generic APPROACH titles have a visual-only source-header label',()=>{
const candidates=charts.filter(c=>/^APPROACH(?: [A-Z0-9-]+)?$/i.test(c.name));
assert.equal(candidates.length,49);
assert.equal(Object.keys(titles.pages).length,49);
for(const c of candidates)assert.ok(titles.pages[String(c.page)]&&!/^APPROACH(?: [A-Z0-9-]+)?$/i.test(titles.pages[String(c.page)]));
});
test('Rafsanjan 16-2 is displayed as NDB DME RWY 29 without modifying stable metadata',()=>{
const c=charts.find(c=>c.airport==='OIKR'&&c.chart_number==='16-2');
assert.equal(c.name,'APPROACH 16-2');
assert.equal(titles.pages[String(c.page)],'NDB DME RWY 29');
});