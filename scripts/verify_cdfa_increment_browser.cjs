"use strict";
const {chromium}=require("playwright"),{spawn}=require("node:child_process"),assert=require("node:assert/strict");
const port=38347,base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{stdio:"ignore"});
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
(async()=>{
 let browser;
 try{
  for(let i=0;i<60;i++){try{if((await fetch(base)).ok)break}catch(_){}
   if(i===59)throw Error("CDFA preview server unavailable");await sleep(200);}
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1100,height:850}});
  page.on("pageerror",e=>console.error(e.message));
  await page.goto(base+"cdfa-increment-preview.html",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelector("#jpCdfaSide .jp-cdfa-next-increment")&&
   document.querySelector("#next")?.textContent.includes("D"),null,{timeout:25000});
  const initial=await page.evaluate(()=>document.querySelectorAll("#jpCdfaSide .jp-cdfa-next-increment line").length);
  assert.equal(initial,4,"Two visible guides plus faint halos");
  const normalStroke=await page.evaluate(()=>getComputedStyle(
   document.querySelector("#jpCdfaSide .jp-inc-line:not(.jp-inc-halo)")).stroke);
  assert.equal(normalStroke,"rgb(255, 79, 160)","Normal chart guide must be pink");
  await page.locator("#previewInvertBtn").click();
  const invertedStroke=await page.evaluate(()=>getComputedStyle(
   document.querySelector("#jpCdfaSide .jp-inc-line:not(.jp-inc-halo)")).stroke);
  assert.equal(invertedStroke,"rgb(247, 203, 109)","INVERT chart guide retains yellow");
  await page.locator("#previewInvertBtn").click();
  assert.equal(await page.evaluate(()=>getComputedStyle(
   document.querySelector("#jpCdfaSide .jp-inc-line:not(.jp-inc-halo)")).stroke),
   "rgb(255, 79, 160)","Switching INVERT off restores pink");
  const before=await page.evaluate(()=>{const s=document.querySelector("#demoSlider");s.value="7.4";s.dispatchEvent(new Event("input",{bubbles:true}));
   const m=document.querySelector(".jp-cdfa-next-increment");return {dme:m.dataset.dme,top:m.style.transform};});
  assert.equal(before.dme,"7");
  const after=await page.evaluate(()=>{const s=document.querySelector("#demoSlider");s.value="6.8";s.dispatchEvent(new Event("input",{bubbles:true}));
   const m=document.querySelector(".jp-cdfa-next-increment");return {dme:m.dataset.dme,top:m.style.transform,
   transition:getComputedStyle(m).transition};});
  assert.equal(after.dme,"6");assert.notEqual(after.top,before.top);
  assert.match(after.transition,/730ms|0\.73s/);
  await page.locator("#play").click();
  await page.waitForFunction(()=>document.querySelector("#play")?.textContent.includes("PAUSE"),null,{timeout:4000});
  console.log("PASS: real Chrome preview, OIII CDFA catalogue, smooth next-increment D7 to D6, playback.");
 }finally{if(browser)await browser.close();server.kill("SIGTERM");}
})().catch(e=>{console.error(e);process.exitCode=1});
