const CACHE="jeppiran-pwa-2621-oimm-axis-r19";
const PDF_CACHE="jeppiran-chart-pdfs-v2621-printclean-3";
const SHELL=["./","./index.html","./home-ils-background.css?v=2621-ils-bg-fixed-r1","./home-art/ils-dark-portrait.png","./home-art/ils-dark-landscape.png","./home-art/ils-light-portrait.png","./home-art/ils-light-landscape.png","./styles.css?v=2621-stand-groups-generic-r10","./app.js?v=2621-taxi-open-r8","./taxi-stand-engine.js?v=2621-stand-groups-generic-r10","./taxi-unnamed-connectors.js?v=2621-ltfm-n2c-r12","./taxi-auto-router.js?v=2621-oimm-ramp-runway-r17","./taxi-adjacency.js?v=2621-neighbor-index-r1","./taxi-published-procedure.js?v=2621-ltfm-procedures-r16","./taxi-chart-label-pins.js?v=2621-ltfm-labels-r17","./taxi-runway-access.js?v=2621-oimm-runway-holds-r17","./taxi-runway-render.js?v=2621-oimm-axis-r19","./taxi-mode.js?v=2621-oimm-axis-r19","./taxi-stand-candidate-inspector.js?v=2621-ltfm-stands-r18","./toolbar-artwork/toolbar-matte.png","./toolbar-artwork/position-matte.png","./toolbar-artwork/taxi-matte.png","./manifest.webmanifest","./data/georef-provisional-v2621.json","./data/othh-flight-qa-v2621.json","./data/othh-flight-qa-extra-v2621.json","./data/taxi-stands/OMDB.json","./data/taxi-networks/LTFM.json","./data/taxi-networks/OIMM.json","./data/taxi-audits/LTFM.json","./data/taxi-adjacency/LTFM.json","./data/taxi-procedure-traces/LTFM.json","./data/taxi-chart-labels/LTFM.json","./data/taxi-stand-positions/LTFM.json","./data/taxi-stand-candidates/LTFM.json","./data/taxi-stand-pushback/LTFM.json","./data/taxi-procedures/LTFM.json","./data/taxi-stands/LTFM-ins-groups.json","./app-icon.png","./vendor/pdf.min.mjs","./vendor/pdf.worker.min.mjs"];
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
  // V2621 chart-title hotfix: refresh only the chart index when online.
  // Keep the prior index available offline and preserve cached airport PDFs.
  if(url.pathname.endsWith("/data/charts-current.json")){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
      return response;
    }).catch(()=>caches.match(event.request)));
    return;
  }
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
