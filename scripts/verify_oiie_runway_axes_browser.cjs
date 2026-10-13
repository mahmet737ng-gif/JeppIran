/* Real Chrome E2E: original OIIE runway axes are visible, stand accesses fail closed.
 * Execute during Pages workflow after OIIE charts & QA JSON are generated.
 */
"use strict";
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const PORT=38286,base="http://127.0.0.1:"+PORT+"/";
const server=spawn("python3",["-m","http.server",String(PORT),"--bind","127.0.0.1","--directory","web"],{
 cwd:require("node:path").resolve(__dirname,".."),stdio:"ignore"
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitServer(){
 for(let i=0;i<80;i++){
  try{if((await fetch(base)).ok)return;}catch(_){}
  await pause(150);
 }
 throw Error("Local JEPPIRAN server did not start");
}
(async()=>{
 let browser;
 try{
  await waitServer();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{
   executablePath:process.env.JEPPIRAN_CHROME_BIN
  }:{})});
  const page=await browser.newPage({viewport:{width:1280,height:920}});
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof selectAirport==="function"&&typeof selectChart==="function"&&
    Array.isArray(charts)&&charts.some(c=>c.airport==="OIIE"&&Number(c.page)===380),null,{timeout:70000});
  await page.evaluate(()=>{
    selectAirport("OIIE");
    const c=charts.find(c=>c.airport==="OIIE"&&Number(c.page)===380);
    selectChart(c);
  });
  await page.locator("#chartTaxiBtn").click({timeout:20000});
  await page.locator("#taxiQaInput").waitFor({state:"visible",timeout:10000});
  assert.equal(await page.locator("#taxiQaToolsBtn").count(),0,"TOOLS dropdown must be removed");
  assert.equal(await page.locator("#taxiQaPanel").evaluate(el=>
    el.previousElementSibling?.classList.contains("viewer-toolbar")),true,
    "TAXI must be the second toolbar directly below the primary viewer toolbar");
  for(const id of ["#taxiQaGo","#taxiQaStartQuick","#taxiQaClearQuick","#taxiQaEnd"])
    assert.equal(await page.locator(id).isVisible(),true,id+" should be immediately accessible");
  for(const viewport of [{width:1280,height:920},{width:1024,height:768},{width:768,height:1024}]){
    await page.setViewportSize(viewport);
    const geometry=await page.evaluate(()=>{
      const bar=document.querySelector("#taxiQaPanel").getBoundingClientRect(),
        top=document.querySelector("#chartsView .viewer-toolbar").getBoundingClientRect();
      return {barLeft:bar.left,barRight:bar.right,barTop:bar.top,topBottom:top.bottom,
        visibleHeight:bar.height,screen:window.innerWidth};
    });
    assert.ok(geometry.barTop>=geometry.topBottom-2,
      "TAXI must be physically underneath toolbar "+JSON.stringify(viewport));
    assert.ok(geometry.barLeft>=-2&&geometry.barRight<=geometry.screen+2,
      "TAXI must fit portrait/landscape viewport "+JSON.stringify(viewport));
    assert.ok(geometry.visibleHeight>=36,"TAXI toolbar must be usable");
  }
  await page.setViewportSize({width:1280,height:920});

  await page.waitForFunction(()=>
    document.querySelector("#taxiQaStatus")?.textContent?.includes("OIIE Stage 4"),
    null,{timeout:25000});
  await page.locator("#taxiQaInput").fill("11L 29R");
  await page.locator("#taxiQaGo").click();
  await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").waitFor({
    state:"attached",timeout:10000});
  assert.match(await page.locator("#taxiQaStatus").innerText(),/OIIE RWY 11L/);
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),1);
  await page.locator("#chartTaxiBtn").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),false,"TAXI must toggle OFF");
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),1,
    "Closing sub-toolbar must not erase the runway-only chart path");
  await page.locator("#chartTaxiBtn").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),true,"TAXI must toggle ON");
  await page.locator("#taxiQaInput").fill("29R 11L");
  await page.locator("#taxiQaGo").click();
  assert.match(await page.locator("#taxiQaStatus").innerText(),/RWY 29R/);
  await page.locator("#taxiQaInput").fill("11R 29L");
  await page.locator("#taxiQaGo").click();
  assert.match(await page.locator("#taxiQaStatus").innerText(),/RWY 11R/);
  await page.locator("#taxiQaInput").fill("ST100 29R");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),1,
    "Rejected stand-to-runway request must leave the previous approved path visible");
  await page.locator("#taxiQaInput").fill("ST204 ST314");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),1,
    "Unverified Salam-to-Cargo path must not replace the existing plotted route");
  await page.locator("#taxiQaClearQuick").click();
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),0,
    "CLEAR removes the previously plotted path without hiding the sub-toolbar");
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),true);
  assert.match(await page.locator("#taxiQaStatus").innerText(),/Cleared/);
  await page.locator("#taxiQaInput").fill("ST204 ST314");
  await page.locator("#taxiQaGo").click();
  assert.match((await page.locator("#taxiQaStatus").innerText())+" "+(await page.locator("#taxiQaFullMessage").innerText()),/BOTH PUBLISHED STANDS FOUND/);
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),0);
  await page.locator("#taxiQaInput").fill("11L");
  await page.locator("#taxiQaGo").click();
  assert.match((await page.locator("#taxiQaStatus").innerText())+" "+(await page.locator("#taxiQaFullMessage").innerText()),/CURRENT POSITION/);
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),0);
  await page.locator("#taxiQaInput").fill("ST301");
  await page.locator("#taxiQaGo").click();
  assert.match((await page.locator("#taxiQaStatus").innerText())+" "+(await page.locator("#taxiQaFullMessage").innerText()),/INS coordinates in 20-9D conflict/);
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),0);
  await page.locator("#taxiQaInput").fill("ST400");
  await page.locator("#taxiQaGo").click();
  assert.match((await page.locator("#taxiQaStatus").innerText())+" "+(await page.locator("#taxiQaFullMessage").innerText()),/label-grid position/);
  assert.match(await page.locator("#taxiQaStatus").innerText(),/printed stand LABEL/);
  await page.locator("#taxiQaInput").fill("R1");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),0);
  await page.locator("#taxiQaInput").fill("11L 29R");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),1);
  await page.locator("#taxiQaEnd").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),false);
  assert.equal(await page.locator("polyline.taxi-oiie-physical-runway-axis-simulator-qa").count(),0);
  await page.locator("#chartTaxiBtn").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),true);
  await page.locator("#taxiQaInput").fill("ST301 ST314");
  await page.locator("#taxiQaGo").click();
  await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").waitFor({state:"attached",timeout:12000});
  assert.match(await page.locator("#taxiQaStatus").innerText(),/ORIGINAL-DRAWN CURVED PARKING LINES/);
  assert.equal(await page.evaluate(()=>Number(selectedChart?.page)),383);
  await page.locator("#chartTaxiBtn").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),false);
  assert.equal(await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").count(),1,
    "Cargo source QA route must remain on chart after TAXI closed");
  await page.locator("#chartTaxiBtn").click();
  await page.locator("#taxiQaInput").fill("ST204 ST208");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").count(),1);
  assert.match(await page.locator("#taxiQaStatus").innerText(),/SALAM/);
  await page.locator("#taxiQaInput").fill("ST204 ST314");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").count(),1,
    "Unreviewed cross-apron runway shortcut MUST NOT replace source-same-apron preview");
  await page.locator("#taxiQaClearQuick").click();
  assert.equal(await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").count(),0);
  await page.locator("#taxiQaEnd").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),false);
  await page.locator("#chartTaxiBtn").click();
  await page.locator("#taxiQaInput").fill("ST100 ST102");
  await page.locator("#taxiQaGo").click();
  await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").waitFor({state:"attached",timeout:12000});
  assert.equal(await page.evaluate(()=>Number(selectedChart?.page)),382);
  assert.match(await page.locator("#taxiQaStatus").innerText(),/PASSENGER/);
  await page.locator("#taxiQaInput").fill("ST403 ST405");
  await page.locator("#taxiQaGo").click();
  assert.equal(await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").count(),1,
    "Unresolved Passenger stand connections must not replace a valid printed curve preview");
  assert.match((await page.locator("#taxiQaStatus").innerText())+" "+(await page.locator("#taxiQaFullMessage").innerText()),/ROUTING UNAVAILABLE/);
  await page.locator("#taxiQaClearQuick").click();
  assert.equal(await page.locator("polyline.taxi-oiie-source-drawn-curve-qa-not-cleared").count(),0);
  await page.locator("#taxiQaEnd").click();
  assert.equal(await page.locator("#taxiQaPanel").isVisible(),false);
  console.log("PASS Chrome OIIE: Passenger 3422 source-curved preview candidates on page382 and unreviewed 403/405/407 fail closed.");
  console.log("PASS Chrome OIIE: 800 original Cargo/Salam same-apron SIM QA candidates, chart383, persistent overlay, cross-runway blocked, CLEAR/END lifecycle.");
  console.log("PASS Chrome: responsive second-toolbar, TAXI toggle keeps route, CLEAR/END delete route, and 11L↔29R/11R↔29L source geometry remains gated");
 }finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(error=>{console.error(error);process.exitCode=1});
