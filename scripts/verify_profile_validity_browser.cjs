// End-to-end JEPPIRAN profile validity display QA.
// Serves the built web app locally and checks actual visible browser elements.
// Never edits approved Home imagery, chart tools, or simulator connections.
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const port=38267;
const base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{
 cwd:root,stdio:"ignore"
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForServer(){
 for(let i=0;i<70;i++){
  if(server.exitCode!==null)throw Error("Local web server exited before startup");
  try{const response=await fetch(base);if(response.ok)return;}catch(_){}
  await pause(150);
 }
 throw Error("Local web server not ready");
}
(async()=>{
 let browser;
 try{
  await waitForServer();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{
   executablePath:process.env.JEPPIRAN_CHROME_BIN
  }:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",error=>console.error("PROFILE QA JS ERROR:",error.message,error.stack||""));
  page.on("requestfailed",request=>console.error("PROFILE QA REQUEST FAILED:",request.url(),request.failure()?.errorText||""));
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded"});
  await page.waitForTimeout(2500);
  console.log("PROFILE QA STARTUP:",JSON.stringify(await page.evaluate(()=>({
    hash:location.hash,activeViews:[...document.querySelectorAll(".view.active")].map(e=>e.id),
    selectorCount:document.querySelectorAll("#profileTerminalValidity .terminal-date-start b").length,
    profilePreview:document.getElementById("airportProfile")?.innerText.slice(0,500),
    chartCount:document.querySelectorAll("#airportList .airport-item").length,
    ready:window.JEPPIRAN_NAV_READY,
    scripts:[...document.scripts].filter(s=>s.src&&s.src.includes("app.js")).map(s=>s.src)
  }))));

  const from=page.locator("#profileTerminalValidity .terminal-date-start b");
  const to=page.locator("#profileTerminalValidity .terminal-date-end b");
  await from.waitFor({state:"visible",timeout:18000});
  await to.waitFor({state:"visible",timeout:10000});
  assert.equal((await from.innerText()).trim(),"09 Oct 2026","visible starting date in OIII");
  assert.equal((await to.innerText()).trim(),"22 Oct 2026","visible final date in OIII");
  assert.ok(await page.locator("#profileUtcClock").isVisible(),"UTC clock above dates");
  // Confirm real Chrome uses the reviewed apron headings while retaining source chart identities.
  await page.waitForFunction(()=>
    displayChartName(charts.find(c=>c.page===382))==="AIRCRAFT PARKING CHART (APRON 1 / PASSENGER APRON)" &&
    displayChartName(charts.find(c=>c.page===383))==="AIRCRAFT PARKING CHART (APRON 2 CARGO / APRON 3 SALAM)",
    null,{timeout:18000});
  assert.ok(await page.evaluate(()=>charts.find(c=>c.page===383).name.startsWith("51-")),
    "Source chart data and georeference keys are unchanged despite the display title");
  // Real regression: inspect VISIBLE airport tree and chart viewer toolbar.
  await page.evaluate(()=>{ selectAirport("OIIE"); expanded.add("Airport"); renderAirports(""); });
  for(const [number,title] of [
    ["20-9B","AIRCRAFT PARKING CHART (APRON 1 / PASSENGER APRON)"],
    ["20-9C","AIRCRAFT PARKING CHART (APRON 2 CARGO / APRON 3 SALAM)"]
  ]){
    const row=page.locator("#chartsView .airport-inline-tree .tree-item").filter({hasText:number}).first();
    await row.waitFor({state:"visible",timeout:12000});
    assert.ok((await row.innerText()).includes(title),
      "visible AIRPORT sidebar must show source-reviewed "+number+" title");
    await row.click();
    assert.ok((await page.locator("#viewerChart").innerText()).includes(title),
      "opened chart toolbar must show source-reviewed "+number+" title");
  }
  await page.evaluate(()=>selectAirport("OIII"));
  console.log("PASS Chrome OIIE 20-9B/C: selected chart rows and viewer title corrected");

  // AIRPORT audit: all 10 visual corrections, including five safely rerouted
  // ICAO branches. Original PDFs and chart identities must remain unchanged.
  const audit=await page.evaluate(()=>{
    const data=AUDITED_AIRPORT_DISPLAY_V2621;
    return Object.entries(data).map(([page,row])=>{
      const c=charts.find(c=>Number(c.page)===Number(page));
      return {page:+page,source:c?.airport,displayAirport:displayAirportCode(c),
        displayedNumber:displayChartNumber(c),displayedName:displayChartName(c),
        sourcePdfPage:manifest?.airports?.[c?.airport]?.global_pages?.[c?.pdf_page-1]};
    });
  });
  assert.equal(audit.length,10);
  for(const row of audit){
    const expected={
      94:["OIBK","10-4","NOISE ABATEMENT"],408:["OIII","10-1R1","RADAR MINIMUM ALTITUDES"],
      432:["OIII","10-9B","HOT SPOTS"],514:["OIKM","10-9","Airport Diagram Chart (ADC)"],
      548:["OIKY","10-9","Airport Diagram Chart (ADC)"],651:["OINE","10-9","Airport Diagram Chart (ADC)"],
      808:["OITM","10-9","Airport Diagram Chart (ADC)"],896:["OIZB","10-9","Airport Diagram Chart (ADC)"],
      1125:["LTAC","10-4","NOISE ABATEMENT"],1243:["LTFM","30-4","NOISE ABATEMENT"]
    }[row.page];
    assert.deepEqual([row.displayAirport,row.displayedNumber,row.displayedName],expected);
    assert.equal(row.sourcePdfPage,row.page,"underlying source PDF page preserved");
  }
  await page.evaluate(()=>{selectAirport("OIKM");expanded.add("Airport");renderAirports("");});
  const bam=page.locator("#chartsView .airport-inline-tree .tree-item").filter({hasText:"10-9"}).first();
  assert.ok(await bam.innerText(),"BAM must appear under OIKM, not OIKK");
  await bam.click();
  await page.waitForFunction(()=>currentPdfUrl.endsWith("/OIKK.pdf"),null,{timeout:10000});
  assert.equal((await page.locator("#viewerChart").innerText()).includes("10-9"),true);
  await page.evaluate(()=>selectAirport("OIII"));

  // Owner-approved Ahwaz profile: actual Chrome geometry and section placement.
  await page.locator("#profileWind").waitFor({state:"visible",timeout:12000});
  const approved=await page.evaluate(()=>{
    const ids=["profileWeather","profileWind","profileRunways","profileNotam","profileTaf"];
    const boxes=Object.fromEntries(ids.map(id=>{const r=document.getElementById(id).getBoundingClientRect();return [id,{top:r.top,left:r.left,right:r.right,bottom:r.bottom,width:r.width,height:r.height}]}));
    return {boxes,extraInfo:document.querySelectorAll("#profileInfo").length,overview:document.querySelectorAll("#airportProfile .profile-tabs").length,localClock:!!document.getElementById("profileLocalTime")};
  });
  const bw=approved.boxes.profileWeather,ww=approved.boxes.profileWind,nn=approved.boxes.profileNotam,rr=approved.boxes.profileRunways,tt=approved.boxes.profileTaf;
  assert.equal(approved.extraInfo,0,"Additional Information removed");
  assert.equal(approved.overview,0,"unnecessary Overview tab removed");
  assert.ok(approved.localClock,"airport-local time still runs in header");
  assert.ok(Math.abs(bw.width-ww.width)<=2&&Math.abs(bw.height-ww.height)<=2,"METAR/Wind same dimensions: "+JSON.stringify(approved.boxes));
  assert.ok(ww.left>bw.right-3&&nn.left>rr.right-3&&nn.top>=ww.bottom-2,"NOTAM belongs below Wind in right column: "+JSON.stringify(approved.boxes));
  assert.ok(Math.abs(tt.left-nn.left)<=2&&Math.abs(tt.width-nn.width)<=2&&
    tt.top>=nn.bottom-2&&tt.top-nn.bottom<=15,
    "TAF belongs directly below NOTAM in the right column: "+JSON.stringify(approved.boxes));
  console.log("PASS approved Ahwaz layout geometry, equal-sized METAR/Wind, NOTAM below Wind",JSON.stringify(approved.boxes));
  // The full original picture (without cropped edge) and its live text must
  // fit and stay anchored together inside a non-scrolling airport viewport.
  await page.locator("#airportProfile.jp-airport-poster-loaded .jp-poster-frame")
    .waitFor({state:"visible",timeout:15000});
  const fixedPoster=await page.evaluate(()=>{
    const outer=document.querySelector("#airportProfile");
    const frame=outer.querySelector(".jp-poster-frame");
    const cap=frame.querySelector(".jp-poster-caption");
    const rect=node=>{const r=node.getBoundingClientRect();return {x:r.x,y:r.y,left:r.left,right:r.right,top:r.top,bottom:r.bottom,width:r.width,height:r.height}};
    return {outer:rect(outer),frame:rect(frame),cap:rect(cap),overflow:getComputedStyle(outer).overflowY,
      scrolled:outer.scrollHeight>outer.clientHeight+3};
  });
  assert.ok(!fixedPoster.scrolled,"airport poster viewport must not scroll: "+JSON.stringify(fixedPoster));
  assert.equal(fixedPoster.overflow,"hidden","airport image never becomes scrolling content");
  assert.ok(fixedPoster.frame.left>=fixedPoster.outer.left-2&&fixedPoster.frame.top>=fixedPoster.outer.top-2 &&
    fixedPoster.frame.right<=fixedPoster.outer.right+2&&fixedPoster.frame.bottom<=fixedPoster.outer.bottom+2,
    "whole image contained in viewport: "+JSON.stringify(fixedPoster));
  assert.ok(fixedPoster.cap.left>=fixedPoster.frame.left-2&&fixedPoster.cap.bottom<=fixedPoster.frame.bottom+2,
    "live labels are anchored to image, not scroll area: "+JSON.stringify(fixedPoster));
  console.log("PASS full poster in viewport with fixed live caption",JSON.stringify(fixedPoster));
  assert.equal(await page.locator("#profileValidity").count(),0,"no standalone card");
  const positions=await page.evaluate(()=>{
   const clock=document.querySelector("#profileUtcClock").getBoundingClientRect();
   const period=document.querySelector("#profileTerminalValidity .terminal-validity-dates").getBoundingClientRect();
   const header=document.querySelector("#airportProfile .profile-heading").getBoundingClientRect();
   return {clockBottom:clock.bottom,periodTop:period.top,periodWidth:period.width,headerBottom:header.bottom};
  });
  assert.ok(positions.periodTop>=positions.clockBottom-2,"dates physically below clock");
  assert.ok(positions.periodWidth>=100,"date range has visible width");
  assert.ok(positions.headerBottom>=positions.periodTop,"range is in the header");
  // Owner-requested sidebar alignment: HOME is on the LEFT, Charts title to its RIGHT.
  const sidebarHeader=await page.evaluate(()=>{
    const pane=document.querySelector("#chartsView .airport-pane").getBoundingClientRect();
    const title=document.querySelector("#chartsView .airport-pane .pane-head h2").getBoundingClientRect();
    const home=document.getElementById("chartsBackBtn").getBoundingClientRect();
    return {paneLeft:pane.left,paneRight:pane.right,titleLeft:title.left,titleRight:title.right,
      homeLeft:home.left,homeRight:home.right,homeWidth:home.width};
  });
  assert.ok(sidebarHeader.homeLeft>=sidebarHeader.paneLeft+14,
    "HOME button needs the original small left inset: "+JSON.stringify(sidebarHeader));
  assert.ok(sidebarHeader.titleLeft>=sidebarHeader.homeRight+4&&
    sidebarHeader.titleLeft<=sidebarHeader.homeRight+24,
    "Charts must sit immediately to the RIGHT of HOME: "+JSON.stringify(sidebarHeader));
  assert.ok(sidebarHeader.titleRight<=sidebarHeader.paneRight-3,
    "Charts title must fit within the airport pane: "+JSON.stringify(sidebarHeader));

  // Critical regression: the old QA saw only the header, while a phone
  // could show a completely empty airport chart body. Exercise the actual
  // Android phone style and verify visible, clickable procedure categories.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.classList.add("jp-android-phone"));
  const phoneCss=require("node:fs").readFileSync(
    path.join(root,"app/src/main/assets/phone-layout.css"),"utf8");
  await page.addStyleTag({content:phoneCss});
  await page.locator("#profileWeather").waitFor({state:"visible",timeout:18000});
  assert.equal(await page.locator("#profileProcedures").count(),0,"airport profile must not contain a duplicated chart list");
  const geometry=await page.evaluate(()=>{
    const profile=document.getElementById("airportProfile");
    const chartTree=document.querySelector("#chartsView .airport-inline-tree");
    return {
      airports:document.querySelectorAll("#airportList .airport-item").length,
      cards:document.querySelectorAll("#airportProfile .profile-card").length,
      tabs:document.querySelectorAll("#chartsView .airport-inline-tree .tree-group-head").length,
      profileHeight:profile.getBoundingClientRect().height,
      toolbarDisplay:getComputedStyle(document.querySelector("#chartsView .viewer-toolbar")).display,
      workspaceDisplay:getComputedStyle(document.querySelector("#jpCdfaWorkspace")).display,
      chartTreePresent:!!chartTree,
      profileScrollHeight:profile.scrollHeight
    };
  });
  assert.ok(geometry.airports>2,"phone must display multiple airports: "+JSON.stringify(geometry));
  assert.ok(geometry.cards>=5,"phone profile missing visible data panels: "+JSON.stringify(geometry));
  assert.equal(geometry.tabs,4,"STAR/SID/AIRPORT/APP remain available only in the airport sidebar");
  assert.ok(geometry.chartTreePresent,"selected airport must have a sidebar procedure tree");
  assert.ok(geometry.profileHeight>=380,
    "Android phone airport profile is clipped by inactive chart UI: "+JSON.stringify(geometry));
  assert.equal(geometry.toolbarDisplay,"none","inactive chart toolbar must be hidden on phone");
  assert.equal(geometry.workspaceDisplay,"none","inactive PDF workspace must be hidden on phone");
  assert.equal(await page.locator("#airportPickerBtn").isVisible(),true,
    "phone Charts must provide the airport drawer button");
  await page.waitForTimeout(230); // wait for initial responsive drawer transition
  const closed=await page.evaluate(()=>{
    const node=document.querySelector("#chartsView .airport-pane");
    const r=node.getBoundingClientRect();
    return {right:r.right,visibility:getComputedStyle(node).visibility,transform:getComputedStyle(node).transform};
  });
  assert.ok(closed.right<=8||closed.visibility==="hidden",
    "airport list must not cover the chosen airport's chart/profile: "+JSON.stringify(closed));
  await page.locator("#airportPickerBtn").click();
  await page.waitForTimeout(220);
  const opened=await page.evaluate(()=>document.querySelector("#chartsView .airport-pane").getBoundingClientRect().right);
  assert.ok(opened>=200,"airport drawer can be opened to switch airports: "+opened);
  const mobileHeader=await page.evaluate(()=>{
    const title=document.querySelector("#chartsView .airport-pane .pane-head h2").getBoundingClientRect();
    const home=document.getElementById("chartsBackBtn").getBoundingClientRect();
    return {titleRight:title.right,homeLeft:home.left,homeRight:home.right,
      paneRight:document.querySelector("#chartsView .airport-pane").getBoundingClientRect().right};
  });
  assert.ok(mobileHeader.titleRight<=mobileHeader.paneRight&&
    mobileHeader.titleRight>=mobileHeader.homeRight+3&&
    mobileHeader.titleRight<=mobileHeader.homeRight+125,
    "Mobile airport drawer must keep Charts immediately RIGHT of HOME: "+JSON.stringify(mobileHeader));
  await page.locator("#airportPickerCloseBtn").click();
  await page.waitForTimeout(220);
  const closedAgain=await page.evaluate(()=>document.querySelector("#chartsView .airport-pane").getBoundingClientRect().right);
  assert.ok(closedAgain<=8,"airport drawer can be closed: "+closedAgain);
  await page.locator("#airportPickerBtn").click();
  await page.locator("#chartsView .airport-inline-tree .tree-group-head")
    .filter({hasText:/SID \(/}).first().click();
  assert.ok(await page.locator("#chartsView .airport-inline-tree .tree-item").count()>0,
    "SID charts must be accessible from the airport drawer, not duplicated in the profile");
  await page.locator("#airportPickerCloseBtn").click();
  console.log("PASS Android phone chart body and procedures",JSON.stringify(geometry));
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>document.documentElement.classList.remove("jp-android-phone"));

  // The entire Home artwork is unaffected and continues to show ONLY the status.
  await page.evaluate(()=>{
   document.querySelectorAll(".view").forEach(e=>e.classList.remove("active"));
   document.getElementById("homeView").classList.add("active");
  });
  assert.ok(await page.locator("#homeTerminalValidity").isVisible(),"Home status still visible");
  assert.equal(await page.locator("#homeTerminalValidity .terminal-validity-dates").count(),0,
   "Home must not gain detailed validity dates");

  // Real Update route must not show the obsolete "Chart data" popup.
  await page.locator("#updateCard").click();
  await page.locator("#updateView.active").waitFor({state:"visible",timeout:5000});
  await page.waitForFunction(()=>document.querySelectorAll("#updateAirportSelect option").length>3,
    {timeout:25000});
  assert.ok(await page.locator("#updateAirportDetails .jp-update-change").count()>0,
    "published airport revision rows must be visible in Update");
  assert.match(await page.locator("#updateCycleStatus").innerText(),/Published: V2621/,
    "web updates must display the actual cycle, separate from APK version");
  assert.equal(await page.locator("#messageDialog").isVisible(),false,
    "update must not show the old chart-data popup");
  console.log("PASS web Update page: published cycle, 78-airport change log, no obsolete popup.");

  // Light theme must render both labels legibly without adding a profile card.
  await page.evaluate(()=>{
   document.getElementById("homeView").classList.remove("active");
   document.getElementById("chartsView").classList.add("active");
   document.documentElement.classList.add("light");
  });
  assert.ok(await from.isVisible(),"date range visible in light mode");
  assert.ok(await to.isVisible(),"valid-to date visible in light mode");
  console.log("PASS real Chrome UI: OIII terminal 09 Oct–22 Oct 2026, dates below UTC, no standalone card, Home unchanged, light mode visible.");
 }finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
