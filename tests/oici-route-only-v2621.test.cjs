"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const data=JSON.parse(read("web/data/oici-route-only-v2621.json"));
const android=JSON.parse(read("app/src/main/assets/oici-route-only-v2621.json"));
const charts=JSON.parse(read("app/src/main/assets/charts-current.json"));
const web=JSON.parse(read("web/data/chart-georef.json"));
const native=JSON.parse(read("app/src/main/assets/chart-georef.json"));
test("OICI 207/209 route-only models are removed from the viewer and 807 other models remain unchanged",async()=>{
 assert.deepEqual(data,android);
 assert.equal(data.cycle,"V2621");assert.equal(data.activeInChartViewer,false);
 assert.match(data.reviewStatus,/DISABLED_BY_OWNER/);assert.deepEqual(data.charts,[]);
 assert.deepEqual(web,native);assert.equal(web.charts.length,807);
 for(const page of [207,209]){
  const c=charts.find(x=>x.page===page);assert.equal(c.airport,"OICI");
  assert.equal(c.category,page===207?"STAR":"SID");
  assert.equal(c.chart_number,page===207?"10-2":"10-3");
  assert.ok(!web.charts.some(x=>x.page===page));
 }
 const mod=await import("../web/oici-route-only-v2621.mjs");
 assert.equal(mod.validateOiciRoutes(data,{version:"V2621",source_sha256:data.source.sha256},charts),false);
});
test("Web and native reject cached OICI models; live/outside labels do not name the simulator",()=>{
 const js=read("web/app.js"),geo=read("app/src/main/java/com/tareghmsr/jeppiran/ChartGeoreference.kt");
 const fallback=read("app/src/main/java/com/tareghmsr/jeppiran/OiciRouteOnlyFlightQa.kt");
 assert.match(js,/OICI_DISABLED_GEOREF_PAGES=new Set\(\[207,209\]\)/);
 assert.match(js,/for\(const page of OICI_DISABLED_GEOREF_PAGES\)georefByPage\.delete\(page\)/);
 assert.match(js,/OICI_DISABLED_GEOREF_PAGES\.has\(Number\(item\.page\)\)/);
 assert.doesNotMatch(js,/georefByPage\.set\(page,model\);oiciRouteQaPages\.add\(page\)/);
 assert.match(geo,/dataVersion == "V2621" && \(page == 207 \|\| page == 209\)/);
 assert.match(fallback,/!root\.optBoolean\("activeInChartViewer", false\)/);
 const s=js.slice(js.indexOf("function refreshPositionStatus(){"),js.indexOf("// Center aircraft at 150%",js.indexOf("function refreshPositionStatus(){")));
 assert.match(s,/setPositionStatus\("live","POS LIVE"/);
 assert.match(s,/setPositionStatus\("outside","OUTSIDE CHART"/);
 assert.match(s,/setPositionStatus\("warning","NO GEOREF"/);
 assert.doesNotMatch(s,/code\+" (?:LIVE|OUTSIDE)"/);
 assert.match(js,/badge\.textContent="POS LIVE"/);
 const html=read("web/index.html"),sw=read("web/service-worker.js");
 // Keep the actual safety checks above; version labels may change independently.
 const currentScript=html.match(/\.\/app\.js\?v=([a-z0-9-]+)/i);
 assert.ok(currentScript,"HTML must load the versioned protected chart viewer");
 assert.ok(sw.includes("./app.js?v="+currentScript[1]),"offline shell must cache that exact viewer version");
});
