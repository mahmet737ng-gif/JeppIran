"use strict";
/* Chrome smoke test for the isolated airport carousel preview.
   Protects against the previous bug: remounting text on every swipe frame. */
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const path=require("node:path");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const port=18654;
const url="http://127.0.0.1:"+port+"/preview/airport-carousel-r2/";
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
  await page.route("**/data/charts-manifest.json",async route=>{await new Promise(r=>setTimeout(r,850));return route.fulfill({
   contentType:"application/json",body:JSON.stringify({airports:Object.fromEntries(codes.map(c=>[c,c==="OIII"?{
     file:"OIII.pdf",global_pages:[101,102,103,104,105]
   }:{file:c+".pdf",global_pages:[]}]))})
  })});
  await page.route("**/data/charts-current.json",route=>route.fulfill({
    contentType:"application/json",body:JSON.stringify([
      {page:101,airport:"OIII",category:"STAR",chart_number:"10-2",name:"RNAV Arrival",pdf_page:1},
      {page:102,airport:"OIII",category:"SID",chart_number:"10-3",name:"SID Departure",pdf_page:2},
      {page:103,airport:"OIII",category:"STAR",chart_number:"10-2A",name:"Conventional Arrival",pdf_page:3},
      {page:104,airport:"OIII",category:"Airport",chart_number:"10-9",name:"Airport Diagram",pdf_page:4},
      {page:105,airport:"OIII",category:"Approach",chart_number:"11-1",name:"ILS RWY 29L",pdf_page:5}
    ])
  }));
  await page.route("**/data/airport-profiles.json",route=>route.fulfill({
   contentType:"application/json",body:JSON.stringify({airports:{
    OIII:{iata:"THR",name:"Mehrabad International Airport",city:"Tehran",country:"Iran",elevation:3962},
    OIIE:{iata:"IKA",name:"Imam Khomeini International Airport",city:"Tehran",country:"Iran"}
   }})
  }));
  await page.route("**/wx-live.json*",route=>route.abort());
  await page.goto(url,{waitUntil:"domcontentloaded"});
  // Regression: the visual selector and dock must appear immediately while
  // the airport manifest is still waiting on the network.
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length>=9);
  const instant=await page.evaluate(()=>({
    count:document.querySelectorAll(".airport-token").length,
    active:document.querySelector(".airport-token.active")?.dataset.airport,
    poster:getComputedStyle(document.querySelector(".scenery")).backgroundImage,
    hasDock:document.querySelectorAll(".chart-dock-button").length===4,
    hasOldButton:Boolean(document.querySelector("#showCharts"))
  }));
  assert.equal(instant.active,"OIII");
  assert.ok(instant.poster.includes("OIII.webp"),"OIII picture must be in CSS before JS/network completes");
  assert.equal(instant.hasDock,true);
  assert.equal(instant.hasOldButton,false,"stale Explore button must never be in R2 HTML");
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length===12);
  assert.equal(await page.locator(".airport-token.active").count(),1);
  assert.equal(await page.locator(".airport-token.active").getAttribute("data-airport"),"OIII");
  const data=await page.evaluate(()=>{
    const buttons=[...document.querySelectorAll(".airport-token")];
    buttons.forEach((b,i)=>b.dataset.qa=String(i));
    return {count:buttons.length,ids:buttons.map(b=>b.dataset.airport)};
  });
  assert.equal(data.count,codes.length);
  // The thin four-category dock stays independent from the spinning airport names.
  assert.equal(await page.locator(".chart-dock-button").count(),4);
  assert.equal(await page.locator("#chartSheet").getAttribute("aria-hidden"),"true");
  await page.locator('.chart-dock-button[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".sheet-chart-link").length===2);
  assert.equal(await page.locator("#chartSheet").getAttribute("aria-hidden"),"false");
  assert.equal(await page.locator(".chart-dock-button.active").textContent(),"STAR");
  assert.match(await page.locator(".sheet-chart-link").first().getAttribute("href"),/\/charts\/OIII\.pdf#page=1$/);
  await page.locator("#chartSearch").fill("RNAV");
  assert.equal(await page.locator(".sheet-chart-link").count(),1,"search filters only the active chart category");
  await page.locator('.chart-dock-button[data-category="SID"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".sheet-chart-link").length===1);
  assert.match(await page.locator(".sheet-chart-link").first().getAttribute("href"),/#page=2$/);
  for(const [cat,pageNo] of [["AIRPORT",4],["APP",5]]){
    await page.locator('.chart-dock-button[data-category="'+cat+'"]').click();
    await page.waitForFunction(()=>document.querySelectorAll(".sheet-chart-link").length===1);
    assert.match(await page.locator(".sheet-chart-link").first().getAttribute("href"),new RegExp("#page="+pageNo+"$"));
  }
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#chartSheet").getAttribute("aria-hidden"),"true","Escape closes bottom chart selector");
  assert.equal(await page.locator("#chartSheetScrim").isHidden(),true);
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
  // Phone layout keeps the four tabs touchable and the bottom drawer within the viewport.
  await page.setViewportSize({width:390,height:844});
  await page.locator('.chart-dock-button[data-category="APP"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".sheet-chart-link").length===0
    ||document.querySelector("#chartSheetHeading")?.textContent==="APP charts");
  const mobile=await page.evaluate(()=>{
    const d=document.querySelector(".chart-dock").getBoundingClientRect();
    const s=document.querySelector("#chartSheet").getBoundingClientRect();
    return {dock:d.toJSON(),sheet:s.toJSON(),innerWidth};
  });
  assert.ok(mobile.dock.left>=0 && mobile.dock.right<=mobile.innerWidth,
    "chart dock must stay within narrow phone viewport");
  assert.ok(mobile.sheet.left>=0 && mobile.sheet.right<=mobile.innerWidth,
    "chart drawer must stay within narrow phone viewport");
  await page.locator("#closeChartSheet").click();
  assert.equal(await page.locator("#chartSheet").getAttribute("aria-hidden"),"true");
  assert.deepEqual(errors,[],"Chrome errors: "+errors.join("; "));
  console.log("PASS airport-carousel-r2 initial first paint and smooth interpolation, finger tracking, stable DOM, snap and photo-only background:",JSON.stringify(after));
 } finally{if(browser)await browser.close();server.kill("SIGTERM");}
})().catch(error=>{console.error(error);process.exitCode=1;});
