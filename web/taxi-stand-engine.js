/* JEPPIRAN reusable stand-to-taxi candidate engine · SIM QA ONLY.
 * Stand INS group coordinates do not establish pushback/lead-out connectivity.
 * Graph connectivity is usable only when a separately chart-validated connector
 * is supplied; never bridge a gap because two features happen to be close.
 */
(function(root){
"use strict";
const METERS=111195;
const normalize=id=>String(id||"").trim().toUpperCase();
function explicitStandIds(expression){
  const value=normalize(expression).replace(/\s+THRU\s+/g," thru ");
  const parts=value.split(/\s*,\s*/).filter(Boolean);
  const ids=new Set();
  for(const part of parts){
    const match=part.match(/^([A-Z]*)(\d+) thru ([A-Z]*)(\d+)$/i);
    if(match&&match[1]===match[3]&&Number(match[4])-Number(match[2])>=0&&
       Number(match[4])-Number(match[2])<=40){
      for(let n=Number(match[2]);n<=Number(match[4]);n++)ids.add(match[1]+n);
      continue;
    }
    const sides=part.match(/^([A-Z]*\d+)L thru \1R$/i);
    if(sides){ids.add(sides[1]+"L");ids.add(sides[1]);ids.add(sides[1]+"R");continue}
    if(/^[A-Z]*\d+[LR]?$/.test(part))ids.add(part);
    // Nontrivial or ambiguous ranges retain original printed label only.
  }
  return [...ids];
}
function validate(groupSet,graph){
  return !!(groupSet&&graph&&groupSet.airport===graph.airport&&
    String(groupSet.cycle)===String(graph.cycle)&&groupSet.verifiedForTaxiRouting===false&&
    groupSet.coordinateSystem==="WGS84"&&Array.isArray(groupSet.groups)&&
    graph.nodes&&Array.isArray(graph.edges));
}
function normalizeGroups(groupSet){
  return (groupSet?.groups||[]).filter(g=>typeof g.group==="string"&&
    Number.isFinite(g.lat)&&Number.isFinite(g.lon)&&Math.abs(g.lat)<=90&&Math.abs(g.lon)<=180)
    .map(g=>({...g,standIds:explicitStandIds(g.group),status:"UNVERIFIED_GROUP_COORDINATES"}));
}
function resolve(groupSet,standName){
  const query=normalize(standName).replace(/^ST/,"");
  const groups=normalizeGroups(groupSet);
  const exact=groups.filter(g=>g.standIds.includes(query)||normalize(g.group)===query);
  if(exact.length)return exact;
  // An arbitrary interior ID in an ambiguous mixed-suffix range must not
  // be placed at the group's rounded INS coordinate as though surveyed.
  return [];
}
function footToSegment(group,a,b){
  const c=Math.cos(group.lat*Math.PI/180);
  const px=(a.lon-group.lon)*METERS*c,py=(a.lat-group.lat)*METERS;
  const qx=(b.lon-group.lon)*METERS*c,qy=(b.lat-group.lat)*METERS;
  const dx=qx-px,dy=qy-py,div=dx*dx+dy*dy;
  const t=div>0?Math.max(0,Math.min(1,-(px*dx+py*dy)/div)):0;
  return {distanceMeters:Math.hypot(px+t*dx,py+t*dy),fraction:t};
}
function candidateSegments(graph,group,options={}){
  const maxMeters=Math.max(1,Math.min(1000,Number(options.searchRadiusMeters)||320));
  const limit=Math.max(1,Math.min(20,Math.round(Number(options.maxResults)||8)));
  const byWay=new Map();
  for(const e of graph?.edges||[]){
    if(e.closed||e.runway||e.military||e.allowStandAccess===true)continue;
    const a=graph.nodes?.[e.from],b=graph.nodes?.[e.to];
    if(!a||!b)continue;
    const label=normalize(e.taxiway);
    if(!label||label==="UNNAMED")continue;
    const {distanceMeters,fraction}=footToSegment(group,a,b);
    if(distanceMeters>maxMeters)continue;
    const old=byWay.get(label);
    if(!old||distanceMeters<old.distanceMeters)
      byWay.set(label,{taxiway:label,distanceMeters:+distanceMeters.toFixed(1),
        from:e.from,to:e.to,fraction:+fraction.toFixed(4),state:"PROXIMITY_CANDIDATE_ONLY"});
  }
  return [...byWay.values()].sort((a,b)=>a.distanceMeters-b.distanceMeters).slice(0,limit);
}
function audit(groupSet,graph,options={}){
  if(!validate(groupSet,graph))throw Error("Incompatible INS and ground-graph cycles/airports");
  const groups=normalizeGroups(groupSet);
  const indexed=groups.map(g=>({page:g.page,group:g.group,ids:g.standIds,
    latitude:g.lat,longitude:g.lon,approxOnly:true,
    candidates:candidateSegments(graph,g,options),
    approvedConnector:false}));
  const totalIds=new Set(indexed.flatMap(x=>x.ids));
  return {airport:graph.airport,cycle:String(graph.cycle),groupCount:indexed.length,
    explicitlyIdentifiableStandIds:totalIds.size,
    withNamedNearbyCandidate:indexed.filter(x=>x.candidates.length>0).length,
    connectedStandCount:0,
    approvedForNavigation:false,
    status:"PRELIMINARY_GEO_PROXIMITY_NOT_ROUTING",
    groups:indexed};
}
root.JEPPIRAN_STAND_TOPOLOGY={explicitStandIds,validate,normalizeGroups,resolve,candidateSegments,audit};
})(typeof window!=="undefined"?window:globalThis);
