/* JEPPIRAN unified airport briefing preloader.
   Warm the TWO existing 78-airport METAR and FAA NOTAM batch feeds as soon as
   either Carousel or Classic opens, rather than requesting the whole JSON on
   every airport selection. Cache Storage is opportunistic: stale FAA notices
   are never validated as current by caching them. */
(function(){
"use strict";
if(window.JEPPIRAN_AIRPORT_PREFETCH)return;
const SOURCES=Object.freeze({
 metar:"https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/wx-cache/wx-live.json",
 notam:"https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/notam-cache/notams-current.json"
});
const CACHE_NAME="jeppiran-all-airport-briefings-v1";
const records={metar:null,notam:null};
const jobs={metar:null,notam:null};
const refreshed={metar:0,notam:0};
const REFRESH_MS={metar:5*60000,notam:30*60000};
function validate(kind,data){
 if(!data||typeof data!=="object"||!data.stations||typeof data.stations!=="object")throw Error("Invalid "+kind+" feed");
 // Do not accept a successful HTTP response with an empty/partial catalog.
 if(Object.keys(data.stations).length!==78)throw Error("Incomplete "+kind+" airport catalog");
 return data;
}
function update(kind,data,network){
 records[kind]=validate(kind,data);
 if(network)refreshed[kind]=Date.now();
 window.dispatchEvent(new CustomEvent("jeppiran-airport-briefings-updated",{detail:{kind}}));
 return records[kind];
}
async function stored(kind){
 if(!("caches" in window))return null;
 try{
  const cache=await caches.open(CACHE_NAME);
  const response=await cache.match(SOURCES[kind]);
  if(!response?.ok)return null;
  return validate(kind,await response.json());
 }catch(_){return null;}
}
async function network(kind){
 const ctrl=new AbortController();
 const timeout=setTimeout(()=>ctrl.abort(),12000);
 try{
  const response=await fetch(SOURCES[kind]+"?t="+Math.floor(Date.now()/300000),{
    cache:"no-store",mode:"cors",signal:ctrl.signal
  });
  if(!response.ok)throw Error(kind+" HTTP "+response.status);
  const data=validate(kind,await response.json());
  update(kind,data,true);
  if("caches" in window){
    // Persist exact structured data, without the transient cache-busting query.
    const copy=new Response(JSON.stringify(data),{headers:{"Content-Type":"application/json"}});
    void caches.open(CACHE_NAME).then(c=>c.put(SOURCES[kind],copy)).catch(()=>{});
  }
  return data;
 }finally{clearTimeout(timeout);}
}
function warm(kind){
 if(!Object.prototype.hasOwnProperty.call(SOURCES,kind))return Promise.reject(Error("Unknown feed"));
 if(jobs[kind])return jobs[kind];
 jobs[kind]=(async()=>{
  const saved=await stored(kind);
  if(saved&&!records[kind])update(kind,saved,false);
  try{return await network(kind);}
  catch(error){
   if(records[kind])return records[kind];
   throw error;
  }
 })().finally(()=>{jobs[kind]=null});
 return jobs[kind];
}
function get(kind){return records[kind];}
function ready(kind){return jobs[kind]||Promise.resolve(get(kind));}
function start(){
 // Parallel downloads: one METAR batch and one NOTAM batch for the 78 ICAOs.
 for(const kind of ["metar","notam"]){
  if(!jobs[kind]&&(!records[kind]||Date.now()-refreshed[kind]>=REFRESH_MS[kind]))
   void warm(kind).catch(()=>{});
 }
}
window.JEPPIRAN_AIRPORT_PREFETCH=Object.freeze({start,warm,ready,get});
start();
document.addEventListener("visibilitychange",()=>{if(!document.hidden)start()});
})();
