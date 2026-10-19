"use strict";
const {test}=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const root=path.resolve(__dirname,"..");
const asset=(name)=>fs.readFileSync(path.join(root,name),"utf8");
test("Entry preloads exactly two aggregate requests for 78 ICAOs, then reuses them",async()=>{
 const codes=Object.keys(JSON.parse(asset("app/src/main/assets/charts-manifest.json")).airports);
 assert.equal(codes.length,78);
 const weather={stations:Object.fromEntries(codes.map(code=>[code,{metar:"METAR "+code+" 191900Z 9999 SCT030 Q1013"}]))};
 const notam={stations:Object.fromEntries(codes.map(code=>[code,{status:"unavailable",fetched_at:null,notams:[]}]))};
 const calls=[],writes=[];
 class CustomEventMock{constructor(name,args){this.type=name;this.detail=args?.detail}}
 const events=[];
 const context={console,Promise,Date,AbortController,setTimeout,clearTimeout,Response,CustomEvent:CustomEventMock,
   window:{addEventListener:()=>{},dispatchEvent:e=>events.push(e)},
   document:{hidden:false,addEventListener:()=>{}},
   caches:{open:async()=>({match:async()=>null,put:async(key,value)=>{writes.push(key);assert.ok(value instanceof Response)}})},
   fetch:async url=>{
     calls.push(String(url));
     const data=String(url).includes("wx-live.json")?weather:notam;
     return {ok:true,json:async()=>data}
   }};
 context.window.caches=context.caches;
 vm.createContext(context);
 vm.runInContext(asset("web/airport-briefings-preload.js"),context);
 const api=context.window.JEPPIRAN_AIRPORT_PREFETCH;
 await Promise.all([api.ready("metar"),api.ready("notam")]);
 assert.equal(calls.length,2,"One batch for each data type, never 78 individual requests");
 assert.equal(Object.keys(api.get("metar").stations).length,78);
 assert.equal(Object.keys(api.get("notam").stations).length,78);
 api.start();
 assert.equal(calls.length,2,"Warm session must not repeat network calls");
 await new Promise(resolve=>setTimeout(resolve,0));
 assert.deepEqual(writes.sort(),[
  "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/notam-cache/notams-current.json",
  "https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/wx-cache/wx-live.json"
 ].sort());
 assert.ok(events.filter(e=>e.type==="jeppiran-airport-briefings-updated").length>=2);
});
test("Owner-approved names and briefing title are source and UI overrides only",()=>{
 const builder=asset("scripts/build_airport_profiles.py");
 const wheel=asset("web/preview/airport-carousel-r13-fixed/app.js");
 const main=asset("web/app.js");
 const labels=JSON.parse(asset("web/data/chart-briefing-titles-v2621.json"));
 assert.match(builder,/"ORBI": "Baghdad International Airport"/);
 assert.match(builder,/"OIAW": "Ahwaz International Airport"/);
 assert.match(wheel,/APPROVED_AIRPORT_NAMES/);
 assert.match(main,/Ahwaz International Airport/);
 assert.equal(labels.pages["1402"].name,"Brief: Arrival 2");
 assert.match(wheel,/chart-briefing-titles-v2621\.json/);
});

test("Warm METARs hydrate synchronously at app launch and each swipe needs no network",async()=>{
 const codes=Object.keys(JSON.parse(asset("app/src/main/assets/charts-manifest.json")).airports);
 const cached={stations:Object.fromEntries(codes.map(icao=>[icao,{metar:"METAR "+icao+" 200000Z CAVOK Q1014"}]))};
 const persisted=JSON.stringify(cached),calls=[];
 const storage={
  getItem: key=>key==="jeppiran-metar-all-78-v1"?persisted:null,
  setItem: ()=>{}
 };
 class Event{constructor(n,o){this.type=n;this.detail=o?.detail}}
 const ctx={console,Promise,Date,AbortController,setTimeout,clearTimeout,Response,CustomEvent:Event,
  window:{localStorage:storage,dispatchEvent:()=>{}},
  document:{hidden:false,addEventListener:()=>{}},
  fetch:async url=>{
   calls.push(String(url));
   return {ok:true,json:async()=>cached};
  }
 };
 vm.createContext(ctx);
 vm.runInContext(asset("web/airport-briefings-preload.js"),ctx);
 const api=ctx.window.JEPPIRAN_AIRPORT_PREFETCH;
 // This assertion is intentionally BEFORE awaiting anything asynchronous.
 assert.equal(api.get("metar").stations.OIAW.metar,"METAR OIAW 200000Z CAVOK Q1014");
 for(const code of codes){
  assert.ok(api.get("metar").stations[code],"Every ICAO must be in the initial in-memory index");
 }
 const source=asset("web/preview/airport-carousel-r13-fixed/app.js");
 const hotPath=source.split("function planProfileWeather(code){")[1]
   .split("function renderAirportProfile(code,force=false){")[0];
 assert.doesNotMatch(hotPath,/setTimeout|fetch\(|updateMetar\(|readSourceMetar\(/,
   "METAR carousel hot path must be synchronous and network-free");
 assert.match(source,/const aggregate=availableWeather\(\)/);
 assert.match(source,/paintRawMetar\(raw\)/);
 await Promise.all([api.ready("metar"),api.ready("notam")]);
 assert.equal(calls.filter(url=>url.includes("wx-live.json")).length,1);
});
test("Native Android warms the same 78 ICAOs once on Application launch",()=>{
 const application=asset("app/src/main/java/com/tareghmsr/jeppiran/JeppIranApplication.kt");
 const store=asset("app/src/main/java/com/tareghmsr/jeppiran/FlightDataStore.kt");
 assert.match(application,/FlightDataStore\.prefetchAllAsync\(this\)/);
 assert.match(store,/AtomicBoolean\(false\)/);
 assert.match(store,/stations\.length\(\) == 78/);
 assert.match(store,/BATCH_URL/);
 assert.match(store,/editor\.putString\(icao \+ "_metar"/);
});
