// Fetch the ACTUAL GitHub Pages deployment URL after the Pages deploy step.
// Check the published app revision, both ten-image gallery pages and SHA256 of
// every one of the twenty publicly served WebP assets.
"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const manifest=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters-new20/manifest.json"),"utf8"));
const assigned=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters-new20/assignments.json"),"utf8"));
const v3=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters-v3/manifest.json"),"utf8"));
const original=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters/manifest.json"),"utf8"));
const expectedProfiles=[...new Set([...Object.keys(original.files),...Object.keys(assigned.airport_to_design),...Object.keys(v3.files)])].sort();
const chartProfiles=JSON.parse(fs.readFileSync(path.join(root,"app/src/main/assets/airport-profile-chart-overrides.json"),"utf8")).airports;
const base=process.env.JEPPIRAN_PAGE_URL;
const posterScript=fs.readFileSync(path.join(root,"web/index.html"),"utf8").match(/src="\.\/(airport-profile-posters\.js\?v=[^"]+)"/)?.[1];
assert.ok(posterScript,"Current versioned airport poster script is required");
if(!base||!/^https:\/\//.test(base))throw Error("Pages deployment output URL is required");
const url=(relative)=>new URL(relative,base.endsWith("/")?base:base+"/");
const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function get(relative){const r=await fetch(url(relative),{headers:{"Cache-Control":"no-cache"},signal:AbortSignal.timeout(35000)});if(!r.ok)throw Error(relative+" HTTP "+r.status);return r}
(async()=>{
 let ready=false;
 for(let i=1;i<=15;i++){
  try{
   const html=await (await get("index.html")).text();
   const gallery=await (await get("airport-profile-posters-new20/?batch=1")).text();
   const code=await (await get(posterScript)).text();
   const mapping=await (await get("data/airport-poster-cache.json")).json();
   assert.ok(html.includes(posterScript));
   assert.ok(gallery.includes("const perPage=10")&&gallery.includes("const total=20"));
   assert.ok(code.includes("additionalPosterAssignments"));
   assert.deepEqual(Object.keys(mapping.posters).sort(),expectedProfiles);
   const profiles=await (await get("data/airport-profiles.json")).json();
   for(const [icao,entry] of Object.entries(chartProfiles)){
    for(const [key,value] of Object.entries(entry.profile))assert.equal(profiles.airports[icao]?.[key],value,icao+" chart profile "+key);
    assert.match(profiles.airports[icao].source,/Jeppesen/);
   }
   for(const [icao,id] of Object.entries(assigned.airport_to_design))if(!(icao in v3.files))assert.ok(mapping.posters[icao].includes(id+".webp"));
   for(const icao of Object.keys(v3.files))assert.ok(mapping.posters[icao].includes("/"+icao+".webp?v="),icao);
   ready=true;break;
  }catch(e){console.log("Published Pages not current yet, attempt",i,e.message);if(i<15)await wait(12000)}
 }
 assert.ok(ready,"New airport profile mapping NOT visible on published Pages");
 const gallery2=await (await get("airport-profile-posters-new20/?batch=2")).text();
 assert.ok(gallery2.includes("const perPage=10"));
 for(const entry of manifest.assets){
  const r=await get("airport-profile-posters-new20/"+entry.id+".webp");
  assert.ok((r.headers.get("content-type")||"").includes("image/"),"not an image: "+entry.id);
  const body=Buffer.from(await r.arrayBuffer());
  assert.equal(crypto.createHash("sha256").update(body).digest("hex"),entry.sha256_webp,entry.id);
  console.log("LIVE WEB PASS",entry.id,body.length,"bytes");
 }
 for(const [icao,meta] of Object.entries(v3.files)){
  const r=await get("airport-profile-posters-v3/"+icao+".webp");
  const body=Buffer.from(await r.arrayBuffer());
  assert.equal(crypto.createHash("sha256").update(body).digest("hex"),meta.sha256,icao);
  console.log("LIVE WEB V3 PASS",icao,body.length,"bytes");
 }
 console.log("PASS PUBLIC PAGES: twenty historical photos, all current V3 photos,",expectedProfiles.length,"profile mappings and both review pages.");
})().catch(e=>{console.error(e);process.exitCode=1});

