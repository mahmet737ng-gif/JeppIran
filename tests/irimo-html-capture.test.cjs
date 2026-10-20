'use strict';
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('IRIMO HTML capture is directly embedded but never used as live weather',()=>{
  const s=fs.readFileSync('web/app.js','utf8');
  const html=fs.readFileSync('web/index.html','utf8');
  assert.match(s,/METAR OIAW 201530Z 36006KT CAVOK 31\/09 Q1014/);
  assert.match(s,/TAF OIAW 201100Z 2012\/2118 32005KT 7000 NSC/);
  assert.match(s,/PROB30 TS\/RA SCT030CB SCT035 BKN1000/);
  assert.match(s,/ARCHIVED · NOT LIVE/);
  assert.match(s,/renderIrimoHtmlCapture\(icao,"metar"\)/);
  assert.match(s,/renderIrimoHtmlCapture\(icao,"taf"\)/);
  assert.match(s,/const raw=wxCache\[icao\+":metar"\]/);
  assert.match(s,/const taf=wxCache\[icao\+":taf"\]/);
  assert.match(html,/app\.js\?v=[^"]+-irimo-capture-r1/);
  assert.match(html,/airport-profile-live-text\.css\?v=[^"]+-irimo-capture-r1/);
});
