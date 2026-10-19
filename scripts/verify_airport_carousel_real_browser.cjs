"use strict";
// Unlike the previous fixture-only browser tests, this test runs AFTER the
// GitHub Pages build has produced real manifest, PDF, and PDF.js assets.
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const path=require("node:path");
const {chromium}=require("playwright");
const port=18927;
const base="http://127.0.0.1:"+port+"/preview/airport-carousel-r5/";
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
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   page.on("response",r=>{if(/charts-manifest|charts-current|\/charts\/OIII.pdf|vendor\/pdf/.test(r.url())&&r.status()>=400)errors.push(r.status()+" "+r.url())});
   await page.goto(base,{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>document.querySelector(".airport-token.active")?.dataset.airport==="OIII",{timeout:12000});
   const icaoBefore=await page.locator("#airportCarousel").boundingBox();
   const catBefore=await page.locator(".procedure-categories").boundingBox();
   assert.ok(catBefore.width<450,"Collapsed categories too wide: "+catBefore.width);
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
   await page.waitForFunction(()=>!document.querySelector("#miniChartCanvas").hidden||
     document.querySelector("#miniChartStatus").textContent.includes("unavailable"),{timeout:25000});
   const preview=await page.evaluate(()=>({loaded:!document.querySelector("#miniChartCanvas").hidden,
     status:document.querySelector("#miniChartStatus").textContent,
     canvas:document.querySelector("#miniChartCanvas").width+"x"+document.querySelector("#miniChartCanvas").height}));
   console.log("REAL PDF thumbnail status:",JSON.stringify(preview));
   assert.ok(preview.loaded,"Real PDF thumbnail failed "+JSON.stringify({preview,errors}));
   await page.locator("#procedureNext").click();
   await page.waitForFunction(()=>document.querySelector(".procedure-token.active")?.dataset.chartPage!=="394",{timeout:7000});
   assert.ok(await page.locator("#classicViewerHost").isHidden(),"Swipe opened Classic unexpectedly");
   await page.locator("#miniChartOpen").click();
   assert.ok(await page.locator("#classicViewerHost").isVisible(),"Tap did not open full chart");
   assert.ok(errors.filter(x=>/ReferenceError|SyntaxError|TypeError|404/.test(x)).length===0,errors.join("; "));
   console.log("PASS REAL R13: compact ICAO/category, expanded chart names visible, actual PDF.js thumbnail loaded, Classic on tap");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(err=>{console.error(err);process.exitCode=1});