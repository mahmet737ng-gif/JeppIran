"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const web=read("data/oigg-star-flightqa-v2621.json");
const android=read("../app/src/main/assets/oigg-star-flightqa-v2621.json");
const approved=read("data/chart-georef.json");
const index=read("data/charts-current.json");
assert.deepEqual(web,android,"Android + Web require identical QA file");
assert.equal(web.version,2);
assert.equal(web.testOnly,true);
assert.equal(web.notForActualNavigation,true);
assert.equal(web.source.sha256,approved.source.sha256);
assert.equal(web.source.chartDataVersion,"V2621");
assert.equal(web.source.pageCount,1654);
assert.deepEqual(web.charts.map(c=>c.page),[307,308]);
assert.equal(approved.charts.filter(c=>c.airport==="OIII").length,29);
assert.ok(approved.charts.filter(c=>c.airport==="OIGG").every(c=>!([307,308].includes(c.page))));
const sites={RST:{lat:37+19.58/60,lon:49+36.95/60},
KOBUB:{lat:37+6/60+15/3600,lon:50+10/60+44/3600}};
const pixels={
307:{RST:[221.0999984741211,674.1000061035156],KOBUB:[463.44000244140625,169.02001953125],
fp:"a40a3de145df915dd71dcec063477726c6eb31adb0284b12e426f1c6794a81b9"},
308:{RST:[220.9800033569336,673.9800109863281],KOBUB:[463.3800048828125,168.96002197265625],
fp:"ceb66c6a644da4d000d9d23a4121c73be70542a54f0e3e0037537b716a921b81"}};
for(const c of web.charts){
 const v=index.find(x=>x.page===c.page);
 assert.equal(v.airport,"OIGG");assert.equal(v.category,"STAR");
 assert.equal(c.chartKey,[v.airport,v.category.toUpperCase(),v.chart_number,v.name.toUpperCase()].join("|"));
 assert.equal(c.sourceFingerprint,pixels[c.page].fp);
 assert.equal(c.validation.method,"two_vector_landmarks_simulator_qa");
 assert.equal(c.validation.qaTestOnly,true);
 assert.equal(c.validation.notApprovedForNavigation,true);
 assert.ok(c.validation.independentPrintedGridMismatchMaxMetres>=700);
 assert.ok(c.validation.independentPrintedGridMismatchMaxMetres<=1100);
 assert.equal(c.points.length,4);
 const ps=c.points,x=ps.reduce((s,p)=>s+p.x,0)/4,y=ps.reduce((s,p)=>s+p.y,0)/4;
 const lat=ps.reduce((s,p)=>s+p.lat,0)/4,lon=ps.reduce((s,p)=>s+p.lon,0)/4;
 const xs=[...new Set(ps.map(p=>p.x))],ys=[...new Set(ps.map(p=>p.y))];
 assert.equal(xs.length,2);assert.equal(ys.length,2);
 const xlon=(ps[1].x-ps[0].x)/(ps[1].lon-ps[0].lon);
 // Fit using all four independent geometric points, not the false one-axis ratio.
 const p0=ps[0],p1=ps[1],p2=ps[2];
 const L1=p1.lon-p0.lon,T1=p1.lat-p0.lat,L2=p2.lon-p0.lon,T2=p2.lat-p0.lat,den=L1*T2-L2*T1;
 assert.ok(Math.abs(den)>1e-12);
 const ax=((p1.x-p0.x)*T2-(p2.x-p0.x)*T1)/den;
 const bx=((p2.x-p0.x)*L1-(p1.x-p0.x)*L2)/den;
 const ay=((p1.y-p0.y)*T2-(p2.y-p0.y)*T1)/den;
 const by=((p2.y-p0.y)*L1-(p1.y-p0.y)*L2)/den;
 assert.ok(ax*by-bx*ay<0,"Must have physical WGS84 orientation");
 function at(g){return {x:p0.x+ax*(g.lon-p0.lon)+bx*(g.lat-p0.lat),
y:p0.y+ay*(g.lon-p0.lon)+by*(g.lat-p0.lat)}}
 for(const n of ["RST","KOBUB"]){const q=at(sites[n]),expected=pixels[c.page][n];
 assert.ok(Math.hypot(q.x-expected[0],q.y-expected[1])<0.01,"Printed symbol control "+n);}
}
const js=fs.readFileSync(path.join(root,"app.js"),"utf8");
const kt=fs.readFileSync(path.join(root,"../app/src/main/java/com/tareghmsr/jeppiran/ChartGeoreference.kt"),"utf8");
assert.ok(js.includes("loadOiggStarsFlightQa(m)"));
assert.ok(js.includes("GRID DISAGREES 700–940 m"));
assert.ok(kt.includes("loadOiggStarFlightQa(context, selected)"));
console.log("PASS OIGG 307/308 simulator QA only; geodetic source uncertainty visible; protected original untouched");
