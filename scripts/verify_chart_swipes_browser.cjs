// End-to-end interactive chart swipe regression in real Chromium.
// The release must not publish if a reversed swipe changes the chart.
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const port=38331,base="http://127.0.0.1:"+port+"/";
const child=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{stdio:"ignore"});
const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
(async()=>{
 let browser;
 try{
  for(let i=0;i<60;i++){
   try{if((await fetch(base)).ok)break}catch(_){}
   if(i===59)throw Error("Local QA server unavailable");
   await sleep(200);
  }
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{
   executablePath:process.env.JEPPIRAN_CHROME_BIN
  }:{})});
  const page=await browser.newPage({viewport:{width:1100,height:830}});
  page.on("pageerror",err=>console.error("Browser page error:",err.message));
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded"});
  await page.locator("#airportList .airport-item.selected").first().waitFor({timeout:85000});
  await page.evaluate(()=>{
   const airport=charts.filter(c=>c.airport==="OIII").sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
   if(airport.length<3)throw Error("Missing OIII chart samples");
   selectChart(airport[1],{keepTreeClosed:true});
  });
  await page.waitForFunction(()=>{
   const canvas=document.getElementById("pdfCanvas");
   return canvas&&canvas.width>150&&canvas.height>150;
  },null,{timeout:60000});
  // Canvas dimensions are assigned before its asynchronous PDF render finishes.
  // Wait for paintChartTransform() to update the visible zoom label.
  await page.waitForFunction(()=>document.getElementById("zoomValue")?.textContent==="100%",null,{timeout:60000});
  assert.equal(await page.evaluate(()=>chartZoom),1,"Opening a chart must fit at 100% zoom");
  assert.equal(await page.locator("#zoomValue").innerText(),"100%","Zoom display must read 100%");
  const first=await page.locator("#viewerChart").innerText();
  await page.waitForFunction(()=>chartSlidePreviews.size>0,null,{timeout:25000});
  await page.evaluate(()=>{
   const state=beginChartSwipe(1);
   if(!state)throw Error("No adjacent chart swipe");
  });
  await page.waitForFunction(()=>activeChartSlide?.ready,null,{timeout:25000});
  const drag=await page.evaluate(()=>{
   const state=activeChartSlide;
   updateChartSwipe(state,-state.width*.63,100,100);
   const moved=state.track.style.transform;
   updateChartSwipe(state,-state.width*.02,290,145);
   const reversed=state.track.style.transform;
   finishChartSwipe(state,false);
   return {moved,reversed};
  });
  assert.notEqual(drag.moved,drag.reversed,"preview must follow the reversing finger");
  await page.waitForFunction(()=>activeChartSlide===null,null,{timeout:3000});
  const afterCancel=await page.locator("#viewerChart").innerText();
  assert.equal(afterCancel,first,"reversing swipe back must retain the current chart");
  await page.evaluate(()=>{
   const state=beginChartSwipe(1);
   if(!state)throw Error("Second chart swipe unavailable");
  });
  await page.waitForFunction(()=>activeChartSlide?.ready,null,{timeout:15000});
  await page.evaluate(()=>{
   const state=activeChartSlide;
   updateChartSwipe(state,-state.width*.65,100,100);
   finishChartSwipe(state,false);
  });
  await page.waitForFunction(()=>activeChartSlide===null,null,{timeout:3000});
  await page.waitForFunction(first=>document.getElementById("viewerChart").textContent!==first,first,{timeout:16000});
  assert.equal(await page.evaluate(()=>chartZoom),1,"Swiping must open the next chart at 100%");
  const second=await page.locator("#viewerChart").innerText();
  assert.notEqual(second,first,"a completed swipe must select the adjacent PDF");
  await page.locator("#zoomInBtn").click();
  assert.ok(await page.evaluate(()=>chartZoom)>1,"User zoom-in must remain available");
  await page.locator("#zoomResetBtn").click();
  assert.equal(await page.evaluate(()=>chartZoom),1,"Reset zoom must return to 100%");
  console.log("PASS default/reset 100% zoom, matching swipe-preview scale, reversible navigation and retained zoom control.");

  // Vector-backed detail must sharpen after zoom without changing the PDF's
  // CSS dimensions (or the georeferenced position of existing overlays).
  const beforeZoom=await page.evaluate(()=>{
    const el=document.getElementById("pdfCanvas");
    return {pixels:el.width,cssWidth:el.clientWidth,cssHeight:el.clientHeight};
  });
  await page.evaluate(()=>setChartZoom(1.95));
  await page.waitForFunction(old=>document.getElementById("pdfCanvas")?.width>old,
    beforeZoom.pixels,{timeout:45000});
  const hiRes=await page.evaluate(()=>{
    const el=document.getElementById("pdfCanvas");
    return {pixels:el.width,cssWidth:el.clientWidth,cssHeight:el.clientHeight,
      zoom:chartZoom,quality:chartDetail.quality};
  });
  assert.equal(hiRes.cssWidth,beforeZoom.cssWidth,"Hi-res render cannot resize chart coordinates");
  assert.equal(hiRes.cssHeight,beforeZoom.cssHeight,"Hi-res render cannot resize PDF marker coordinates");
  assert.ok(hiRes.quality>1.6,"High zoom must request PDF-native extra detail");
  console.log("PASS vector PDF re-render after zoom without reflow or georeference drift",hiRes);

  // At 195% zoom, continue swiping PAST the actual panning edge to navigate.
  // A short edge reach or a deliberate finger reversal must not change charts.
  const edgeBefore=await page.evaluate(()=>{
    const max=chartHorizontalPanLimit().maxX;
    if(!chartHorizontalPanLimit().scrollable||max<60)throw Error("Zoomed chart has no horizontal pan range");
    chartPanX=max;chartPanY=0;applyChartTransform();
    const first=selectedChart.page;
    const canvas=document.getElementById("pdfCanvas");
    const fire=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{
      bubbles:true,pointerId:87,pointerType:"touch",isPrimary:true,clientX:x,clientY:420
    }));
    fire("pointerdown",510);
    fire("pointermove",700);
    if(!activeChartSlide?.edgePaging)throw Error("Edge continuation did not open preview");
    fire("pointermove",540);
    if(!activeChartSlide?.reversing)throw Error("Reversal did not cancel pending edge navigation");
    fire("pointerup",540);
    return first;
  });
  await page.waitForFunction(()=>activeChartSlide===null,null,{timeout:3500});
  assert.equal(await page.evaluate(()=>selectedChart.page),edgeBefore,
    "Reversing a zoomed edge swipe must retain the current chart");
  await page.evaluate(()=>{
    const canvas=document.getElementById("pdfCanvas");
    const fire=(type,x)=>canvas.dispatchEvent(new PointerEvent(type,{
      bubbles:true,pointerId:88,pointerType:"touch",isPrimary:true,clientX:x,clientY:420
    }));
    fire("pointerdown",510);
    fire("pointermove",745);
    if(!activeChartSlide?.edgePaging||Math.abs(activeChartSlide.dx)<48)
      throw Error("Long edge continuation failed to arm a chart transition");
    fire("pointerup",745);
  });
  await page.waitForFunction(()=>activeChartSlide===null,null,{timeout:3500});
  await page.waitForFunction(before=>selectedChart?.page!==before,edgeBefore,{timeout:20000});
  await page.waitForFunction(()=>chartZoom===1 && document.getElementById("zoomValue")?.textContent==="100%",null,{timeout:20000});
  assert.equal(await page.evaluate(()=>chartZoom),1,"Next chart opens at its fitted default zoom");
  console.log("PASS edge-only zoomed page navigation, reversed-swipe cancellation and 100% reset.");

  // Distinct toolbar BACK must restore the airport profile; Prev/Next must
  // continue navigating charts and Android system-Back behavior stays intact.
  const beforeBack=await page.evaluate(()=>({icao:selectedAirport,page:selectedChart?.page}));
  await page.locator("#chartReturnBtn").click();
  assert.equal(await page.locator("#chartsView").evaluate(el=>el.classList.contains("chart-open")),false,
    "Toolbar BACK closes chart to reveal the airport profile");
  assert.equal(await page.evaluate(()=>selectedAirport),beforeBack.icao);
  assert.equal(await page.evaluate(()=>selectedChart),null);
  await page.evaluate(pageNumber=>{
    const chart=charts.find(c=>Number(c.page)===pageNumber);
    if(!chart)throw Error("Original chart could not be reopened after BACK");
    selectChart(chart);
  },beforeBack.page);
  assert.equal(await page.locator("#chartsView").evaluate(el=>el.classList.contains("chart-open")),true);
  assert.equal(await page.locator("#chartReturnBtn").count(),1);
  // The BACK click leaves the Playwright cursor hovering over the new tile.
  // Compare raster frames at rest, never hover-highlighted BACK vs idle Prev.
  await page.mouse.move(900,720);
  const matchingMosaic=await page.evaluate(()=>{
    const back=document.querySelector("#chartReturnBtn");
    const prev=document.querySelector("#prevChartBtn");
    const a=getComputedStyle(back),b=getComputedStyle(prev);
    const backIcon=getComputedStyle(back.querySelector(".toolbar-art"));
    const prevIcon=getComputedStyle(prev.querySelector(".toolbar-art"));
    return {raster:back.classList.contains("raster-btn"),
      background:a.backgroundColor===b.backgroundColor,
      border:a.borderColor===b.borderColor,
      radius:a.borderRadius===b.borderRadius,
      iconImage:backIcon.backgroundImage===prevIcon.backgroundImage &&
        backIcon.backgroundImage.includes("toolbar-matte.png"),
      caption:back.querySelector(".toolbar-label")?.textContent?.trim()};
  });
  assert.deepEqual(matchingMosaic,{raster:true,background:true,border:true,radius:true,iconImage:true,caption:"BACK"},
    "BACK must match the approved mosaic buttons in Chrome");
  console.log("PASS separate toolbar BACK: chart → airport profile → chart.");

  // Android keeps HOME navigation in the Charts header (and closed-drawer profile),
  // but fullscreen remains clean; the system Back gesture still works.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.classList.add("jp-android-phone"));
  await page.addStyleTag({content:require("node:fs").readFileSync(
    require("node:path").join("app","src","main","assets","phone-layout.css"),"utf8")});
  assert.equal(await page.locator("#chartsBackBtn").count(),1,
    "Charts airport header retains the requested HOME control");
  assert.equal(await page.locator("#chartsBackMobileBtn").count(),1,
    "Phone profile retains a responsive HOME control");
  assert.equal(await page.locator("#chartsBackMobileBtn").isVisible(),false,
    "When a chart is open, no HOME button may cover its fullscreen workspace");
  assert.equal(await page.locator("#prevChartBtn").count(),1,
    "Keep the approved chart Prev/Next toolbar even when gestures are supported");
  assert.equal(await page.locator("#nextChartBtn").count(),1);
  await page.evaluate(()=>document.body.classList.add("viewer-fullscreen"));
  const movedBack=await page.evaluate(()=>window.jeppiranAndroidBack());
  assert.equal(movedBack,true,"Android Back gesture should exit chart to airport profile");
  const backState=await page.evaluate(()=>({
    open:document.getElementById("chartsView").classList.contains("chart-open"),
    full:document.body.classList.contains("viewer-fullscreen")
  }));
  assert.equal(backState.open,false,"Back gesture must return to the airport profile");
  assert.equal(backState.full,false,"Back gesture must exit full-screen");
  assert.equal(await page.evaluate(()=>window.jeppiranAndroidBack()),true,
    "Second Android Back gesture should return to Home");
  assert.equal(await page.locator("#homeView.active").isVisible(),true);
  console.log("PASS Android screen-edge Back: chart → profile → Home; Charts has HOME without a fullscreen overlay.");

 }finally{if(browser)await browser.close();child.kill("SIGTERM");}
})().catch(e=>{console.error(e);process.exitCode=1});
