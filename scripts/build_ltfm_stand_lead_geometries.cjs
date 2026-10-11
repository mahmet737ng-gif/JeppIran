#!/usr/bin/env node
/**
 * JEPPIRAN V2621 / LTFM
 * Extract ACTUAL SOURCE-DRAWN OSM parking stand lead-in/lead-out polylines.
 * Only way vertices ALREADY present in OpenStreetMap are used. A connection
 * to taxiway graph exists ONLY at a shared original OSM NODE ID.
 * NEVER snap stand-label positions to nearby taxiway geometry.
 *
 * A map-matched geometry is usable for SIMULATOR GRAPH QA, but is NOT a
 * certified Jeppesen pushback curve or ATC clearance.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const graph=read("web/data/taxi-networks/LTFM.json"),
  registry=read("web/data/taxi-stand-registry/LTFM.json"),
  parking=read("web/data/taxi-parking-ways/LTFM.json");
if(graph.airport!=="LTFM"||registry.airport!=="LTFM"||
   parking.airport!=="LTFM"||parking.stats.allOsmParkingWays<500||
   String(registry.cycle)!=="2621")throw Error("Incomplete or mismatched original source charts/OSM data");
const trueTaxiNodes=new Set();
const waysByNode=new Map();
for(const e of graph.edges){
 if(e.closed||e.runway||e.military||!graph.nodes[e.from]||!graph.nodes[e.to])continue;
 trueTaxiNodes.add(e.from);trueTaxiNodes.add(e.to);
 for(const n of [e.from,e.to]){
  if(!waysByNode.has(n))waysByNode.set(n,new Set());
  waysByNode.get(n).add(e.taxiway||"UNNAMED");
 }
}
const rad=Math.PI/180;
function metres(p,q){
 const lat=(p[1]+q[1])/2*rad;
 return Math.hypot((p[1]-q[1])*111132,
   (p[0]-q[0])*111320*Math.cos(lat));
}
const out={schemaVersion:1,airport:"LTFM",cycle:"2621",
 kind:"exact-osm-parking-stand-lead-centerlines",
 coordinateSystem:"WGS84 lon-lat",
 sources:{
  parking:"OpenStreetMap contributors ODbL 1.0, original parking_position way vertices",
  taxi:"Original OSM taxi/taxilane centerline graph, EXACT shared OSM node joins",
  names:"Jeppesen 2621 30-9B/30-9C and 30-9J2..J12"
 },simulationOnly:true,verifiedForNavigation:false,atcClearanceImplied:false,
 routingApproved:false,
 caution:"This is exact source-drawn physical OSM geometry, not computed Euclidean straight lines. Connections to taxi graph require identical OSM node IDs. Way shape/direction/parking instructions still need cycle-2621 chart and aircraft-type QA. DO NOT USE FOR ACTUAL NAVIGATION.",
 stands:{},stats:{}};
let withOsm=0,joined=0,preferred=0,single=0,groupOnly=0,segments=0,awaitsQA=0;
for(const [id,info] of Object.entries(registry.stands)){
 const all=parking.matchedStandWayGeometries[id]||[],variants=[];
 if(info.locationType!=="PRINTED_LABEL_ANCHOR")groupOnly++;
 for(const w of all){
  if(!Array.isArray(w.geometry)||w.geometry.length<2||
     w.geometry.length!==w.osmNodes.length)continue;
  // Only nodes that actually have an incident taxiway edge, not simply
  // source vertex IDs in the larger OSM inventory.
  const endIndices=[0,w.osmNodes.length-1];
  const matches=endIndices.filter(i=>trueTaxiNodes.has(w.osmNodes[i]));
  if(!matches.length){
   variants.push({osmParkingWay:w.osmParkingWay,
     originalGeometry:w.geometry,geometryContinuous:false,
     error:"NO_EXACT_SHARED_OSM_TAXI_NODE",routingApproved:false});
   continue;
  }
  // A parking way may be attached to multiple taxi nodes. Keep the entire
  // original shape and mark as requiring review rather than choosing an exit.
  const directionAmbiguous=matches.length!==1;
  const ix=matches.length===1?matches[0]:null;
  const vertices=ix===0?[...w.geometry].reverse():ix===w.geometry.length-1?
    [...w.geometry]:[...w.geometry];
  const ids=ix===0?[...w.osmNodes].reverse():ix===w.geometry.length-1?
    [...w.osmNodes]:[...w.osmNodes];
  const taxiNode=ix===null?null:w.osmNodes[ix];
  const sourceNose=vertices[0],sourceTaxiJoin=taxiNode?vertices.at(-1):null;
  const length=vertices.slice(1).reduce((v,p,i)=>v+metres(vertices[i],p),0);
  const labelCoordinate=info.locationType==="PRINTED_LABEL_ANCHOR"?
    [info.position.lon,info.position.lat]:null;
  const chartOffset=labelCoordinate?metres(labelCoordinate,sourceNose):null;
  const sourcePathPoints=vertices.map(([lon,lat])=>[lon,lat]);
  const nodeGroup=taxiNode?[...(waysByNode.get(taxiNode)||new Set())].sort():[];
  variants.push({
   osmParkingWay:w.osmParkingWay,
   sourceNodeIds:ids,geometry:sourcePathPoints,
   standEndpoint:[...sourceNose],
   taxiGraphJoinPoint:sourceTaxiJoin?[...sourceTaxiJoin]:null,
   exactTaxiGraphJoinNode:taxiNode,
   taxiwayNamesAtGraphJoin:nodeGroup,
   lengthMeters:Math.round(length*100)/100,
   sourcePrintedLabelOffsetMeters:chartOffset===null?null:Math.round(chartOffset*10)/10,
   geometryContinuous:!directionAmbiguous&&!!taxiNode,
   orientationVerifiedBySourceEndpoint:!directionAmbiguous&&!!taxiNode,
   OSMPhysicalGraphEvidence:!!taxiNode,
   taxiClearanceVerified:false,
   jeppesenPushbackGeometryVerified:false,
   simulatorQaOnly:true,routingApproved:false,
   status:directionAmbiguous?"AMBIGUOUS_BOTH_GRAPH_ENDPOINTS":
     "EXACT_OSM_PARKING_WAY_TO_TAXI_GRAPH_NODE"
  });
 }
 if(all.length)withOsm++;
 const valid=variants.filter(v=>v.geometryContinuous);
 if(valid.length)joined++;
 if(valid.length===1)preferred++;
 if(all.length===1)single++;
 segments+=valid.reduce((sum,v)=>sum+v.geometry.length-1,0);
 // Source-geometry existence does NOT constitute chart-approval of pushback.
 if(valid.length)awaitsQA++;
 out.stands[id]={
  id,chartLocationType:info.locationType,
  sourceStandChartPosition:info.locationType==="PRINTED_LABEL_ANCHOR"?info.position:null,
  publishedPushbackTaxiways:info.publishedPushbackTaxiways,
  sourceCharts:info.sourcePushbackCharts,
  sourceParkingLeadVariants:variants,
  exactConnectedVariantCount:valid.length,
  singleUnambiguousOSMVariant:valid.length===1,
  taxiGraphGeometricallyConnected:valid.length>0,
  pilotPushbackApproval:false,
  standToTaxiwaySourceGeometryExtracted:valid.length>0,
  operatingProcedureValidated:false,
  routingApproved:false
 };
}
out.stats={allRegisteredStandIdentifiers:Object.keys(out.stands).length,
    originalNamedOsmParkingWays:parking.stats.allOsmParkingWays,
    OSMReferencedStands:withOsm,
    exactJoinedStandIdentifiers:joined,
    standsWithSingleConnectedSourceVariant:preferred,
    standNamesWithOnlyOneOsmParkingWay:single,
    coarseInsGroupStands:groupOnly,
    geometricallyConnectedOsmCenterlineSegments:segments,
    JeppesenApprovedPushbackRoutes:0};
if(out.stats.allRegisteredStandIdentifiers!==379||
   joined<350||withOsm<358||preferred<215||groupOnly!==116)
 throw Error("Integrity QA failure "+JSON.stringify(out.stats));
for(const [id,item] of Object.entries(out.stands)){
 for(const v of item.sourceParkingLeadVariants){
  if(!v.geometryContinuous)continue;
  if(!trueTaxiNodes.has(v.exactTaxiGraphJoinNode))throw Error("Unconnected line "+id);
  const last=v.sourceNodeIds.at(-1);
  if(last!==v.exactTaxiGraphJoinNode)throw Error("Bad stand->taxi source direction "+id);
  const x=graph.nodes[last],q=v.geometry.at(-1);
  if(x.lon!==q[0]||x.lat!==q[1])throw Error("Fake join coordinate "+id);
  if(v.routingApproved||v.taxiClearanceVerified)throw Error("Unsafe route approval "+id);
 }
}
const target=path.join(root,"web/data/taxi-stand-leads/LTFM.json");
fs.mkdirSync(path.dirname(target),{recursive:true});
fs.writeFileSync(target,JSON.stringify(out)+"\n");
console.log("STAND_TO_TAXI_OSM_SOURCE_GEOMETRY",JSON.stringify(out.stats));
