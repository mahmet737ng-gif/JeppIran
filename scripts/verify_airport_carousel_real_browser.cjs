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
   const errors=[],pdfRequests=[];
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
   await page.locator("#procedureNext").click();
   await page.waitForFunction(()=>document.querySelector(".procedure-token.active")?.dataset.chartPage!=="394",{timeout:7000});
   assert.ok(await page.locator("#classicViewerHost").isHidden(),"Swipe opened Classic unexpectedly");
   await page.waitForFunction(()=>!document.querySelector("#miniChartImage").hidden &&
     document.querySelector("#miniChartImage").naturalWidth>100,{timeout:7000});
   assert.equal(pdfRequests.length,0,"Second thumbnail must not download the PDF");
   await page.locator("#miniChartOpen").click();
   assert.ok(await page.locator("#classicViewerHost").isVisible(),"Tap did not open full chart");
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
   assert.equal(await page.locator(".category-shell.active").count(),0,
     "Airport swipe must close stale chart category instead of opening another preview");
   await page.locator('.procedure-category[data-category="AIRPORT"]').click();
   await page.waitForFunction(()=>!document.querySelector("#miniChartPreview").hidden,{timeout:13000});
   assert.ok(await page.locator(".selected-airport").isHidden(),
     "Opening any new chart preview hides the profile again");
   await page.locator('.procedure-category[data-category="AIRPORT"]').click();
   assert.ok(await page.locator(".selected-airport").isVisible(),
     "Closing chart preview restores current airport profile");
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
   console.log("PASS R13 profile switch: absent chart shows profile, JPEG/Classic hides, finger swipe reveals every intermediate ICAO, closing chart restores");
   console.log("PASS FINAL R13 FIXED: fresh URL 78 airports, real JPEG, no PDF swipe, iPad geometry, Classic tap, cached old HTML resilient");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(err=>{console.error(err);process.exitCode=1});