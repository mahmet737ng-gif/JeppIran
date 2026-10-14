'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');

test('HOME shortcut is available outside Home without replacing chart controls',()=>{
  const html=read('web/index.html');
  assert.match(html,/<button id="jpHomeBtn"[^>]*data-route="home"[\s\S]*?aria-label="Return to JEPPIRAN Home"/);
  assert.match(html,/id="jpChartMenuBtn"|id="fullscreenExitBtn"/);
  for(const id of ['airportPickerBtn','prevChartBtn','nextChartBtn','chartTaxiBtn','fullscreenBtn'])assert.ok(html.includes('id="'+id+'"'),id);
  assert.match(html,/homeButton.hidden=el.id==="homeView"/);
});
test('the route always goes straight home and exits native fullscreen',()=>{
  const js=read('web/app.js');
  assert.match(js,/async function returnToJeppiranHome\(\)/);
  assert.match(js,/await exitViewerFullscreen\(true\)/);
  assert.match(js,/if\(target==="home"\)\{void returnToJeppiranHome\(\);return\}/);
  assert.match(js,/route\("home"\)/);
  assert.match(js,/homeButton.hidden=el.id==="homeView"/);
  assert.doesNotMatch(js.slice(js.indexOf('async function returnToJeppiranHome'),js.indexOf('$$("[data-route]")')),/history\.back\(/);
});
test('HOME stays separate from chart gestures, with fullscreen drawer not obstructed',()=>{
  const css=read('web/styles.css');
  const drawer=read('web/fullscreen-chart-drawer.css');
  assert.match(css,/#jpHomeBtn\[hidden\]\{display:none!important\}/);
  assert.match(css,/body\.viewer-fullscreen #jpHomeBtn\.jp-home-shortcut/);
  assert.match(css,/body\.viewer-fullscreen\.jp-chart-drawer-open #jpHomeBtn/);
  assert.match(drawer,/body\.viewer-fullscreen #jpChartMenuBtn/);
  assert.match(read('web/service-worker.js'),/jeppiran-pwa-2621-direct-home-r1/);
});
