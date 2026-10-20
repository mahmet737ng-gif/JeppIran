/* Regression tests: atomic + differential sync, interrupted updates, offline PDF. */
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const vm=require("node:vm");
const {webcrypto}=require("node:crypto");
const BASE="https://example.test/JeppIran/";
const sha=async text=>{
  const d=await webcrypto.subtle.digest("SHA-256",new TextEncoder().encode(text));
  return Buffer.from(d).toString("hex");
};
class Cache{
  constructor(){this.entries=new Map();}
  normalize(k,ignore=false){
    const url=new URL(k,BASE);
    return ignore?url.pathname:url.href;
  }
  async match(k,opts={}){
    const key=this.normalize(k,opts.ignoreSearch);
    for(const [url,r] of this.entries){
      if((opts.ignoreSearch?this.normalize(url,true):url)===key)return r.clone();
    }
    return undefined;
  }
  async put(k,res){this.entries.set(this.normalize(k),res.clone());}
  async delete(k){return this.entries.delete(this.normalize(k));}
  async keys(){return [...this.entries.keys()].map(x=>new Request(x));}
}
class Storage{
  constructor(){this.data=new Map();}
  async open(n){if(!this.data.has(n))this.data.set(n,new Cache());return this.data.get(n);}
  async keys(){return [...this.data.keys()];}
  async delete(n){return this.data.delete(n);}
  async match(k,opts){for(const c of this.data.values()){const r=await c.match(k,opts);if(r)return r;}}
}
async function packageFor(content){
  const required=["./","./index.html","./app.js","./offline-manager.js",
                  "./service-worker.js","./data/charts-manifest.json","./vendor/pdf.min.mjs"];
  const assets=await Promise.all(required.map(async url=>({url,kind:"asset",size:content[url].length,
              sha256:await sha(content[url])})));
  const pdfs=[{url:"./charts/OIIE.pdf",kind:"pdf",icao:"OIIE",
               size:content["./charts/OIIE.pdf"].length,sha256:await sha(content["./charts/OIIE.pdf"])}];
  return {schema:1,cycle:"V2621",release_tag:"test",assets,pdfs,
          totalBytes:assets.concat(pdfs).reduce((a,x)=>a+x.size,0)};
}
const files=Object.fromEntries([
  "./","./index.html","./app.js","./offline-manager.js",
  "./service-worker.js","./data/charts-manifest.json","./vendor/pdf.min.mjs",
  "./charts/OIIE.pdf"
].map((k,i)=>[k,"test-file-"+i]));
function makeBrowser(){
  const memory=new Storage();
  const listeners={};
  const controls=Object.fromEntries(
    ["goOfflineBtn","stopOfflineBtn","verifyOfflineBtn","offlineVerifyStatus","offlinePackStatus","offlinePackProgress","offlinePackCount"]
     .map(id=>[id,{disabled:false,hidden:false,value:0,textContent:"",addEventListener(type,cb){this[type]=cb;}}]));
  const document={visibilityState:"visible",hidden:false,
                  getElementById:id=>controls[id],
                  addEventListener(name,cb){listeners["document:"+name]=cb;}};
  const window={caches:memory,crypto:webcrypto,addEventListener(name,cb){listeners[name]=cb;}};
  const navigator={onLine:true,serviceWorker:{ready:Promise.resolve({active:true}),controller:{}},
                   storage:{persist:async()=>false}};
  let remote={...files};let failures=new Set();const requests=[],requestUrls=[];
  let staleWorker=false;
  let manifest;
  async function fetch(url,opts={}){
    const requestUrl=new URL(url,BASE);
    const path=requestUrl.pathname.replace("/JeppIran/","./");
    if(opts.signal?.aborted)throw new DOMException("Cancelled","AbortError");
    if(path==="./offline-assets.json")return new Response(JSON.stringify(manifest),{status:200});
    requests.push(path);requestUrls.push(requestUrl.href);
    if(failures.has(path))throw Error("network unavailable");
    const body=remote[path];
    if(staleWorker&&!requestUrl.searchParams.has("jeppiran_offline_sync"))
      return new Response("stale-service-worker-script",{status:200});
    return body===undefined?new Response("not found",{status:404}):new Response(body,{status:200});
  }
  const sandbox={window,document,navigator,caches:memory,crypto:webcrypto,fetch,Response,
    Request,DOMException,AbortController,URL,TextEncoder,location:{href:BASE},isSecureContext:true,
    setInterval:()=>{},Date,console};
  const script=fs.readFileSync("web/offline-manager.js","utf8");
  vm.runInNewContext(script,sandbox,{filename:"offline-manager.js"});
  return {api:window.JeppIranOffline,memory,requests,requestUrls,controls,window,document,listeners,
    setManifest:v=>{manifest=v;},setRemote:(key,value)=>{remote[key]=value;},
    staleSW:value=>{staleWorker=value;},
    fail:(key)=>failures.add(key),resume:key=>failures.delete(key)};
}
test("first sync downloads complete package, second only checks; one change downloads one file",async()=>{
  const browser=makeBrowser();
  let remote={...files};
  browser.setManifest(await packageFor(remote));
  await browser.api.sync();
  assert.equal(browser.requests.length,Object.keys(files).length);
  assert.equal(await browser.api.hasSnapshot(),true);
  const first=browser.requests.length;
  await browser.api.sync();
  assert.equal(browser.requests.length,first,"unchanged files must not be re-downloaded");
  remote["./charts/OIIE.pdf"]="new-airport-pdf";
  browser.setRemote("./charts/OIIE.pdf",remote["./charts/OIIE.pdf"]);
  browser.setManifest(await packageFor(remote));
  await browser.api.sync();
  assert.deepEqual(browser.requests.slice(first),["./charts/OIIE.pdf"]);
  const pdf=await browser.api.getPdfResponse("./charts/OIIE.pdf",await sha("new-airport-pdf"));
  assert.equal(await pdf.text(),"new-airport-pdf");
});
test("network failure never replaces committed snapshot and succeeds on retry",async()=>{
  const browser=makeBrowser();
  let remote={...files};
  browser.setManifest(await packageFor(remote));
  await browser.api.sync();
  const initial=await (await (await browser.memory.open("jeppiran-offline-meta-v2"))
    .match("./__jeppiran_active_offline_v2__")).json();
  remote["./app.js"]="new-version-of-the-app";
  browser.setRemote("./app.js",remote["./app.js"]);
  browser.setManifest(await packageFor(remote));
  browser.fail("./app.js");
  await browser.api.sync();
  const afterFailure=await (await (await browser.memory.open("jeppiran-offline-meta-v2"))
    .match("./__jeppiran_active_offline_v2__")).json();
  assert.equal(afterFailure.signature,initial.signature,"commit pointer changed during incomplete sync");
  assert.ok(browser.controls.offlinePackStatus.textContent.includes("previous")||
            browser.controls.offlinePackStatus.textContent.includes("Previous"));
  browser.resume("./app.js");
  const count=browser.requests.length;
  await browser.api.sync();
  assert.deepEqual(browser.requests.slice(count),["./app.js"]);
  const latest=await (await (await browser.memory.open("jeppiran-offline-meta-v2"))
    .match("./__jeppiran_active_offline_v2__")).json();
  assert.notEqual(latest.signature,initial.signature);
});
test("automatic sync is scheduled for launch, visibility, reconnect and five-minute polling",()=>{
  const b=makeBrowser();
  assert.equal(typeof b.listeners.load,"function");
  assert.equal(typeof b.listeners.pageshow,"function");
  assert.equal(typeof b.listeners.online,"function");
  assert.equal(typeof b.listeners["document:visibilitychange"],"function");
  assert.equal(typeof b.api.getPdfResponse,"function");
});

