"use strict";
/* Chrome regression for preview R3: second swipeable chart wheel, tabs under
 * ICAO, valid source pages, fast gesture, tap to expand/collapse, Classic opt-in. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const port=18655;
const base="http://127.0.0.1:"+port;
const url=base+"/preview/airport-carousel-r3/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const codes=["OIAA","OIAW","OIBB","OICC","OIIE","OIII","OIKB","OIKK","OIMM","OISS","OITT","OIYY"];
async function waitServer(){
 for(let i=0;i<65;i++){
  try{if((await fetch(url)).ok)return}catch(_){}
  await new Promise(r=>setTimeout(r,100));
 }
 throw Error("No local web server");
}
(async()=>{
 let browser;
 try{
  // Main app stays Classic unless the user explicitly changes the preference.
  const main=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
  assert.ok(main.includes('name="chartsLayoutMode" value="classic" checked'));
  assert.ok(main.includes('name="chartsLayoutMode" value="carousel"'));
  assert.ok(main.includes('localStorage.getItem(KEY)==="carousel"'));
  assert.ok(main.includes('data-route="charts"'));
  await waitServer();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"no-preference"});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/data/charts-manifest.json",async route=>{
   await new Promise(done=>setTimeout(done,350));
   await route.fulfill({contentType:"application/json",body:JSON.stringify({airports:
    Object.fromEntries(codes.map(c=>[c,{file:c+".pdf",global_pages:c==="OIII"?[101,102,103,104,105]:[]}]))})});
  });
  await page.route("**/data/charts-current.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify([
    {page:101,airport:"OIII",category:"STAR",chart_number:"10-2",name:"RNAV Arrival",pdf_page:1},
    {page:102,airport:"OIII",category:"SID",chart_number:"10-3",name:"SID Departure",pdf_page:2},
    {page:103,airport:"OIII",category:"STAR",chart_number:"10-2A",name:"Conventional Arrival",pdf_page:3},
    {page:104,airport:"OIII",category:"Airport",chart_number:"10-9",name:"Airport Diagram",pdf_page:4},
    {page:105,airport:"OIII",category:"Approach",chart_number:"11-1",name:"ILS RWY 29L",pdf_page:5}
   ])}));
  await page.route("**/data/airport-profiles.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({airports:{
    OIII:{iata:"THR",name:"Mehrabad International Airport",city:"Tehran",country:"Iran",elevation:3962},
    OIIE:{iata:"IKA",name:"Imam Khomeini International Airport",city:"Tehran",country:"Iran"}
  }})}));
  await page.route("**/wx-live.json*",route=>route.abort());
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length===12);
  assert.equal(await page.locator(".airport-token.active").getAttribute("data-airport"),"OIII");
  assert.equal(await page.locator(".procedure-category").count(),4);
  assert.equal(await page.locator("#chartDock").count(),0,"old fixed bottom dock gone");
  const first=await page.evaluate(()=>({
    category:document.querySelector(".procedure-zone").getBoundingClientRect().top,
    wheel:document.querySelector("#airportCarousel").getBoundingClientRect().bottom
  }));
  assert.ok(first.category>=first.wheel-25 && first.category<first.wheel+45,"categories directly below airport wheel");
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===2);
  assert.equal(await page.locator("#procedureDetails").getAttribute("aria-hidden"),"false");
  assert.equal(await page.locator(".procedure-token.active").getAttribute("data-chart-page"),"101");
  assert.match(await page.locator("#openSelectedProcedure").getAttribute("href"),/\/charts\/OIII\.pdf#page=1$/);
  // A side chart is a focusable choice; its first tap centers, second opens.
  await page.locator('.procedure-token[data-chart-page="103"]').click();
  await page.waitForTimeout(730);
  assert.equal(await page.locator(".procedure-token.active").getAttribute("data-chart-page"),"103");
  assert.match(await page.locator("#openSelectedProcedure").getAttribute("href"),/#page=3$/);
  // Swipe physically and verify track elements are not unmounted.
  await page.evaluate(()=>document.querySelectorAll(".procedure-token").forEach((b,i)=>b.dataset.identity="stable"+i));
  const rect=await page.locator("#procedureWheel").boundingBox();
  let x=rect.x+rect.width/2,y=rect.y+rect.height/2;
  await page.mouse.move(x,y);await page.mouse.down();
  for(let i=1;i<=12;i++){await page.mouse.move(x-i*13,y);await page.waitForTimeout(8)}
  const stable=await page.evaluate(()=>[...document.querySelectorAll(".procedure-token")].every((b,i)=>b.dataset.identity==="stable"+i));
  assert.ok(stable,"chart buttons stay mounted during high-speed swipe");
  await page.mouse.up();await page.waitForTimeout(790);
  assert.equal(await page.locator(".procedure-token.active").count(),1);
  await page.locator("#procedureSearch").fill("RNAV");
  assert.equal(await page.locator(".procedure-token").count(),1);
  assert.equal(await page.locator(".procedure-token").first().getAttribute("data-chart-page"),"101");
  await page.locator('.procedure-category[data-category="SID"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===1);
  assert.match(await page.locator("#openSelectedProcedure").getAttribute("href"),/#page=2$/);
  for(const [category,expected] of [["AIRPORT",4],["APP",5]]){
    await page.locator('.procedure-category[data-category="'+category+'"]').click();
    await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===1);
    assert.match(await page.locator("#openSelectedProcedure").getAttribute("href"),new RegExp("#page="+expected+"$"));
  }
  // Tapping expanded category collapses; switching category expands the next.
  await page.locator('.procedure-category[data-category="APP"]').click();
  assert.equal(await page.locator("#procedureDetails").getAttribute("aria-hidden"),"true");
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===2);
  await page.keyboard.press("Escape");
  assert.equal(await page.locator("#procedureDetails").getAttribute("aria-hidden"),"true");
  await page.setViewportSize({width:390,height:844});
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===2);
  const mobile=await page.evaluate(()=>({
    tabs:document.querySelector(".procedure-categories").getBoundingClientRect().toJSON(),
    chart:document.querySelector(".procedure-wheel").getBoundingClientRect().toJSON(),w:innerWidth
  }));
  assert.ok(mobile.tabs.left>=0&&mobile.tabs.right<=mobile.w,"tabs fit phone screen");
  assert.ok(mobile.chart.left>=0&&mobile.chart.right<=mobile.w,"chart wheel fits phone screen");
  assert.deepEqual(errors,[],"Browser runtime errors: "+errors.join("; "));
  console.log("PASS carousel-R3: category tabs below ICAO, chart-wheel swipe, side tap, expand/collapse, chart page identity, search, mobile, Classic opt-in");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(e=>{console.error(e);process.exitCode=1});
