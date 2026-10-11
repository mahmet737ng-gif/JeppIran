#!/usr/bin/env node
/**
 * Import parking-chart stand positions and generate proximity candidates for QA.
 * Usage:
 *   node scripts/import_taxi_stands.cjs NETWORK.json STANDS.json OUTPUT.json
 *
 * STANDS.json: {"airport":"LTFM","stands":[{"id":"D3","lat":41.0,
 * "lon":28.0,"source":"parking chart page 12"}]}
 * No link is marked routable: proximity is not physical taxiway connectivity.
 */
'use strict';
const fs=require('node:fs');
const [networkFile,standFile,outputFile]=process.argv.slice(2);
if(!networkFile||!standFile||!outputFile){console.error('Usage: node scripts/import_taxi_stands.cjs NETWORK.json STANDS.json OUTPUT.json');process.exit(2)}
const network=JSON.parse(fs.readFileSync(networkFile,'utf8'));
const data=JSON.parse(fs.readFileSync(standFile,'utf8'));
if(data.airport&&data.airport!==network.airport)throw Error('Airport mismatch');
const positions=Array.isArray(data.stands)?data.stands:Object.entries(data.stands||{}).map(([id,v])=>({...v,id}));
const ids=new Set(),results={},errors=[];
const METERS=111132,DEG=Math.PI/180;
function pointProjection(p,a,b){
 const scale=111320*Math.cos(p.lat*DEG);
 const ax=(a.lon-p.lon)*scale,ay=(a.lat-p.lat)*METERS;
 const bx=(b.lon-p.lon)*scale,by=(b.lat-p.lat)*METERS;
 const dx=bx-ax,dy=by-ay,lengthSquared=dx*dx+dy*dy;
 const t=lengthSquared?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/lengthSquared)):0;
 const x=ax+t*dx,y=ay+t*dy;
 return {lat:p.lat+y/METERS,lon:p.lon+x/scale,distanceMeters:Math.hypot(x,y)};
}
const edges=(network.edges||[]).filter(e=>network.nodes?.[e.from]&&network.nodes?.[e.to]);
for(const raw of positions){
 const id=String(raw.id||'').trim().toUpperCase();
 if(!id||ids.has(id)||!Number.isFinite(raw.lat)||!Number.isFinite(raw.lon)||Math.abs(raw.lat)>90||Math.abs(raw.lon)>180){
  errors.push({id,reason:'Invalid or duplicate stand identifier/coordinates'});continue;
 }
 ids.add(id);
 const p={lat:raw.lat,lon:raw.lon}, candidates=[];
 for(const e of edges){
  const q=pointProjection(p,network.nodes[e.from],network.nodes[e.to]);
  if(q.distanceMeters>60)continue;
  candidates.push({taxiway:e.taxiway||null,edgeFrom:e.from,edgeTo:e.to,
   projectedPoint:{lat:+q.lat.toFixed(8),lon:+q.lon.toFixed(8)},
   distanceMeters:+q.distanceMeters.toFixed(2),connectorVerified:false,routingApproved:false});
 }
 candidates.sort((a,b)=>a.distanceMeters-b.distanceMeters);
 const selected=[],seen=new Set();
 for(const c of candidates){
  const key=c.taxiway||c.edgeFrom+':'+c.edgeTo;
  if(seen.has(key))continue;
  seen.add(key);selected.push(c);
  if(selected.length>=5)break;
 }
 results[id]={position:p,source:raw.source||null,chartPage:raw.chartPage||null,
  candidates:selected,status:selected.length?'NEEDS_CHART_VALIDATION':'NO_NEARBY_EDGE'};
}
const count=Object.values(results).filter(s=>s.candidates.length).length;
const out={schemaVersion:2,airport:network.airport,cycle:network.cycle,
 kind:'stand-connector-candidates',simulationOnly:true,routingApproved:false,
 warning:'Candidates are NOT taxi routes. Approve only connections validated against parking/docking charts.',
 maxDistanceMeters:60,stands:results,errors,
 stats:{input:positions.length,valid:Object.keys(results).length,withCandidates:count,withoutCandidates:Object.keys(results).length-count,rejected:errors.length}};
fs.writeFileSync(outputFile,JSON.stringify(out,null,2)+'\n');
console.log(JSON.stringify(out.stats,null,2));
if(errors.length)process.exitCode=1;
