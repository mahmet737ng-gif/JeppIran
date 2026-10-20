'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('HOME stays on the left, Charts title immediately to its right; mobile return remains available',()=>{
  const html=read('web/index.html');
  assert.match(html,/<button id="chartsBackBtn"[^>]*aria-label="Go to JEPPIRAN Home"[^>]*>[\s\S]*?<span>HOME<\/span><\/button><h2>Charts<\/h2>/);
  assert.doesNotMatch(html,/id="chartsBackBtn"[^>]*>← Back/);
  assert.doesNotMatch(html,/id="chartsBackBtn" class="back-btn/);
  assert.match(html,/id="chartsBackBtn" class="jp-charts-back"/);
  assert.match(html,/id="chartsBackMobileBtn"/);
  for(const id of ['airportPickerBtn','prevChartBtn','nextChartBtn','chartTaxiBtn','fullscreenBtn','fullscreenExitBtn'])assert.ok(html.includes('id="'+id+'"'),id);
});
test('HOME safely returns directly home, never leaves the offline origin',()=>{
  const js=read('web/app.js');
  assert.match(js,/async function returnToJeppiranHome\(\)/);
  assert.match(js,/await exitViewerFullscreen\(true\)/);
  assert.match(js,/\["chartsBackBtn","chartsBackMobileBtn"\]/);
  assert.match(js,/route\("home"\)/);
  assert.ok(js.includes('$$("[data-route]").forEach'), 'route controls must use the $$ NodeList selector');
  const fn=js.slice(js.indexOf('async function returnToJeppiranHome'),js.indexOf('["chartsBackBtn","chartsBackMobileBtn"].forEach'));
  assert.doesNotMatch(fn,/history\.back\(/);
});
test('HOME is hidden on Charts and fullscreen without affecting owner-locked gestures',()=>{
  const html=read('web/index.html'),js=read('web/app.js'),css=read('web/styles.css');
  const guard='homeButton.hidden=el.id==="homeView"||el.id==="chartsView";';
  assert.ok(html.includes(guard));assert.ok(js.includes(guard));
  assert.match(css,/body\.viewer-fullscreen #jpHomeBtn\.jp-home-shortcut,\s*body\.viewer-fullscreen #chartsView #chartsBackBtn\{display:none!important\}/);
  assert.match(css,/#chartsView\.chart-open #chartsBackMobileBtn,\s*body\.viewer-fullscreen #chartsBackMobileBtn\{display:none!important\}/);
  assert.match(read('web/fullscreen-chart-drawer.css'),/body\.viewer-fullscreen #jpChartMenuBtn/);
  const sw=read('web/service-worker.js');
  // Cache epoch advances when the chart navigation shell adds offline assets.
  assert.match(sw,/const CACHE="jeppiran-pwa-2621-[a-z0-9-]+"/);
  assert.match(sw,/url\.pathname\.endsWith\("\/notam-service\.js"\)/);
  assert.match(sw,/url\.pathname\.endsWith\("\/notam-service\.css"\)/);
});

test('airport chart categories remain in the sidebar and NEVER occupy profile Overview',()=>{
  const js=read('web/app.js');
  assert.doesNotMatch(js,/id="profileProcedures"/);
  assert.doesNotMatch(js,/procedureMarkup\s*\+/);
  assert.match(js,/renderTreeInto\(tree\)/);
  assert.match(js,/\["STAR","SID","Airport","Approach"\]\.forEach/);
  assert.match(js,/class="profile-heading"/);
  assert.match(js,/id="profileWeather"/);
});

test('HOME precedes Charts title in flex layout, never in fullscreen',()=>{
  const css=read('web/styles.css'),html=read('web/index.html');
  assert.match(css,/#chartsView \.airport-pane \.pane-head\{[\s\S]*?flex-flow:row nowrap/);
  assert.match(css,/#chartsView \.airport-pane \.pane-head h2\{[\s\S]*?order:1/);
  assert.match(css,/#chartsView #chartsBackBtn\.jp-charts-back\{[\s\S]*?position:static;inset:auto;order:0/);
  assert.match(css,/body\.viewer-fullscreen #chartsView #chartsBackBtn\{display:none!important\}/);
  assert.match(html,/id="chartsBackMobileBtn"[^>]*aria-label="Go to JEPPIRAN Home"/);
});
