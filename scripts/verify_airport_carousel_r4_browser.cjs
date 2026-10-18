"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,".."),port=18656;
const url="http://127.0.0.1:"+port+"/preview/airport-carousel-r4/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const codes=["OIAA","OIAW","OIBB","OICC","OIIE","OIII","OIKB","OIKK","OIMM","OISS","OITT","OIYY"];
async function ready(){
 for(let i=0;i<65;i++){try{if((await fetch(url)).ok)return}catch(_){}await new Promise(r=>setTimeout(r,130))}
 throw Error("Preview HTTP server did not start");
}
const stubPDF=String.raw`
export const GlobalWorkerOptions={};
export function getDocument({url}){
 return {promise:Promise.resolve({numPages:250,async getPage(n){
  return {getViewport({scale}){return {width:612*scale,height:792*scale}},
   render({canvasContext,viewport}){
    canvasContext.fillStyle="#ffffff";
    canvasContext.fillRect(0,0,viewport.width,viewport.height);
    canvasContext.fillStyle="#17334a";
    canvasContext.fillRect(14,14,65,65);
    return {promise:Promise.resolve(),cancel(){}};
   }};
 }})};
}
`;
(async()=>{
 let browser;
 try{
  const main=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
  assert.ok(main.includes('name="chartsLayoutMode" value="classic" checked'));
  // R4 remains archived for regression; Settings now points to the improved R5.
  assert.ok(fs.existsSync(path.join(root,"web/preview/airport-carousel-r4/index.html")));
  assert.ok(main.includes("./preview/airport-carousel-r5/"));
  await ready();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900},reducedMotion:"no-preference"});
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  await page.route("**/vendor/pdf.min.mjs",route=>route.fulfill({contentType:"text/javascript",body:stubPDF}));
  await page.route("**/data/charts-manifest.json",route=>route.fulfill({
   contentType:"application/json",body:JSON.stringify({airports:Object.fromEntries(codes.map(c=>[c,{
     file:c+".pdf",global_pages:c==="OIII"?[101,102,103,104,105]:[]
   }]))})
  }));
  await page.route("**/data/charts-current.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify([
   {page:101,airport:"OIII",category:"STAR",chart_number:"10-2",name:"RNAV Arrival",pdf_page:1},
   {page:102,airport:"OIII",category:"SID",chart_number:"10-3",name:"SID Departure",pdf_page:2},
   {page:103,airport:"OIII",category:"STAR",chart_number:"10-2A",name:"Conventional Arrival",pdf_page:3},
   {page:104,airport:"OIII",category:"Airport",chart_number:"10-9",name:"Airport Diagram",pdf_page:4},
   {page:105,airport:"OIII",category:"Approach",chart_number:"11-1",name:"ILS RWY 29L",pdf_page:5}
  ])}));
  await page.route("**/data/airport-profiles.json",route=>route.fulfill({
   contentType:"application/json",body:JSON.stringify({airports:{
    OIII:{iata:"THR",name:"Mehrabad International Airport",city:"Tehran",country:"Iran",elevation:3962}
   }})
  }));
  await page.route("**/wx-live.json*",route=>route.abort());
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length===12);
  assert.equal(await page.locator(".airport-token.active").getAttribute("data-airport"),"OIII");
  assert.equal(await page.locator(".category-shell").count(),4);
  assert.equal(await page.locator("#inlineChartViewer").isHidden(),true);
  assert.equal(await page.locator("#airportName").isVisible(),true);
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===2);
  await page.waitForFunction(()=>document.querySelector("#viewerChartMessage").hidden);
  assert.equal(await page.locator(".category-shell.active").getAttribute("data-category"),"STAR");
  assert.equal(await page.locator('.category-shell[data-category="STAR"] #procedureDetails').count(),1,
    "chart titles must physically nest inside expanded category");
  assert.equal(await page.locator(".selected-airport").isVisible(),false);
  assert.equal(await page.locator(".weather-line").isVisible(),false);
  assert.equal(await page.locator("#inlineChartViewer").isVisible(),true);
  assert.ok(await page.locator("#viewerChartCanvas").evaluate(el=>el.width>0&&el.height>0));
  assert.match(await page.locator("#viewerProcedureTitle").textContent(),/10-2/);
  await page.locator('.procedure-token[data-chart-page="103"]').click();
  await page.waitForTimeout(610);
  assert.match(await page.locator("#viewerProcedureTitle").textContent(),/10-2A/);
  await page.locator("#viewerChartTap").click({position:{x:190,y:100}});
  await page.waitForFunction(()=>document.querySelector("#inlineChartViewer").classList.contains("fullscreen-viewer"));
  assert.equal(await page.locator("#viewerCloseFullScreen").isVisible(),true);
  await page.locator("#viewerCloseFullScreen").click();
  await page.waitForFunction(()=>!document.querySelector("#inlineChartViewer").classList.contains("fullscreen-viewer"));
  await page.locator('.procedure-category[data-category="SID"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===1);
  await page.waitForFunction(()=>document.querySelector("#viewerProcedureTitle").textContent.includes("SID Departure"));
  assert.equal(await page.locator('.category-shell[data-category="SID"] #procedureDetails').count(),1);
  assert.equal(await page.locator('.category-shell[data-category="STAR"] #procedureDetails').count(),0);
  await page.locator('.procedure-category[data-category="SID"]').click();
  assert.equal(await page.locator("#inlineChartViewer").isHidden(),true);
  assert.equal(await page.locator(".selected-airport").isVisible(),true);
  // Every group should reopen from source index and show the inline PDF.
  for(const [category,number] of [["AIRPORT","10-9"],["APP","11-1"]]){
   await page.locator('.procedure-category[data-category="'+category+'"]').click();
   await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===1);
   await page.waitForFunction(num=>document.querySelector("#viewerProcedureTitle").textContent.includes(num),number);
   await page.locator('.procedure-category[data-category="'+category+'"]').click();
  }
  await page.setViewportSize({width:390,height:844});
  await page.locator('.procedure-category[data-category="STAR"]').click();
  await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===2);
  const mobile=await page.evaluate(()=>({
   scroller:document.querySelector(".procedure-categories").getBoundingClientRect().toJSON(),
   viewer:document.querySelector("#inlineChartViewer").getBoundingClientRect().toJSON(),width:innerWidth
  }));
  assert.ok(mobile.scroller.left>=0&&mobile.scroller.right<=mobile.width);
  assert.ok(mobile.viewer.left>=0&&mobile.viewer.right<=mobile.width);
  assert.deepEqual(errors,[]);
  console.log("PASS R4: nested category accordion, linked V2621 inline chart canvas, weather hides/restores, chart tap fullscreen, sibling switching, phone layout.");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(e=>{console.error(e);process.exitCode=1});
