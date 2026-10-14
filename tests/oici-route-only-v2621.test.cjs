const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const ROOT=path.resolve(__dirname,"..");
const DATA=JSON.parse(fs.readFileSync(path.join(ROOT,"web/data/oici-route-only-v2621.json"),"utf8"));
const records=DATA.charts.map(c=>({
  page:c.page,airport:"OICI",
  category:c.page===207?"STAR":"SID",
  chart_number:c.page===207?"10-2":"10-3",
  name:c.page===207?"ALTET 1N, ALTET 1P":"ALTET 1A, ALTET 1B"
}));
const manifest={version:"V2621",source_sha256:DATA.source.sha256};
test("OICI 207/209 NOT TO SCALE route QA has exact source, chart identity and nonaffine guards",async()=>{
 const m=await import("../web/oici-route-only-v2621.mjs");
 assert.equal(m.validateOiciRoutes(DATA,manifest,records),true);
 assert.equal(m.validateOiciRoutes({...DATA,source:{...DATA.source,sha256:"invalid"}},manifest,records),false);
 assert.equal(m.validateOiciRoutes({...DATA,charts:DATA.charts.slice(0,1)},manifest,records),false);
 assert.equal(m.validateOiciRoutes(DATA,{...manifest,version:"V2622"},records),false);
 assert.equal(m.validateOiciRoutes(DATA,manifest,records.slice(0,1)),false);
});
test("OICI ILM, D18 and ALTET anchors project accurately; out-of-corridor positions fail closed",async()=>{
 const m=await import("../web/oici-route-only-v2621.mjs");
 for(const row of DATA.charts){
   const model=m.buildOiciRouteModel(row);
   assert.ok(model);
   assert.equal(model.routeOnly,true);
   for(const point of row.waypoints){
     const p=m.projectOiciRoute(model,point.lat,point.lon);
     assert.ok(p,"anchor "+row.page+" "+point.id);
     assert.ok(Math.hypot(p.x-point.pdfX,p.y-point.pdfY)<0.4,"anchor match "+row.page+" "+point.id);
   }
   const [a,b]=[row.waypoints[0],row.waypoints.at(-1)];
   const lat=(a.lat+b.lat)/2,lon=(a.lon+b.lon)/2;
   assert.ok(m.projectOiciRoute(model,lat,lon),"centerline");
   assert.equal(m.projectOiciRoute(model,lat+0.03,lon),null,"off course must hide");
   assert.equal(m.projectOiciRoute(model,a.lat,a.lon-0.05),null,"before ILM must hide");
   assert.equal(m.projectOiciRoute(model,b.lat,b.lon+0.05),null,"past ALTET must hide");
   const heading=m.headingOiciRoute(model,lat,lon,94.7,612,792);
   assert.ok(Number.isFinite(heading)&&Math.abs(heading-94)<8);
 }
});
test("Release never adds schema-incompatible routes to existing protected affine chart-georef data",()=>{
 const web=JSON.parse(fs.readFileSync(path.join(ROOT,"web/data/chart-georef.json"),"utf8"));
 const android=JSON.parse(fs.readFileSync(path.join(ROOT,"app/src/main/assets/chart-georef.json"),"utf8"));
 assert.deepEqual(web,android);
 assert.equal(web.charts.length>=807,true);
 for(const page of [207,209])assert.equal(web.charts.some(c=>c.page===page),false);
 const native=fs.readFileSync(path.join(ROOT,"app/src/main/java/com/tareghmsr/jeppiran/ChartGeoreference.kt"),"utf8");
 assert.match(native,/val ref = references\[page\]/);
 assert.match(native,/if \(ref == null\)/);
 assert.match(native,/OiciRouteOnlyFlightQa\.renderedPoint/);
});
