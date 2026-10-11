const CACHE="jeppiran-pwa-v2621-taxi-startfix-1";
const PDF_CACHE="jeppiran-chart-pdfs-v2621-printclean-3";
const SHELL=["./","./index.html","./styles.css?v=2621-dual-ops-1","./app.js?v=2621-dual-ops-1","./taxi-mode.js?v=2621-taxi-startfix-1","./toolbar-artwork/toolbar-matte.png","./toolbar-artwork/position-matte.png","./toolbar-artwork/taxi-matte.png","./manifest.webmanifest","./data/georef-provisional-v2621.json","./data/othh-flight-qa-v2621.json","./data/othh-flight-qa-extra-v2621.json","./data/taxi-stands/OMDB.json","./data/taxi-networks/LTFM.json","./app-icon.png","./vendor/pdf.min.mjs","./vendor/pdf.worker.min.mjs"];
self.addEventListener("install",event=>{
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)).then(()=>self.skipWaiting()));
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key!==CACHE&&key!==PDF_CACHE).map(key=>caches.delete(key)));
    // Preserve unrelated airports saved offline. Invalidate ONLY stale Maku/Tabriz PDF bundles.
    if(keys.includes(PDF_CACHE)){
      const pdfCache=await caches.open(PDF_CACHE);
      const outdated=(await pdfCache.keys()).filter(req=>{ const path=new URL(req.url).pathname; return path.endsWith("/OITU.pdf")||path.endsWith("/OITT.pdf"); });
      await Promise.all(outdated.map(req=>pdfCache.delete(req)));
    }
    await self.clients.claim();
  })());
});
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes("/charts/"))return;
  if(/\/(app\.js|taxi-mode\.js|index\.html|styles\.css|service-worker\.js)$/.test(url.pathname)||url.pathname.endsWith("/JeppIran/")){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
  event.respondWith(caches.match(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
    return response;
  })));
});

