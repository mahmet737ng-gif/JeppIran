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
