const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=file=>fs.readFileSync(path.join(root,file),"utf8");

test("the reversible side-panel experiment is scoped only to Mehrabad",()=>{
  const js=read("web/airport-profile-side-panel-experiment.js");
  assert.match(js,/code\(\)==="OIII"/);
  assert.doesNotMatch(js,/\bOTHH\b|\bOIIE\b|\bOITL\b|\bUDYZ\b/);
  assert.match(js,/jp-side-panel-collapsed/);
  assert.match(js,/aria-expanded/);
  assert.match(js,/reversible:true/);
});

test("the experiment loads after poster rendering and preserves other airports",()=>{
  const html=read("web/index.html");
  const css=read("web/airport-profile-side-panel-experiment.css");
  assert.doesNotMatch(html,/src="\.\/airport-profile-side-panel-experiment\.js/);
  assert.doesNotMatch(html,/href="\.\/airport-profile-side-panel-experiment\.css/);
  assert.doesNotMatch(html,/airport-runway-schematics/);
  assert.match(css,/jp-side-panel-experiment\.jp-side-panel-collapsed/);
  assert.match(css,/@media\(max-width:720px\)/);
  assert.match(css,/prefers-reduced-motion/);
});
