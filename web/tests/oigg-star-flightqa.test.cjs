"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,".."),read=p=>fs.readFileSync(path.join(root,p),"utf8");
const json=p=>JSON.parse(read(p));
const web=json("data/oigg-star-flightqa-v2621.json");
const android=json("../app/src/main/assets/oigg-star-flightqa-v2621.json");
const stable=json("data/chart-georef.json"),index=json("data/charts-current.json");
assert.deepEqual(web,android,"Web and Android flight QA model must be identical");
assert.equal(web.calibrationRevision,"oigg-rst-d20-local-warp-flightqa-r3");
assert.equal(web.version,2);assert.equal(web.testOnly,true);assert.equal(web.notForActualNavigation,true);
assert.equal(web.source.sha256,stable.source.sha256);assert.equal(stable.charts.length,807);
assert.deepEqual(web.charts.map(c=>c.page),[307,308]);
assert.ok(stable.charts.every(c=>![307,308].includes(c.page)),"Protected production models were altered");
const fingerprints={307:"a40a3de145df915dd71dcec063477726c6eb31adb0284b12e426f1c6794a81b9",308:"ceb66c6a644da4d000d9d23a4121c73be70542a54f0e3e0037537b716a921b81"};
for(const c of web.charts){
 const v=c.validation,k=index.find(x=>x.page===c.page);
 assert.equal(c.sourceFingerprint,fingerprints[c.page]);
 assert.equal(c.chartKey,[k.airport,k.category.toUpperCase(),k.chart_number,k.name.toUpperCase()].join("|"));
 assert.equal(v.method,"three_source_controls_printed_grid_simulator_qa");
 assert.equal(c.routeWarp?.type,"oigg_source_control_local_residual");
 assert.equal(c.routeWarp?.simulatorOnly,true);
 assert.deepEqual(c.routeWarp?.controls,["RST","D20","KOBUB"]);
 assert.equal(v.qaTestOnly,true);assert.equal(v.notApprovedForNavigation,true);
 assert.equal(v.userFsxEvidence.d15HeldOutWithoutPdfSymbol.usedInFit,false);
 assert.ok(v.independentPrintedGridMismatchMaxMetres>=250&&v.independentPrintedGridMismatchMaxMetres<=650);
 assert.ok(v.originalRejectedGridMismatchMaxMetres>=900);
 assert.equal(c.points.length,4);
 const p=c.points,mlat=p.reduce((a,q)=>a+q.lat,0)/4,mlon=p.reduce((a,q)=>a+q.lon,0)/4,mx=p.reduce((a,q)=>a+q.x,0)/4,my=p.reduce((a,q)=>a+q.y,0)/4;
 let ll=0,bb=0,lb=0,lx=0,bx=0,ly=0,by=0;
 for(const q of p){const l=q.lon-mlon,t=q.lat-mlat;ll+=l*l;bb+=t*t;lb+=l*t;lx+=l*(q.x-mx);bx+=t*(q.x-mx);ly+=l*(q.y-my);by+=t*(q.y-my)}
 const d=ll*bb-lb*lb;assert.ok(d>1e-12);
 const xlon=(bb*lx-lb*bx)/d,xlat=(ll*bx-lb*lx)/d,ylon=(bb*ly-lb*by)/d,ylat=(ll*by-lb*ly)/d;
 assert.ok(xlon*ylat-xlat*ylon<0,"Chart projection must not mirror WGS84");
 const proj=(lat,lon)=>[mx+xlon*(lon-mlon)+xlat*(lat-mlat),my+ylon*(lon-mlon)+ylat*(lat-mlat)];
 for(const name of ["RST","D20","KOBUB"]){
   const m=v.independentControls[name],q=proj(m.lat,m.lon),err=Math.hypot(q[0]-m.pdf[0],q[1]-m.pdf[1]);
   assert.ok(err<4.2,"Control "+name+" page "+c.page+" exceeded QA residual");
 }
 for(const g of v.independentControls.printedGraticule)
    assert.ok(Math.abs(proj(g.comparisonLatitude,g.lon)[1]-g.y)<5.6,"Printed grid QA failed");
 assert.ok(v.residualsPdfPoints.D20<3.7&&v.maxCalibrationResidualPdfPoints<5.6);
 assert.ok(p.every(q=>q.source.includes("Derived grid node")));
}
const app=read("app.js"),native=read("../app/src/main/java/com/tareghmsr/jeppiran/ChartGeoreference.kt");
assert.ok(app.includes("three_source_controls_printed_grid_simulator_qa"));
assert.ok(native.includes("three_source_controls_printed_grid_simulator_qa"));
assert.ok(app.includes("oigg-local-r3"));
assert.ok(read("index.html").includes("oigg-d20-r2"));
assert.ok(read("service-worker.js").includes("oigg-d20-r2"));
console.log("PASS OIGG STAR 307/308 revised flight-only QA, D20 and original grid; 807 protected georefs unchanged");
