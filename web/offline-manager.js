/* JEPPIRAN Go Offline V2621: device-local app, data, images, and all airport PDFs. */
(function(){
  "use strict";
  const ASSET_CACHE="jeppiran-all-offline-assets-v1";
  const PDF_CACHE="jeppiran-chart-pdfs-v2621-printclean-3";
  const button=document.getElementById("goOfflineBtn");
  const stop=document.getElementById("stopOfflineBtn");
  const status=document.getElementById("offlinePackStatus");
  const progress=document.getElementById("offlinePackProgress");
  const counter=document.getElementById("offlinePackCount");
  if(!button||!stop||!status||!progress||!counter)return;
  let controller=null, active=false;
  const bytesLabel=n=>(n/1048576).toFixed(1)+" MB";
  const say=s=>{status.textContent=s;};
  async function hash(bytes){
    const digest=await crypto.subtle.digest("SHA-256",bytes);
    return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
  }
  async function valid(cache,item){
    const response=await cache.match(item.url,{ignoreSearch:true});
    if(!response||!response.ok)return false;
    const data=await response.arrayBuffer();
    return data.byteLength===item.size&&await hash(data)===item.sha256;
  }
  function ensurePack(m){
    if(!m||m.schema!==1||!Array.isArray(m.assets)||!Array.isArray(m.pdfs)||!m.pdfs.length||
       !m.assets.some(x=>x.url==="./index.html")||!m.assets.some(x=>x.url==="./")||
       !m.assets.some(x=>x.url==="./app.js")||!m.assets.some(x=>x.url==="./vendor/pdf.min.mjs"))
      throw new Error("The offline package is incomplete. Reopen the app online.");
    return m;
  }
  function supported(){
    return isSecureContext&&"serviceWorker" in navigator&&"caches" in window&&
           !!window.crypto?.subtle;
  }
  async function cachedPack(){
    const cache=await caches.open(ASSET_CACHE);
    const saved=await cache.match("./offline-assets.json");
    return saved?ensurePack(await saved.json()):null;
  }
  async function showSavedStatus(){
    if(active||!supported())return;
    try{
      const m=await cachedPack();
      if(!m){say("Not downloaded. Tap Go Offline to save the whole app.");return;}
      const app=await caches.open(ASSET_CACHE),pdf=await caches.open(PDF_CACHE);
      let present=0;
      for(const x of m.assets){if(await app.match(x.url,{ignoreSearch:true}))present++;}
      for(const x of m.pdfs){if(await pdf.match(x.url))present++;}
      const total=m.assets.length+m.pdfs.length;
      if(present===total) say("Offline files present: "+m.cycle+" · "+total+" files. Tap Go Offline to verify or refresh.");
      else say("Partial offline copy: "+present+"/"+total+" files. Tap Go Offline to resume.");
    }catch(e){say("Tap Go Offline to download this version.");}
  }
  stop.addEventListener("click",()=>controller?.abort());
  button.addEventListener("click",async()=>{
    if(active)return;
    if(!supported()){say("Offline storage needs HTTPS and a supported browser (Safari/Chrome).");return;}
    active=true;controller=new AbortController();
    button.disabled=true;stop.hidden=false;progress.hidden=false;progress.value=0;
    try{
      if(!navigator.onLine)throw new Error("Connect to the internet to start or refresh the offline download.");
      say("Preparing offline package…");
      const reg=await navigator.serviceWorker.ready;
      if(!reg.active)throw new Error("The offline service worker is not ready.");
      if(navigator.storage?.persist){try{await navigator.storage.persist();}catch(_){}}
      const response=await fetch("./offline-assets.json",{cache:"reload",signal:controller.signal});
      if(!response.ok)throw new Error("Offline package manifest HTTP "+response.status);
      const m=ensurePack(await response.json());
      const items=[...m.assets,...m.pdfs];
      const app=await caches.open(ASSET_CACHE);
      const pdf=await caches.open(PDF_CACHE);
      let done=0,completeBytes=0;
      progress.max=items.length;
      const update=entry=>{
        progress.value=done;
        counter.textContent=done+" / "+items.length+" files · "+bytesLabel(completeBytes)+" / "+bytesLabel(m.totalBytes);
        say(done===items.length?"Verifying completed download…":"Saving "+(entry?.icao||entry?.url||"app files")+" to this device…");
      };
      update();
      for(const item of items){
        if(controller.signal.aborted)throw new DOMException("Stopped","AbortError");
        const cache=item.kind==="pdf"?pdf:app;
        if(!await valid(cache,item)){
          const r=await fetch(item.url,{cache:"reload",signal:controller.signal});
          if(!r.ok||r.type==="opaque")throw new Error("Download failed: "+item.url+" (HTTP "+r.status+")");
          const data=await r.clone().arrayBuffer();
          if(data.byteLength!==item.size||await hash(data)!==item.sha256)
            throw new Error("File verification failed: "+item.url);
          try{await cache.put(item.url,r);}catch(e){
            if(e?.name==="QuotaExceededError")throw new Error("Device storage quota reached. Free space and retry; completed files are retained.");
            throw e;
          }
        }
        done++;completeBytes+=item.size;update(item);
      }
      // Verify manifest last: an incomplete transfer can never be marked ready.
      await app.put("./offline-assets.json",new Response(JSON.stringify(m),{
        headers:{"Content-Type":"application/json"}
      }));
      if(!await app.match("./")||!await app.match("./index.html")||!await pdf.match(m.pdfs[0].url))
        throw new Error("Final local-cache verification failed.");
      progress.value=items.length;
      say("READY OFFLINE · "+m.cycle+" · "+m.pdfs.length+" airports · "+bytesLabel(m.totalBytes)+". Launch from the Home Screen without internet. Storage remains browser-managed.");
      counter.textContent=items.length+" / "+items.length+" files verified";
    }catch(e){
      if(e?.name==="AbortError")say("Stopped. Downloaded files are saved; tap Go Offline to resume.");
      else say("Offline copy not complete: "+(e?.message||String(e))+" Tap Go Offline to retry.");
    }finally{
      active=false;controller=null;button.disabled=false;stop.hidden=true;
    }
  });
  showSavedStatus();
})();