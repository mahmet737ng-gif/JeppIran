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
  await page.waitForFunction(()=>document.getElementById("zoomValue")?.textContent==="80%",null,{timeout:60000});
  assert.equal(await page.evaluate(()=>chartZoom),.8,"Opening a chart must default to 80% zoom");
  assert.equal(await page.locator("#zoomValue").innerText(),"80%","Zoom display must read 80%");
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
  assert.equal(await page.evaluate(()=>chartZoom),.8,"Swiping must open the next chart at 80%");
  const second=await page.locator("#viewerChart").innerText();
  assert.notEqual(second,first,"a completed swipe must select the adjacent PDF");
  await page.locator("#zoomInBtn").click();
  assert.ok(await page.evaluate(()=>chartZoom)>.8,"User zoom-in must remain available");
  await page.locator("#zoomResetBtn").click();
  assert.equal(await page.evaluate(()=>chartZoom),.8,"Reset zoom must return to 80%");
  console.log("PASS default/reset 80% zoom, matching swipe-preview scale, reversible navigation and retained zoom control.");
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
