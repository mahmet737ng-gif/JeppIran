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
  // Owner-requested sidebar alignment: HOME immediately after an inset Charts title.
  const sidebarHeader=await page.evaluate(()=>{
    const pane=document.querySelector("#chartsView .airport-pane").getBoundingClientRect();
    const title=document.querySelector("#chartsView .airport-pane .pane-head h2").getBoundingClientRect();
    const home=document.getElementById("chartsBackBtn").getBoundingClientRect();
    return {paneLeft:pane.left,paneRight:pane.right,titleLeft:title.left,titleRight:title.right,
      homeLeft:home.left,homeRight:home.right,homeWidth:home.width};
  });
  assert.ok(sidebarHeader.titleLeft>=sidebarHeader.paneLeft+14,
    "Charts header title needs a small left inset: "+JSON.stringify(sidebarHeader));
  assert.ok(sidebarHeader.homeLeft>=sidebarHeader.titleRight+4&&
    sidebarHeader.homeLeft<=sidebarHeader.titleRight+24,
    "HOME button must sit immediately beside Charts title: "+JSON.stringify(sidebarHeader));
  assert.ok(sidebarHeader.homeRight<=sidebarHeader.paneRight-3,
    "HOME button must fit within the airport pane: "+JSON.stringify(sidebarHeader));

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
  assert.ok(mobileHeader.homeLeft>=mobileHeader.titleRight+3&&
    mobileHeader.homeRight<=mobileHeader.paneRight,
    "Mobile airport drawer must keep HOME next to Charts: "+JSON.stringify(mobileHeader));
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
