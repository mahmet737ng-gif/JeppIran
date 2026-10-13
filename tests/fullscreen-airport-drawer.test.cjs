const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.resolve(__dirname,'..',p),'utf8');

test('Android chart selection never opens the obsolete narrow inline preview',()=>{
 const native=read('app/src/main/java/com/tareghmsr/jeppiran/AirportChartsActivity.kt');
 assert.match(native,/private fun openChart\(chart: ChartRepository\.ChartInfo\) \{\s*openChartAdvanced\(chart\)/);
});
test('Android full-screen viewer offers an independent, translucent, scrollable airport drawer',()=>{
 const native=read('app/src/main/java/com/tareghmsr/jeppiran/PdfViewerActivity.kt');
 assert.match(native,/buildFloatingChartMenu\(\)/);
 assert.match(native,/root\.post \{[\s\S]*?controlsVisible = false[\s\S]*?hideViewerControls\(\)/);
 assert.match(native,/text = "☰"/);
 assert.match(native,/FrameLayout\.LayoutParams\.MATCH_PARENT\)\.apply \{\s*gravity = Gravity\.START or Gravity\.TOP/);
 assert.match(native,/Color\.argb\(\s*213,\s*3,\s*17,\s*38/);
 assert.match(native,/if \(chartTreeOpen\) toggleChartTree\(\)/);
 assert.match(native,/val sideWidth = minOf\(302\.dp,/);
});
test('Safari chart fullscreen has left hamburger, proper fullscreen list and same airport restriction',()=>{
 const js=read('web/app.js');
 const css=read('web/fullscreen-chart-drawer.css');
 const html=read('web/index.html');
 assert.match(js,/function ensureFullscreenChartDrawer\(\)/);
 assert.match(js,/document\.createElement\("aside"\)/);
 assert.match(js,/id="jpChartDrawerList"/);
 assert.match(js,/c\.airport===selectedAirport/);
 assert.match(js,/jpChartDrawerOpen/);
 assert.match(js,/setFullscreenChartDrawer\(false\)/);
 assert.match(js,/scheduleFullscreenRefit\(400\)/);
 assert.match(css,/height:100dvh/);
 assert.match(css,/background:rgba\(5,22,40,\.78\)/);
 assert.match(css,/touch-action:pan-y/);
 assert.match(html,/fullscreen-chart-drawer\.css\?v=2621-fullscreen-nav-r1/);
 assert.match(read('web/service-worker.js'),/fullscreen-chart-drawer\.css\?v=2621-fullscreen-nav-r1/);
});
test('chart pan is proportional to actual finger motion (no post-release animation)',()=>{
 const js=read('web/app.js');
 assert.match(js,/stage\.style\.touchAction="none"/);
 assert.match(js,/chartPanX=panStart\.panX\+dx;chartPanY=panStart\.panY\+dy/);
 assert.match(js,/stageEl\.scrollTop=panStart\.scrollTop-dy/);
 assert.match(js,/cancelTail\(\);\s*\/\/ No delayed scrolling/);
});
