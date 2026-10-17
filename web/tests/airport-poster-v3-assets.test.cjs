"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"../..");
const dir=path.join(root,"web/airport-profile-posters-v3");
test("a stale offline registry cannot replace any of the 13 approved V3 posters",()=>{
 const vm=require("node:vm");
 const source=fs.readFileSync(path.join(root,"web/airport-profile-posters.js"),"utf8");
 const codes=["LTAC","LTFM","OIAA","OIAM","OIAW","OIBA","OIBB","OIBK","OIBL","OIBP","OIBQ","OIII","OIMM"];
 const urls=Object.fromEntries(codes.map(c=>[c,"./airport-profile-posters-textfree/"+c+".webp?v=old"]));
 const window={JEPPIRAN_POSTER_CACHE_URLS:urls,addEventListener(){}};
 const rootStub={querySelector(){return null}};
 class Observer {observe(){}}
 vm.runInNewContext(source.replace('  window.JEPPIRAN_NEW20_PROFILE_POSTERS =','  window.testPosterUrl = urlFor;\n  window.JEPPIRAN_NEW20_PROFILE_POSTERS ='),{
   window,document:{getElementById(){return rootStub}},MutationObserver:Observer,ResizeObserver:Observer,requestAnimationFrame(){}
 });
 for(const code of codes){
   assert.equal(window.testPosterUrl(code),"./airport-profile-posters-v3/"+code+".webp?v=2621-poster-v3-13",code+" rejects old registry artwork");
   const fresh="./airport-profile-posters-v3/"+code+".webp?v=1234567890abcdef1234";
   urls[code]=fresh;assert.equal(window.testPosterUrl(code),fresh,code+" preserves current content hash");
 }
 urls.OIIE="./airport-profile-posters-textfree/OIIE.webp?v=unchanged";
 assert.equal(window.testPosterUrl("OIIE"),urls.OIIE,"other approved airports retain their original mapping");
});
test("poster registry refreshes online and retains offline fallback",async()=>{
 const vm=require("node:vm"),handlers={},writes=[];
 const registryUrl="https://example.test/JeppIran/data/airport-poster-cache.json";
 let offline=false,networkCalls=0;
 const cached=new Response('old-registry');
 const cache={async match(){return cached.clone()},async put(request,response){writes.push(await response.text())}};
 const context={URL,Response,Request,self:{location:{origin:"https://example.test"},addEventListener(type,fn){handlers[type]=fn}},
   caches:{async open(){return cache},async match(){return cached.clone()}},
   async fetch(request,options){networkCalls++;assert.equal(options.cache,"no-cache");if(offline)throw Error("offline");return new Response('current-registry')}
 };
 vm.runInNewContext(fs.readFileSync(path.join(root,"web/service-worker.js"),"utf8"),context);
 async function read(){let response;const pending=[];handlers.fetch({request:new Request(registryUrl),respondWith(p){response=p},waitUntil(p){pending.push(p)}});const text=await (await response).text();await Promise.all(pending);return text}
 assert.equal(await read(),"current-registry");assert.deepEqual(writes,["current-registry"]);
 offline=true;assert.equal(await read(),"old-registry");assert.equal(networkCalls,2);
});
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

