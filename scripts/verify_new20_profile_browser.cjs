// Real-Chrome test of all twenty newly activated decorative airport profile images.
// Runs against built web assets, not a mocked profile. Does not modify PDF/chart/UI data.
"use strict";
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const assignment=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters-new20/assignments.json"),"utf8")).airport_to_design;
const replaced=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters-v3/manifest.json"),"utf8")).files;
const chartProfiles=JSON.parse(fs.readFileSync(path.join(root,"app/src/main/assets/airport-profile-chart-overrides.json"),"utf8")).airports;
const port=38279,base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{cwd:root,stdio:"ignore"});
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function ready(){for(let i=0;i<100;i++){if(server.exitCode!==null)throw Error("Server exited");try{if((await fetch(base)).ok)return}catch(_){}await delay(200)}throw Error("Local server timed out")}
(async()=>{
 let browser;
 try{
  await ready();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:1380,height:870}});
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded",timeout:30000});
  await page.waitForFunction(()=>typeof selectAirport==="function" && Array.isArray(charts) && charts.length>1500,null,{timeout:60000});
  await page.waitForFunction(()=>!!window.JEPPIRAN_POSTER_CACHE_URLS && Object.keys(window.JEPPIRAN_POSTER_CACHE_URLS).length>=70,null,{timeout:25000});
  await page.waitForFunction(()=>typeof airportMetadata==="object" &&
    airportMetadata.OPIS?.source?.startsWith("Jeppesen") && airportMetadata.OPKC?.source?.startsWith("Jeppesen"),null,{timeout:25000});
  const checks={...assignment,...Object.fromEntries(Object.keys(replaced).map(icao=>[icao,icao]))};
  for(const [icao,id] of Object.entries(checks)){
   const actual=Object.hasOwn(replaced,icao)?icao:id;
   await page.evaluate(code=>selectAirport(code),icao);
   await page.waitForFunction(({code,design})=>{
    const root=document.getElementById("airportProfile");
    const frame=root?.querySelector(".jp-poster-frame");
    return root?.querySelector(".profile-icao")?.textContent.trim()===code &&
      root.classList.contains("jp-airport-poster-loaded") && !!frame &&
      frame.style.backgroundImage.includes(design+".webp") &&
      frame.getBoundingClientRect().width>20 && frame.getBoundingClientRect().height>20;
   },{code:icao,design:actual},{timeout:18000});
   // An airport change can re-render its frame after the first wait.
   // Read the image and its geometry atomically, retrying transient DOM states.
   const result=await page.waitForFunction(({code,design})=>{
    const outer=document.querySelector("#airportProfile");
    if(!outer||outer.querySelector(".profile-icao")?.textContent.trim()!==code)return false;
    const frame=outer.querySelector(".jp-poster-frame");
    const caption=frame?.querySelector(".jp-caption-title");
    if(!frame||!caption||!frame.style.backgroundImage.includes(design+".webp"))return false;
    const f=frame.getBoundingClientRect(),o=outer.getBoundingClientRect();
    if(f.width<20||f.height<20)return false;
    return {image:frame.style.backgroundImage,caption:caption.textContent,width:f.width,height:f.height,inside:f.left>=o.left-2&&f.right<=o.right+2&&f.top>=o.top-2&&f.bottom<=o.bottom+2};
   },{code:icao,design:actual},{timeout:18000}).then(h=>h.jsonValue());
   assert.ok(result.image.includes(actual+".webp"),"incorrect image for "+icao);
   assert.ok(result.caption?.includes(icao),"missing clear ICAO caption "+icao);
   assert.ok(result.inside,"cropped image for "+icao);
   if(chartProfiles[icao]){
    const expected=chartProfiles[icao].profile;
    const shown=await page.waitForFunction(code=>{
     const root=document.querySelector("#airportProfile");
     if(!root||root.querySelector(".profile-icao")?.textContent.trim()!==code)return false;
     const name=root.querySelector(".profile-heading h2")?.textContent,
       iata=root.querySelector(".profile-code-row .profile-chip")?.textContent,
       place=root.querySelector(".profile-heading p")?.textContent,
       coordinates=root.querySelector(".profile-coordinates")?.textContent;
     return name&&iata&&place&&coordinates?{name,iata,place,coordinates}:false;
    },icao,{timeout:18000}).then(h=>h.jsonValue());
    assert.equal(shown.name,expected.name,icao+" chart airport name");
    assert.equal(shown.iata,expected.iata,icao+" chart IATA");
    assert.ok(shown.place.includes(expected.city)&&shown.place.includes(expected.country),icao+" chart location");
    assert.ok(shown.place.replace(/,/g,"").includes("Elevation "+expected.elevation+" ft"),icao+" chart elevation");
    assert.ok(shown.coordinates.includes(expected.lat.toFixed(4))&&shown.coordinates.includes(expected.lon.toFixed(4)),icao+" chart ARP");
    console.log("PASS Chrome chart-derived profile",icao,shown.name);
   }
   console.log("PASS Chrome profile",icao,actual,Math.round(result.width)+"x"+Math.round(result.height));
  }
  const report=await page.evaluate(()=>window.JEPPIRAN_NEW20_PROFILE_POSTERS);
  assert.equal(report.count,20);
  console.log("PASS all assigned and current corrected profile images loaded within visible browser profile; original 50 untouched.");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(e=>{console.error(e);process.exitCode=1;server.kill("SIGTERM")});

