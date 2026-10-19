"use strict";
// Unlike the previous fixture-only browser tests, this test runs AFTER the
// GitHub Pages build has produced real manifest, PDF, and PDF.js assets.
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const path=require("node:path");
const fs=require("node:fs");
const {chromium}=require("playwright");
const port=18927;
const base="http://127.0.0.1:"+port+"/preview/airport-carousel-r13-fixed/";
const oldBase="http://127.0.0.1:"+port+"/preview/airport-carousel-r13/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:path.resolve(__dirname,".."),stdio:"ignore"});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 let browser;
 try{
   for(let i=0;i<70;i++){
     try{const r=await fetch(base);if(r.ok)break}catch(_){}
     await sleep(150);
   }
   browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
   const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
   const page=await context.newPage();
   // Deterministic source-backed METAR fixture; the UI must display its raw
   // report, not the deprecated cached/source/disclaimer status message.
   const metarSample="METAR OIII 191900Z 24006KT 9999 SCT030 21/12 Q1015";
   const ahwazMetar="METAR OIAW 192030Z 27002KT CAVOK 28/07 Q1012";
   const airports=Object.keys(JSON.parse(fs.readFileSync(
     path.join(path.resolve(__dirname,".."),"web/data/charts-manifest.json"),"utf8")).airports);
   const weatherStations=Object.fromEntries(airports.map(icao=>[
     icao,{metar:icao==="OIII"?metarSample:icao==="OIAW"?ahwazMetar:
        "METAR "+icao+" 192030Z 24005KT 9999 FEW030 21/12 Q1015"}
   ]));
   await page.route("**/wx-cache/wx-live.json*",route=>route.fulfill({
     status:200,contentType:"application/json",
     headers:{"access-control-allow-origin":"*"},
     body:JSON.stringify({stations:weatherStations})
   }));
   const errors=[],pdfRequests=[],weatherRequests=[];
   page.on("request",request=>{
     if(/wx-live\.json|aviationweather\.gov\/api\/data\/metar|rotatepilot\.com\/api\/v1\/metar|metars\.eu\/api\/metars/.test(request.url()))weatherRequests.push(request.url());
   });
   page.on("request",request=>{
     if(/\/charts\/[^/]+\.pdf(?:$|\?)/.test(request.url()))pdfRequests.push(request.url());
   });
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(/charts-manifest|charts-current|\/charts\/OIII.pdf|vendor\/pdf/.test(r.url())&&r.status()>=400)errors.push(r.status()+" "+r.url())});
   await page.goto(base,{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>document.querySelector(".airport-token.active")?.dataset.airport==="OIII",{timeout:12000});
   // With no chart open, the airport name, city, elevation and weather fields
   // must appear below the compact four-tab rail.
   assert.ok(await page.locator(".selected-airport").isVisible(),
     "Airport profile must be visible before any chart is previewed");
   assert.equal(await page.locator(".selected-airport").getAttribute("data-profile-airport"),"OIII");
   assert.ok((await page.locator("#airportPlace").innerText()).includes("Elevation"));
   await page.waitForFunction(expected=>
     document.querySelector("#weatherStatus")?.textContent===expected,metarSample,{timeout:12000});
   assert.equal(await page.locator("#weatherStatus").innerText(),metarSample,
     "Airport profile must show the original raw METAR, without advisory words");
   assert.equal(await page.locator(".airport-token").count(),78,
     "The complete 78-airport catalog must exist at first paint");
   const icaoBefore=await page.locator("#airportCarousel").boundingBox();
   const catBefore=await page.locator(".procedure-categories").boundingBox();
   assert.ok(catBefore.width<450,"Collapsed categories too wide: "+catBefore.width);
   const previewStart=Date.now();
   await page.locator('.procedure-category[data-category="AIRPORT"]').click();
   await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length>=9,{timeout:20000});
   await page.waitForTimeout(800);
   const layout=await page.evaluate(()=>{
     const sel=s=>document.querySelector(s),rect=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
     const items=[...document.querySelectorAll(".procedure-token")].filter(x=>getComputedStyle(x).visibility!=="hidden");
     const wheel=sel("#procedureWheel");
     const centered=sel(".procedure-token.active");
     const cat=sel(".procedure-categories");
     return {wheel:rect(wheel),active:centered?rect(centered):null,category:rect(cat),
       icao:rect(sel("#airportCarousel")),tokens:items.length,
       activeText:centered?.textContent,
       titleRect:centered?.querySelector(".procedure-title")?rect(centered.querySelector(".procedure-title")):null,
       activeOpacity:centered?getComputedStyle(centered).opacity:null,
       bodyRect:rect(sel(".category-shell.active .category-body")),
       mini:sel("#miniChartPreview").hidden,
       miniStatus:sel("#miniChartStatus").textContent,
       previewText:sel("#miniChartTitle").textContent,
       state:document.body.className};
   });
   console.log("REAL carousel DOM geometry:",JSON.stringify(layout));
   assert.ok(Math.abs(layout.icao.width-icaoBefore.width)<1,"ICAO strip resized!");
   assert.ok(layout.category.width>catBefore.width+300,"Opened chart body should grow!");
   assert.ok(layout.tokens>=1,"No visible chart buttons");
   assert.ok(layout.wheel.width>250&&layout.active?.width>130,"Chart buttons clip or collapse");
   assert.ok(layout.active?.right>layout.wheel.left&&layout.active?.left<layout.wheel.right,"Selected chart outside the wheel");
   assert.ok(layout.activeText.length>=4,"Selected chart has no text");
   assert.ok(!layout.mini,"Mini preview not shown");
   assert.ok(await page.locator(".selected-airport").isHidden(),
     "Airport profile should disappear when a chart is previewed");
   await page.waitForFunction(()=>{
     const img=document.querySelector("#miniChartImage");
     return img&&img.complete&&img.naturalWidth>100&&!img.hidden;
   },null,{timeout:12000});
   const elapsed=Date.now()-previewStart;
   const preview=await page.evaluate(()=>({
     loaded:!document.querySelector("#miniChartImage").hidden,
     status:document.querySelector("#miniChartStatus").textContent,
     image:document.querySelector("#miniChartImage").naturalWidth+"x"+
       document.querySelector("#miniChartImage").naturalHeight,
     src:document.querySelector("#miniChartImage").currentSrc
   }));
   console.log("REAL pre-rendered JPEG preview:",JSON.stringify({...preview,elapsed_ms:elapsed}));
   assert.ok(preview.loaded&&preview.src.includes("/chart-previews/OIII/"),
     "Fast source-backed thumbnail missing "+JSON.stringify({preview,errors}));
   assert.ok(elapsed<7000,"Preview exceeded fast-load budget: "+elapsed+"ms");
   assert.equal(pdfRequests.length,0,"Browsing must not request a full airport PDF");
   // R13 visual carousel: the previous and next *actual* chart screenshots
   // must be visible at the same time and smaller than the centered plate.
   await page.waitForFunction(()=>{
     const imgs=["miniPreviewBeforeImage","miniPreviewAfterImage"].map(id=>document.getElementById(id));
     return imgs.every(el=>el?.complete&&el.naturalWidth>100);
   },null,{timeout:12000});
   const thumbLayout=await page.evaluate(()=>{
     const bounds=id=>{const r=document.getElementById(id).getBoundingClientRect();
       return {x:r.x,width:r.width,height:r.height,left:r.left,right:r.right}};
     const item=id=>document.getElementById(id)?.dataset.previewKey;
     return {stage:bounds("miniPreviewCarousel"),
       prev:bounds("miniPreviewBefore"),selected:bounds("miniPreviewTap"),
       next:bounds("miniPreviewAfter"),before:item("miniPreviewBefore"),
       after:item("miniPreviewAfter"),
       prevSrc:document.querySelector("#miniPreviewBeforeImage")?.currentSrc,
       nextSrc:document.querySelector("#miniPreviewAfterImage")?.currentSrc};
   });
   assert.ok(thumbLayout.prev.width<thumbLayout.selected.width*.90,
     "Previous thumbnail should be visibly smaller: "+JSON.stringify(thumbLayout));
   assert.ok(thumbLayout.next.width<thumbLayout.selected.width*.90,
     "Next thumbnail should be visibly smaller: "+JSON.stringify(thumbLayout));
   assert.ok(thumbLayout.prev.right>thumbLayout.stage.left &&
     thumbLayout.next.left<thumbLayout.stage.right,
     "Adjacent charts must remain visible inside the viewport");
   assert.ok(thumbLayout.prevSrc.includes("/chart-previews/OIII/") &&
     thumbLayout.nextSrc.includes("/chart-previews/OIII/"),
     "Both side previews must use genuine per-chart thumbnails");
   console.log("PASS three-chart visual carousel",JSON.stringify(thumbLayout));
   // Adjacent card taps *select* the chart; only center/Open loads Classic.
   const startingChart=await page.locator(".procedure-token.active").getAttribute("data-chart-page");
   await page.locator("#miniPreviewAfter").click();
   await page.waitForFunction(previous=>document.querySelector(".procedure-token.active")
     ?.dataset.chartPage!==previous,startingChart,{timeout:7000});
   assert.ok(await page.locator("#classicViewerHost").isHidden(),
     "Tapping a side thumbnail must not open full Classic");
   await page.locator("#miniPreviewBefore").click();
   await page.waitForFunction(original=>document.querySelector(".procedure-token.active")
     ?.dataset.chartPage===original,startingChart,{timeout:7000});
   // iPad landscape must keep the ICAO row unchanged and chart names within the wheel.
   await page.setViewportSize({width:1024,height:768});
   await page.waitForTimeout(300);
   const ipad=await page.evaluate(()=>{
     const rr=e=>{const r=e.getBoundingClientRect();return {left:r.left,right:r.right,width:r.width}};
     return {icao:rr(document.querySelector("#airportCarousel")),
       wheel:rr(document.querySelector("#procedureWheel")),
       name:rr(document.querySelector(".procedure-token.active .procedure-title"))};
   });
   console.log("REAL iPad landscape geometry:",JSON.stringify(ipad));
   assert.ok(ipad.wheel.width>=350,"iPad landscape chart names should have usable width");
   assert.ok(ipad.name.left>=ipad.wheel.left-2 && ipad.name.right<=ipad.wheel.right+2,
     "iPad chart title is clipped outside the selector");
   await page.setViewportSize({width:1440,height:900});
   // Horizontal drag on the IMAGE carousel is synced to the chart-name wheel.
   const photoBox=await page.locator("#miniPreviewCarousel").boundingBox();
   const sx=photoBox.x+photoBox.width*.50,sy=photoBox.y+photoBox.height*.50;
   const originalCard=await page.locator(".procedure-token.active").getAttribute("data-chart-page");
   await page.mouse.move(sx,sy);
   await page.mouse.down();
   await page.mouse.move(sx-photoBox.width*.37,sy,{steps:12});
   await page.mouse.up();
   await page.waitForFunction(original=>document.querySelector(".procedure-token.active")
     ?.dataset.chartPage!==original,originalCard,{timeout:7000});
   assert.ok(await page.locator("#classicViewerHost").isHidden(),
     "Dragging the thumbnail carousel must not open Classic");
   const previewSelected=await page.locator("#miniChartContext").innerText();
   assert.ok(previewSelected.includes("OIII"));
   console.log("PASS horizontal thumbnail swipe and snap without Classic viewer");
   await page.locator("#procedureNext").click();
   await page.waitForFunction(()=>document.querySelector(".procedure-token.active")?.dataset.chartPage!=="394",{timeout:7000});
   assert.ok(await page.locator("#classicViewerHost").isHidden(),"Swipe opened Classic unexpectedly");
   await page.waitForFunction(()=>!document.querySelector("#miniChartImage").hidden &&
     document.querySelector("#miniChartImage").naturalWidth>100,{timeout:7000});
   assert.equal(pdfRequests.length,0,"Second thumbnail must not download the PDF");
   await page.locator("#miniChartOpen").click();
   assert.ok(await page.locator("#classicViewerHost").isVisible(),"Tap did not open full chart");
   // Even when the chart iframe loads and selects the V2621 PDF, its METAR
   // banner must never appear automatically. The toolbar's manual METAR
   // control remains available in the main standalone app.
   await page.waitForFunction(()=>Boolean(document.querySelector("#classicViewerFrame")
     ?.contentDocument?.querySelector("#chartMetarBanner")),null,{timeout:20000});
   await page.waitForTimeout(300);
   const banner=await page.locator("#classicViewerFrame").evaluate(iframe=>{
     const element=iframe.contentDocument?.querySelector("#chartMetarBanner");
     return {visible:element?.classList.contains("visible"),
       inEmbed:iframe.contentWindow?.document?.documentElement?.classList.contains("jp-preview-classic-embed")};
   });
   assert.equal(banner.inEmbed,true,"Chart iframe must be in scoped Carousel embed mode");
   assert.equal(banner.visible,false,"METAR must not appear automatically over Classic chart");
   assert.ok(await page.locator(".selected-airport").isHidden(),
     "Airport profile must remain hidden for a full Classic chart");
   // Drag the airport strip WHILE Classic is open. The profile must emerge
   // immediately, and track each intermediate centered ICAO before release.
   const airportRect=await page.locator("#airportCarousel").boundingBox();
   const step=await page.locator("#airportCarousel").evaluate(el=>el.clientWidth/10.25);
   const startX=airportRect.x+airportRect.width/2, startY=airportRect.y+airportRect.height/2;
   console.log("Profile swipe coordinates",JSON.stringify({airportRect,step,startX,startY}));
   assert.ok([step,startX,startY].every(Number.isFinite),"Invalid carousel swipe coordinates");
   await page.mouse.move(startX,startY);
   await page.mouse.down();
   await page.mouse.move(startX+step*1.15,startY,{steps:5});
   await page.waitForFunction(()=>document.querySelector(".selected-airport")?.dataset.profileAirport==="OIIE");
   assert.ok(await page.locator(".selected-airport").isVisible(),
     "First intermediate airport profile should be visible during the drag");
   assert.ok(await page.locator("#classicViewerHost").isHidden(),
     "Full Classic should close at the first deliberate airport swipe");
   await page.mouse.move(startX+step*2.15,startY,{steps:5});
   await page.waitForFunction(()=>document.querySelector(".selected-airport")?.dataset.profileAirport==="OIHR");
   assert.ok((await page.locator("#airportName").innerText()).length>3,
     "Second intermediate airport needs profile name while finger is still held");
   await page.mouse.up();
   await page.waitForTimeout(720);
   assert.ok(await page.locator(".selected-airport").isVisible(),
     "Airport profile remains visible after the carousel stops");
   // The real approved airport artwork must follow the center at swipe speed.
   const scenery=await page.locator("#scenery").evaluate(el=>({
     code:el.dataset.airport,background:getComputedStyle(el).backgroundImage
   }));
   assert.ok(scenery.background.includes("/"+scenery.code+".webp"),
     "Background must belong to currently centered airport: "+JSON.stringify(scenery));
   assert.equal(await page.locator(".category-shell.active").count(),0,
     "Airport swipe must close stale chart category instead of opening another preview");
   await page.locator('.procedure-category[data-category="AIRPORT"]').click();
   await page.waitForFunction(()=>!document.querySelector("#miniChartPreview").hidden,{timeout:13000});
   assert.ok(await page.locator(".selected-airport").isHidden(),
     "Opening any new chart preview hides the profile again");
   await page.locator('.procedure-category[data-category="AIRPORT"]').click();
   assert.ok(await page.locator(".selected-airport").isVisible(),
     "Closing chart preview restores current airport profile");
   // Reproduce user screenshot: choose Ahwaz after a prior airport was
   // centered; the poster and actual Ahwaz METAR must both update.
   await page.locator("#airportSearch").fill("OIAW");
   await page.locator("#searchResults button").first().click();
   await page.waitForFunction(()=>document.querySelector(".selected-airport")
      ?.dataset.profileAirport==="OIAW",{timeout:9000});
   await page.waitForFunction(()=>{
     const img=document.querySelector("#scenery");
     return img?.dataset.airport==="OIAW"&&
       getComputedStyle(img).backgroundImage.includes("/OIAW.webp");
   },null,{timeout:7000});
   await page.waitForFunction(expected=>document.querySelector("#weatherStatus")
     ?.textContent===expected,ahwazMetar,{timeout:9000});
   const ahwazState=await page.evaluate(()=>({
     weather:document.querySelector("#weatherStatus").textContent,
     background:getComputedStyle(document.querySelector("#scenery")).backgroundImage
   }));
   console.log("PASS Ahwaz METAR + changing poster",JSON.stringify(ahwazState));
   const requestsAfterStartup=weatherRequests.length;
   // Swipe-through/airport selection MUST be a synchronous lookup. Neither the
   // 78-station JSON nor an individual live-provider request may start here.
   await page.locator("#airportSearch").fill("OIII");
   await page.locator("#searchResults button").first().click();
   await page.waitForFunction(expected=>
     document.querySelector("#weatherStatus")?.textContent===expected,metarSample,
     {timeout:600});
   await page.locator("#airportSearch").fill("OIAW");
   await page.locator("#searchResults button").first().click();
   await page.waitForFunction(expected=>
     document.querySelector("#weatherStatus")?.textContent===expected,ahwazMetar,
     {timeout:600});
   assert.equal(weatherRequests.length,requestsAfterStartup,
     "Changing an ICAO after startup must NEVER initiate a weather request");
   console.log("PASS instant METAR switching; no additional network requests while browsing");
   // Search must navigate a real V2621 procedure, not just its airport.
   await page.locator("#airportSearch").fill("MIVAK 4N");
   await page.waitForFunction(()=>[...document.querySelectorAll(".search-result-procedure")]
     .some(btn=>btn.textContent.includes("MIVAK 4N")),{timeout:12000});
   await page.locator(".search-result-procedure").filter({hasText:"MIVAK 4N"}).first().click();
   try{
     await page.waitForFunction(()=>document.querySelector(".airport-token.active")?.dataset.airport==="OIII"
       && document.querySelector(".procedure-category.active")?.dataset.category==="STAR"
       && document.querySelector("#miniChartTitle")?.textContent.includes("MIVAK 4N"),null,{timeout:8000});
   }catch(error){
     const state=await page.evaluate(()=>({
       airport:document.querySelector(".airport-token.active")?.dataset.airport,
       category:document.querySelector(".procedure-category.active")?.dataset.category,
       mini:document.querySelector("#miniChartTitle")?.textContent,
       miniHidden:document.querySelector("#miniChartPreview")?.hidden,
       selected:document.querySelector(".procedure-token.active")?.textContent,
       count:document.querySelectorAll(".procedure-token").length,
       status:document.querySelector("#procedureCount")?.textContent,
       results:document.querySelectorAll("#searchResults button").length,
       searchValue:document.querySelector("#airportSearch")?.value
     }));
     console.log("Procedure search navigation diagnostic:",JSON.stringify(state));
     throw error;
   }
   assert.ok(await page.locator("#classicViewerHost").isHidden(),
     "Procedure search should select the lightweight preview, not open Classic");
   // Search genuine five-letter chart waypoints extracted from V2621 source PDFs.
   await page.waitForFunction(()=>window.fetch!==undefined,{timeout:3000});
   const fixPick=await page.evaluate(async()=>{
     const [idx,charts]=await Promise.all([
       fetch("../../data/chart-point-index-v2621.json").then(r=>r.json()),
       fetch("../../data/charts-current.json").then(r=>r.json())
     ]);
     const rows=Object.fromEntries(charts.map(r=>[String(r.page),r]));
     for(const [pg,terms] of Object.entries(idx.pages||{})){
       const row=rows[pg];
       if(!row||terms.length===0)continue;
       const fix=terms.find(fix=>!/^[A-Z]{5}$/.test(fix)===false &&
         !String(row.name||"").toUpperCase().includes(fix));
       if(fix)return {fix,page:Number(pg),airport:row.airport};
     }
     return null;
   });
   assert.ok(fixPick,"No source-derived waypoint candidate available for search QA");
   await page.locator("#airportSearch").fill(fixPick.fix);
   await page.waitForFunction(()=>document.querySelector(".search-result-point"),null,{timeout:12000});
   const target=page.locator(".search-result-point").filter({hasText:fixPick.airport}).first();
   await target.click();
   await page.waitForFunction(expected=>{
     const airport=document.querySelector(".airport-token.active")?.dataset.airport;
     const chart=Number(document.querySelector(".procedure-token.active")?.dataset.chartPage);
     return airport===expected.airport&&Number.isFinite(chart)&&
       document.querySelector("#miniChartPreview")?.hidden===false;
   },{airport:fixPick.airport},{timeout:15000});
   assert.ok(await page.locator("#classicViewerHost").isHidden(),
     "Point search should resolve to actual source chart preview");
   console.log("PASS V2621 procedure and PDF-derived point search",JSON.stringify(fixPick));
   // An unavailable index must never shrink the 78-airport carousel to 9 entries.
   const offlinePage=await context.newPage();
   await offlinePage.route("**/data/charts-manifest.json*",route=>route.abort());
   await offlinePage.goto(base,{waitUntil:"domcontentloaded"});
   await offlinePage.waitForFunction(()=>document.querySelectorAll(".airport-token").length===78);
   await offlinePage.locator("#airportSearch").fill("OTHH");
   await offlinePage.waitForFunction(()=>document.querySelector(".airport-token.active")?.dataset.airport==="OTHH");
   await offlinePage.close();
   // Regression: an old R13 HTML shell without the thumbnail IMG can load a
   // newer JavaScript bundle from a separately versioned URL. That formerly
   // threw "Cannot set properties of null (setting 'hidden')" and emptied
   // every chart category. Recreate the exact mixed-version scenario.
   const stalePage=await context.newPage();
   const staleErrors=[];
   stalePage.on("pageerror",error=>staleErrors.push(error.message));
   const sourceHtml=fs.readFileSync(path.join(path.resolve(__dirname,".."),
     "web/preview/airport-carousel-r13/index.html"),"utf8");
   const missingImageHtml=sourceHtml.replace(/<img id="miniChartImage"[^>]*>/,"")
     .replace("R13 • 78 Airports","R13 • Fresh preview");
   assert.ok(!missingImageHtml.includes('id="miniChartImage"'));
   await stalePage.route("**/preview/airport-carousel-r13/",route=>
     route.fulfill({status:200,contentType:"text/html; charset=utf-8",body:missingImageHtml}));
   await stalePage.goto(oldBase,{waitUntil:"domcontentloaded"});
   await stalePage.waitForFunction(()=>document.querySelectorAll(".airport-token").length===78);
   assert.equal(await stalePage.locator("#miniChartImage").count(),1,
     "New JS must repair missing preview image element from cached old HTML");
   await stalePage.locator("#airportSearch").fill("OIKM");
   await stalePage.waitForFunction(()=>document.querySelector(".airport-token.active")?.dataset.airport==="OIKM");
   await stalePage.locator('.procedure-category[data-category="AIRPORT"]').click();
   await stalePage.waitForFunction(()=>document.querySelectorAll(".procedure-token").length>=1,{timeout:20000});
   await stalePage.waitForFunction(()=>document.querySelector("#miniChartImage")?.naturalWidth>100
      && !document.querySelector("#miniChartImage")?.hidden,{timeout:16000});
   assert.ok(!staleErrors.some(x=>x.includes("null")||x.includes("TypeError")),
     "Stale HTML / new JS mismatch: "+staleErrors.join("; "));
   console.log("PASS mixed-version R13 regression: cached old HTML, new JS, OIKM chart list and image preview");
   await stalePage.close();
   assert.ok(errors.filter(x=>/ReferenceError|SyntaxError|TypeError|404/.test(x)).length===0,errors.join("; "));
   console.log("PASS METAR: original raw report in airport profile, no automatic Classic popup");
   console.log("PASS R13 profile switch: absent chart shows profile, JPEG/Classic hides, finger swipe reveals every intermediate ICAO, closing chart restores");
   console.log("PASS FINAL R13 FIXED: fresh URL 78 airports, real JPEG, no PDF swipe, iPad geometry, Classic tap, cached old HTML resilient");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(err=>{console.error(err);process.exitCode=1});