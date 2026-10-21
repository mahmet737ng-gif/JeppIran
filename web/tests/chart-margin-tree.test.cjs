"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");

test("chart tree belongs to the PDF's actual left white margin, with no separate layout column",()=>{
  const html=read("index.html"),nav=read("chart-margin-tree.js"),css=read("chart-margin-tree.css");
  assert.match(html,/chart-margin-tree\.js/);
  assert.match(html,/chart-margin-tree\.css/);
  assert.match(nav,/layer\.appendChild\(host\)/);
  assert.match(nav,/jeppiran-chart-rendered/);
  assert.match(nav,/\.jp-margin-tree-search/);
  assert.match(nav,/opened\.add\(selectedAirport/);
  assert.doesNotMatch(nav,/workspace\.insertBefore|refitSelectedChartForLayout/);
  assert.match(css,/#chartsView\.chart-open #chartTransformLayer > \.jp-margin-chart-tree/);
  assert.doesNotMatch(css,/flex:0 0 var\(--jp-chart-margin-width/);
  assert.match(css,/#chartsView\.chart-open #offlinePdfBtn,#chartsView\.chart-open #fullscreenBtn/);
});
test("short release-based reversible horizontal paging, two-axis kinetic pan and zoom to 50%",()=>{
  const js=read("app.js");
  assert.match(js,/Math\.max\(\.5,Math\.min\(4,Number\(next\)/);
  assert.match(js,/Math\.max\(\.5,Math\.min\(4,next\)/);
  assert.match(js,/state\.reversing/);
  assert.match(js,/Math\.abs\(dx\)>7/);
  assert.match(js,/Math\.abs\(state\.dx\)>=32/);
  assert.match(js,/function startPanInertia\(\)/);
  assert.match(js,/chartPanX\+=vx\*dt;chartPanY\+=vy\*dt/);
  assert.match(js,/Math\.hypot\(vx,vy\)>\.07&&progressed/);
  assert.match(js,/vx\*=decay;vy\*=decay/);
  assert.match(js,/state\.vx=Math\.max/);
});
test("preview removes upper chart-name rail and excludes waypoint searching",()=>{
  const css=read("preview/airport-carousel-r13-fixed/styles.css");
  const js=read("preview/airport-carousel-r13-fixed/app.js");
  const html=read("preview/airport-carousel-r13-fixed/index.html");
  assert.match(css,/body\.chart-selected \.procedure-zone/);
  assert.match(html,/id="previewBackToCharts"/);
  assert.doesNotMatch(js,/void loadPublishedPoints\(\)/);
  assert.doesNotMatch(js,/kind:titleMatch\?"procedure":"point"/);
});
test("offline shell includes matching chart tree scripts and locked chart assets",()=>{
  const sw=read("service-worker.js"),html=read("index.html");
  for(const asset of ["chart-margin-tree.js","chart-margin-tree.css","app.js"]){
    const escaped=asset.replace(/\./g,"\\.");
    const match=html.match(new RegExp("\\./"+escaped+"\\?v=[a-z0-9-]+","i"));
    assert.ok(match,asset+" must be versioned in HTML");
    assert.ok(sw.includes(match[0]),asset+" must use the exact same version in offline shell");
  }
  assert.match(sw,/oigg-star-flightqa-v2621\.json\?v=oigg-local-r3/);
});

test("legacy Classic browser QA respects the owner-hidden top chart title",()=>{
  const smoke=read("../scripts/verify_airport_carousel_r5_classic_browser.cjs");
  assert.match(smoke,/viewerChart"\)\.waitFor\(\{state:"attached"\}\)/);
  assert.doesNotMatch(smoke,/viewerChart"\)\.waitFor\(\)/);
});

test("real browser profile QA switches from profile tree to in-chart PDF tree",()=>{
  const smoke=read("../scripts/verify_profile_validity_browser.cjs");
  assert.match(smoke,/chartOpen\?"#jpMarginChartTree \.jp-margin-tree-chart"/);
  assert.match(smoke,/#chartsView \.airport-inline-tree \.tree-item/);
});

test("larger chart tree and change-only METAR alerts respect chart selection",()=>{
  const css=read("chart-margin-tree.css"),js=read("app.js");
  assert.match(css,/width:clamp\(198px,20%,238px\)/);
  assert.match(css,/font-size:13px;line-height:1\.4/);
  assert.match(css,/-webkit-overflow-scrolling:touch/);
  assert.match(js,/hideChartMetar\(\);\s*void showChartMetar\(true,true\)/);
  assert.match(js,/if\(cached&&!automatic\)presentChartMetar/);
  assert.match(js,/if\(automatic&&!chartMetarShown\.get\(icao\)\)/);
});

test("PDF zoom sharpens from original vector page and edge paging requires overscroll",()=>{
  const js=read("app.js");
  assert.match(js,/async function renderChartDetail\(request\)/);
  assert.match(js,/page\.render\(\{canvasContext:next\.getContext/);
  assert.match(js,/canvas\.getContext\("2d",\{alpha:false\}\)\.drawImage\(next,0,0\)/);
  assert.match(js,/scheduleChartDetail\(\)/);
  assert.match(js,/maxPixels=memoryConstrained\?16000000:30000000/);
  assert.match(js,/chartDetail\.page=page;chartDetail\.quality=dpr/);
  assert.match(js,/chartHorizontalPanLimit\(\)/);
  assert.match(js,/extra>52&&adjacentChart\(direction\)/);
  assert.match(js,/edgePaging\?Math\.abs\(state\.dx\)>=48/);
  assert.match(js,/state\.reversing/);
  assert.match(js,/zoom:chartZoom,panX:chartZoom>1\.001\?chartPanX:0/);
});

test("iPad fullscreen chart tree stays below status clock at every PDF zoom",()=>{
  const nav=read("chart-margin-tree.js"),css=read("chart-margin-tree.css");
  assert.match(nav,/const TREE_SCREEN_CLEARANCE=48/);
  assert.match(nav,/getComputedStyle\(document\.body\)\.paddingTop/);
  assert.match(nav,/Math\.ceil\(\(screenTop-rect\.top\)\/scale\)/);
  assert.match(nav,/host\.style\.top=nextTop/);
  assert.match(nav,/host\.style\.maxHeight=nextHeight/);
  assert.match(nav,/window\.visualViewport\?\.addEventListener\("resize"/);
  assert.match(nav,/Math\.abs\(now-lastLayerScale\)>\.002/);
  assert.match(css,/body\.viewer-fullscreen #chartsView\.chart-open #chartTransformLayer > \.jp-margin-chart-tree/);
  assert.match(css,/env\(safe-area-inset-top\)/);
  assert.doesNotMatch(nav,/stage\.style\.paddingTop|layer\.style\.paddingTop|stage\.style\.transform/);
});

test("iPad standalone status bar is respected without viewer-fullscreen",()=>{
 const js=read("chart-margin-tree.js"),css=read("chart-margin-tree.css");
 assert.doesNotMatch(js,/if\(!document\.body\.classList\.contains\("viewer-fullscreen"\)\)\{[\s\S]*?removeProperty\("top"\)/);
 assert.match(js,/screenTop-rect\.top/);
 assert.match(js,/requestSafeTreePosition\(\)/);
 assert.match(css,/#chartsView\.chart-open #chartTransformLayer > \.jp-margin-chart-tree\{\s*top:max\(56px/);
});
