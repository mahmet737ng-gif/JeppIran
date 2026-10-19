/* Real Chrome regression: opening NOTAM must not shrink the whole airport
 * profile; only notice text should scroll inside its own panel. No changes to
 * actual chart data, original posters, or simulator coordinates. */
"use strict";
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),port=38314;
const base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){
 for(let n=0;n<100;n++){if(server.exitCode!==null)throw Error("Web test server exited");
  try{if((await fetch(base)).ok)return}catch(_){}
  await delay(200);
 }throw Error("Web server did not start");
}
async function geometry(page){
 return page.evaluate(()=>{
  const root=document.querySelector("#airportProfile");
  const shell=root.querySelector(".profile-shell");
  const rect=selector=>{const element=root.querySelector(selector);
    const r=element.getBoundingClientRect();
    return {x:r.x,y:r.y,width:r.width,height:r.height};
  };
  const notices=root.querySelector("#profileNotam .jp-notam-scroll");
  return {zoom:Number(shell.style.zoom)||1,shell:rect(".profile-shell"),
    metar:rect("#profileWeather"),wind:rect("#profileWind"),
    runways:rect("#profileRunways"),
    detailOpen:root.querySelector(".profile-notam-details")?.open,
    readerClient:notices?.clientHeight||0,readerScroll:notices?.scrollHeight||0};
 });
}
(async()=>{
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,
   ...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const codes=Object.keys(JSON.parse(fs.readFileSync(path.join(root,"web/data/charts-manifest.json"))).airports);
  const now=Date.now(),notams=Object.fromEntries(codes.map(icao=>[icao,{
    status:"available",fetched_at:new Date(now).toISOString(),
    notams:[{id:"A1234/26",text:("CRANE OPERATING NEAR AIRPORT / NOTAM FOR LAYOUT REGRESSION. ").repeat(80),
      begin:new Date(now-3600000).toISOString(),end:new Date(now+86400000).toISOString(),status:"active"}]
  }]));
  const page=await browser.newPage({viewport:{width:1640,height:905}});
  await page.route("**/notams-current.json*",route=>route.fulfill({
    status:200,contentType:"application/json",headers:{"access-control-allow-origin":"*"},
    body:JSON.stringify({stations:notams})
  }));
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded"});
  await page.waitForFunction(()=>typeof selectAirport==="function"&&
   Array.isArray(charts)&&charts.length>1500,null,{timeout:60000});
  for(const icao of ["OIMB","OIAW"]){
    await page.evaluate(code=>selectAirport(code),icao);
    await page.waitForFunction(code=>{
      const root=document.querySelector("#airportProfile");
      return root?.querySelector(".profile-icao")?.textContent.trim()===code &&
        root.classList.contains("jp-airport-poster-loaded") &&
        root.querySelector(".profile-notam-details") && root.querySelector(".jp-notam-scroll .jp-notam-item");
    },icao,{timeout:20000});
    await page.evaluate(()=>document.fonts.ready);
    await page.waitForTimeout(250);
    const closed=await geometry(page);
    await page.locator("#profileNotam .profile-notam-details summary").click();
    await page.waitForFunction(()=>document.querySelector("#profileNotam .profile-notam-details")?.open);
    await page.waitForTimeout(280);
    const opened=await geometry(page);
    assert.ok(opened.detailOpen,icao+" NOTAM did not open");
    assert.ok(Math.abs(opened.zoom-closed.zoom)<.005,
     icao+" profile zoom changed while opening NOTAM: "+JSON.stringify({closed,opened}));
    for(const key of ["shell","metar","wind","runways"]){
      assert.ok(Math.abs(opened[key].width-closed[key].width)<4,
       icao+" "+key+" width shrank on NOTAM open: "+JSON.stringify({closed,opened}));
    }
    assert.ok(opened.readerClient>70 && opened.readerScroll>opened.readerClient+15,
      icao+" NOTAM text must scroll INSIDE card: "+JSON.stringify(opened));
    await page.locator("#profileNotam .profile-notam-details summary").click();
    await page.waitForFunction(()=>!document.querySelector("#profileNotam .profile-notam-details")?.open);
    await page.waitForTimeout(200);
    const after=await geometry(page);
    assert.ok(Math.abs(after.zoom-closed.zoom)<.005,icao+" changed zoom after closing NOTAM");
    console.log("PASS NOTAM no-profile-shrink",icao,
      JSON.stringify({zoom:closed.zoom,openZoom:opened.zoom,
        width:closed.shell.width,openWidth:opened.shell.width,
        innerScroll:opened.readerScroll,innerHeight:opened.readerClient}));
  }
 } finally {
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(e=>{console.error(e);process.exitCode=1;server.kill("SIGTERM")});
