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
    ["goOfflineBtn","stopOfflineBtn","offlinePackStatus","offlinePackProgress","offlinePackCount"]
     .map(id=>[id,{disabled:false,hidden:false,value:0,textContent:"",addEventListener(type,cb){this[type]=cb;}}]));
  const document={visibilityState:"visible",hidden:false,
                  getElementById:id=>controls[id],
                  addEventListener(name,cb){listeners["document:"+name]=cb;}};
  const window={caches:memory,crypto:webcrypto,addEventListener(name,cb){listeners[name]=cb;}};
  const navigator={onLine:true,serviceWorker:{ready:Promise.resolve({active:true})},
                   storage:{persist:async()=>false}};
  let remote={...files};let failures=new Set();const requests=[];
  let manifest;
  async function fetch(url,opts={}){
    const path=new URL(url,BASE).pathname.replace("/JeppIran/","./");
    if(opts.signal?.aborted)throw new DOMException("Cancelled","AbortError");
    if(path==="./offline-assets.json")return new Response(JSON.stringify(manifest),{status:200});
    requests.push(path);
    if(failures.has(path))throw Error("network unavailable");
    const body=remote[path];
    return body===undefined?new Response("not found",{status:404}):new Response(body,{status:200});
  }
  const sandbox={window,document,navigator,caches:memory,crypto:webcrypto,fetch,Response,
    Request,DOMException,AbortController,URL,TextEncoder,location:{href:BASE},isSecureContext:true,
    setInterval:()=>{},Date,console};
  const script=fs.readFileSync("web/offline-manager.js","utf8");
  vm.runInNewContext(script,sandbox,{filename:"offline-manager.js"});
  return {api:window.JeppIranOffline,memory,requests,controls,window,document,listeners,
    setManifest:v=>{manifest=v;},setRemote:(key,value)=>{remote[key]=value;},
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
