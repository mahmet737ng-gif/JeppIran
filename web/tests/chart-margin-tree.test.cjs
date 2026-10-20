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
test("short release-based reversible horizontal swipe, vertical inertia and zoom to 50%",()=>{
  const js=read("app.js");
  assert.match(js,/Math\.max\(\.5,Math\.min\(4,Number\(next\)/);
  assert.match(js,/Math\.max\(\.5,Math\.min\(4,next\)/);
  assert.match(js,/state\.reversing/);
  assert.match(js,/Math\.abs\(dx\)>7/);
  assert.match(js,/Math\.abs\(state\.dx\)>=32/);
  assert.match(js,/function startVerticalInertia\(\)/);
  assert.match(js,/velocity\*=Math\.pow\(\.93,dt\/16\.67\)/);
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
  assert.match(sw,/chart-margin-tree\.js\?v=2621-chart-margin-tree-r2-overlay/);
  assert.match(sw,/chart-margin-tree\.css\?v=2621-chart-margin-tree-r2-overlay/);
  assert.match(html,/app\.js\?v=2621-oici-ungeoref-neutral-pos-r1/);
  assert.match(html,/oigg-local-r3/);
});

test("legacy Classic browser QA respects the owner-hidden top chart title",()=>{
  const smoke=read("../scripts/verify_airport_carousel_r5_classic_browser.cjs");
  assert.match(smoke,/viewerChart"\)\.waitFor\(\{state:"attached"\}\)/);
  assert.doesNotMatch(smoke,/viewerChart"\)\.waitFor\(\)/);
});