test("offline verification is local-only and detects missing cached files",async()=>{
  const b=makeBrowser();
  assert.equal(await b.api.verify(),false,"no completed package must not be declared ready");
  b.setManifest(await packageFor(files));
  await b.api.sync();
  const requestsBeforeVerify=b.requests.length;
  assert.equal(await b.api.verify(),true,"complete committed snapshot must verify");
  assert.equal(b.requests.length,requestsBeforeVerify,"verification must never access network");
  const state=await (await (await b.memory.open("jeppiran-offline-meta-v2"))
    .match("./__jeppiran_active_offline_v2__")).json();
  const entry=state.entries[new URL("./charts/OIIE.pdf",BASE).pathname];
  await (await b.memory.open(entry.cache)).delete(entry.url);
  assert.equal(await b.api.verify(),false,"evicted PDF must fail offline verification");
  assert.match(b.controls.offlineVerifyStatus.textContent,/NOT READY/);
});

test("an unavailable iPad PDF yields a recoverable HTTP status, never a browser-internal network error",async()=>{
  const workerText=fs.readFileSync("web/service-worker.js","utf8");
  const callbacks={};
  const memory=new Storage();
  const SW={
    location:{origin:new URL(BASE).origin},
    registration:{scope:BASE},
    addEventListener(type,handler){callbacks[type]=handler;}
  };
  vm.runInNewContext(workerText,{
    self:SW,caches:memory,fetch:async()=>{throw Error("network disconnected");},
    Response,Request,URL,console
  });
  let responsePromise;
  const request=new Request(BASE+"charts/OIBL.pdf");
  const event={request,respondWith(p){responsePromise=Promise.resolve(p);},waitUntil(){}};
  callbacks.fetch(event);
  const missing=await responsePromise;
  assert.equal(missing.status,503);
  assert.match(await missing.text(),/Go Offline/);
  const legacy=await memory.open("jeppiran-chart-pdfs-v2621-printclean-3");
  await legacy.put(request,new Response("saved-PDF-content"));
  callbacks.fetch(event);
  const saved=await responsePromise;
  assert.equal(saved.status,200);
  assert.equal(await saved.text(),"saved-PDF-content");
});
test("PDF error screen offers direct access to offline settings",()=>{
  const app=fs.readFileSync("web/app.js","utf8");
  assert.match(app,/openOfflineSettingsFromChart/);
  assert.match(app,/This airport PDF has not been saved on this iPad/);
});

