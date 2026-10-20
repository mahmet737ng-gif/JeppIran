"use strict";
// Regressions observed on iPad landscape: OS status bar overlap, ICAO strip
// obscuring the opened chart, and Classic gestures not updating the outer rail.
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const fs=require("node:fs"),path=require("node:path"),assert=require("node:assert/strict");
const root=path.resolve(__dirname,".."),port=38371;
const base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],
  {cwd:root,stdio:"ignore"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){
 for(let i=0;i<100;i++){
  if(server.exitCode!==null)throw Error("Test server exited unexpectedly");
  try{if((await fetch(base)).ok)return}catch(_){}
  await delay(200);
 }
 throw Error("Server unavailable");
}
const screenshot=()=>{};
async function verifySelection(page,category,pageNumber){
 await page.waitForFunction(expected=>{
   const token=document.querySelector(".procedure-token.active");
   const cat=document.querySelector(".procedure-category.active");
   return cat?.dataset.category===expected.category&&
     Number(token?.dataset.chartPage)===expected.pageNumber&&
     document.body.classList.contains("chart-selected");
 },{category,pageNumber},{timeout:18000});
 assert.ok(await page.locator("#airportCarousel").isHidden(),
  "ICAO airport wheel should remain hidden during Classic navigation");
 assert.ok(await page.locator("#classicViewerHost").isVisible(),
  "Classic frame must remain visible through category transition");
}
(async()=>{
 let browser;
 try{
  await ready();
  const css=fs.readFileSync(path.join(root,"web/preview/airport-carousel-r13-fixed/styles.css"),"utf8");
  assert.match(css,/safe-area-inset-top/);
  assert.match(css,/@supports \(-webkit-touch-callout:none\)/);
  browser=await chromium.launch({headless:true,
    ...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1475,height:991},hasTouch:true,deviceScaleFactor:1});
  page.on("pageerror",e=>console.log("Browser JS error:",e.message));
  await page.goto(base+"preview/airport-carousel-r13-fixed/",{waitUntil:"domcontentloaded",timeout:35000});
  await page.locator("#airportSearch").fill("20-3H");
  await page.waitForFunction(()=>
    [...document.querySelectorAll(".search-result-procedure")]
      .some(el=>el.textContent.includes("OIIE")),null,{timeout:20000});
  await page.locator(".search-result-procedure").filter({hasText:"OIIE"}).first().click();
  await page.waitForFunction(()=>document.querySelector("#miniChartPreview")?.hidden===false &&
    document.querySelector(".procedure-token.active")?.dataset.chartPage==="379",
    null,{timeout:20000});
  assert.ok(await page.locator("#airportCarousel").isVisible(),
    "Airport wheel remains available while only a preview is active");
  await page.locator("#miniChartOpen").click();
  await verifySelection(page,"SID",379);
  console.log("PASS iPad chart open: ICAO row hidden, chart category remains visible");
  const frame=page.frameLocator("#classicViewerFrame");
  await frame.locator("#nextChartBtn").waitFor({state:"visible",timeout:25000});
  await frame.locator("#nextChartBtn").click();
  await verifySelection(page,"AIRPORT",380);
  console.log("PASS embedded Classic NEXT automatically switches the rail SID -> AIRPORT");
  await frame.locator("#prevChartBtn").click();
  await verifySelection(page,"SID",379);
  // Swipe on the real embedded chart canvas at 100% zoom. Classic handles
  // pan and pinch as before; only a successful page change broadcasts to the
  // outer category wheel.
  await page.waitForFunction(()=>{
    const doc=document.querySelector("#classicViewerFrame")?.contentDocument;
    const canvas=doc?.querySelector("#pdfCanvas");
    return canvas?.width>100&&!doc.querySelector(".pdf-loading");
  },null,{timeout:35000});
  await page.waitForTimeout(1100); // allow the source adjacent PDF page to be predecoded
  const bbox=await frame.locator("#pdfCanvas").boundingBox();
  assert.ok(bbox?.width>200&&bbox?.height>200,"Actual PDF canvas must have a swipe surface");
  const startX=bbox.x+bbox.width*.7,startY=bbox.y+Math.min(bbox.height*.25,160);
  await page.mouse.move(startX,startY);
  await page.mouse.down();
  await page.mouse.move(startX-bbox.width*.46,startY,{steps:14});
  await page.mouse.up();
  await verifySelection(page,"AIRPORT",380);
  console.log("PASS chart-canvas swipe synchronizes the matching category + chart");
  // Closing the selected category restores the airport list (no persistent
  // invisible capture layer remains over the ICAO picker).
  await page.locator('.procedure-category[data-category="AIRPORT"]').click();
  await page.waitForFunction(()=>document.querySelector("#airportCarousel")
   ?.getBoundingClientRect().height>50 &&
   document.querySelector("#classicViewerHost")?.hidden,{timeout:9000});
  console.log("PASS airport carousel restored when chart category is collapsed");
 }finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.kill("SIGTERM")});
