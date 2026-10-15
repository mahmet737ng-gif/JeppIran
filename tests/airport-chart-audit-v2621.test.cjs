'use strict';
const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const root=path.join(__dirname,'..'),read=p=>fs.readFileSync(path.join(root,p),'utf8');
const a=JSON.parse(read('web/data/airport-chart-audit-v2621.json'));
const android=JSON.parse(read('app/src/main/assets/airport-chart-audit-v2621.json'));
const charts=JSON.parse(read('app/src/main/assets/charts-current.json'));
const manifest=JSON.parse(read('app/src/main/assets/charts-manifest.json'));
test('exact 10 verified airport fixes, preserved source PDF/pages, original georeferences untouched',()=>{
 assert.deepEqual(a,android);assert.equal(a.version,manifest.version);assert.equal(a.source_pdf_sha256,manifest.source_sha256);
 assert.equal(a.displayOnly,true);assert.equal(Object.keys(a.pages).length,10);
 for(const [page,fix] of Object.entries(a.pages)){
   const source=charts.find(c=>c.page===Number(page));
   assert.ok(source,page);assert.equal(source.airport,fix.source_icao);assert.equal(source.category,fix.category);
   assert.equal(source.chart_number,fix.chart_number);assert.equal(source.name,fix.original_name);
   assert.equal(source.pdf_page,fix.pdf_page);
   assert.equal(manifest.airports[fix.source_icao].global_pages[fix.pdf_page-1],source.page);
   assert.ok(manifest.airports[fix.display_icao],fix.display_icao);
 }
 assert.equal(Object.values(a.pages).filter(c=>c.display_icao!==c.source_icao).length,5);
 assert.equal(Object.values(a.pages).filter(c=>c.display_number!==c.chart_number).length,2);
 assert.equal(Object.values(a.pages).filter(c=>c.display_name!==c.original_name).length,3);
});
test('UI remaps airport branches and corrected plate labels; PDF loading uses immutable source',()=>{
 const js=read('web/app.js'),html=read('web/index.html'),sw=read('web/service-worker.js');
 const start=js.indexOf('const AUDITED_AIRPORT_DISPLAY_V2621=Object.freeze(');
 assert.ok(start>=0);
 const begin=start+'const AUDITED_AIRPORT_DISPLAY_V2621=Object.freeze('.length;
 const end=js.indexOf(');\nfunction auditedAirportDisplay(',begin);
 assert.deepEqual(JSON.parse(js.slice(begin,end)),a.pages);
 assert.match(js,/function displayAirportCode\(c\)/);
 assert.match(js,/charts\.filter\(c=>displayAirportCode\(c\)===selectedAirport\)/);
 assert.match(js,/const pdfIcao=c\.airport/);
 assert.match(js,/Number\(info\.global_pages\?\.\[Number\(c\.pdf_page\)-1\]\)/
 );
 assert.match(js,/next\.airport===selectedChart\.airport/);
 assert.match(js,/function displayChartNumber\(c\)/);
 assert.match(html,/app\.js\?v=2621-airport-audit10-r1/);
 assert.match(sw,/app\.js\?v=2621-airport-audit10-r1/);
});
