"use strict";
// Three OIIE new simulator georef pages from verified original PDF vector grids.
// NEVER delete, replace or auto-certify ANY existing published georeference.
const {test}=require("node:test"),assert=require("node:assert/strict");
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const sha="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6";
const expected={
  376:["OIIE|SID|20-3E|RUS 4C, RUS 4D","fc0a0285d01f39872f68bae9fddf39cb6703f8c8c1d1776125de2c188d873c9b"],
  386:["OIIE|APPROACH||LOC RWY 29R","17c4902191d2ee254d3c378ed23c75e973d1da66377d99b86c24742bfe81adeb"],
  388:["OIIE|APPROACH||ILS RWY 29R","4185dfa21c0adf26e52ac08439bf4507bf16fd7014d89ab8cea08d9b23d95e23"]
};
test("all previously approved georeferences are immutable and Android/Web source files identical",()=>{
 const w=fs.readFileSync(path.join(root,"data/chart-georef.json"));
 const a=fs.readFileSync(path.join(root,"../app/src/main/assets/chart-georef.json"));
 assert.deepEqual(w,a);
 const base=JSON.parse(w);
 assert.equal(base.source.sha256,sha);
 assert.equal(base.charts.length,807);
 assert.equal(base.charts.filter(c=>c.airport==="OIII").length,29);
 assert.equal(base.charts.filter(c=>c.airport==="OIIE").length,24);
 assert.ok(base.charts.filter(c=>c.airport==="OIIE").every(c=>!Object.hasOwn(expected,c.page)));
});
test("three source-calibrated OIIE overlays match V2621 chart keys and independent vector controls",()=>{
 const qa=load("data/oiie-missing-sid-ils-flightqa-v2621.json");
 const native=load("../app/src/main/assets/oiie-missing-sid-ils-flightqa-v2621.json");
 const index=load("data/charts-current.json");
 assert.deepEqual(qa,native);
 assert.equal(qa.version,2);
 assert.equal(qa.source.sha256,sha);
 assert.equal(qa.source.chartDataVersion,"V2621");
 assert.equal(qa.source.pageCount,1654);
 assert.equal(qa.coordinateSystem,"WGS84");
 assert.equal(qa.coordinateSpace,"pdf_points");
 assert.equal(qa.origin,"top_left");
 assert.equal(qa.testOnly,true);
 assert.equal(qa.notForActualNavigation,true);
 assert.deepEqual(qa.charts.map(c=>c.page),[376,386,388]);
 for(const c of qa.charts){
  const idx=index.find(x=>Number(x.page)===c.page);
  assert.equal(idx.airport,"OIIE");
  assert.equal(c.chartKey,[idx.airport,idx.category.toUpperCase(),idx.chart_number,idx.name.toUpperCase()].join("|"));
  assert.equal(c.chartKey,expected[c.page][0]);
  assert.equal(c.sourceFingerprint,expected[c.page][1]);
  assert.equal(c.validation.originalPdfSha256,sha);
  assert.equal(c.validation.qaTestOnly,true);
  assert.equal(c.validation.notApprovedForNavigation,true);
  assert.equal(c.validation.flightSimulatorQAOnly,true);
  assert.equal(c.validation.method,c.page===376?"two_navaid_source_grid_flight_qa":"crossplate_ika_grid_flight_qa");
  assert.equal(c.points.length,4);
  assert.equal(c.maxResidualPdfPoints,.5);
  assert.equal(c.width,612);
  assert.equal(c.height,792);
  const errors=Object.values(c.validation.independentCheckErrorsPdfPoints);
  assert.ok(errors.length>=2);
  assert.ok(errors.every(x=>Number.isFinite(x)&&x>=0&&x<=1.5));
  assert.equal(c.excludedBounds.length,c.page===376?0:2);
  for(const p of c.points){
   assert.ok(p.x>=c.bounds.left&&p.x<=c.bounds.right);
   assert.ok(p.y>=c.bounds.top&&p.y<=c.bounds.bottom);
   for(const mask of c.excludedBounds)
    assert.ok(!(p.x>=mask.left&&p.x<=mask.right&&p.y>=mask.top&&p.y<=mask.bottom),
       "control point cannot be in NOT TO SCALE box");
  }
  const point0=c.points[0],b=c.points[1],north=c.points[2];
  const xLon=(b.x-point0.x)/(b.lon-point0.lon),
        yLat=(north.y-point0.y)/(north.lat-point0.lat);
  assert.ok(xLon>0&&yLat<0,"reject mirrored map");
  const lon0=point0.lon,lat0=point0.lat;
  const project=(lat,lon)=>[point0.x+(lon-lon0)*xLon,point0.y+(lat-lat0)*yLat];
  if(c.page===376){
    for(const control of c.validation.sourceControlPoints.filter(x=>x.id==="RUS"||x.id==="IKA")){
      const predicted=project(control.lat,control.lon);
      assert.ok(Math.hypot(predicted[0]-control.pdf[0],predicted[1]-control.pdf[1])<.01);
    }
    assert.ok(c.validation.independentCheckErrorsPdfPoints["35-30"]<=1.5);
    assert.ok(c.validation.independentCheckErrorsPdfPoints["51-00"]<.15);
  }else{
    const ika=c.validation.sourceControlPoints.find(x=>x.id==="IKA");
    const predicted=project(ika.lat,ika.lon);
    assert.ok(Math.hypot(predicted[0]-ika.pdf[0],predicted[1]-ika.pdf[1])<.75);
    assert.ok(c.validation.independentCheckErrorsPdfPoints.IKA_VOR_pdf_points<.75);
    assert.ok(c.validation.independentCheckErrorsPdfPoints.shared_D6_2_vector_shift_pdf_points<.05);
    assert.ok(c.excludedBounds.some(m=>m.left<=119&&119<=m.right&&m.top<=391&&391<=m.bottom));
    assert.ok(c.excludedBounds.some(m=>m.left<=503&&503<=m.right&&m.top<=388&&388<=m.bottom));
  }
 }
});
test("Viewer integration is reversible, source locked, locally bundled and flight QA-labeled",()=>{
 const web=fs.readFileSync(path.join(root,"app.js"),"utf8"),
       kt=fs.readFileSync(path.join(root,"../app/src/main/java/com/tareghmsr/jeppiran/ChartGeoreference.kt"),"utf8"),
       activity=fs.readFileSync(path.join(root,"../app/src/main/java/com/tareghmsr/jeppiran/PdfViewerActivity.kt"),"utf8");
 assert.match(web,/loadOiiMissingSidIlsFlightQa\(m\)/);
 assert.match(web,/experimentalEligibleGeoModels\.set\(page,model\)/);
 assert.match(web,/OIIE SID\/ILS · SOURCE GRID/);
 assert.match(kt,/loadOiiMissingSidIlsFlightQa\(context, selected\)/);
 assert.match(activity,/isOiiMissingGeoQa/);
 assert.match(activity,/NOT FOR ACTUAL NAVIGATION/);
});