test("iPad Go Offline bypasses stale controlling Service Worker responses with SHA-verified fresh URLs",async()=>{
  const b=makeBrowser();
  b.setManifest(await packageFor(files));
  b.staleSW(true);
  await b.api.sync();
  assert.equal(await b.api.hasSnapshot(),true,"stale SW must not corrupt offline sync");
  assert.ok(b.requestUrls.length>=Object.keys(files).length);
  assert.ok(b.requestUrls.every(u=>new URL(u).searchParams.has("jeppiran_offline_sync")),
    "Every downloaded resource must use the network-only integrity channel");
  const result=await b.api.getPdfResponse("./charts/OIIE.pdf",await sha(files["./charts/OIIE.pdf"]));
  assert.equal(await result.text(),files["./charts/OIIE.pdf"]);
  assert.match(b.controls.offlinePackStatus.textContent,/READY OFFLINE/);
});
test("service worker never returns old cache on integrity-marked Go Offline requests",async()=>{
 const textSW=fs.readFileSync("web/service-worker.js","utf8");
 const callbacks={},memory=new Storage(),network=[];
 const SW={location:{origin:new URL(BASE).origin},registration:{scope:BASE},
   addEventListener:(type,handler)=>{callbacks[type]=handler;}};
 vm.runInNewContext(textSW,{self:SW,caches:memory,
   fetch:async(request,opts)=>{network.push({url:request.url,cache:opts?.cache});return new Response("new-asset");},
   Response,Request,URL,console});
 const cache=await memory.open("jeppiran-all-offline-assets-v1");
 await cache.put("./airport-poster-preload.js",new Response("old-asset"));
 const request=new Request(BASE+"airport-poster-preload.js?jeppiran_offline_sync=abcd1234");
 let output;const evt={request,respondWith(p){output=Promise.resolve(p)},waitUntil(){}};
 callbacks.fetch(evt);
 const result=await output;
 assert.equal(await result.text(),"new-asset");
 assert.equal(network.length,1);
 assert.equal(network[0].cache,"no-store");
 const unchanged=await cache.match("./airport-poster-preload.js");
 assert.equal(await unchanged.text(),"old-asset","old verified offline snapshot must remain untouched");
});
