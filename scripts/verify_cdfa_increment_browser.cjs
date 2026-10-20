"use strict";
const {chromium}=require("playwright"),{spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const port=38347,base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let browser;
 try{
  for(let i=0;i<60;i++){
   try{if((await fetch(base)).ok)break}catch(_){}
   if(i===59)throw Error("Local CDFA QA server unavailable");await sleep(200);
  }
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  page.on("pageerror",e=>console.error("Browser JS error",e.message));
  await page.goto(base+"?cdfa_increment_qa=1#charts",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof charts!=="undefined"&&charts.length>0,null,{timeout:90000});
  await page.evaluate(()=>{
   const c=charts.find(x=>Number(x.page)===438&&x.airport==="OIII");
   if(!c)throw Error("Missing OIII page 438");
   selectAirport("OIII");selectChart(c);
  });
  await page.waitForFunction(()=>document.querySelector("#pdfCanvas")?.width>100&&
   !document.querySelector("#chartCdfaBtn")?.disabled,null,{timeout:90000});
  await page.locator("#chartCdfaBtn").click();
  await sleep(1100);
  console.log("CDFA preview diagnostics",JSON.stringify(await page.evaluate(()=>({
    selected:typeof selectedChart!=="undefined"?{page:selectedChart?.page,icao:selectedChart?.airport}:null,
    panelHidden:document.querySelector("#jpCdfaSide")?.hidden,
    panelParent:document.querySelector("#jpCdfaSide")?.parentElement?.id,
    tableRows:document.querySelectorAll("#jpCdfaSide .jp-cdfa-table tbody tr").length,
    hasSvg:!!document.querySelector("#jpCdfaSide .jp-cdfa-vector"),
    hasMarker:!!document.querySelector("#jpCdfaSide .jp-cdfa-next-increment"),
    qaPanel:!!document.querySelector(".jp-cdfa-increment-qa"),
    qaPanelHidden:document.querySelector(".jp-cdfa-increment-qa")?.hidden,
    coreLoaded:!!window.JEPPIRAN_CDFA_NEXT_CORE,
    viewerButtonDisabled:document.querySelector("#chartCdfaBtn")?.disabled
  }))));

  await page.waitForFunction(()=>document.querySelector("#jpCdfaSide .jp-cdfa-next-increment")&&
   document.querySelector(".jp-cdfa-increment-qa:not([hidden])"),null,{timeout:25000});
  const initial=await page.evaluate(()=>document.querySelectorAll("#jpCdfaSide .jp-cdfa-table tbody tr").length);
  assert.ok(initial>6,"Original CDFA rows remain intact");
  const sample=await page.evaluate(()=>{
   const slider=document.querySelector(".jp-inc-slider");
   slider.value="7.4";slider.dispatchEvent(new Event("input",{bubbles:true}));
   const m=document.querySelector(".jp-cdfa-next-increment");
   return {dme:m.dataset.dme,transform:m.style.transform};
  });
  assert.equal(sample.dme,"7");
  const later=await page.evaluate(()=>{
   const slider=document.querySelector(".jp-inc-slider");
   slider.value="6.8";slider.dispatchEvent(new Event("input",{bubbles:true}));
   const m=document.querySelector(".jp-cdfa-next-increment");
   return {dme:m.dataset.dme,transform:m.style.transform,transition:getComputedStyle(m).transition};
  });
  assert.equal(later.dme,"6");
  assert.notEqual(later.transform,sample.transform);
  assert.match(later.transition,/730ms|0\.73s/);
  assert.equal(await page.evaluate(()=>document.querySelectorAll("#jpCdfaSide .jp-cdfa-table tbody tr").length),initial);
  console.log("PASS: OIII 438, 2 moving lines, smooth D7 to D6, original CDFA rows unchanged.");
 }finally{if(browser)await browser.close();server.kill("SIGTERM");}
})().catch(error=>{console.error(error);process.exitCode=1});
