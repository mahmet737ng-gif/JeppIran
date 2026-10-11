#!/usr/bin/env node
/**
 * LTFM stand connector candidate generator (simulator QA only).
 * Usage: node scripts/build_stand_candidates.cjs web/data/taxi-networks/LTFM.json path/to/stands.json output.json
 * Input stands.json: {"stands":{"D3":{"lat":41.0,"lon":28.0},...}}
 * OR {"stands":[{"id":"D3","lat":41.0,"lon":28.0},...]}.
 * The candidate line is a geometric projection, NOT a surveyed lead-in,
 * pushback path or permission to taxi. Only confirmed chart paths may be routable.
 */
const fs=require('fs');
const [networkPath,standPath,outputPath]=process.argv.slice(2);
if(!networkPath||!standPath||!outputPath){console.error('Usage: node build_stand_candidates.cjs network.json stands.json output.json');process.exit(2)}
const net=JSON.parse(fs.readFileSync(networkPath,'utf8'));
const input=JSON.parse(fs.readFileSync(standPath,'utf8'));
const entries=Array.isArray(input.stands)?input.stands.map(s=>[String(s.id||s.name),s]):Object.entries(input.stands||{});
const MAX_METERS=60,MAX_CANDIDATES=5;
function meters(lat){return [111132,111320*Math.cos(lat*Math.PI/180)]}
function project(p,a,b){
 const [sy,sx]=meters(p.lat), ax=(a.lon-p.lon)*sx,ay=(a.lat-p.lat)*sy,bx=(b.lon-p.lon)*sx,by=(b.lat-p.lat)*sy;
 const dx=bx-ax,dy=by-ay,t=dx*dx+dy*dy?Math.max(0,Math.min(1,-(ax*dx+ay*dy)/(dx*dx+dy*dy))):0;
 const x=ax+t*dx,y=ay+t*dy;return {lat:p.lat+y/sy,lon:p.lon+x/sx,distanceMeters:Math.hypot(x,y),fraction:t}
}
const edges=(net.edges||[]).filter(e=>net.nodes[e.from]&&net.nodes[e.to]);
const output={schemaVersion:1,airport:net.airport,cycle:net.cycle,kind:'stand-connector-candidates',verifiedForNavigation:false,simulationOnly:true,routingApproved:false,warning:'NEAREST does not imply CONNECTED. These are candidate projections only, not surveyed stand exits, lead-in or pushback traces.',maxDistanceMeters:MAX_METERS,stands:{},stats:{}};
for(const [id,stand] of entries){
 if(!id||!Number.isFinite(+stand.lat)||!Number.isFinite(+stand.lon))continue;
 const p={lat:+stand.lat,lon:+stand.lon};
 const nearest=[];
 for(const e of edges){
  const q=project(p,net.nodes[e.from],net.nodes[e.to]);
  if(q.distanceMeters>MAX_METERS)continue;
  nearest.push({taxiway:e.taxiway||null,edgeFrom:e.from,edgeTo:e.to,projectedPoint:{lat:+q.lat.toFixed(8),lon:+q.lon.toFixed(8)},distanceMeters:+q.distanceMeters.toFixed(1),fraction:+q.fraction.toFixed(5),connectorVerified:false,routingApproved:false});
 }
 nearest.sort((a,b)=>a.distanceMeters-b.distanceMeters);
 const seen=new Set(),candidates=[];
 for(const x of nearest){const key=x.taxiway||x.edgeFrom+'_'+x.edgeTo;if(!seen.has(key)){seen.add(key);candidates.push(x)}if(candidates.length>=MAX_CANDIDATES)break}
 output.stands[id]={position:p,candidates,status:candidates.length?'NEEDS_CHART_VALIDATION':'NO_NEARBY_EDGE',source:stand.source||null};
}
output.stats={inputStands:entries.length,locatedStands:Object.keys(output.stands).length,withCandidates:Object.values(output.stands).filter(s=>s.candidates.length).length,withoutCandidates:Object.values(output.stands).filter(s=>!s.candidates.length).length};
fs.writeFileSync(outputPath,JSON.stringify(output,null,2)+'\n');
console.log(JSON.stringify(output.stats));
