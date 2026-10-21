"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");
test("final minimal profile loads before application and matches the offline worker",()=>{
 const html=read("web/index.html"),sw=read("web/service-worker.js");
 const file="profile-minimal.js?v=2621-minimal-20261021-r1";
 const css="profile-minimal.css?v=2621-minimal-20261021-r1";
 assert.ok(html.includes(file)&&sw.includes(file),"script missing from PWA shell");
 assert.ok(html.includes(css)&&sw.includes(css),"style missing from PWA shell");
 assert.ok(html.indexOf(file)<html.indexOf("app.js?v=2621-minimal-profile-r1"),
   "profile hook must load before app.js");
 assert.ok(sw.includes('app.js?v=2621-minimal-profile-r1'));
 assert.doesNotMatch(html,/src="\.\/airport-profile-posters\.js/);
 assert.doesNotMatch(html,/src="\.\/airport-profile-topbar-experiment\.js/);
});
test("profile retains live METAR and TAF, verified NOTAM and actual airport chart directory",()=>{
 const app=read("web/app.js"),minimal=read("web/profile-minimal.js");
 for(const source of ["wxCache[icao+\":metar\"]","wxCache[icao+\":taf\"]",
     "window.JEPPIRAN_NOTAM?.render","renderAirportProfile(icao)"])
   assert.ok(app.includes(source),source);
 assert.ok(app.includes("window.JEPPIRAN_MINIMAL_PROFILE?.render"));
 assert.match(minimal,/METAR/);assert.match(minimal,/TAF/);assert.match(minimal,/NOTAM/);
 assert.match(minimal,/ctx\.displayChartName\(c\)/);
 assert.match(minimal,/ctx\.displayChartNumber\(c\)/);
 assert.match(minimal,/ctx\.selectChart\(chart\)/);
 assert.match(minimal,/sourceIdentity\(chart,ctx\.manifest\)/);
 assert.match(minimal,/Number\(info\.global_pages/);
 assert.match(minimal,/ctx\.getPdfBytes\(url,false\)/);
 assert.match(minimal,/doc\.getPage\(Number\(chart\.pdf_page\)\)/);
 assert.match(minimal,/IntersectionObserver/);
 assert.match(minimal,/aria-expanded/);
 assert.match(minimal,/details class="jp-mp-category"/);
 assert.doesNotMatch(minimal,/airport-profile-posters-(?:v3|portrait)/);
 assert.doesNotMatch(minimal,/(?:mockMetar|fakeNotam|placeholderThumb|fakePdf)/i);
});
test("no decorative airport wallpaper and categories have no leading icons",()=>{
 const css=read("web/profile-minimal.css"),js=read("web/profile-minimal.js");
 assert.match(css,/background-image:none!important/);
 assert.match(css,/:root\.light/);
 assert.match(css,/\.jp-mp-weather/);
 assert.match(css,/\.jp-mp-category/);
 assert.match(css,/\.jp-mp-thumb-wrap/);
 assert.ok(js.includes('["Airport","AIRPORT"]'));
 assert.ok(js.includes('["SID","SID"]'));
 assert.ok(js.includes('["STAR","STAR"]'));
 assert.ok(js.includes('["Approach","APPROACH"]'));
 assert.ok(!js.includes('✈')&&!js.includes('🛬'));
 const html=read("web/index.html");
 assert.ok(html.includes('id="airportPickerBtn"'));
 assert.ok(html.includes('id="chartsBackMobileBtn"'));
 assert.doesNotMatch(html,/id="jp-global-floating-back"/);
});
