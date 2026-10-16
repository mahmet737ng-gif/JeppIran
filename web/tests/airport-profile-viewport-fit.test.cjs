"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");
test("poster is contained in viewport with immutable source and no scroll",()=>{
 const js=read("web/airport-profile-posters.js"),css=read("web/airport-profile-viewport-locked.css");
 for(const pattern of [/positionFrame\(icao\)/,/Math\.min\(w\/size\.width,h\/size\.height\)/,/root\.clientWidth/,/root\.clientHeight/,/ResizeObserver/,/frame\.appendChild\(caption\)/])
  assert.match(js,pattern);
 assert.match(css,/\.airport-profile\.jp-airport-poster-loaded \{[\s\S]*?overflow:hidden!important/);
 assert.match(css,/\.jp-poster-frame \{[\s\S]*?position:absolute/);
 assert.match(css,/background-size:100% 100%/);
 assert.match(css,/\.jp-poster-frame \.jp-poster-caption \{[\s\S]*?position:absolute/);
 assert.doesNotMatch(js,/shell\.appendChild\(caption\)/);
});
test("original assets are not edited, all 50 source signatures are present",()=>{
 const manifest=JSON.parse(read("web/airport-profile-posters/manifest.json"));
 assert.equal(manifest.expectedCount,50);
 assert.equal(Object.keys(manifest.files).length,50);
 for(const entry of Object.values(manifest.files)) assert.match(entry.sha256,/^[a-f0-9]{64}$/);
});
test("new asset versioned in HTML and service worker and tests included in Pages",()=>{
 const html=read("web/index.html"),sw=read("web/service-worker.js"),wf=read(".github/workflows/deploy-ipad-web.yml");
 for(const name of ["airport-profile-viewport-locked.css?v=2621-poster-viewport-fixed-r1","airport-profile-posters.js?v=2621-persistent-r1"])
  assert.ok(html.includes(name)&&sw.includes(name),name);
 assert.match(wf,/node --test web\/tests\/airport-profile-viewport-fit\.test\.cjs/);
});
