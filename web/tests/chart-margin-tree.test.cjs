"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=(p)=>fs.readFileSync(path.join(root,p),"utf8");
test("chart viewer side-tree is registered, searchable and selection synchronized",()=>{
  const html=read("index.html"),js=read("app.js"),nav=read("chart-margin-tree.js"),css=read("chart-margin-tree.css");
  assert.match(html,/chart-margin-tree\.js/);
  assert.match(html,/chart-margin-tree\.css/);
  assert.match(js,/dispatchEvent\(new CustomEvent\("jeppiran-chart-selected"/);
  assert.match(nav,/window\.addEventListener\("jeppiran-chart-selected",syncSelection\)/);
  assert.match(nav,/displayAirportCode\(c\)===selectedAirport/);
  assert.match(nav,/jp-chart-margin-category/);
  assert.match(nav,/aria-selected/);
  assert.match(css,/#jpChartMarginNav/);
});
test("chart paging is reversible, fast vertical scroll has inertia and zoom reaches 50%",()=>{
  const js=read("app.js");
  assert.match(js,/Math\.max\(\.5,Math\.min\(4,Number\(next\)/);
  assert.match(js,/Math\.max\(\.5,Math\.min\(4,next\)/);
  assert.match(js,/state\.reversing/);
  assert.match(js,/startVerticalInertia\(/);
  assert.match(js,/Math\.abs\(state\.dx\)>=42/);
});
test("preview hides chart-name rail and keeps a visible return action",()=>{
  const css=read("preview/airport-carousel-r13-fixed/styles.css");
  const html=read("preview/airport-carousel-r13-fixed/index.html");
  assert.match(css,/body\.chart-selected \.procedure-zone/);
  assert.match(html,/id="previewBackToCharts"/);
});
test("offline shell includes the viewer code and original V2621 safeguards",()=>{
  const sw=read("service-worker.js"),html=read("index.html");
  assert.match(sw,/chart-margin-tree\.js/);
  assert.match(sw,/chart-margin-tree\.css/);
  assert.match(html,/app\.js\?v=2621-oici-ungeoref-neutral-pos-r1/);
  assert.match(html,/oigg-local-r3/);
});
