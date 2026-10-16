"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const data=JSON.parse(fs.readFileSync(path.join(root,"data/oigg-star-flightqa-v2621.json"),"utf8"));
const app=fs.readFileSync(path.join(root,"app.js"),"utf8");
const begin=app.indexOf("function projectOiggSourceWarp("),end=app.indexOf("function projectGeoRaw(",begin);
assert.ok(begin>0&&end>begin,"Source warp function missing");
const warp=Function(app.slice(begin,end)+";return projectOiggSourceWarp;")();
const D12={lat:37+14.12/60,lon:49+50.34/60};
const segment=[[322.44,457.56],[239.52,626.16]]; // Extracted from source PDF page 307 black line
const distanceToSegment=(p,[a,b])=>{
 const vx=b[0]-a[0],vy=b[1]-a[1];
 const t=Math.max(0,Math.min(1,((p.x-a[0])*vx+(p.y-a[1])*vy)/(vx*vx+vy*vy)));
 return Math.hypot(p.x-a[0]-t*vx,p.y-a[1]-t*vy);
};
function calibrated(c){
 const s=c.points,mean=k=>s.reduce((v,p)=>v+p[k],0)/4;
 const meanLon=mean("lon"),meanLat=mean("lat"),meanX=mean("x"),meanY=mean("y");
 let ll=0,bb=0,lb=0,lx=0,bx=0,ly=0,by=0;
 for(const p of s){const lon=p.lon-meanLon,lat=p.lat-meanLat;ll+=lon*lon;bb+=lat*lat;lb+=lon*lat;
 lx+=lon*(p.x-meanX);bx+=lat*(p.x-meanX);ly+=lon*(p.y-meanY);by+=lat*(p.y-meanY);}
 const det=ll*bb-lb*lb;assert.ok(det>1e-9);
 const controls=["RST","D20","KOBUB"].map(k=>c.validation.independentControls[k])
 .map(p=>({lat:p.lat,lon:p.lon,x:p.pdf[0],y:p.pdf[1]}));
 return {meanLon,meanLat,meanX,meanY,
 xLon:(bb*lx-lb*bx)/det,xLat:(ll*bx-lb*lx)/det,
 yLon:(bb*ly-lb*by)/det,yLat:(ll*by-lb*ly)/det,
 routeCorrection:{controls,fullNm:1.5,endNm:6}};
}
const raw=(m,lat,lon)=>({x:m.meanX+m.xLon*(lon-m.meanLon)+m.xLat*(lat-m.meanLat),
 y:m.meanY+m.yLon*(lon-m.meanLon)+m.yLat*(lat-m.meanLat)});
for(const chart of data.charts){
 test("OIGG "+chart.page+" exact PDF ground controls without route snapping",()=>{
  const m=calibrated(chart);
  for(const control of m.routeCorrection.controls){
   const p=warp(m,control.lat,control.lon,raw(m,control.lat,control.lon));
   assert.ok(Math.hypot(p.x-control.x,p.y-control.y)<1e-6,chart.page+" "+JSON.stringify(control));
  }
  const far={lat:37.6,lon:49.61583},r=raw(m,far.lat,far.lon);
  const out=warp(m,far.lat,far.lon,r);
  assert.deepEqual(out,r,"Outside route corridor must retain unchanged global georef");
  // WGS84 orientation is not mirrored at or near the fitted route.
  for(const z of [D12,chart.validation.independentControls.D20]){
   const at=(lat,lon)=>warp(m,lat,lon,raw(m,lat,lon));
   const o=at(z.lat,z.lon),east=at(z.lat,z.lon+1e-5),north=at(z.lat+1e-5,z.lon);
   const det=(east.x-o.x)*(north.y-o.y)-(north.x-o.x)*(east.y-o.y);
   assert.ok(det<0&&Number.isFinite(det),"Source-fitted map must not flip orientation");
  }
 });
}
test("At FSX D12, aircraft moves closer to independently measured 307 PDF black R113 line",()=>{
 const model=calibrated(data.charts.find(p=>p.page===307));
 const old=raw(model,D12.lat,D12.lon),next=warp(model,D12.lat,D12.lon,old);
 const oldDistance=distanceToSegment(old,segment),corrected=distanceToSegment(next,segment);
 assert.ok(oldDistance>3.2&&oldDistance<3.7,"Original ~3.42 PDF-point D12 deviation");
 assert.ok(corrected<1,"R3 must yield ~0.5 point, without snapping exactly onto black line");
 assert.ok(corrected>0.15,"Do not just snap the aircraft onto the printed route");
 assert.ok(Math.hypot(next.x-old.x,next.y-old.y)<6,"Avoid large map displacement");
});
