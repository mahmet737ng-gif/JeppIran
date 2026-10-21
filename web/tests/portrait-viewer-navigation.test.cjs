"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");

test("phone opens Viewer first and enters fullscreen only on subsequent chart tap",()=>{
 const app=read("web/app.js");
 const start=app.indexOf("function selectChart(c,options={})");
 const end=app.indexOf("function hideChartMetar(){",start);
 const select=app.slice(start,end);
 assert.match(select,/classList\.add\("chart-open"\)/);
 assert.doesNotMatch(select,/enterViewerFullscreen\(/);
 assert.match(app,/if\(!document\.body\.classList\.contains\("viewer-fullscreen"\)\)/);
 assert.match(app,/enterViewerFullscreen\(\)/);
 assert.match(app,/if\(window\.matchMedia\("\(max-width: 749px\)"\)\.matches\)showPhoneViewerControls\(\)/);
});

test("back navigation resets chart selection and closes inline PDF",()=>{
 const app=read("web/app.js");
 assert.match(app,/window\.jeppiranAndroidBack=function\(\)/);
 assert.match(app,/if\(selectedChart\)\{[\s\S]*?selectAirport\(selectedAirport\)/);
 const begin=app.indexOf("function selectAirport(icao){");
 const end=app.indexOf("function renderTreeInto(",begin);
 const code=app.slice(begin,end);
 assert.match(code,/selectedChart=null/);
 assert.match(code,/classList\.remove\("chart-open"\)/);
 assert.match(code,/getElementById|\$\("#pdfStage"\)\.innerHTML/);
 const css=read("web/fullscreen-chart-drawer.css");
 assert.match(css,/#chartsView\.active:not\(\.chart-open\) #jpCdfaWorkspace/);
 assert.match(css,/#chartsView\.active\.chart-open #airportProfile/);
});

test("full-screen phone tools fade after five seconds and reappear on touch or pan",()=>{
 const app=read("web/app.js"),css=read("web/fullscreen-chart-drawer.css");
 assert.match(app,/jpPhoneViewerControlsTimer=setTimeout\(/);
 assert.match(app,/\},5000\)/);
 assert.match(app,/phoneStage\.addEventListener\("pointerdown",showPhoneViewerControls/);
 assert.match(app,/phoneStage\.addEventListener\("pointermove"/);
 assert.match(app,/resetPhoneViewerControls\(\)/);
 assert.match(css,/\.jp-viewer-controls-hidden:not\(\.jp-chart-drawer-open\)/);
 assert.match(css,/transition:opacity \.32s ease/);
 for(const key of ["chartMetarBtn","chartTaxiBtn","chartInvertBtn","positionStatusBtn"])
   assert.ok(app.includes('data-chart-tool="'+key+'"'),key);
 assert.match(css,/#fullscreenCdfaBtn\[aria-pressed="true"\]/);
});

test("TAF stays raw and wraps at forecast change group boundaries",()=>{
 const profile=read("web/profile-minimal.js");
 assert.match(profile,/function displayTaf\(raw\)/);
 assert.match(profile,/displayTaf\(taf\)/);
 assert.match(profile,/FM\\d\{6\}/);
 assert.match(read("web/profile-minimal.css"),/white-space:pre-wrap!important/);
});
