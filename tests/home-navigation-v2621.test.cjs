'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const read=p=>fs.readFileSync(path.join(__dirname,'..',p),'utf8');
test('original Charts layout keeps just a Back control in its own header and mobile profile',()=>{
  const html=read('web/index.html');
  assert.match(html,/id="chartsBackBtn"[^>]*class="back-btn jp-charts-back"/);
  assert.match(html,/id="chartsBackMobileBtn"/);
  for(const id of ['airportPickerBtn','prevChartBtn','nextChartBtn','chartTaxiBtn','fullscreenBtn','fullscreenExitBtn'])assert.ok(html.includes('id="'+id+'"'),id);
});
test('Back safely returns directly home, never leaves the offline origin',()=>{
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
  assert.match(css,/body\.viewer-fullscreen #jpHomeBtn\.jp-home-shortcut\{display:none!important\}/);
  assert.match(css,/#chartsView\.chart-open #chartsBackMobileBtn,body\.viewer-fullscreen #chartsBackMobileBtn\{display:none!important\}/);
  assert.match(read('web/fullscreen-chart-drawer.css'),/body\.viewer-fullscreen #jpChartMenuBtn/);
  assert.match(read('web/service-worker.js'),/jeppiran-pwa-2621-chart-back-r1/);
});
