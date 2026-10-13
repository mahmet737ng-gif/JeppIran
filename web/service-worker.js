const CACHE="jeppiran-pwa-2621-charts-visible-r2";
const SNAPSHOT_META="jeppiran-offline-meta-v2";
const SNAPSHOT_KEY="./__jeppiran_active_offline_v2__";
const OFFLINE_ASSET_CACHE="jeppiran-all-offline-assets-v1";
const PDF_CACHE="jeppiran-chart-pdfs-v2621-printclean-3";
const SHELL=["./aircraft-marker-locked.css?v=2621-aircraft-marker-locked-r1","./","./index.html","./home-ils-background.css?v=2621-ils-bg-fixed-r1","./airport-adc-banners.css?v=2621-adc-template2-r1","./airport-adc-banners.js?v=2621-adc-template2-r1","./data/airport-runways.json","./home-art/ils-dark-portrait.png","./home-art/ils-dark-landscape.png","./home-art/ils-light-portrait.png","./home-art/ils-light-landscape.png","./styles.css?v=2621-charts-visible-r2","./fullscreen-chart-drawer.css?v=2621-fullscreen-nav-r1","./app.js?v=2621-charts-visible-r1","./cdfa-margin-overlay.js?v=2621-cdfa-ipad-column-fit-r3","./cdfa-margin-overlay.css?v=2621-cdfa-ipad-column-fit-r3","./taxi-toolbar-v4.css?v=2621-taxi-subbar-r2","./cdfa-chart-panel.js?v=2621-cdfa-inpage-white-margin-r1","./cdfa-locked.css?v=2621-cdfa-gutter-r2","./data/cdfa-v2621-v17-qa.json","./data/cdfa-exclusions-v2621.json","./taxi-stand-engine.js?v=2621-stand-groups-generic-r10","./taxi-unnamed-connectors.js?v=2621-ltfm-n2c-r12","./taxi-engine.js?v=2621-stand-twy-runway-r12","./taxi-runway-goals.js?v=2621-oimm-goals-r24","./taxi-auto-router.js?v=2621-oimm-goals-r24","./taxi-adjacency.js?v=2621-neighbor-index-r1","./taxi-published-procedure.js?v=2621-ltfm-procedures-r16","./taxi-chart-label-pins.js?v=2621-ltfm-labels-r17","./taxi-runway-access.js?v=2621-oimm-runway-holds-r17","./taxi-runway-render.js?v=2621-oimm-dual-runway-r27","./taxi-survey-engine.js?v=2621-adc-survey-r1","./taxi-adc-workflow.js?v=2621-adc-workflow-v2-3","./taxi-adc-router.js?v=2621-adc-router-v2-1","./taxi-adc-engine-v3.js?v=2621-adc-engine-v3-r2","./taxi-o3-layers.js?v=2621-o3-layer-r1","./taxi-pdf-vector-engine.js?v=2621-overview-dual-r3","./taxi-inset-preview.js?v=2621-oiaw-inset-r3","./taxi-oiie-stages456.js?v=2621-oiie-verified-runway-axis-r5","./data/taxi-surveys/OIIE-stages456-approved-v2621.json","./data/taxi-surveys/OIIE-native-vectors-v2621.json","./data/taxi-surveys/OIIE-runway-axes-v2621.json","./data/taxi-surveys/OIIE-stand-coordinate-audit-v2621.json","./data/taxi-surveys/OIIE-stand-label-registration-v2621.json","./data/taxi-surveys/OIIE-page-portal-candidates-v2621.json","./taxi-mode.js?v=2621-taxi-docked-r14","./taxi-stand-candidate-inspector.js?v=2621-ltfm-real-stand-to-twy-r23","./toolbar-artwork/toolbar-matte.png","./toolbar-artwork/position-matte.png","./toolbar-artwork/taxi-matte.png","./manifest.webmanifest","./offline-assets.json","./offline-manager.js?v=2621-auto-sync-r2","./data/chart-georef.json","./data/airport-region-georef-v2621.json?v=oiie-o3-multiregion-r2","./data/georef-provisional-v2621.json","./data/othh-flight-qa-v2621.json","./data/othh-flight-qa-extra-v2621.json","./data/taxi-stands/OMDB.json","./data/taxi-networks/LTFM.json","./data/taxi-networks/OIMM.json","./data/taxi-surveys/OIAW.json?v=2621-adc-inventory-r1","./data/taxi-surveys/OIII.json?v=2621-o3-native-inventory-r1","./data/taxi-surveys/OIIE.json?v=2621-oiie-v3-source-r1","./data/taxi-surveys/OIIE-workflow-2621.json?v=2621-oiie-v3-qa-r1","./data/taxi-surveys/OIIE-3step-source-review-2621.json?v=2621-oiie-native-3step-r1","./data/taxi-surveys/OIII-workflow-2621.json?v=2621-graph-contact-qa-r2","./data/taxi-chart-traces/OIAW-2621.json?v=2621-overview-dual-r3","./data/taxi-audits/LTFM.json","./data/taxi-adjacency/LTFM.json","./data/taxi-procedure-traces/LTFM.json","./data/taxi-chart-labels/LTFM.json","./data/taxi-stand-positions/LTFM.json","./data/taxi-stand-candidates/LTFM.json","./data/taxi-stand-registry/LTFM.json", "./data/taxi-egress-geometry/LTFM.json", "./data/taxi-stand-leads/LTFM.json", "./data/taxi-stand-egress-routes/LTFM.json","./data/taxi-stand-pushback/LTFM.json","./data/taxi-procedures/LTFM.json","./data/taxi-stands/LTFM-ins-groups.json","./app-icon.png","./vendor/pdf.min.mjs","./vendor/pdf.worker.min.mjs"];
self.addEventListener("install",event=>{
  // Do not force-activate a new worker during an active chart session.
  event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(SHELL)));
});
self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("jeppiran-pwa-")&&key!==CACHE).map(key=>caches.delete(key)));
    // Keep user-downloaded app assets and every chart bundle across worker updates.
    // Preserve unrelated airports saved offline. Invalidate ONLY stale Maku/Tabriz PDF bundles.
    if(keys.includes(PDF_CACHE)){
      const pdfCache=await caches.open(PDF_CACHE);
      const outdated=(await pdfCache.keys()).filter(req=>{ const path=new URL(req.url).pathname; return path.endsWith("/OITU.pdf")||path.endsWith("/OITT.pdf"); });
      await Promise.all(outdated.map(req=>pdfCache.delete(req)));
    }
    await self.clients.claim();
  })());
});
async function snapshotFallback(request){
  try{
    const meta=await caches.open(SNAPSHOT_META);
    const r=await meta.match(SNAPSHOT_KEY);
    if(!r)return null;
    const state=await r.json();
    if(state.schema!==2||!state.entries)return null;
    const entry=state.entries[new URL(request.url).pathname];
    if(!entry||!entry.cache)return null;
    return (await caches.open(entry.cache)).match(entry.url,{ignoreSearch:true});
  }catch(_){return null;}
}
async function localFallback(request){
  const committed=await snapshotFallback(request);
  if(committed)return committed;
  const offline=await caches.open(OFFLINE_ASSET_CACHE);
  return (await offline.match(request,{ignoreSearch:true}))||
         (await caches.match(request))||
         (await caches.match(request,{ignoreSearch:true}));
}
self.addEventListener("fetch",event=>{
  if(event.request.method!=="GET")return;
  const url=new URL(event.request.url);
  if(url.origin!==self.location.origin)return;
  if(url.pathname.includes("/charts/")){
    event.respondWith(fetch(event.request).catch(async()=>{
      const saved=(await snapshotFallback(event.request))||
                  (await (await caches.open(PDF_CACHE)).match(event.request));
      return saved||Response.error();
    }));
    return;
  }
  // A sync request must never silently return an old manifest from offline cache.
  if(url.pathname.endsWith("/offline-assets.json")&&url.searchParams.has("sync")){
    event.respondWith(fetch(event.request,{cache:"no-store"}));
    return;
  }
  // V2621 chart-title hotfix: refresh only the chart index when online.
  // Keep the prior index available offline and preserve cached airport PDFs.
  // OIAW route geometry is screenshot-registered QA only. Prefer the
  // latest versioned graph over a stale install cache; preserve offline
  // fallback only for the exact requested URL/revision. Never change chart PDFs.
  if(url.pathname.endsWith("/data/taxi-surveys/OIIE-3step-source-review-2621.json")||
     url.pathname.endsWith("/data/taxi-surveys/OIIE.json")||url.pathname.endsWith("/data/taxi-surveys/OIIE-workflow-2621.json")||
     url.pathname.endsWith("/data/taxi-surveys/OIII-workflow-2621.json")||
     url.pathname.endsWith("/data/taxi-surveys/OIII.json")||
     url.pathname.endsWith("/data/taxi-surveys/OIAW.json")||
     url.pathname.endsWith("/data/taxi-chart-traces/OIAW-2621.json")){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
      return response;
    }).catch(()=>localFallback(event.request)));
    return;
  }
  if(url.pathname.endsWith("/offline-assets.json")||url.pathname.endsWith("/data/charts-current.json")||url.pathname.endsWith("/data/charts-manifest.json")||url.pathname.endsWith("/data/chart-georef.json")||url.pathname.endsWith("/data/airport-region-georef-v2621.json")||url.pathname.endsWith("/data/airport-profiles.json")||url.pathname.endsWith("/data/airport-runways.json")){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
      return response;
    }).catch(()=>localFallback(event.request)));
    return;
  }
  if(/\/(app\.js|cdfa-chart-panel\.js|offline-manager\.js|taxi-mode\.js|index\.html|styles\.css|service-worker\.js)$/.test(url.pathname)||url.pathname.endsWith("/JeppIran/")){
    event.respondWith(fetch(event.request).then(response=>{
      if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
      return response;
    }).catch(()=>localFallback(event.request)));
    return;
  }
  event.respondWith(localFallback(event.request).then(cached=>cached||fetch(event.request).then(response=>{
    if(response.ok){const copy=response.clone();event.waitUntil(caches.open(CACHE).then(cache=>cache.put(event.request,copy)))}
    return response;
  })));
});
