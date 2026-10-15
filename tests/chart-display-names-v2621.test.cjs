
'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const titles=JSON.parse(fs.readFileSync(path.join(__dirname,'../web/data/chart-display-names-v2621.json'),'utf8'));
const charts=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/charts-current.json'),'utf8'));
test('all 49 generic APPROACH titles have a visual-only source-header label',()=>{
const candidates=charts.filter(c=>/^APPROACH(?: [A-Z0-9-]+)?$/i.test(c.name));
assert.equal(candidates.length,49);
assert.equal(Object.keys(titles.pages).length,60);
for(const c of candidates)assert.ok(titles.pages[String(c.page)]&&!/^APPROACH(?: [A-Z0-9-]+)?$/i.test(titles.pages[String(c.page)]));
});
test('Rafsanjan 16-2 is displayed as NDB DME RWY 29 without modifying stable metadata',()=>{
const c=charts.find(c=>c.airport==='OIKR'&&c.chart_number==='16-2');
assert.equal(c.name,'APPROACH 16-2');
assert.equal(titles.pages[String(c.page)],'NDB DME RWY 29');
});
test('eleven original AIRPORT CHART and coordinate-only page labels have source-audited display names',()=>{
 const native=JSON.parse(fs.readFileSync(path.join(__dirname,'../app/src/main/assets/chart-display-names-v2621.json'),'utf8'));
 assert.deepEqual(native,titles);
 assert.equal(Object.keys(titles.airportPages).length,11);
 const sourceByPage=new Map(charts.map(c=>[String(c.page),c]));
 for(const [page,review] of Object.entries(titles.airportPages)){
  const c=sourceByPage.get(page);
  assert.ok(c,'unrecognized page '+page);
  assert.equal(c.airport,review.icao);assert.equal(c.chart_number,review.chart_number);
  assert.equal(c.category,review.category);assert.equal(c.name,review.original_name);
  assert.equal(titles.pages[page],review.name);
  assert.notEqual(review.name,review.original_name);
 }
 const unexplained=charts.filter(c=>c.category==='Airport'&&
  (c.name==='AIRPORT CHART'||/^(?:51-\d+(?:\.\d+)?\s*){4,}$/.test(c.name)));
 assert.equal(unexplained.length,11);
 assert.ok(unexplained.every(c=>titles.airportPages[String(c.page)]));
 assert.match(titles.pages['382'],/APRON 1 \/ PASSENGER APRON/);
 assert.match(titles.pages['383'],/APRON 2 CARGO \/ APRON 3 SALAM/);
});
test('Android uses safe page, ICAO, chart number and exact original name guards',()=>{
 const code=fs.readFileSync(path.join(__dirname,'../app/src/main/java/com/tareghmsr/jeppiran/ChartRepository.kt'),'utf8');
 assert.match(code,/assets\.open\("chart-display-names-v2621\.json"\)/);
 assert.match(code,/optJSONObject\("airportPages"\)/);
 assert.match(code,/label\.optString\("original_name"\) == old/);
});

test('all 11 reviewed V2621 ground plate names are bundled for immediate display',()=>{
 const js=fs.readFileSync(path.join(__dirname,'../web/app.js'),'utf8');
 const html=fs.readFileSync(path.join(__dirname,'../web/index.html'),'utf8');
 const sw=fs.readFileSync(path.join(__dirname,'../web/service-worker.js'),'utf8');
 assert.match(html,/app\.js\?v=2621-ground-title-firstpaint-r2/);
 assert.match(sw,/app\.js\?v=2621-ground-title-firstpaint-r2/);
 const open='const REVIEWED_V2621_GROUND_TITLES=Object.freeze(';
 const start=js.indexOf(open),end=js.indexOf(');\nlet chartDisplayNamesByPage=',start);
 assert.ok(start>=0&&end>start,'reviewed titles are missing from the main JS');
 const embedded=JSON.parse(js.slice(start+open.length,end));
 assert.deepEqual(embedded,titles.airportPages);
 assert.match(js,/manifest\?\.version==="V2621"/);
 assert.match(js,/c\?\.name===review\.original_name/);
 assert.ok(js.indexOf('REVIEWED_V2621_GROUND_TITLES')<js.indexOf('function displayChartName'));
});
