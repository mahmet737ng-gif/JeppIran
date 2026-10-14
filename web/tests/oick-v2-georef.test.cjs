"use strict";
// OICK V2621 source-lock georeference regression; models for simulator QA ONLY.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const dir=path.resolve(__dirname,"..");
const load=p=>JSON.parse(fs.readFileSync(path.join(dir,p),"utf8"));
const d=load("data/oick-georef-v2621.json"),native=load("../app/src/main/assets/oick-georef-v2621.json");
const original=load("data/chart-georef.json");
assert.deepEqual(d,native,"Web and Android must have identical V2 source models");
assert.equal(d.schemaVersion,1);
assert.equal(d.type,"OICK_V2621_GEOREFERENCE_REGIONS");
assert.equal(d.cycle,"V2621");assert.equal(d.sourceSha256,original.source.sha256);
assert.equal(d.safeForActualNavigation,false);
assert.deepEqual(d.pages.map(p=>p.page),[218,219,221,223]);
assert.deepEqual(original.charts.filter(c=>c.airport==="OICK").map(c=>c.page).sort((a,b)=>a-b),[220,224,225,226]);
assert.equal(original.charts.filter(c=>c.airport==="OIII").length,29);
const expected={218:1,219:1,221:2,223:1};let count=0;
for(const page of d.pages){
  assert.equal(page.regions.length,expected[page.page]);count+=page.regions.length;
  for(const {id,model} of page.regions){
    assert.equal(model.page,page.page);assert.equal(model.chartKey,page.chartKey);
    assert.equal(model.sourceFingerprint,page.sourceFingerprint);
    assert.equal(model.validation.v2Region,id);
    assert.equal(model.validation.qaTestOnly,true);assert.equal(model.validation.notApprovedForNavigation,true);
    assert.ok(model.points.length>=4);
    assert.ok(model.validation.measuredSourceTickResidualPdfPoints<=.2);
    for(const p of model.points)assert.ok(p.x>=model.bounds.left-.01&&p.x<=model.bounds.right+.01&&
      p.y>=model.bounds.top-.01&&p.y<=model.bounds.bottom+.01);
    const a=model.points[0],b=model.points.find(p=>p.lat===a.lat&&p.lon!==a.lon),
          c=model.points.find(p=>p.lon===a.lon&&p.lat!==a.lat);
    assert.ok(b&&c);
    const dlon=b.lon-a.lon,dlat=c.lat-a.lat;
    const det=((b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x))/(dlon*dlat);
    assert.ok(det<0,"Reject mirrored geographic transform");
    const project=(lat,lon)=>({
      x:a.x+(lon-a.lon)*(b.x-a.x)/dlon+(lat-a.lat)*(c.x-a.x)/dlat,
      y:a.y+(lon-a.lon)*(b.y-a.y)/dlon+(lat-a.lat)*(c.y-a.y)/dlat
    });
    for(const mark of model.validation.independentChecks){
      const p=project(mark.lat,mark.lon),q=mark.referencePdfCenter;
      assert.ok(Math.hypot(p.x-q[0],p.y-q[1])<=1.5,"Independent KRD check");
    }
  }
}
assert.equal(count,5);
const adc=d.pages.find(p=>p.page===221);
assert.equal(adc.regions[0].id,"parking_apron_inset");
assert.equal(adc.regions[1].id,"main_adc");
assert.ok(adc.regions[1].model.excludedBounds.length);
assert.ok(d.pages.find(p=>p.page===223).regions[0].model.excludedBounds.length);
const app=fs.readFileSync(path.join(dir,"app.js"),"utf8");
const android=fs.readFileSync(path.join(dir,"../app/src/main/java/com/tareghmsr/jeppiran/ChartGeoreference.kt"),"utf8");
assert.ok(app.includes("loadPublishedOickV2Georefs(m)"));
assert.ok(android.includes("loadPublishedOickV2(context, selected)"));
assert.ok(android.includes("strictBounds = true"));
console.log("PASS: protected source models, 4 OICK pages and 5 simulator map regions");
