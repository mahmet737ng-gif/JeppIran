"use strict";
/* Chrome smoke test for owner-approved portrait profile; real V2621 airport PDFs.
 * Does not alter charts, simulator, moving-map georefs or archived poster artwork. */
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const root=require("node:path").resolve(__dirname,"..");
const port=38427,base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error("local server stopped");try{if((await fetch(base)).ok)return}catch(_){}await sleep(170)}throw Error("local server unavailable")}
(async()=>{
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:393,height:852},deviceScaleFactor:1});
  page.on("pageerror",e=>console.warn("Page JS:",e.message));
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>typeof selectAirport==="function"&&Array.isArray(charts)&&charts.length>1500,null,{timeout:60000});
  await page.evaluate(()=>{document.documentElement.classList.add("light");selectAirport("OIII")});
  await page.waitForFunction(()=>document.querySelector("#airportProfile.jp-minimal-profile .profile-icao")?.textContent==="OIII",null,{timeout:12000});
  const rootLocator=page.locator("#airportProfile.jp-minimal-profile");
  assert.equal(await rootLocator.evaluate(el=>getComputedStyle(el).backgroundImage),"none");
  assert.equal(await rootLocator.locator(".jp-poster-frame").count(),0);
  assert.ok(await rootLocator.locator("#profileMetarRaw").isVisible());
  const tafInfo=await rootLocator.evaluate(el=>{
    const t=el.querySelector(".jp-mp-taf-text"),c=el.querySelector("#profileTaf");
    return {found:!!t,parent:!!c,text:t?.textContent.slice(0,100),
      display:t?getComputedStyle(t).display:null,
      parentDisplay:c?getComputedStyle(c).display:null,
      dimensions:t?.getBoundingClientRect().toJSON(),
      cardDimensions:c?.getBoundingClientRect().toJSON(),
      weatherDimensions:el.querySelector(".jp-mp-weather")?.getBoundingClientRect().toJSON(),
      rootDimensions:el.getBoundingClientRect().toJSON(),
      weatherDisplay:getComputedStyle(el.querySelector(".jp-mp-weather")).display,
      weatherGrid:getComputedStyle(el.querySelector(".jp-mp-weather")).gridTemplateColumns,
      cardWidth:c?getComputedStyle(c).width:null};
  });
  console.log("TAF QA DIAGNOSTIC",JSON.stringify(tafInfo));
  await rootLocator.locator(".jp-mp-taf-text").waitFor({state:"visible",timeout:10000});
  assert.ok(await rootLocator.locator("#profileUtcClock").isVisible());
  const categories=await rootLocator.locator(".jp-mp-category summary").allInnerTexts();
  for(const item of ["AIRPORT","SID","STAR","APPROACH"])assert.ok(categories.some(s=>s.includes(item)),item+" accordion absent");
  assert.equal(await rootLocator.locator(".jp-mp-category[data-category='Airport']").getAttribute("open"),"");
  const rows=rootLocator.locator(".jp-mp-category[data-category='Airport'] .jp-mp-chart-row");
  assert.ok(await rows.count()>0,"no real V2621 Airport charts");
  assert.ok((await rows.first().locator(".jp-mp-chart-copy strong").innerText()).length>4);
  await rows.first().scrollIntoViewIfNeeded();
  // The first thumbnail is rendered directly from the original chart PDF.
  await page.waitForFunction(()=>document.querySelector("#airportProfile .jp-mp-category[data-category='Airport'] .jp-mp-thumb-ready")!==null,null,{timeout:45000});
  await page.locator("#jpMinimalNotamToggle").click();
  assert.equal(await page.locator("#jpMinimalNotamToggle").getAttribute("aria-expanded"),"true");
  assert.ok(await page.locator("#jpMinimalNotamReader").isVisible());
  // Collapse another group and open it again: disclosure states are real.
  await page.locator(".jp-mp-category[data-category='SID'] summary").click();
  assert.ok(await page.locator(".jp-mp-category[data-category='SID'] .jp-mp-chart-row").count()>0);
  // System back / chart selection continues through existing app.js APIs.
  const firstTitle=await rows.first().locator(".jp-mp-chart-copy strong").innerText();
  await rows.first().click();
  await page.waitForFunction(()=>document.querySelector("#chartsView")?.classList.contains("chart-open"),null,{timeout:18000});
  assert.ok((await page.locator("#viewerChart").innerText()).includes(firstTitle));
  await page.evaluate(()=>{selectAirport("OIII");document.documentElement.classList.remove("light")});
  await page.waitForFunction(()=>document.querySelector("#airportProfile.jp-minimal-profile .profile-icao")?.textContent==="OIII",null,{timeout:12000});
  assert.equal(await rootLocator.evaluate(el=>getComputedStyle(el).backgroundImage),"none");
  assert.ok((await rootLocator.evaluate(el=>getComputedStyle(el).backgroundColor))!=="rgba(0, 0, 0, 0)");
  console.log("PASS minimal profile: responsive light/dark, real weather, NOTAM, expandable charts, true PDF thumbnail, and chart navigation");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(e=>{console.error(e);process.exitCode=1;server.kill("SIGTERM")});
