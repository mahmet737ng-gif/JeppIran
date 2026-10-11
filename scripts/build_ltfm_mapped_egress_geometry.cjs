#!/usr/bin/env node
/* JEPPIRAN LTFM/IST: Extract REAL EXISTING (OSM) taxiway edge geometry
 * surrounding chart-published stand pushback taxiway names. This script
 * NEVER invents the stand-to-edge connector. For simulation/QA ONLY.
 *
 * Invariant: every published segment equals an ORIGINAL graph edge's
 * true WGS84 node-to-node geometry. Distinct black Jeppesen leader/callout
 * lines are not asserted as taxiway centerlines.
 * Run: node scripts/build_ltfm_mapped_egress_geometry.cjs
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const load=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const net=load("web/data/taxi-networks/LTFM.json");
const register=load("web/data/taxi-stand-registry/LTFM.json");
const cand=load("web/data/taxi-stand-candidates/LTFM.json");
for(const d of [net,register,cand])
 if(d.airport!=="LTFM"||String(d.cycle)!=="2621")throw Error("Wrong chart cycle");
const rad=Math.PI/180;
function length(a,b){
 const lat=(a.lat+b.lat)/2*rad;
 return Math.hypot((a.lat-b.lat)*111132,(a.lon-b.lon)*111320*Math.cos(lat));
}
const byEndpoint=new Map(),edgeLookup=new Map();
for(let i=0;i<net.edges.length;i++){
 const e=net.edges[i],a=net.nodes[e.from],b=net.nodes[e.to];
 if(!a||!b||e.closed||e.runway||e.military)continue;
 for(const n of [e.from,e.to]){
  if(!byEndpoint.has(n))byEndpoint.set(n,[]);
  byEndpoint.get(n).push(i);
 }
 const key=[e.from,e.to].sort().join("|")+"|"+e.taxiway;
 if(!edgeLookup.has(key))edgeLookup.set(key,[]);
 edgeLookup.get(key).push(i);
}
function connectedEdges(stand,seedIndex,limitMeters=115){
 const seed=net.edges[seedIndex],way=seed.taxiway;
 // Explore the exact contiguous SAME-NAME OSM way around the chart-matching
 // location; boundaries do not snap to proximity or leave to other names.
 const result=new Set([seedIndex]),queue=[];
 for(const id of [seed.from,seed.to])queue.push([id,0]);
 const visited=new Map();
 while(queue.length){
  const [node,reach]=queue.shift();
  if(reach>limitMeters||visited.has(node)&&visited.get(node)<=reach)continue;
  visited.set(node,reach);
  for(const i of byEndpoint.get(node)||[]){
   const e=net.edges[i];
   if(e.taxiway!==way)continue;
   const other=e.from===node?e.to:e.from;
   const dist=length(net.nodes[node],net.nodes[other]);
   if(reach+dist>limitMeters+dist/2)continue;
   result.add(i);
   if(!visited.has(other)||visited.get(other)>reach+dist)queue.push([other,reach+dist]);
  }
 }
 return [...result].sort((a,b)=>a-b);
}
const out={schemaVersion:1,airport:"LTFM",cycle:"2621",
 kind:"stand-egress-existing-centerline-evidence",coordinateSystem:"WGS84",
 sources:{taxiway:"OpenStreetMap contributors (ODbL 1.0), original cycle-2621 network edges",
 stand:"Jeppesen 30-9B/30-9C schematic parking stand LABELS",
 name:"Jeppesen LTFM 30-9J2..J12 published pushback taxiway texts"},
 simulationOnly:true,verifiedForNavigation:false,routingApproved:false,
 disclaimer:"These are ONLY true pre-existing OSM taxiway centerline segments near the stand and matching the published pushback name. The STAND-TO-NAMED-TAXIWAY curve / lead-out / pushback trajectory is NOT represented. Stand labels are not surveyed stop positions. NEVER draw an interpolated line as approved stand route.",
 stands:{},stats:{}};
let geometried=0,withTexts=0,withoutNames=0,withoutPoints=0,segments=0,groupOnly=0;
for(const [id,record] of Object.entries(register.stands)){
 const entry={id,position:record.position,standLocationType:record.locationType,
 officialPushbackTargets:record.publishedPushbackTaxiways,
 unmappedOfficialTaxiways:record.namedTaxiwaysWithoutCenterline,
 publishedCharts:record.sourcePushbackCharts,standConnectorVerified:false,
 publishedNamedTaxiwaySegments:[],noArtificialStandConnector:true};
 if(record.publishedPushbackTaxiways.length)withTexts++;
 if(record.locationType!=="PRINTED_LABEL_ANCHOR"){
  groupOnly++;entry.reason="ONLY_ROUNDED_INS_GROUP";out.stands[id]=entry;continue;
 }
 const hits=(cand.stands[id]?.candidates||[]).filter(c=>
   c.chartNamedTaxiwayMatch&&record.publishedPushbackTaxiways.includes(c.taxiway));
 const named=new Map();
 for(const h of hits){
  const key=[h.edgeFrom,h.edgeTo].sort().join("|")+"|"+h.taxiway;
  const i=edgeLookup.get(key)?.[0];
  if(i===undefined)throw Error("QA: candidate edge missing from physical graph "+id);
  const segs=connectedEdges(record,i);
  const list=named.get(h.taxiway)||new Map();
  for(const ix of segs){
   const e=net.edges[ix],a=net.nodes[e.from],b=net.nodes[e.to];
   list.set(ix,{
     fromNode:e.from,toNode:e.to,osmWay:e.osmWay,
     taxiway:e.taxiway,geometry:[[a.lon,a.lat],[b.lon,b.lat]],
     lengthMeters:Math.round(length(a,b)*100)/100,
     source:"ORIGINAL_OSM_TAXIWAY_EDGE",routingApproved:false
   });
  }
  named.set(h.taxiway,list);
 }
 for(const [taxiway,data] of named){
  const closest=hits.filter(v=>v.taxiway===taxiway).sort((a,b)=>a.distanceMeters-b.distanceMeters)[0];
  entry.publishedNamedTaxiwaySegments.push({
    taxiway,closestPrintedLabelDistanceMeters:closest.distanceMeters,
    geometryValidatedAsOriginalOsmEdges:true,
    // Subgraph is a real chart-correlated taxiway section, not an exit
    // starting on a parking stand; no stand-to-edge projection in paths.
    standToTaxiwayExitGeometryExtracted:false,
    chartRouteUnverified:true,segments:[...data.values()]
  });
  segments+=data.size;
 }
 if(entry.publishedNamedTaxiwaySegments.length)geometried++;
 else withoutNames++;
 if(!record.position)withoutPoints++;
 out.stands[id]=entry;
}
out.stats={
 allNamedStands:Object.keys(out.stands).length,
 printedIndividualStandLabels:Object.keys(out.stands).length-groupOnly,
 groupOnlyStands:groupOnly,standNamesWithPushbackText:withTexts,
 standsWithMappedPublishedTaxiwayGeometry:geometried,
 printedLabelsWithoutCorroboratedNamedGeometry:withoutNames,
 physicalCenterlineEdgeSegmentsRecorded:segments,
 physicallyVerifiedStandLeadOuts:0
};
if(out.stats.allNamedStands!==379||geometried<195||groupOnly!==116||
   out.stats.physicallyVerifiedStandLeadOuts!==0)
 throw Error("Unexpected graph coverage "+JSON.stringify(out.stats));
for(const entry of Object.values(out.stands))
 for(const way of entry.publishedNamedTaxiwaySegments)
  for(const seg of way.segments){
   const a=net.nodes[seg.fromNode],b=net.nodes[seg.toNode];
   if(!a||!b||seg.geometry[0][0]!==a.lon||seg.geometry[0][1]!==a.lat||
      seg.geometry[1][0]!==b.lon||seg.geometry[1][1]!==b.lat||
      seg.taxiway!==way.taxiway||seg.routingApproved!==false)
    throw Error("False egress geometry detected: "+entry.id);
  }
const dest=path.join(root,"web/data/taxi-egress-geometry/LTFM.json");
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(out)+"\n");
console.log(JSON.stringify(out.stats));
