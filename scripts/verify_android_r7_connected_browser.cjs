"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const {spawn}=require("node:child_process");
const {chromium}=require("playwright");
const root=path.resolve(__dirname,"..");
const directory=path.join(root,"app/build/generated/jeppiran-local-web/jeppiran-web");
const port=18677,url="http://127.0.0.1:"+port+"/index.html";
const html=fs.readFileSync(path.join(root,"web/index.html"),"utf8");
const app=fs.readFileSync(path.join(root,"web/app.js"),"utf8");
const viewer=fs.readFileSync(path.join(root,"web/preview/airport-carousel-r5/app.js"),"utf8");
const native=fs.readFileSync(path.join(root,"app/src/main/java/com/tareghmsr/jeppiran/MobileWebActivity.kt"),"utf8");
assert.match(html,/const KEY="jeppiran-chart-layout-v2"/);
assert.match(html,/jeppiran-chart-layout-android-r7/);
assert.match(html,/isAndroid\(\)\?"carousel":"classic"/);
assert.match(html,/airport-carousel-r5\/index\.html\?platform=android-phone/);
assert.match(app,/if\(isAndroidLocal\(\)\)\{\s*\/\/ The APK has ONE update screen/);
assert.match(native,/Press Back again to exit JeppIran/);
assert.match(native,/url\.scheme == "jeppiran" && url\.host == "updates"/);
assert.match(viewer,/document\.body\.classList\.add\("chart-selected"\)/);
assert.match(viewer,/index\.html\?jeppiranEmbedCharts=1#charts/);
assert.ok(fs.existsSync(path.join(directory,"index.html")));
const packaged=fs.readFileSync(path.join(directory,"index.html"),"utf8");
assert.match(packaged,/<meta name="jeppiran-runtime" content="android-local-apk">/);
assert.match(packaged,/android-phone\.css/);
assert.ok(fs.existsSync(path.join(directory,"preview/airport-carousel-r5/index.html")));
assert.ok(fs.existsSync(path.join(directory,"preview-classic-embed.css")));
const server=spawn("python3",["-m","http.server",String(port),"--bind","127.0.0.1","--directory",directory],{cwd:root,stdio:"ignore"});
async function waitServer(){
 for(let k=0;k<90;k++){
  try{if((await fetch(url)).ok)return}catch(e){}
  await new Promise(resolve=>setTimeout(resolve,120));
 }
 throw Error("Local Android WebViewAssetLoader mock server did not start");
}
(async()=>{
 let browser;
 try{
  await waitServer();
  browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  const page=await browser.newPage({viewport:{width:390,height:844},serviceWorkers:"block"});
  await page.goto(url,{waitUntil:"domcontentloaded"});
  await page.waitForSelector("#homeView");
  await page.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>d.close()));
  assert.equal(await page.locator('meta[name="jeppiran-runtime"]').getAttribute("content"),"android-local-apk");
  await page.locator('button.home-card[data-route="charts"]').click();
  await page.waitForURL(/\/preview\/airport-carousel-r5\/index\.html\?platform=android-phone/,{timeout:13000});
  await page.waitForFunction(()=>document.querySelectorAll(".airport-token").length>2,{timeout:13000});
  assert.equal(await page.locator("html").evaluate(el=>el.classList.contains("jp-android-carousel-qa")),true);
  const fullHeight=await page.locator(".carousel-region").evaluate(el=>el.getBoundingClientRect().height);
  await page.locator('.procedure-category[data-category="SID"]').click();
  await page.waitForFunction(()=>document.body.classList.contains("chart-selected"),{timeout:16000});
  await page.waitForTimeout(400);
  const compact=await page.locator(".carousel-region").evaluate(el=>el.getBoundingClientRect().height);
  assert.ok(compact<fullHeight*.85,JSON.stringify({fullHeight,compact}));
  assert.equal(await page.locator(".qa-updates-link").isVisible(),true);
  assert.equal(await page.locator("#classicViewerHost").isVisible(),true);
  assert.equal(await page.evaluate(()=>window.jeppiranAndroidBack()),true);
  await page.waitForFunction(()=>!document.body.classList.contains("chart-selected"));
  assert.equal(await page.evaluate(()=>window.jeppiranAndroidBack()),true);
  await page.waitForURL(/\/index\.html#home$/,{timeout:13000});
  await page.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>d.close()));
  await page.locator("#settingsHomeBtn").click();
  await page.locator('input[name="chartsLayoutMode"][value="classic"]').check();
  assert.equal(await page.evaluate(()=>localStorage.getItem("jeppiran-chart-layout-android-r7")),"classic");
  await page.evaluate(()=>document.querySelectorAll("dialog[open]").forEach(d=>d.close()));
  await page.locator('button.home-card[data-route="charts"]').click();
  await page.waitForURL(/\/index\.html#charts$/,{timeout:10000});
  assert.equal(await page.locator("#chartsView.active").count(),1);
  console.log("PASS R7: packaged Android home defaults to real compact Carousel; Classic opt-out, native Update bridge, proper chart Back navigation.");
 } finally {
  if(browser)await browser.close();
  server.kill("SIGTERM");
 }
})().catch(e=>{console.error(e);process.exitCode=1});
