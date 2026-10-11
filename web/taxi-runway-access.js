/* OIMM · V2621 runway junctions, simulator QA ONLY.
 * Uses ONLY source-documented holding nodes and existing chart-derived runway
 * axis edges as anchors. The short foot-to-runway links are GRAPHIC PROJECTIONS,
 * not surveyed centerlines or permission to enter/exit a runway.
 * Never connect ordinary spatially close taxiways, stands or other runways.
 */
(function(root){
"use strict";
const METERS=111195,cache=new WeakMap();
const normal=s=>String(s||"").trim().toUpperCase();
function toXY(p,lat0){
  return {x:p.lon*METERS*Math.cos(lat0*Math.PI/180),y:p.lat*METERS};
}
function nearestOnEdge(p,a,b){
  const cos=Math.cos(p.lat*Math.PI/180);
  const scale=METERS*cos;
  const dx=(b.lon-a.lon)*scale,dy=(b.lat-a.lat)*METERS;
  const x=(p.lon-a.lon)*scale,y=(p.lat-a.lat)*METERS,mag=dx*dx+dy*dy;
  if(mag<.001)return null;
  const t=Math.max(0,Math.min(1,(x*dx+y*dy)/mag));
  const lat=a.lat+(b.lat-a.lat)*t,lon=a.lon+(b.lon-a.lon)*t;
  return {t,point:{lat,lon},distance:Math.hypot(x-dx*t,y-dy*t)};
}
function build(graph,token,{maxJoinMeters=115}={}){
  const bt=normal(token),info=graph?.runwayBacktracks?.[bt];
  if(!info||!info.requiresExplicitClearance||!graph.simulatorTestOnly||graph.airport!=="OIMM")
    return {graph:null,access:[],error:"Runway access requires an explicitly mapped BT runway token."};
  const seen=cache.get(graph);
  if(seen?.has(bt))return seen.get(bt);
  const eligible=Object.entries(graph.holdNodes||{}).filter(([id,x])=>{
    const p=graph.nodes[id],taxi=normal(x.taxiway);
    return p&&taxi&&graph.taxiways?.[taxi]&&!graph.taxiways[taxi].militaryOnly&&
      !/^L$|^M$|^N$|^P$/.test(taxi)&&normal(x.runway)===normal(info.runway);
  });
  const runwayEdges=graph.edges.filter(e=>e.runway&&normal(e.taxiway)===bt&&
    graph.nodes[e.from]&&graph.nodes[e.to]);
  const additions=[],nodes={...graph.nodes},access=[],splits=new Map();
  for(const [hold,meta] of eligible){
    const source=graph.nodes[hold];let winner=null;
    for(let i=0;i<runwayEdges.length;i++){
      const e=runwayEdges[i],p=nearestOnEdge(source,graph.nodes[e.from],graph.nodes[e.to]);
      if(p&&p.distance<=maxJoinMeters&&(!winner||p.distance<winner.distance))
        winner={...p,edge:e,idx:i};
    }
    if(!winner)continue;
    const crossing=winner.point;
    let projection;
    if(winner.t<.00001)projection=winner.edge.from;
    else if(winner.t>.99999)projection=winner.edge.to;
    else {
      // Splitting preserves the published runway segment's ONE-WAY direction.
      const id="oimm-rwy-"+bt+"-"+hold;
      projection=id;nodes[id]={...crossing,sourcePage:winner.edge.sourcePage,
        geometry:"QA runway-axis projection",notSurveyed:true};
      const split={...winner.edge,geometry:"QA runway-axis segment split",sourceEdge:bt};
      additions.push({...split,from:winner.edge.from,to:id},
        {...split,from:id,to:winner.edge.to});
    }
    // Explicit BT labels let the existing ordered-label route engine switch
    // from each physically recorded taxiway exit onto the runway *only after
    // the BT label occurs*. Never add this link to the normal AUTO graph.
    additions.push({from:hold,to:projection,taxiway:bt,runway:true,
      runwayUse:info.runway,requiresExplicitClearance:true,
      bidirectional:true,sourcePage:meta.sourcePage||winner.edge.sourcePage,
      geometry:"projected-hold-to-runway-AXIS-QA-not-surveyed",
      runwayAccessCandidate:true,fromTaxiway:normal(meta.taxiway),
      distanceMeters:+winner.distance.toFixed(1)});
    access.push({taxiway:normal(meta.taxiway),holdNode:hold,runwayNode:projection,
      distanceMeters:Math.round(winner.distance),geometry:"CHART-PROJECTED-QA-ONLY",
      runway:info.runway,requiresExplicitClearance:true});
  }
  const result={graph:{...graph,nodes,edges:[...graph.edges,...additions],
      runwayAccessQA:true},access,
      note:"Simulator preview using printed hold points and chart-derived runway axis; connector projections are NOT survey-verified."};
  let lookup=seen;if(!lookup){lookup=new Map();cache.set(graph,lookup)}
  lookup.set(bt,result);
  return result;
}
function candidates(graph,token){
  return build(graph,token).access.map(x=>({...x}));
}
const api={build,candidates,nearestOnEdge};
root.JEPPIRAN_TAXI_RUNWAY=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
