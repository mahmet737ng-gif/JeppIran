"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const base=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(base,p),"utf8");
test("OICZ Saqez Airport is in Saqez in all displayed user data",()=>{
 const script=read("scripts/build_airport_profiles.py");
 const app=read("web/app.js");
 assert.match(script,/found\["OICZ"\][^\n]*[\s\S]*?"name": "Saqez Airport", "city": "Saqez"/);
 assert.match(app,/"OICZ":\["Saqez Airport","Saqez"\]/);
 assert.match(app,/icao==="OICZ"\?\{\.\.\.airportMetadata\[icao\],name:"Saqez Airport",city:"Saqez"\}/);
 assert.match(app,/icao==="OICZ"\?\{\.\.\.\(airportMetadata\[icao\]\|\|\{\}\),name:"Saqez Airport",city:"Saqez"\}/);
});
test("all image poster bytes are served from immutable content-addressed URL cache",()=>{
 const registry=read("scripts/build_airport_poster_precache_manifest.py");
 const sw=read("web/service-worker.js");
 const loader=read("web/airport-poster-preload.js");
 assert.match(registry,/hashlib\.sha256\(file\.read_bytes\(\)\)\.hexdigest\(\)/);
 assert.match(registry,/new20_\*\.webp/);
 assert.match(sw,/const AIRPORT_POSTER_CACHE="jeppiran-airport-poster-files-v1"/);
 assert.match(sw,/\/airport-profile-posters-textfree\//);
 assert.match(sw,/\/airport-profile-posters-new20\//);
 assert.match(sw,/\/airport-profile-posters-v3\//);
 assert.match(sw,/const ready=await cache\.match\(event\.request\)/);
 assert.match(sw,/if\(ready\)return ready/);
 assert.match(loader,/CACHE = "jeppiran-airport-poster-files-v1"/);
 assert.match(loader,/status\.loaded===urls\.length/);
 assert.match(loader,/JEPPIRAN_PREFETCH_POSTERS/);
 assert.doesNotMatch(sw,/caches\.delete\(AIRPORT_POSTER_CACHE\)/);
});
test("preload starts at launch without blocking initial UI or deleting chart PDFs",()=>{
 const html=read("web/index.html"),sw=read("web/service-worker.js");
 for(const n of ["airport-poster-preload.js?v=2621-persistent-v3-13-r1","airport-profile-posters.js?v=2621-profile-v3-63-r2"]){
  assert.ok(html.includes(n),n);
  assert.ok(sw.includes(n),n);
 }
 // The airport poster cache is immutable; app.js still needs its own version
 // whenever chart UI logic changes. Verify parity rather than freeze an old SHA.
 const appEntry=html.match(/<script src="\.\/(app\.js\?v=[^"]+)" defer><\/script>/);
 assert.ok(appEntry,"versioned app.js script missing");
 assert.ok(sw.includes("./"+appEntry[1]),"same app.js revision in offline worker");
 assert.ok(html.indexOf("airport-poster-preload.js")<html.indexOf("airport-profile-posters.js"));
 assert.match(sw,/const PDF_CACHE=/);
 assert.match(sw,/const AIRPORT_POSTER_CACHE=/);
});

