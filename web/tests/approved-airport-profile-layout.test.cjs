// JEPPIRAN: approved profile DOM, photo hash locks and layout contract.
// Images are NEVER regenerated, cropped, reencoded or modified by this test.
"use strict";
const assert=require("node:assert/strict"),test=require("node:test");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("approved Ahwaz profile cards have one direct CSS grid and five sections",()=>{
 const js=read("web/app.js"),css=read("web/airport-profile-layout-locked.css");
 const from=js.indexOf('root.innerHTML=\'<div class="profile-shell">');
 const to=js.indexOf("  updateTerminalValidityDisplay();",from);
 assert.ok(from>0&&to>from);
 const profile=js.slice(from,to);
 for(const id of ["profileWeather","profileWind","profileRunways","profileNotam","profileTaf"])
  assert.equal(profile.split('id="'+id+'"').length-1,1,"only one "+id);
 assert.doesNotMatch(profile,/profile-tabs|>Overview<\/button>|id="profileInfo"|ADDITIONAL INFORMATION/);
 assert.doesNotMatch(profile,/class="profile-col"/);
 assert.match(profile,/id="profileLocalTime"/);
 assert.match(profile,/id="profileUtcClock"/);
 assert.match(profile,/id="profileTerminalValidity"/);
 assert.match(profile,/profile-elev-inline/);
 assert.ok(profile.indexOf('id="profileWind"')<profile.indexOf('id="profileNotam"'));
 assert.match(css,/grid-template-columns:repeat\(2,minmax\(0,1fr\)\)\s*!important/);
 assert.match(css,/"metar wind"\s*"runways notam"\s*"taf \."/);
 for(const [id,area] of [["profileWeather","metar"],["profileWind","wind"],["profileRunways","runways"],["profileNotam","notam"],["profileTaf","taf"]])
  assert.ok(css.includes("#"+id+" {grid-area:"+area),id);
 assert.match(css,/#profileWeather \{grid-area:metar;align-self:stretch/);
 assert.match(css,/#profileWind \{grid-area:wind;align-self:stretch/);
});
test("wind is compact without old explanatory filler",()=>{
 const js=read("web/app.js"),css=read("web/airport-profile-layout-locked.css");
 assert.match(js,/id="profileWind"/);
 assert.match(js,/class="wind-compact"/);
 assert.doesNotMatch(js,/'<small>Heading printed beside RWY on V2621 ADC · no conversion<\/small>'/);
 assert.doesNotMatch(js,/'<small class="wind-arrow-label">/);
 assert.match(css,/#profileWind \.wind-compact \{/);
 assert.match(css,/grid-template-columns:minmax\(126px,0\.45fr\) minmax\(0,0\.55fr\)/);
});
test("original fifty picture files and SHA hashes remain owner-locked",()=>{
 const manifest=JSON.parse(read("web/airport-profile-posters/manifest.json"));
 assert.equal(manifest.expectedCount,50);
 assert.equal(Object.keys(manifest.files).length,50);
 for(const [icao,entry] of Object.entries(manifest.files)){
  assert.equal(entry.file,icao+".webp");
  assert.match(entry.sha256,/^[a-f0-9]{64}$/);
 }
 const posterCss=read("web/airport-profile-posters.css");
 assert.match(posterCss,/background-size:contain\s*!important/);
 assert.doesNotMatch(posterCss,/background-size:cover/);
 const html=read("web/index.html"),sw=read("web/service-worker.js");
 // Match the exact current app.js version in both entrypoint and offline shell.
 // Do not freeze an obsolete JS query string: new chart labels must be able to deploy
 // without touching any of the 50 approved poster files or profile CSS.
 const appEntry=html.match(/<script src="\.\/(app\.js\?v=[^"]+)" defer><\/script>/);
 assert.ok(appEntry,"versioned app.js entrypoint required");
 assert.ok(sw.includes("./"+appEntry[1]),"offline shell must precache the same JS revision");
 const profileCss="airport-profile-layout-locked.css?v=2621-ahwaz-approved-profile-r1";
 assert.ok(html.includes(profileCss)&&sw.includes(profileCss),
  "owner-locked profile CSS revision must remain unchanged");
});
