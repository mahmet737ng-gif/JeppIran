/* JEPPIRAN persistent airport poster loading — content-addressed, background.
 * Does not touch any PDF, georeferencing, UI design or original locked photos.
 * Always fetch the small asset registry on app start; actual WebPs load from
 * a dedicated persistent cache and are fetched only when their SHA changes.
 */
(() => {
  "use strict";
  const MANIFEST = "./data/airport-poster-cache.json";
  const CACHE = "jeppiran-airport-poster-files-v1";
  window.JEPPIRAN_POSTER_CACHE_URLS = Object.create(null);
  window.JEPPIRAN_POSTER_CACHE_STATUS = {loaded:0,total:0,ready:false};
  const valid = u => typeof u==="string" &&
    /^\.\/airport-profile-posters-(?:textfree|new20|v3)\/[a-zA-Z0-9_-]+\.webp\?v=[a-f0-9]{20}$/.test(u);
  async function cacheOne(cache,url) {
    const req = new Request(new URL(url, document.baseURI).href,{mode:"same-origin"});
    if(await cache.match(req)) return true;
    const response = await fetch(req,{cache:"force-cache"});
    if(!response.ok) throw Error("Poster HTTP "+response.status);
    await cache.put(req,response);
    return true;
  }
  async function cacheAll(urls) {
    if(!("caches" in window)) return;
    const cache=await caches.open(CACHE);
    let next=0;
    const status=window.JEPPIRAN_POSTER_CACHE_STATUS;
    async function worker() {
      while(next<urls.length) {
        const url=urls[next++];
        try {await cacheOne(cache,url);status.loaded++;}
        catch (_) { /* Network interruption: retry next launch. */ }
      }
    }
    await Promise.all(Array.from({length:Math.min(4,urls.length)},worker));
    // Remove stale versions only after the current manifest's assets are
    // present. Cached images from other airport sets are never touched.
    if(status.loaded===urls.length) {
      const current=new Set(urls.map(u=>new URL(u,document.baseURI).href));
      for(const req of await cache.keys())if(!current.has(req.url))await cache.delete(req);
      status.ready=true;
    }
  }
  async function boot() {
    try {
      const response=await fetch(MANIFEST,{cache:"no-cache"});
      if(!response.ok) return;
      const data=await response.json();
      if(data.schema!==1 || !data.posters || !Array.isArray(data.gallery)) return;
      const codes=Object.keys(data.posters);
      if(codes.length<50) return;
      const urls=[...codes.map(code=>data.posters[code]),...data.gallery].filter(valid);
      const map=window.JEPPIRAN_POSTER_CACHE_URLS;
      for(const code of codes)if(/^[A-Z]{4}$/.test(code)&&valid(data.posters[code]))map[code]=data.posters[code];
      const status=window.JEPPIRAN_POSTER_CACHE_STATUS;status.total=urls.length;
      window.dispatchEvent(new Event("jeppiran:poster-assets-ready"));
      // Start asynchronous background caching immediately, never block UI.
      const job=cacheAll([...new Set(urls)]);
      // The SW also retains the same persistent cache across deployments.
      if("serviceWorker" in navigator) {
        navigator.serviceWorker.ready.then(reg=>{
          (navigator.serviceWorker.controller || reg.active)?.postMessage({type:"JEPPIRAN_PREFETCH_POSTERS",urls});
        }).catch(()=>{});
      }
      await job;
    } catch(_) { /* Leave original poster behavior when offline/unsupported. */ }
  }
  if(document.readyState==="loading")document.addEventListener("DOMContentLoaded",()=>{void boot();},{once:true});
  else void boot();
})();