"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");
test("design 2 is a reversible OIII-only runtime overlay using live card nodes",()=>{
 const js=read("web/airport-profile-topbar-experiment.js");
 const css=read("web/airport-profile-topbar-experiment.css");
 assert.match(js,/code\(\) !== "OIII"/);
 assert.match(js,/drawer\.append\(drawerTop, cols\)/);
 assert.match(js,/meta\.append\(clock\)/);
 assert.match(js,/root\.classList\.add\("jp-o3-topbar-experiment"\)/);
 assert.match(js,/reversible: true/);
 assert.doesNotMatch(js,/innerHTML\s*=/);
 assert.match(css,/#chartsView \.airport-profile\.jp-o3-topbar-experiment/);
 assert.match(css,/\.jp-o3-details\[hidden\] \{display:none!important\}/);
 assert.match(css,/background-image:url\("\.\/airport-profile-posters-v3\/OIII\.webp"\)!important/);
 assert.match(css,/> \.jp-poster-scenic-foreground \{[\s\S]*?display:none!important/);
});
test("topbar scripts deploy after approved posters and old side panel remains reversible fallback",()=>{
 const html=read("web/index.html"),sw=read("web/service-worker.js");
 const side=read("web/airport-profile-side-panel-experiment.js");
 for(const file of ["airport-profile-topbar-experiment.css","airport-profile-topbar-experiment.js"]){
  const rev=file.endsWith(".css")?"r2":"r1";
  assert.ok(html.includes(file+"?v=2621-oiii-topbar-design2-"+rev));
  assert.ok(sw.includes(file+"?v=2621-oiii-topbar-design2-"+rev));
 }
 assert.ok(html.indexOf("airport-profile-posters.js")<html.indexOf("airport-profile-topbar-experiment.js"));
 assert.ok(html.indexOf("airport-profile-topbar-experiment.js")<html.indexOf("airport-profile-side-panel-experiment.js"));
 assert.match(side,/!root\.classList\.contains\("jp-o3-topbar-experiment"\)/);
});
