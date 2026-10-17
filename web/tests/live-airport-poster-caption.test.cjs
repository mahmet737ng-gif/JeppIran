"use strict";
const test=require("node:test"), assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const read=p=>fs.readFileSync(path.resolve(__dirname,"../..",p),"utf8");
test("all fifty immutable source files have a separate renderable display derivative",()=>{
 const p=read("scripts/build_textfree_airport_posters.py");
 assert.match(p,/manifest\["expectedCount"\] != 50/);
 assert.match(p,/hashlib\.sha256\(blob\)\.hexdigest\(\)\s*!=\s*item\["sha256"\]/);
 assert.match(p,/airport-profile-posters-textfree/);
 assert.match(p,/cv2\.inpaint/);
 assert.match(p,/mask_letters/);
 assert.doesNotMatch(p,/Image\.new\("RGB"/);
 assert.doesNotMatch(p,/Image\.composite/);
 assert.doesNotMatch(p,/original_rgb\.save\(source/);
});
test("caption is live DOM from profile, not an image or hardcoded airport name",()=>{
 const js=read("web/airport-profile-posters.js");
 assert.match(js,/function ensureCaption\(frame\)/);
 assert.match(js,/document\.createElement\("section"\)/);
 assert.match(js,/\.textContent = value/);
 assert.match(js,/className = "jp-poster-caption"/);
 assert.match(js,/airports\[icao\]/);
 assert.match(js,/\.profile-coordinates/);
 assert.match(js,/airport-profile-posters-textfree\//);
 assert.match(js,/ensureCaption\(frame\)/);
 assert.match(js,/frame\.appendChild\(caption\)/);
});
test("approved metallic gradient typography stays text at arbitrary zoom",()=>{
 const css=read("web/airport-profile-live-text.css");
 assert.match(css,/\.jp-caption-title/);
 assert.match(css,/background-clip:text/);
 assert.match(css,/-webkit-text-fill-color:transparent/);
 assert.match(css,/linear-gradient/);
 assert.match(css,/\.jp-caption-coordinates/);
});
test("live caption assets are versioned in HTML and SW and generated before package",()=>{
 const html=read("web/index.html"),sw=read("web/service-worker.js"),wf=read(".github/workflows/deploy-ipad-web.yml");
 for(const n of ["airport-profile-posters.js?v=2621-profile-v3-63-r1","airport-profile-live-text.css?v=2621-live-caption-r1"]) {
  assert.ok(html.includes(n)&&sw.includes(n),n);
 }
 assert.match(wf,/python3 scripts\/build_textfree_airport_posters\.py/);
 assert.match(wf,/node --test web\/tests\/live-airport-poster-caption\.test\.cjs/);
});

test("V2 global headers replace old captions without changing original artwork",()=>{
 const js=read("web/airport-profile-posters.js");
 const css=read("web/airport-profile-header-v2.css");
 const py=read("scripts/build_textfree_airport_posters.py");
 const html=read("web/index.html"), sw=read("web/service-worker.js");
 assert.match(js,/icao\+" \/ "\+iata/);
 assert.match(js,/const displayName =/);
 assert.match(js,/airportSuffix\.test/);
 assert.match(js,/jp-caption-elevation/);
 assert.match(js,/jp-caption-divider/);
 assert.doesNotMatch(js,/display\("span","jp-caption-coordinates"/);
 assert.match(css,/\.jp-poster-frame \{/);
 assert.match(css,/background-size:cover!important/);
 assert.match(css,/\.jp-caption-divider::before/);
 assert.match(css,/\.jp-caption-divider::after/);
 assert.match(py,/extend_and_repair_caption/);
 assert.match(py,/height \* 16 \/ 9/);
 assert.match(py,/cv2\.BORDER_REFLECT_101/);
 const style="airport-profile-header-v2.css?v=2621-profile-scenery-restored-r3";
 assert.ok(html.includes(style)&&sw.includes(style));
});


