#!/usr/bin/env node
/**
 * Ground-source taxi egress, cycle 2621 / LTFM.
 *
 * For every Jeppesen stand with its own OSM-original parking-position WAY,
 * continue along physically SHARED OSM taxi/taxilane graph vertex IDs to the
 * named taxiway in its published Jeppesen 30-9J pushback instruction.
 *
 * No straight lines, proximity snaps, runway traversal, military branches,
 * or fabricated edges. Aircraft orientation, reverse pushback, towing and
 * ATC approval are NOT encoded, so every result is for simulator QA ONLY.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const root=path.resolve(__dirname,"..");
const read=p=>JSON.parse(fs.readFileSync(path.join(root,p),"utf8"));
const graph=read("web/data/taxi-networks/LTFM.json"),
      lead=read("web/data/taxi-stand-leads/LTFM.json");
if(graph.airport!=="LTFM"||lead.airport!=="LTFM"||
   String(graph.cycle)!=="2621"||String(lead.cycle)!=="2621")
 throw Error("Graph/source AIRAC cycle mismatch");
const RAD=Math.PI/180;
const meters=(a,b)=>Math.hypot((a.lat-b.lat)*111132,
 (a.lon-b.lon)*111320*Math.cos((a.lat+b.lat)/2*RAD));
const adj=new Map(),goals=new Map();
for(let idx=0;idx<graph.edges.length;idx++){
 const e=graph.edges[idx];
 if(e.closed||e.military||e.runway)continue;
 const a=graph.nodes[e.from],b=graph.nodes[e.to];
 if(!a||!b)continue;
 const w=meters(a,b);
 if(w<.01||w>1200)continue;
 if(!adj.has(e.from))adj.set(e.from,[]);
 if(!adj.has(e.to))adj.set(e.to,[]);
 adj.get(e.from).push({to:e.to,edgeIndex:idx,cost:w});
 if(e.bidirectional!==false)
  adj.get(e.to).push({to:e.from,edgeIndex:idx,cost:w});
 if(!goals.has(e.taxiway))goals.set(e.taxiway,new Set());
 goals.get(e.taxiway).add(e.from);goals.get(e.taxiway).add(e.to);
}
class Heap{
 constructor(){this.h=[]}
 put(x){let h=this.h,i=h.length;h.push(x);while(i>0){let p=(i-1)>>1;if(h[p][0]<=x[0])break;h[i]=h[p];i=p}h[i]=x}
 get(){const h=this.h;if(!h.length)return null;const top=h[0],last=h.pop();if(!h.length)return top;let i=0;while(2*i+1<h.length){let j=2*i+1;if(j+1<h.length&&h[j+1][0]<h[j][0])j++;if(h[j][0]>=last[0])break;h[i]=h[j];i=j}h[i]=last;return top}
 get length(){return this.h.length}
}
function shortest(start,target,maxDist=2500){
 const ends=goals.get(target);
 if(!ends||!adj.has(start))return null;
 const heap=new Heap(),dist=new Map([[start,0]]),pred=new Map();
 heap.put([0,start]);
 while(heap.length){
  const [d,from]=heap.get();
  if(d!==(dist.get(from)??Infinity)||d>maxDist)continue;
  if(ends.has(from)){
   const route=[],edges=[];let cur=from;
   while(pred.has(cur)){const a=pred.get(cur);route.push(cur);edges.push(a.edgeIndex);cur=a.from}
   route.push(cur);route.reverse();edges.reverse();
   return {nodes:route,edges,distanceMetres:+d.toFixed(2)};
  }
  for(const e of adj.get(from)||[]){
   const nd=d+e.cost;
   if(nd<=maxDist&&nd<(dist.get(e.to)??Infinity)){
    dist.set(e.to,nd);pred.set(e.to,{from,edgeIndex:e.edgeIndex});heap.put([nd,e.to])
   }
  }
 }
 return null;
}
const result={schemaVersion:1,airport:"LTFM",cycle:"2621",
 kind:"source-continuous-osm-stand-to-published-taxiway-candidates",
 coordinateSystem:"WGS84 lon-lat",simulatorOnly:true,
 chartProcedureValidated:false,operationallyRoutable:false,
 notice:"Path uses 100% original OSM parking_position way vertices and original taxiway graph edges with EXACT shared OSM node IDs. The Jeppesen procedure supplies the target TAXIWAY NAME only. No segment is geometrically invented, but towing direction, stand pushback procedure, operational restrictions and ATC clearance remain UNVERIFIED. NEVER USE FOR ACTUAL NAVIGATION.",
 pathLimitMeters:2500,stands:{},stats:{}};
let matched=0,sourceConnected=0,routableGoalNames=0,paths=0,
    printed=0,ambiguous=0,missingNames=0,noGoal=0;
for(const [id,item] of Object.entries(lead.stands)){
 const routeRows=[];
 if(item.publishedPushbackTaxiways.length)printed++;
 const usable=item.sourceParkingLeadVariants.filter(v=>v.geometryContinuous);
 if(usable.length)sourceConnected++;
 if(usable.length>1)ambiguous++;
 for(const v of usable){
  for(const target of item.publishedPushbackTaxiways){
   const mapped=shortest(v.exactTaxiGraphJoinNode,target);
   if(!mapped)continue;
   // Join is the last original parking-way vertex, which MUST exactly equal
   // the first taxi-graph point. Do not add any intermediate connection.
   const first=graph.nodes[mapped.nodes[0]];
   const lastParking=v.geometry.at(-1);
   if(!first||first.lon!==lastParking[0]||first.lat!==lastParking[1])
    throw Error("Synthetic stand join prohibited: "+id);
   const mappedGraph=mapped.nodes.slice(1).map(n=>{
    const p=graph.nodes[n];return [p.lon,p.lat]
   });
   const full=[...v.geometry,...mappedGraph];
   const osmWays=mapped.edges.map(i=>graph.edges[i].osmWay);
   routeRows.push({
    stand:id,parkingWay:v.osmParkingWay,
    actualParkingStandEndpoint:v.standEndpoint,
    exactOsmTaxiJoin:v.exactTaxiGraphJoinNode,
    publishedTargetTaxiway:target,
    viaTaxiwayNames:[...new Set(mapped.edges.map(i=>graph.edges[i].taxiway))],
    originalOsmTaxiGraphEdges:mapped.edges.map(i=>({
      osmWay:graph.edges[i].osmWay,taxiway:graph.edges[i].taxiway,
      from:graph.edges[i].from,to:graph.edges[i].to
    })),
    geometry:full,coordinateProvenance:"ORIGINAL_OSM_WAY_AND_EDGE_NODES",
    standParkingWayLengthMetres:v.lengthMeters,
    mappedTaxiGraphDistanceMetres:mapped.distanceMetres,
    totalSourceGeometryLengthMetres:+(v.lengthMeters+mapped.distanceMetres).toFixed(2),
    chartNameCorroborated:true,standPushbackDirectionValidated:false,
    operationalTaxiRouteVerified:false,
    noArtificialConnector:true,
    simulatorOnly:true,approvedForNavigation:false
   });
  }
 }
 if(routeRows.length){
  matched++;routableGoalNames+=new Set(routeRows.map(x=>x.publishedTargetTaxiway)).size;
  paths+=routeRows.length;
 }else if(item.publishedPushbackTaxiways.length){
  if(!usable.length)missingNames++;else noGoal++;
 }
 const oneWay=usable.length===1,
   oneTarget=routeRows.length===1;
 result.stands[id]={
   id,physicalOsmLeadExists:usable.length>0,
   standLeadVariants:usable.length,
   publishedTargets:item.publishedPushbackTaxiways,
   physicalMappedSourcePaths:routeRows,
   simulatorDefaultCandidate:oneWay&&oneTarget?0:null,
   canAutoUseAsJeppesenApprovedPushback:false,
   routeSourceVerifiedOnly:true
 };
}
result.stats={knownStandNames:Object.keys(lead.stands).length,
  exactConnectedStandLeads:sourceConnected,
  chartReferencedPushbackStandNames:printed,
  standsWithSourceContinuousPathToPublishedNamedTaxiway:matched,
  pathVariantsStored:paths,
  distinctStandTargetAssociations:routableGoalNames,
  standsWithMultipleOriginalParkingWayVariants:ambiguous,
  chartReferencedStandsWithoutConnectedParkingWay:missingNames,
  sourceConnectedStandsWithoutReachableNamedTarget:noGoal,
  operationallyVerifiedPushbacks:0
};
if(result.stats.knownStandNames!==379||matched<300||
   result.stats.exactConnectedStandLeads<350||result.stats.operationallyVerifiedPushbacks!==0)
 throw Error("Unexpected route coverage "+JSON.stringify(result.stats));
// Final edge-to-edge and source validation.
for(const entry of Object.values(result.stands))
 for(const line of entry.physicalMappedSourcePaths){
  if(line.approvedForNavigation||!line.noArtificialConnector)
   throw Error("OSM simulator candidate improperly authorized");
  if(line.geometry.length<2)throw Error("No physical vertices");
  for(const edge of line.originalOsmTaxiGraphEdges)
   if(edge.taxiway==="BT13R"||edge.taxiway==="BT31L")
    throw Error("Unexpected runway backtrack in stand exit corridor");
 }
const dest=path.join(root,"web/data/taxi-stand-egress-routes/LTFM.json");
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(result)+"\n");
console.log("SOURCE_CONNECTED_STAND_TO_PUBLISHED_TAXIWAY_QA",result.stats);
