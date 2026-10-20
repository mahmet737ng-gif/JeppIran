const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.join(__dirname,"..",p),"utf8");
test("Chart BACK is distinct from PDF Previous/Next",()=>{
 const html=read("index.html"),app=read("app.js"),css=read("styles.css");
 const group=html.match(/<div class="viewer-nav-group"[\s\S]*?<\/div>/)?.[0]||"";
 assert.match(group,/id="chartReturnBtn"/);
 assert.match(group,/id="prevChartBtn"/);
 assert.match(group,/id="nextChartBtn"/);
 assert.ok(group.indexOf("chartReturnBtn")<group.indexOf("prevChartBtn"));
 assert.match(app,/#chartReturnBtn"\)\.addEventListener\("click"/);
 assert.match(app,/if\(selectedChart\)window\.jeppiranAndroidBack\(\)/);
 assert.match(css,/#chartsView \.viewer-nav-group \.chart-return-btn/);
 assert.match(group,/id="chartReturnBtn"[^>]+class="[^"]*raster-btn/);
 assert.match(group,/id="chartReturnBtn"[\s\S]*?class="toolbar-art art-back"/);
 assert.match(group,/id="chartReturnBtn"[\s\S]*?class="toolbar-label">BACK/);
 assert.match(css,/\.toolbar-art\s*\{[\s\S]*?toolbar-artwork\/toolbar-matte\.png/);
});
test("Chart default/reset are 80% with 50% minimum still available",()=>{
 const html=read("index.html"),app=read("app.js"),sw=read("service-worker.js");
 assert.match(app,/const DEFAULT_CHART_ZOOM=\.8;/);
 assert.match(app,/chartZoom=DEFAULT_CHART_ZOOM;chartPanX=0/);
 assert.match(app,/Math\.max\(\.5,Math\.min\(4,Number\(next\)\|\|1\)\)/);
 assert.match(app,/function resetChartView\(\)\{setChartZoom\(DEFAULT_CHART_ZOOM,\{resetPan:true\}\)\}/);
 assert.match(app,/chartZoom-DEFAULT_CHART_ZOOM/);
 assert.match(html,/id="zoomValue">80%/);
 assert.match(html,/back-to-profile-zoom80-r1/);
 assert.match(sw,/back-to-profile-zoom80-r1/);
});
