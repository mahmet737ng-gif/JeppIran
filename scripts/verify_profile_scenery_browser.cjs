/* Browser QA: landmarks, safe scenic area, no duplicated lower title.
 * Real Chrome and both profile families (50 legacy + 20 new).
 */
"use strict";
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const port=38284,base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<100;i++){try{if((await fetch(base)).ok)return}catch(_){ }await delay(200)}throw Error("HTTP server not ready")}
(async()=>{
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1380,height:870}});
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof selectAirport==="function"&&Array.isArray(charts)&&charts.length>1500,null,{timeout:60000});
  await page.waitForFunction(()=>Object.keys(window.JEPPIRAN_POSTER_CACHE_URLS||{}).length>=70,null,{timeout:25000});
  for(const code of ["OIII","OIMM","OISS","OIAW","OIIE","OIBL","OICI","OTHH"]){
   await page.evaluate(icao=>selectAirport(icao),code);
   await page.waitForFunction(code=>{
      const root=document.getElementById("airportProfile");
      if(!root||root.querySelector(".profile-icao")?.textContent.trim()!==code)return false;
      const frame=root.querySelector(".jp-poster-frame");
      return !!(frame?.querySelector(".jp-poster-caption")&&
        root.querySelector(".jp-poster-scenic-foreground")&&root.querySelector(".profile-shell"));
   },code,{timeout:18000});
   const value=await page.evaluate(()=>{
    const root=document.getElementById("airportProfile"),frame=root.querySelector(".jp-poster-frame");
    const band=root.querySelector(".jp-poster-scenic-foreground"),caption=frame.querySelector(".jp-poster-caption");
    const shell=root.querySelector(".profile-shell");
    const rect=root.getBoundingClientRect(),scenic=band.getBoundingClientRect(),title=caption.getBoundingClientRect();
    return {r:rect.toJSON(),scenic:scenic.toJSON(),title:title.toJSON(),
      layer:getComputedStyle(band).zIndex,source:band.style.backgroundImage,
      reserve:parseFloat(root.style.getPropertyValue("--jp-scenic-reserve")),
      footer:!!root.querySelector(".jp-caption-coordinates"),
      shellBottom:shell.getBoundingClientRect().bottom};
   });
   assert.ok(value.scenic.bottom<=value.r.bottom+2&&value.scenic.top>=value.r.top,
     code+" city symbol strip clipped");
   assert.ok(value.title.top>=value.r.top && value.title.top<value.r.top+value.r.height*.29,
     code+" title not in upper header");
   assert.ok(value.reserve>=100&&value.layer==="2",code+" skyline not protected");
   assert.ok(value.source.includes(".webp"),code+" missing own picture");
   assert.ok(!value.footer,code+" legacy bottom coordinates returned");
   console.log("PASS landmark",code,"reserve",value.reserve);
  }
 } finally {if(browser)await browser.close();server.kill("SIGTERM");}
})().catch(e=>{console.error(e);process.exitCode=1;server.kill("SIGTERM")});
