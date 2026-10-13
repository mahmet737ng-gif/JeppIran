// End-to-end JEPPIRAN profile validity display QA.
// Serves the built web app locally and checks actual visible browser elements.
// Never edits approved Home imagery, chart tools, or simulator connections.
const {chromium}=require("playwright");
const {spawn}=require("node:child_process");
const assert=require("node:assert/strict");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
const port=38267;
const base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{
 cwd:root,stdio:"ignore"
});
const pause=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function waitForServer(){
 for(let i=0;i<70;i++){
  if(server.exitCode!==null)throw Error("Local web server exited before startup");
  try{const response=await fetch(base);if(response.ok)return;}catch(_){}
  await pause(150);
 }
 throw Error("Local web server not ready");
}
(async()=>{
 let browser;
 try{
  await waitForServer();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{
   executablePath:process.env.JEPPIRAN_CHROME_BIN
  }:{})});
  const page=await browser.newPage({viewport:{width:1440,height:900}});
  await page.goto(base+"#charts",{waitUntil:"domcontentloaded"});
  const from=page.locator("#profileTerminalValidity .terminal-date-start b");
  const to=page.locator("#profileTerminalValidity .terminal-date-end b");
  await from.waitFor({state:"visible",timeout:85000});
  await to.waitFor({state:"visible",timeout:10000});
  assert.equal((await from.innerText()).trim(),"09 Oct 2026","visible starting date in OIII");
  assert.equal((await to.innerText()).trim(),"22 Oct 2026","visible final date in OIII");
  assert.ok(await page.locator("#profileUtcClock").isVisible(),"UTC clock above dates");
  assert.equal(await page.locator("#profileValidity").count(),0,"no standalone card");
  const positions=await page.evaluate(()=>{
   const clock=document.querySelector("#profileUtcClock").getBoundingClientRect();
   const period=document.querySelector("#profileTerminalValidity .terminal-validity-dates").getBoundingClientRect();
   const header=document.querySelector("#airportProfile .profile-heading").getBoundingClientRect();
   return {clockBottom:clock.bottom,periodTop:period.top,periodWidth:period.width,headerBottom:header.bottom};
  });
  assert.ok(positions.periodTop>=positions.clockBottom-2,"dates physically below clock");
  assert.ok(positions.periodWidth>=100,"date range has visible width");
  assert.ok(positions.headerBottom>=positions.periodTop,"range is in the header");

  // Critical regression: the old QA saw only the header, while a phone
  // could show a completely empty airport chart body. Exercise the actual
  // Android phone style and verify visible, clickable procedure categories.
  await page.setViewportSize({width:390,height:844});
  await page.evaluate(()=>document.documentElement.classList.add("jp-android-phone"));
  const phoneCss=require("node:fs").readFileSync(
    path.join(root,"app/src/main/assets/phone-layout.css"),"utf8");
  await page.addStyleTag({content:phoneCss});
  await page.locator("#profileProcedures").waitFor({state:"visible",timeout:18000});
  const geometry=await page.evaluate(()=>{
    const profile=document.getElementById("airportProfile");
    const procedures=document.getElementById("profileProcedures");
    const rect=procedures.getBoundingClientRect();
    return {
      airports:document.querySelectorAll("#airportList .airport-item").length,
      cards:document.querySelectorAll("#airportProfile .profile-card").length,
      tabs:document.querySelectorAll("#profileProcedures [data-proc-cat]").length,
      profileHeight:profile.getBoundingClientRect().height,
      procedureHeight:rect.height,
      procedureWidth:rect.width,
      profileScrollHeight:profile.scrollHeight
    };
  });
  assert.ok(geometry.airports>2,"phone must display multiple airports: "+JSON.stringify(geometry));
  assert.ok(geometry.cards>=5,"phone profile missing visible data panels: "+JSON.stringify(geometry));
  assert.equal(geometry.tabs,4,"STAR/SID/AIRPORT/APP category controls are mandatory");
  assert.ok(geometry.procedureHeight>80&&geometry.procedureWidth>220,
    "procedure panel has collapsed on phone: "+JSON.stringify(geometry));
  await page.locator('#profileProcedures [data-proc-cat="SID"]').click();
  assert.ok(await page.locator('#profileProcedures [data-proc-page]').count()>0,
    "SID charts not rendered for OIII");
  console.log("PASS Android phone chart body and procedures",JSON.stringify(geometry));
  await page.setViewportSize({width:1440,height:900});
  await page.evaluate(()=>document.documentElement.classList.remove("jp-android-phone"));

  // The entire Home artwork is unaffected and continues to show ONLY the status.
  await page.evaluate(()=>{
   document.querySelectorAll(".view").forEach(e=>e.classList.remove("active"));
   document.getElementById("homeView").classList.add("active");
  });
  assert.ok(await page.locator("#homeTerminalValidity").isVisible(),"Home status still visible");
  assert.equal(await page.locator("#homeTerminalValidity .terminal-validity-dates").count(),0,
   "Home must not gain detailed validity dates");

  // Light theme must render both labels legibly without adding a profile card.
  await page.evaluate(()=>{
   document.getElementById("homeView").classList.remove("active");
   document.getElementById("chartsView").classList.add("active");
   document.documentElement.classList.add("light");
  });
  assert.ok(await from.isVisible(),"date range visible in light mode");
  assert.ok(await to.isVisible(),"valid-to date visible in light mode");
  console.log("PASS real Chrome UI: OIII terminal 09 Oct–22 Oct 2026, dates below UTC, no standalone card, Home unchanged, light mode visible.");
 }finally{
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(err=>{console.error(err);process.exitCode=1;});
