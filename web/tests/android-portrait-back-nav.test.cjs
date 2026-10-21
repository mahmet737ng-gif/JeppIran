'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const at = (p) => fs.readFileSync(path.resolve(__dirname, '../..', p), 'utf8');

test('all Android portrait artwork is derived from original SHA-verified V3 posters', () => {
  const src = at('scripts/build_android_portrait_posters.py');
  const pack = at('scripts/build_android_local_web.py');
  assert.match(src, /expectedCount.*78/);
  assert.match(src, /sha256\(source\).*spec\["sha256"\]/);
  assert.match(src, /originals unchanged/);
  assert.match(pack, /build_android_portrait_posters\.py/);
  assert.match(pack, /portrait_manifest\["files"\]/);
  assert.match(pack, /Incomplete Android portrait airport poster set/);
});
test('Android portrait uses 9:16 assets but PWA/landscape keeps approved sources', () => {
  const src = at('web/airport-profile-posters.js');
  assert.match(src, /jp-android-phone/);
  assert.match(src, /orientation: portrait/);
  assert.match(src, /airport-profile-posters-portrait/);
  assert.match(src, /artworkUrl === lastArtworkUrl/);
  assert.match(src, /urlFor\(lastCode\) !== lastArtworkUrl/);
});
test('system Back navigates the SPA before double-tap exit and no floating overlay is installed', () => {
  const kt = at('app/src/main/java/com/tareghmsr/jeppiran/MobileWebActivity.kt');
  const web = at('web/app.js');
  const shared = at('app/src/main/java/com/tareghmsr/jeppiran/BackNavigation.kt');
  assert.match(kt, /onBackPressedDispatcher\.addCallback/);
  assert.match(kt, /window\.jeppiranAndroidBack/);
  assert.match(kt, /now - lastBackPress < 2000L/);
  assert.match(web, /window\.jeppiranAndroidBack=function\(\)/);
  assert.match(web, /if\(selectedChart\)/);
  assert.match(web, /route\("home"\)/);
  assert.doesNotMatch(shared, /content\.addView\(/);
});
