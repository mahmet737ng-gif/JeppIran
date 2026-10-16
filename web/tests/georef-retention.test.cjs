"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),source=fs.readFileSync(path.join(root,"app.js"),"utf8");
const stable=JSON.parse(fs.readFileSync(path.join(root,"data/chart-georef.json"),"utf8"));
function between(a,b){
 const i=source.indexOf(a),j=source.indexOf(b,i+a.length);
 assert.ok(i>=0&&j>i,"Missing code: "+a);
 return source.slice(i,j);
}
const protectedPages=[309,310,311,312,313,314,315,316,317,318,319,320,321,322,324,326,327,328,329,330,331,332,333,334,335];
const code=between("const OIGG_PROTECTED_PAGES_V2621=","function buildGeorefIndex(root){");
const helpers=Function("OICI_DISABLED_GEOREF_PAGES",code+"\nreturn {validBaseGeorefCandidate,preservePreviouslyPublishedGeorefs,OIGG_PROTECTED_PAGES_V2621};")(new Set([207,209]));
const {validBaseGeorefCandidate:valid,preservePreviouslyPublishedGeorefs:preserve,OIGG_PROTECTED_PAGES_V2621:guard}=helpers;
const manifest={version:"V2621",source_sha256:stable.source.sha256};
const current=new Map(stable.charts.map(x=>[x.page,{page:x.page,stable:true}]));
test("every published OIGG source record is present and protected in V2621",()=>{
 assert.equal(stable.charts.length,807);
 assert.deepEqual([...guard].sort((a,b)=>a-b),protectedPages);
 assert.equal(stable.charts.filter(c=>c.airport==="OIGG").length,25);
 assert.ok(protectedPages.every(p=>current.has(p)));
 assert.ok(valid(stable,current,manifest));
});
test("missing/partial chart source rejected without losing any prior stable georefs",()=>{
 assert.equal(valid(null,new Map(),manifest),false);
 assert.equal(valid(stable,new Map(),manifest),false);
 const wrongCycle={...stable,source:{...stable.source,chartDataVersion:"V2620"}};
 assert.equal(valid(wrongCycle,current,manifest),false);
 const wrongPdf={...stable,source:{...stable.source,sha256:"0".repeat(64)}};
 assert.equal(valid(wrongPdf,current,manifest),false);
 const broken=new Map(current);broken.delete(317);
 assert.equal(valid(stable,broken,manifest),false);
 const recovered=preserve(current,broken);
 assert.equal(recovered.size,current.size);
 assert.equal(recovered.get(317),current.get(317));
 const onePageAdded=new Map(current);onePageAdded.set(9999,{page:9999});
 assert.equal(preserve(current,onePageAdded).size,current.size+1);
});
test("legacy off switch does not silently suppress Rasht or other test overlays",()=>{
 const head=between('const EXP_GEO_PAGE_KEY=',"// Reversible owner flight QA");
 const prefs=new Map([["jeppiran-v2621-experimental-georef-enabled","off"]]);
 const store={getItem:k=>prefs.has(k)?prefs.get(k):null,setItem:(k,v)=>prefs.set(k,v)};
 const {experimentalGeorefOn:enabled,EXP_GEO_PAGE_KEY:key}=Function("localStorage",head+"\nreturn {experimentalGeorefOn,EXP_GEO_PAGE_KEY};")(store);
 assert.equal(enabled(307),true);
 assert.equal(enabled(308),true);
 assert.equal(enabled(317),true);
 prefs.set(key+"307","off");
 assert.equal(enabled(307),false);
 assert.equal(enabled(308),true);
 assert.equal(enabled(317),true);
});
test("chart-scoped QA toggle changes only the selected page; protected stable Rasht untouched",()=>{
 const head=between('const EXP_GEO_PAGE_KEY=',"// Reversible owner flight QA");
 const toggle=between("function togglePublishedExperimentalGeoref(){","function showPublishedExperimentalGeorefNotice(){");
 const prefs=new Map(),storage={getItem:k=>prefs.get(k)||null,setItem:(k,v)=>prefs.set(k,v)};
 const stable309={baseline:true},qa307={test:307},qa308={test:308};
 const active=new Map([[307,qa307],[308,qa308],[309,stable309]]);
 const eligible=new Map([[307,qa307],[308,qa308]]);
 const sandbox=Function("localStorage","selectedChart","experimentalEligibleGeoModels","georefByPage",
    "experimentalGeorefPages","EXPERIMENTAL_OIMM_ILS_PAGES","experimentalOimmPreviousModels",
    "showPublishedExperimentalGeorefNotice","updateAircraftMarker","refreshPositionStatus",
    head+"\n"+toggle+"\nreturn {togglePublishedExperimentalGeoref,experimentalGeorefOn};")(
    storage,{page:307},eligible,active,new Set([307,308]),new Set([605,606,607]),new Map(),
    ()=>{},()=>{},()=>{});
 sandbox.togglePublishedExperimentalGeoref();
 assert.equal(active.has(307),false);
 assert.equal(active.get(308),qa308);
 assert.equal(active.get(309),stable309);
 sandbox.togglePublishedExperimentalGeoref();
 assert.equal(active.get(307),qa307);
 assert.equal(active.get(308),qa308);
 assert.equal(active.get(309),stable309);
});
console.log("PASS protected 25 OIGG source references, retry-safe georef retention, per-chart opt out");
