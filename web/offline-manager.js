/* JEPPIRAN offline snapshot sync: atomic, differential, resumable, automatic. */
(function(){
  "use strict";
  const META="jeppiran-offline-meta-v2", POINTER="./__jeppiran_active_offline_v2__";
  const LAYER_PREFIX="jeppiran-offline-layer-v2-";
  const LEGACY_ASSETS="jeppiran-all-offline-assets-v1";
  const LEGACY_PDFS="jeppiran-chart-pdfs-v2621-printclean-3";
  const btn=document.getElementById("goOfflineBtn");
  const stop=document.getElementById("stopOfflineBtn");
  const status=document.getElementById("offlinePackStatus");
  const meter=document.getElementById("offlinePackProgress");
  const count=document.getElementById("offlinePackCount");
  if(!btn||!stop||!status||!meter||!count)return;
  const origin=new URL("./",location.href);
  const supported=()=>isSecureContext&&!!window.caches&&!!window.crypto?.subtle&&"serviceWorker" in navigator;
  const sizeLabel=n=>(n/1048576).toFixed(1)+" MiB";
  let busy=false,aborter=null,lastCheck=0;
  const setStatus=s=>{status.textContent=s;};
  const keyOf=url=>new URL(url,origin).pathname;
  const sha=async data=>Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256",data)),b=>b.toString(16).padStart(2,"0")).join("");
  const absolute=item=>new URL(item.url,origin).href;
  async function readState(){
    const r=await (await caches.open(META)).match(POINTER);
    if(!r)return null;
    const s=await r.json();
    return s&&s.schema===2&&s.entries&&typeof s.entries==="object"?s:null;
  }
  async function cachedResponse(entry){
    if(!entry||!entry.cache)return null;
    return (await caches.open(entry.cache)).match(entry.url,{ignoreSearch:true});
  }
  function verifyManifest(m){
    if(!m||m.schema!==1||!Array.isArray(m.assets)||!Array.isArray(m.pdfs)||!m.pdfs.length)
      throw Error("Invalid offline package manifest");
    const items=[...m.assets,...m.pdfs],seen=new Set();
    for(const item of items){
      if(!item||!["asset","pdf"].includes(item.kind)||!Number.isSafeInteger(item.size)||item.size<0||
         !/^[a-f0-9]{64}$/i.test(item.sha256)||typeof item.url!=="string"||!item.url.startsWith("./"))
        throw Error("Invalid offline package entry");
      const u=new URL(item.url,origin);
      if(u.origin!==origin.origin||!u.pathname.startsWith(origin.pathname)||seen.has(u.pathname)||
         (item.kind==="pdf"&&!u.pathname.includes("/charts/")))
        throw Error("Unsafe or repeated offline URL");
      seen.add(u.pathname);
    }
    for(const required of ["./","./index.html","./app.js","./offline-manager.js",
                           "./service-worker.js","./data/charts-manifest.json","./vendor/pdf.min.mjs"]){
      // service-worker.js is fetched by the browser independently but must be in the snapshot.
      if(!seen.has(keyOf(required)))throw Error("Missing essential offline file: "+required);
    }
    return items;
  }
  async function valid(cache,item){
    const r=await cache.match(item.url,{ignoreSearch:true});
    if(!r||!r.ok)return false;
    const data=await r.arrayBuffer();
    return data.byteLength===item.size&&(await sha(data))===item.sha256.toLowerCase();
  }
  async function findReusable(old,item,stage,layerName,checkHashes){
    const oldEntry=old?.entries?.[keyOf(item.url)];
    if(oldEntry&&oldEntry.sha256===item.sha256&&oldEntry.size===item.size){
      const cached=await cachedResponse(oldEntry);
      if(cached&&(!checkHashes||await valid(await caches.open(oldEntry.cache),item)))
        return oldEntry.cache;
    }
    if(await valid(stage,item))return layerName;
    const legacyName=item.kind==="pdf"?LEGACY_PDFS:LEGACY_ASSETS;
    const legacy=await caches.open(legacyName);
    if(await valid(legacy,item))return legacyName;
    return null;
  }
  async function cleanup(old,newState){
    // Keep the previous committed version for rollback, but delete versions older than two snapshots.
    const keep=new Set([META,LEGACY_ASSETS,LEGACY_PDFS]);
    for(const state of [newState,old]){
      for(const entry of Object.values(state?.entries||{}))if(entry.cache)keep.add(entry.cache);
    }
    const names=await caches.keys();
    await Promise.all(names.filter(n=>n.startsWith(LAYER_PREFIX)&&!keep.has(n)).map(n=>caches.delete(n)));
  }
  async function reportStored(){
    if(busy||!supported())return;
    try{
      const state=await readState();
      if(state){
        const total=Object.keys(state.entries).length;
        setStatus("READY OFFLINE · "+state.cycle+" · "+state.pdfCount+" airports. Last successful sync: "+
                  new Date(state.completedAt).toLocaleString()+". Automatic updates enabled.");
        count.textContent=total+" files in the committed offline snapshot";
      }else{
        setStatus("Automatic offline download enabled. Connect to the internet to save all charts.");
      }
    }catch(e){setStatus("Offline storage is unavailable: "+e.message);}
  }
  async function sync({manual=false}={}){
    if(busy||!supported())return;
    if(!navigator.onLine){
      if(manual)await reportStored();
      return;
    }
    busy=true;aborter=new AbortController();
    btn.disabled=true;stop.hidden=false;
    meter.hidden=false;meter.value=0;
    const signal=aborter.signal;
    let old=null,downloaded=0,reused=0,downloadBytes=0;
    try{
      const registration=await navigator.serviceWorker.ready;
      if(!registration.active)throw Error("Offline service worker not ready");
      if(navigator.storage?.persist){try{await navigator.storage.persist();}catch(_){}}
      old=await readState();
      setStatus(manual?"Checking all local files…":"Checking for automatic offline updates…");
      // SW never substitutes an old local manifest for a sync request.
      const r=await fetch("./offline-assets.json?sync="+Date.now(),{cache:"no-store",signal});
      if(!r.ok||r.type==="opaque")throw Error("Offline manifest HTTP "+r.status);
      const remote=await r.json();
      const items=verifyManifest(remote);
      const signature=await sha(new TextEncoder().encode(
        JSON.stringify(items.map(({url,sha256,size,kind})=>[url,sha256,size,kind]))));
      const layerName=LAYER_PREFIX+signature.slice(0,24);
      const layer=await caches.open(layerName);
      const newEntries={};
      meter.max=items.length;
      let completed=0;
      for(const item of items){
        if(signal.aborted)throw new DOMException("Cancelled","AbortError");
        let cacheName=await findReusable(old,item,layer,layerName,manual);
        if(cacheName===null){
          // Only new/changed/unavailable resources use the network.
          const response=await fetch(item.url,{cache:"no-store",signal});
          if(!response.ok||response.type==="opaque")throw Error("HTTP "+response.status+" downloading "+item.url);
          const bytes=await response.clone().arrayBuffer();
          if(bytes.byteLength!==item.size||(await sha(bytes))!==item.sha256.toLowerCase())
            throw Error("Checksum mismatch: "+item.url);
          try{await layer.put(item.url,response);}
          catch(e){if(e?.name==="QuotaExceededError")throw Error("Not enough browser storage; previous offline version is still safe");throw e;}
          cacheName=layerName;downloaded++;downloadBytes+=item.size;
        }else{reused++;}
        newEntries[keyOf(item.url)]={url:item.url,kind:item.kind,sha256:item.sha256,
                                      size:item.size,cache:cacheName};
        completed++;meter.value=completed;
        count.textContent=completed+"/"+items.length+" checked · "+
                          downloaded+" changed files downloaded ("+sizeLabel(downloadBytes)+")";
        if(downloaded||manual)setStatus("Synchronizing "+(item.icao||item.url)+"…");
      }
      // A single cache.put of the pointer is the commit point. Until this succeeds,
      // previous entries and every referenced cache remain unchanged.
      const snapshot={schema:2,cycle:remote.cycle,releaseTag:remote.release_tag||"",
        pdfCount:remote.pdfs.length,totalBytes:remote.totalBytes,
        completedAt:new Date().toISOString(),signature,entries:newEntries};
      await (await caches.open(META)).put(POINTER,new Response(JSON.stringify(snapshot),
        {headers:{"Content-Type":"application/json"}}));
      await cleanup(old,snapshot).catch(()=>{});
      setStatus("READY OFFLINE · "+snapshot.cycle+" · "+snapshot.pdfCount+
                " airports. "+(downloaded?downloaded+" changed files downloaded ("+sizeLabel(downloadBytes)+")":
                "No changes; everything is already current.")+
                " Automatic sync runs on open, refresh, reconnect and while active.");
      count.textContent=items.length+" files checked · "+reused+" reused · "+downloaded+" downloaded";
    }catch(e){
      if(e?.name==="AbortError")setStatus("Download paused. Previously saved offline version remains available. The next check resumes.");
      else setStatus("Sync interrupted: "+e.message+". Previously saved offline version remains available.");
    }finally{
      lastCheck=Date.now();busy=false;aborter=null;btn.disabled=false;stop.hidden=true;
      if(!old&&!(await readState().catch(()=>null)))meter.hidden=true;
    }
  }
  // PDF viewer can read the exact currently published PDF without using stale legacy cache.
  window.JeppIranOffline={
    getPdfResponse:async(url,expectedHash)=>{
      const state=await readState();
      const entry=state?.entries?.[keyOf(url)];
      if(!entry||entry.kind!=="pdf"||(expectedHash&&entry.sha256!==expectedHash.toLowerCase()))return null;
      return cachedResponse(entry);
    },
    hasSnapshot:async()=>!!(await readState()),
    sync:()=>sync({manual:true})
  };
  stop.addEventListener("click",()=>aborter?.abort());
  btn.addEventListener("click",()=>sync({manual:true}));
  // When the web app/PWA is open, compare GitHub Pages package automatically.
  // iPadOS does NOT guarantee background execution after the PWA is closed.
  function checkSoon(force=false){
    if(document.visibilityState==="hidden"||busy||!navigator.onLine)return;
    if(!force&&Date.now()-lastCheck<60000)return;
    lastCheck=Date.now();sync().catch(()=>{});
  }
  window.addEventListener("load",()=>checkSoon(true),{once:true});
  window.addEventListener("pageshow",()=>checkSoon());
  window.addEventListener("focus",()=>checkSoon());
  window.addEventListener("online",()=>checkSoon(true));
  document.addEventListener("visibilitychange",()=>{if(!document.hidden)checkSoon();});
  setInterval(()=>checkSoon(true),5*60*1000);
  reportStored();
})();