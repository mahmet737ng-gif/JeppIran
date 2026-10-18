"use strict";
/* Chrome smoke test for the isolated airport carousel preview.
   Protects against the previous bug: remounting text on every swipe frame. */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const port=18653;
const url="http://127.0.0.1:"+port+"/preview/airport-carousel-r1/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{
 cwd:root,stdio:"ignore"
});
const codes=["OIAA","OIAW","OIBB","OICC","OIIE","OIII","OIKB","OIKK","OIMM","OISS","OITT","OIYY"];
async function ready(){
 for(let i=0;i<50;i++){
  try{const response=await fetch(url);if(response.ok)return;}catch(_){}
  await new Promise(r=>setTimeout(r,150));
 }
 throw Error("Preview local web server did not start");
}
(async()=>{
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,
   ...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"no-preference"});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/data/charts-manifest.json",route=>route.fulfill({
   contentType:"application/json",body:JSON.stringify({airports:Object.fromEntries(codes.map(c=>[c,{global_pages:[]}]))})
  }));
  await page.route("**/data/airport-profiles.json",route=>route.fulfill({
   contentType:"application/json",body:JSON.stringify({airports:{
    OIII:{iata:"THR",name:"Mehrabad International Airport",city:"Tehran",country:"Iran",elevation:3962},
    OIIE:{iata:"IKA",name:"Imam Khomeini International Airport",city:"Tehran",country:"Iran"}
   }})
  }));
  await page.route("**/wx-live.json*",route=>route.abort());
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length===12);
  assert.equal(await page.locator(".airport-token.active").count(),1);
  assert.equal(await page.locator(".airport-token.active").getAttribute("data-airport"),"OIII");
  const data=await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll(".airport-token")];
    buttons.forEach((b,i)=>b.dataset.qa=String(i));
    return {count:buttons.length,ids:buttons.map(b=>b.dataset.airport)};
  });
  assert.equal(data.count,codes.length);
  // A fast drag should paint several intermediate frames yet retain all nodes.
  const rect=await page.locator("#airportCarousel").boundingBox();
  let x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);
  await page.mouse.down();
  for(let i=1;i<=9;i++){
   await page.mouse.move(x-i*25,y,{steps:1});
   await page.waitForTimeout(10);
  }
  const during=await page.evaluate(()=>({
   nodes:[...document.querySelectorAll(".airport-token")].map(b=>b.dataset.qa),
   sizes:[...document.querySelectorAll(".airport-token")].filter(b=>b.style.visibility==="visible")
    .map(b=>Number.parseFloat(getComputedStyle(b.querySelector(".icao")).fontSize))
  }));
  assert.deepEqual(during.nodes,data.ids.map((_,i)=>String(i)),"swipe must retain stable DOM nodes");
  assert.ok(during.sizes.some(size=>size>28&&size<76),"during swipe, text size must interpolate");
  await page.mouse.up();
  await page.waitForTimeout(850);
  const after=await page.evaluate(()=>{
   const active=document.querySelector(".airport-token.active");
   const carousel=document.querySelector("#airportCarousel");
   const ar=active.getBoundingClientRect(),cr=carousel.getBoundingClientRect();
   return {centerError:Math.abs((ar.left+ar.right)/2-(cr.left+cr.right)/2),
    name:document.querySelector("#airportName").textContent,
    item:active.dataset.airport,
    persistent:[...document.querySelectorAll(".airport-token")].every((b,i)=>b.dataset.qa===String(i)),
    rgba:getComputedStyle(active).backgroundColor};
  });
  assert.ok(after.centerError<2,"selected code must snap exactly into center: "+JSON.stringify(after));
  assert.ok(after.persistent,"nodes changed after swipe");
  assert.notEqual(after.item,"OIII","a brisk swipe should change selected airport");
  assert.equal(after.rgba,"rgba(0, 0, 0, 0)","ICAO/IATA have no card backgrounds");
  assert.deepEqual(errors,[],"Chrome errors: "+errors.join("; "));
  console.log("PASS airport-carousel-r1 smooth interpolation, finger tracking, stable DOM, snap and photo-only background:",JSON.stringify(after));
 } finally{if(browser)await browser.close();server.kill("SIGTERM");}
})().catch(error=>{console.error(error);process.exitCode=1;});
