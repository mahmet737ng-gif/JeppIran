/* V2621 multi-region PDF airport georef regression.
 * Execute: node web/tests/multi-region-airport-georef.test.cjs
 * All current approved source records must stay identical in Web and Android.
 */
"use strict";
const assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto");
const root=path.resolve(__dirname,"..");
const web=fs.readFileSync(path.join(root,"data/chart-georef.json"));
const android=fs.readFileSync(path.join(root,"../app/src/main/assets/chart-georef.json"));
assert.equal(crypto.createHash("sha256").update(web).digest("hex"),
             crypto.createHash("sha256").update(android).digest("hex"),
             "Production source chart models must be restored without alteration");
const original=JSON.parse(web),data=require("../data/airport-region-georef-v2621.json");
assert.ok(original.charts.length>=776,"Additive source georeferences must not shrink the baseline");
assert.equal(original.charts.filter(c=>c.airport==="OIII").length,29,"Mehrabad georeferencing record count frozen");
assert.equal(data.regions.length,3);
assert.equal(original.source.sha256,data.source.sha256);
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const a=app.indexOf("function geoNum("),b=app.indexOf("function buildGeorefIndex(");
assert.ok(a>=0&&b>a,"Viewer georeference selector must be present");
const api=new Function("lastPosition",app.slice(a,b)+
  "\nreturn {makeGeoModel,resolveGeoRegion,projectGeo};")({lat:0,lon:0});
const models=Object.fromEntries(data.regions.map(d=>[d.id,api.makeGeoModel(d)]));
assert.ok(Object.values(models).every(Boolean),"Every PDF grid affine passes QA");
const oldCargo=api.makeGeoModel(original.charts.find(c=>c.page===383));
assert.ok(oldCargo&&oldCargo.excluded.length===1);
assert.equal(original.charts.some(c=>c.page===432),false,
  "OIII parking remains an independent region overlay without modifying original charts");
const o2={...oldCargo,regions:[
 {id:"CARGO_APRON_2",model:oldCargo},
 {id:"SALAM_APRON_3",model:models.SALAM_APRON_3}]};
const o3={...models.OIII_PARKING_MAIN,regions:[
 {id:"OIII_APRON_5_INSET",model:models.OIII_APRON_5_INSET},
 {id:"OIII_PARKING_MAIN",model:models.OIII_PARKING_MAIN}]};
const check=(model,lat,lon,id)=>{
 const choice=api.resolveGeoRegion(model,lat,lon);
 assert.equal(choice?.region||null,id);
 if(id)assert.ok(choice?.point&&Number.isFinite(choice.point.x)&&Number.isFinite(choice.point.y));
};
check(o2,35+24.45/60,51+10.45/60,"CARGO_APRON_2");
check(o2,35+25.9/60,51+7.5/60,"SALAM_APRON_3");
check(o3,35+41.4/60,51+19.0/60,"OIII_PARKING_MAIN");
check(o3,35+41.85/60,51+17.95/60,"OIII_APRON_5_INSET");
check(o3,35.5,51.2,null);
assert.ok(app.includes('["region",()=>loadIndependentAirportRegionGeorefs(m)]'),
  "Airport region loader must be scheduled by the guarded async bootstrap");
assert.ok(app.includes("resolveGeoRegion(model,Number(lastPosition?.lat),Number(lastPosition?.lon))"));
console.log("PASS OIIE Cargo/Salam & OIII main/Apron5 independent georef; source Web/Android assets identical; 29 OIII records preserved");
