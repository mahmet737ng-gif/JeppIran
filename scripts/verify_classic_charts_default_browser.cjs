"use strict";
/* Owner-approved Classic airport/profile layout must be the default even
   on browsers that used the old preview Carousel preference. */
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,".."),port=18657;
const base="http://127.0.0.1:"+port+"/";
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory","web"],{
 cwd:root,stdio:"ignore"
});
async function ready(){
 for(let i=0;i<50;i++){
  try{if((await fetch(base)).ok)return}catch(_){}
  await new Promise(r=>setTimeout(r,120));
 }
 throw Error("Local server not ready");
}
(async()=>{
 let browser;
 try{
  const html=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
  assert.match(html,/name="chartsLayoutMode" value="classic" checked/);
  assert.match(html,/const KEY="jeppiran-chart-layout-v2"/);
  assert.match(html,/preview\/airport-carousel-r4/);
  await ready();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage();
  const errors=[];
  page.on("pageerror",e=>errors.push(e.message));
  // Leave the inline navigation and layout scripts active; keep other app
  // scripts out of this focused preference test.
  await page.route(/\/[^/]+\.js(\?.*)?$/,route=>route.abort());
  await page.addInitScript(()=>{
    if(!sessionStorage.getItem("classic-default-test-seeded")){
      localStorage.setItem("jeppiran-chart-layout","carousel");
      localStorage.removeItem("jeppiran-chart-layout-v2");
      sessionStorage.setItem("classic-default-test-seeded","yes");
    }
  });
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.locator('input[name="chartsLayoutMode"][value="classic"]').waitFor({state:"attached"});
  assert.equal(await page.locator('input[name="chartsLayoutMode"][value="classic"]').isChecked(),true,
    "Old Carousel preference must not override the approved Classic default");
  await page.locator('button.home-card[data-route="charts"]').click();
  assert.ok(page.url().endsWith("/#charts"),"Default Charts must stay on the original app");
  assert.equal(await page.locator("#chartsView.active").count(),1);
  await page.evaluate(()=>document.querySelector("#appearanceSettingsDialog").showModal());
  await page.locator('input[name="chartsLayoutMode"][value="carousel"]').check();
  await page.evaluate(()=>document.querySelector("#appearanceSettingsDialog").close());
  assert.equal(await page.evaluate(()=>localStorage.getItem("jeppiran-chart-layout-v2")),"carousel");
  await page.goto(base,{waitUntil:"domcontentloaded"});
  await page.locator('button.home-card[data-route="charts"]').click();
  await page.waitForURL(/\/preview\/airport-carousel-r4\/$/);
  await page.goto(base,{waitUntil:"domcontentloaded"});
  assert.equal(await page.locator('input[name="chartsLayoutMode"][value="carousel"]').isChecked(),true,
    "Only a deliberate new Carousel choice should be remembered");
  await page.evaluate(()=>document.querySelector("#appearanceSettingsDialog").showModal());
  await page.locator('input[name="chartsLayoutMode"][value="classic"]').check();
  await page.evaluate(()=>document.querySelector("#appearanceSettingsDialog").close());
  assert.equal(await page.evaluate(()=>localStorage.getItem("jeppiran-chart-layout-v2")),"classic");
  await page.locator('button.home-card[data-route="charts"]').click();
  assert.ok(page.url().endsWith("/#charts"),"Switching back to Classic restores the original Charts page");
  assert.deepEqual(errors,[],"Page errors: "+errors.join("; "));
  console.log("PASS Classic is default (including old Carousel users), Carousel is explicit opt-in and preferences persist");
 }finally{if(browser)await browser.close();server.kill("SIGTERM")}
})().catch(err=>{console.error(err);process.exitCode=1});
