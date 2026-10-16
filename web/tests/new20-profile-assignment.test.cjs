"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),test=require("node:test");
const root=path.resolve(__dirname,"../..");
const read=p=>fs.readFileSync(path.join(root,p),"utf8");
test("all 20 decorative pictures are mapped to 20 uncovered airports without altering 50 owner locks",()=>{
 const approvals=JSON.parse(read("web/airport-profile-posters/manifest.json"));
 const source=JSON.parse(read("web/airport-profile-posters-new20/manifest.json"));
 const assignments=JSON.parse(read("web/airport-profile-posters-new20/assignments.json"));
 const mapping=assignments.airport_to_design;
 assert.equal(approvals.ownerLocked,true);
 assert.equal(Object.keys(approvals.files).length,50);
 assert.equal(source.assets.length,20);
 assert.equal(assignments.count,20);
 assert.equal(Object.keys(mapping).length,20);
 assert.equal(new Set(Object.values(mapping)).size,20);
 assert.deepEqual([...Object.values(mapping)].sort(),source.assets.map(a=>a.id).sort());
 const js=read("web/airport-profile-posters.js");
 const builder=read("scripts/build_airport_poster_precache_manifest.py");
 for(const [icao,id] of Object.entries(mapping)){
   assert.match(icao,/^[A-Z]{4}$/);
   assert.ok(!approvals.files[icao],"must not overwrite locked "+icao);
   assert.ok(js.includes(JSON.stringify(icao)+":"+JSON.stringify(id)),icao);
   const bytes=fs.readFileSync(path.join(root,"web/airport-profile-posters-new20",id+".webp"));
   const entry=source.assets.find(x=>x.id===id);
   assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),entry.sha256_webp,id);
 }
 assert.match(js,/additionalPosterAssignments\[icao\]/);
 assert.match(js,/window.JEPPIRAN_NEW20_PROFILE_POSTERS/);
 assert.match(js,/window.JEPPIRAN_POSTER_CACHE_URLS\?\.\[icao\]/);
 assert.match(builder,/gallery_urls/);
 assert.match(builder,/icao in posters/);
});
