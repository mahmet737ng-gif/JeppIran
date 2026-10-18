"use strict";
/* Android carousel QA: original Classic viewer is embedded and airport
   wheel collapses to a narrow pinned top band ONLY after chart selection. */
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,".."),port=18659;
const url="http://127.0.0.1:"+port+"/preview/airport-carousel-r5/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
async function ready(){
 for(let i=0;i<60;i++){try{if((await fetch(url)).ok)return}catch(_){}await new Promise(r=>setTimeout(r,140))}
 throw Error("Preview server did not start");
}
(async()=>{
 let browser;
 try{
  const local=fs.readFileSync(path.join(root,"app/src/main/java/com/tareghmsr/jeppiran/MobileWebActivity.kt"),"utf8");
  assert.match(local,/preview\/airport-carousel-r5\/index.html/);
  assert.match(local,/\.phoneqa/);
  assert.match(local,/WebViewAssetLoader/);
  const manifest=fs.readFileSync(path.join(root,"app/src/main/AndroidManifest.xml"),"utf8");
  assert.match(manifest,/JeppIran Carousel QA/);
  const build=fs.readFileSync(path.join(root,"app/build.gradle.kts"),"utf8");
  assert.match(build,/com\.tareghmsr\.jeppiran\.phoneqa/);
  await ready();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:"block"});
  const errors=[];page.on("pageerror",e=>errors.push(e.message));
  const codes=["OIAA","OIAW","OIBB","OICC","OIIE","OIII","OIKB","OIKK","OIMM","OISS","OITT","OIYY"];
  await page.route("**/data/charts-manifest.json",r=>r.fulfill({contentType:"application/json",body:JSON.stringify({airports:Object.fromEntries(codes.map(icao=>[icao,{file:icao+".pdf",global_pages:icao==="OIII"?[101,102,103]:[]}]))})}));
  await page.route("**/data/charts-current.json",r=>r.fulfill({contentType:"application/json",body:JSON.stringify([
    {page:101,airport:"OIII",category:"STAR",chart_number:"10-2",name:"RNAV Arrival",pdf_page:1},
    {page:102,airport:"OIII",category:"SID",chart_number:"10-3",name:"SID Departure",pdf_page:2},
    {page:103,airport:"OIII",category:"STAR",chart_number:"10-2A",name:"Conventional Arrival",pdf_page:3}
  ])}));
  await page.route("**/data/airport-profiles.json",r=>r.fulfill({contentType:"application/json",body:JSON.stringify({airports:{OIII:{iata:"THR",name:"Mehrabad International Airport",city:"Tehran",country:"Iran",elevation:3962}}})}));
  await page.route("**/wx-live.json*",r=>r.abort());
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length===12);
  const expanded=await page.locator(".carousel-region").evaluate(el=>el.getBoundingClientRect().height);
  assert.equal(await page.locator("#airportName").isVisible(),true);
  assert.equal(await page.locator("body").evaluate(el=>el.classList.contains("chart-selected")),false);
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.body.classList.contains("chart-selected"));
  // Compact transition is deliberately animated; measure AFTER it settles.
  await page.waitForTimeout(450);
  const geometry=await page.evaluate(()=>({
    airport:document.querySelector(".carousel-region").getBoundingClientRect().toJSON(),
    viewer:document.querySelector("#classicViewerHost").getBoundingClientRect().toJSON(),
    header:document.querySelector(".topline").getBoundingClientRect().toJSON(),
    bodyHeight:document.body.scrollHeight,windowHeight:innerHeight,
    pdfSrc:document.querySelector("#classicViewerFrame").getAttribute("src")
  }));
  assert.ok(geometry.airport.height<expanded*.75,JSON.stringify({expanded,geometry}));
  assert.ok(geometry.airport.top<100,"Compact airport bar must move near top");
  assert.ok(geometry.viewer.height>230,"Real chart viewer gets remaining screen");
  assert.match(geometry.pdfSrc,/index\.html\?jeppiranEmbedCharts=1#charts/,"Use explicit index.html for Android AssetLoader");
  assert.equal(await page.locator("#airportName").isVisible(),false);
  assert.equal(await page.locator("#classicViewerHost").isVisible(),true);
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForTimeout(450);
  assert.equal(await page.locator("#airportName").isVisible(),true);
  assert.equal(await page.locator("#classicViewerHost").isHidden(),true);
  const restored=await page.locator(".carousel-region").evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(restored>geometry.airport.height*1.25);
  assert.deepEqual(errors,[],"Runtime errors: "+errors.join("; "));
  console.log("PASS Android QA compact: full-size airport selector -> selected chart -> compact at top + embedded original viewer -> restore, local APK origin");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(error=>{console.error(error);process.exitCode=1});
