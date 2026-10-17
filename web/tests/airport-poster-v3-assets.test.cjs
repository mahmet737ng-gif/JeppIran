"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const dir=path.join(root,"web/airport-profile-posters-v3");
test("all 13 ICAO-labelled airport composites match the approved source hashes",()=>{
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,"manifest.json"),"utf8"));
 assert.equal(manifest.schema,1);assert.equal(manifest.expectedCount,13);assert.equal(manifest.illustrativeOnly,true);
 assert.equal(Object.keys(manifest.files).length,13);
 assert.deepEqual(fs.readdirSync(dir).filter(x=>x.endsWith(".webp")).sort(),Object.keys(manifest.files).map(c=>c+".webp").sort());
 for(const [icao,entry] of Object.entries(manifest.files)){
   const bytes=fs.readFileSync(path.join(dir,entry.file));
   assert.equal(bytes.length,entry.size,icao+" byte size");
   assert.equal(bytes.toString("ascii",0,4),"RIFF",icao+" RIFF");
   assert.equal(bytes.toString("ascii",8,12),"WEBP",icao+" WebP");
   assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),entry.sha256,icao+" immutable approved composite");
 }
});
test("web runtime references the 13-display override while keeping historical images",()=>{
 const get=p=>fs.readFileSync(path.join(root,p),"utf8");
 const js=get("web/airport-profile-posters.js"),builder=get("scripts/build_airport_poster_precache_manifest.py");
 const loader=get("web/airport-poster-preload.js"),worker=get("web/service-worker.js");
 assert.match(js,/v3AirportCodes/);assert.match(js,/v3AirportSet\.has\(icao\)/);
 assert.match(js,/additionalPosterAssignments/);assert.match(js,/window\.JEPPIRAN_POSTER_CACHE_URLS/);
 assert.match(builder,/airport-profile-posters-v3/);
 for(const c of ["LTAC","LTFM","OIII","OIMM","OIAW"])assert.ok(js.includes('"'+c+'"'));
 assert.match(loader,/textfree\|new20\|v3/);
 assert.match(worker,/airport-profile-posters-v3/);
});
