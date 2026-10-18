"use strict";
const assert=require("node:assert/strict");
const {spawn}=require("node:child_process");
const path=require("node:path");
const fs=require("node:fs");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,".."),port=18658;
const base="http://127.0.0.1:"+port+"/";
const url=base+"preview/airport-carousel-r5/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const airports=["OIAA","OIAW","OIBB","OICC","OIIE","OIII","OIKB","OIKK","OIMM","OISS","OITT","OIYY"];
const records=[
 {page:101,airport:"OIII",category:"STAR",chart_number:"10-2",name:"RNAV Arrival",pdf_page:1},
 {page:102,airport:"OIII",category:"SID",chart_number:"10-3",name:"SID Departure",pdf_page:2},
 {page:103,airport:"OIII",category:"STAR",chart_number:"10-2A",name:"Conventional Arrival",pdf_page:3},
 {page:104,airport:"OIII",category:"Airport",chart_number:"10-9",name:"Airport Diagram",pdf_page:4},
 {page:105,airport:"OIII",category:"Approach",chart_number:"11-1",name:"ILS RWY 29L",pdf_page:5}
];
const pdfStub=String.raw`
export const GlobalWorkerOptions={};
export function getDocument({data,url}){
 return {promise:Promise.resolve({numPages:5,async getPage(n){
   return {getViewport({scale}){return {width:450*scale,height:600*scale}},
    render({canvasContext,viewport}){
      canvasContext.fillStyle="#ffffff";
      canvasContext.fillRect(0,0,viewport.width,viewport.height);
      canvasContext.fillStyle="#243648";
      canvasContext.fillRect(22,22,120,120);
      return {promise:Promise.resolve(),cancel(){}};
    }};
 }})};
}
`;
async function ready(){for(let i=0;i<70;i++){try{if((await fetch(url)).ok)return}catch(_){}await new Promise(r=>setTimeout(r,120))}throw Error("Local preview HTTP server did not start")}
(async()=>{
 let browser;
 try{
   const main=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
   assert.match(main,/value="classic" checked/);
   assert.match(main,/preview\/airport-carousel-r5/);
   assert.match(main,/preview-classic-embed.css/);
   await ready();
   browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
   const context=await browser.newContext({viewport:{width:1440,height:900},serviceWorkers:"block"});
   const page=await context.newPage();
   const errors=[];
   page.on("pageerror",e=>errors.push(e.message));
   await page.route("**/vendor/pdf.min.mjs",route=>route.fulfill({contentType:"text/javascript",body:pdfStub}));
   await page.route("**/charts/OIII.pdf",route=>route.fulfill({contentType:"application/pdf",body:Buffer.from("%PDF-STUB")}));
   await page.route("**/data/charts-manifest.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({
     version:"V2621",airports:Object.fromEntries(airports.map(icao=>[icao,{
       file:icao+".pdf",global_pages:icao==="OIII"?[101,102,103,104,105]:[]
     }]))
   })}));
   await page.route("**/data/charts-current.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify(records)}));
   await page.route("**/data/airport-profiles.json",route=>route.fulfill({contentType:"application/json",body:JSON.stringify({airports:{OIII:{iata:"THR",name:"Mehrabad International Airport",city:"Tehran",country:"Iran",elevation:3962}}})}));
   await page.route("**/wx-live.json*",route=>route.abort());
   await page.goto(url,{waitUntil:"domcontentloaded"});
   await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length===12);
   assert.equal(await page.locator(".airport-token.active").getAttribute("data-airport"),"OIII");
   assert.equal(await page.locator("#classicViewerHost").isHidden(),true);
   await page.locator('.procedure-category[data-category="STAR"]').click();
   await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===2);
   const layout=await page.evaluate(()=>{
     const buttons=[...document.querySelectorAll(".procedure-category")];
     const wheel=document.querySelector("#procedureWheel").getBoundingClientRect();
     const stars=buttons[0].getBoundingClientRect(),sid=buttons[1].getBoundingClientRect();
     return {starRight:stars.right,starTop:stars.top,sidLeft:sid.left,sidTop:sid.top,
       wheelLeft:wheel.left,wheelRight:wheel.right};
   });
   assert.ok(layout.wheelLeft>=layout.starRight-2,"Chart names should start to the RIGHT of STAR: "+JSON.stringify(layout));
   assert.ok(layout.wheelRight<=layout.sidLeft+2,"Chart names must finish BEFORE SID: "+JSON.stringify(layout));
   assert.ok(Math.abs(layout.starTop-layout.sidTop)<4,"STAR and SID must be in the SAME row");
   assert.ok(await page.locator("#classicViewerHost").isVisible());
   await page.waitForFunction(()=>document.querySelector("#classicViewerStatus")?.hidden,{timeout:17000});
   const frame=page.frame({url:/jeppiranEmbedCharts=1/});
   assert.ok(frame,"Real Classic app must be mounted in an iframe");
   await frame.locator("#viewerChart").waitFor();
   await frame.waitForFunction(()=>document.querySelector("#viewerChart")?.textContent.includes("RNAV Arrival"),{timeout:17000});
   assert.ok(await frame.locator(".viewer-toolbar").isVisible(),"Original Classic toolbar must remain usable");
   assert.ok(await frame.locator("#zoomInBtn").isVisible(),"Original zoom must remain");
   assert.ok(await frame.locator("#chartInvertBtn").isVisible(),"Original INVERT must remain");
   assert.ok(await frame.locator("#chartCdfaBtn").isVisible(),"Original CDFA control must remain");
   assert.ok(await frame.locator("#chartTaxiBtn").isVisible(),"Original TAXI control must remain");
   assert.equal(await frame.locator(".airport-pane").isVisible(),false,"No duplicate Classic airport sidebar");
   await page.locator('.procedure-token[data-chart-page="103"]').click();
   await page.waitForFunction(()=>document.querySelector(".procedure-token.active")?.dataset.chartPage==="103");
   await frame.waitForFunction(()=>document.querySelector("#viewerChart")?.textContent.includes("Conventional Arrival"),{timeout:12000});
   assert.equal(await page.locator(".selected-airport").isVisible(),false);
   await page.locator('.procedure-category[data-category="SID"]').click();
   await page.waitForFunction(()=>document.querySelectorAll(".procedure-token").length===1);
   await frame.waitForFunction(()=>document.querySelector("#viewerChart")?.textContent.includes("SID Departure"),{timeout:12000});
   const sid=await page.locator('.procedure-category[data-category="SID"]').boundingBox();
   const app=await page.locator('.procedure-category[data-category="AIRPORT"]').boundingBox();
   const x=await page.locator("#procedureWheel").boundingBox();
   assert.ok(x.x>=sid.x+sid.width-2&&x.x+x.width<=app.x+2,"SID charts must appear between SID and AIRPORT");
   await page.locator('.procedure-category[data-category="SID"]').click();
   assert.equal(await page.locator("#classicViewerHost").isHidden(),true);
   assert.equal(await page.locator("#airportName").isVisible(),true);
   assert.ok(!errors.some(s=>/ReferenceError|SyntaxError|TypeError/.test(s)),errors.join("; "));
   console.log("PASS R5: real Classic iframe viewer and toolbar, chart names between STAR/SID, live chart switching, Classic default");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(e=>{console.error(e);process.exitCode=1});
