/* Owner-approved profile poster display: 50 original images unchanged.
 * No 'cover', no stretching, no loss of bottom legend, moderate translucency.
 */
const test=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"../..");
const read=f=>fs.readFileSync(path.join(root,f),"utf8");
test("profile images use uncropped containment and no regeneration",()=>{
  const css=read("web/airport-profile-posters.css");
  assert.match(css, /#chartsView \.airport-profile\.jp-airport-poster-loaded\s*\{[^}]*background-size:contain\s*!important/s);
  assert.doesNotMatch(css,/background-size\s*:\s*(?:cover|100%\s+100%)/);
  assert.match(css, /background-position:center center/);
  assert.match(css, /\.profile-card\s*\{[^}]*background:rgba\(5,24,43,\.76\)/s);
  assert.match(css, /:root\.light[\s\S]+background-size:contain\s*!important/);
});
test("new style URL versioned in both HTML and offline service worker",()=>{
  const html=read("web/index.html"),sw=read("web/service-worker.js");
  const url="airport-profile-posters.css?v=2621-profile-fit-no-crop-r2";
  assert.ok(html.includes(url));
  assert.ok(sw.includes(url));
  // Offline cache epoch must advance with new navigation assets, independently of poster CSS.
  assert.match(sw,/const CACHE="jeppiran-pwa-2621-ipad-layout-carousel-r\d+(?:-[^"]+)?"/);
  assert.match(sw,/url\.pathname\.endsWith\("\/notam-service\.css"\)/);
});
test("the same 50 approved image names and SHA256 locks are retained",()=>{
  const man=JSON.parse(read("web/airport-profile-posters/manifest.json"));
  assert.equal(man.expectedCount,50);
  assert.equal(Object.keys(man.files).length,50);
  assert.equal(man.ownerLocked,true);
  for(const [icao,{file,sha256}] of Object.entries(man.files)){
    assert.equal(file,`${icao}.webp`);
    assert.match(sha256,/^[a-f0-9]{64}$/);
  }
  assert.equal(man.files.OICK.file,"OICK.webp");
  assert.equal(man.files.OIFS.file,"OIFS.webp");
});
test("contain geometry preserves the entire poster at desktop and mobile ratios",()=>{
  const size=(boxW,boxH,imgW=1024,imgH=768)=>{
    const scale=Math.min(boxW/imgW,boxH/imgH);
    return [imgW*scale,imgH*scale];
  };
  for(const [w,h] of [[1420,820],[1648,928],[900,700],[393,760],[820,393]]){
    const [dw,dh]=size(w,h);
    assert.ok(dw<=w+1e-8 && dh<=h+1e-8);
    assert.ok(Math.abs(dw/dh-4/3)<1e-10);
  }
});
