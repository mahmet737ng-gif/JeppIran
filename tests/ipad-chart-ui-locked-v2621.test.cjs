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
  assert.match(js,/document\.body\.classList\.contains\("viewer-fullscreen"\)\?exitViewerFullscreen\(\):enterViewerFullscreen\(\)/);
  assert.match(js,/pinched=true/);
  assert.match(js,/tinyPanStop\(\)/);
  assert.match(js,/Math\.min\(2\.5,sample\.dx\*0\.36\)/);
  assert.match(js,/\(now-t0\)\/90/);
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
