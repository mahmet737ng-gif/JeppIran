const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('iPad single chart tap toggles fullscreen without breaking double-tap or gestures',()=>{
  const js=read('web/app.js'),html=read('web/index.html'),css=read('web/styles.css');
  assert.match(js,/singleTapTimer=setTimeout\(/);
  assert.match(js,/chartZoom>1\.2\?1:2/);
  // Owner update: immediate entry on the first tap; second tap still zooms.
  assert.match(js,/enterViewerFullscreen\(\)/);
  assert.match(js,/exitViewerFullscreen\(\)/);
  assert.match(js,/pinched=true/);
  assert.match(js,/stage\.style\.touchAction="none"/);
  assert.match(js,/chartPanX=panStart\.panX\+dx/);
  assert.match(js,/stageEl\.scrollTop=panStart\.scrollTop-dy/);
  // 2026-10-20 owner override: speed-sensitive vertical inertia replaces
  // the older no-fling behavior, without changing taps or PDF transforms.
  assert.match(js,/function startVerticalInertia\(\)/);
  assert.match(js,/velocity\*=Math\.pow\(\.93,dt\/16\.67\)/);
  assert.match(css,/#chartsView\.chart-open \.viewer-toolbar\{[\s\S]*?z-index:85/);
  assert.match(html,/id="fullscreenExitBtn"/);
});
test('inversion is independent from theme and keeps the locked CDFA panel',()=>{
  const js=read('web/app.js'),css=read('web/styles.css'),html=read('web/index.html');
  assert.match(html,/id="chartInvertBtn"/);
  assert.match(js,/document\.body\.classList\.toggle\("chart-inverted",inverted\)/);
  assert.match(css,/body\.chart-inverted #chartsView #pdfCanvas\{filter:invert\(1\)\}/);
  assert.match(read('web/cdfa-locked.css'),/body\.chart-inverted #chartsView \.jp-cdfa-table/);
  assert.match(html,/id="appearanceSettingsDialog"/);
  assert.match(html,/value="light"/);
  assert.match(html,/value="dark"/);
  assert.match(js,/function applyAppearanceTheme\(mode\)/);
});
test('the four approved ILS Home backgrounds remain the sole theme/rotation assets',()=>{
  const css=read('web/home-ils-background.css');
  for(const name of ['ils-dark-portrait.png','ils-dark-landscape.png','ils-light-portrait.png','ils-light-landscape.png']){
    assert.ok(fs.existsSync(path.join(root,'web/home-art',name)),name);
    assert.ok(css.includes(name),name);
  }
  assert.match(css,/:root\.light #homeView\.flight-home\.active/);
  assert.match(css,/@media \(orientation:landscape\)/);
});

test('fullscreen exit is a compact corner X without label',()=>{
  const html=read('web/index.html'),css=read('web/styles.css');
  assert.match(html,/<button id="fullscreenExitBtn"[^>]*aria-label="Exit fullscreen"[^>]*>×<\/button>/);
  assert.doesNotMatch(html,/>✕ Exit Fullscreen<\/button>/);
  assert.match(css,/\.fullscreen-exit\{[\s\S]*?width:32px;height:32px/);
  assert.match(css,/body\.viewer-fullscreen \.fullscreen-exit\{display:flex\}/);
});
test('service worker never forces a mid-chart session reload on update',()=>{
  const js=read('web/app.js'),sw=read('web/service-worker.js');
  assert.doesNotMatch(js,/addEventListener\("controllerchange"/);
  assert.doesNotMatch(js,/location\.reload\(\)/);
  assert.doesNotMatch(sw,/self\.skipWaiting\s*\(/);
  assert.match(js,/navigator\.serviceWorker\.register\("\.\/service-worker\.js"/);
  assert.match(sw,/event\.waitUntil\(caches\.open\(CACHE\)\.then\(cache=>cache\.addAll\(SHELL\)\)\)/);
});

test('fullscreen CDFA and Find Me safeguards',()=>{
 const html=read('web/index.html'),css=read('web/styles.css'),js=read('web/cdfa-chart-panel.js');
 assert.match(html,/id="fullscreenCdfaBtn"[^>]*hidden>CDFA<\/button>/);
 assert.match(css,/body\.viewer-fullscreen #aircraftFollowBtn/);
 assert.match(js,/fullscreenButton\.hidden=!record/);
 assert.match(js,/button\.click\(\)/);
});

test('full screen CDFA files are cache-busted and CDFA script is network-first',()=>{
 const html=read('web/index.html'),sw=read('web/service-worker.js');
 assert.match(html,/cdfa-chart-panel\.js\?v=2621-cdfa-inpage-white-margin-r1/);
 assert.match(sw,/cdfa-chart-panel\.js\?v=2621-cdfa-inpage-white-margin-r1/);
 assert.match(sw,/app\\\.js\|cdfa-chart-panel\\\.js/);
 assert.doesNotMatch(sw,/self\.skipWaiting\(/);
});
