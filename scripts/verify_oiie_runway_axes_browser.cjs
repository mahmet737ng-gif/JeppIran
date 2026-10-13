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
  console.log("PASS Chrome: responsive second-toolbar, TAXI toggle keeps route, CLEAR/END delete route, and 11L↔29R/11R↔29L source geometry remains gated");
 }finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(error=>{console.error(error);process.exitCode=1});
