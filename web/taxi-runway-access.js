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
// The two printed backtrack vectors describe different portions of the SAME
// RWY 13R/31L. A source-constrained intermediate runway axis may connect
// those portions for a simulator QA route. Reject if their bearings/lateral
// offsets disagree rather than guessing a pavement bend.
function reviewedAxisBridge(graph){
  const bt13=graph.runwayBacktracks?.BT13R,bt31=graph.runwayBacktracks?.BT31L;
  if(!bt13||!bt31||bt13.runway!==bt31.runway)return [];
  const j=graph.taxiways?.[bt13.fromTaxiway]?.exitNode;
  const a=graph.taxiways?.[bt31.fromTaxiway]?.exitNode;
  if(!j||!a||!graph.nodes[j]||!graph.nodes[a])return [];
  const heading=toXY(graph.nodes[a],graph.nodes[j].lat);
  const origin=toXY(graph.nodes[j],graph.nodes[j].lat);
  const vx=heading.x-origin.x,vy=heading.y-origin.y,len=Math.hypot(vx,vy);
  if(!(len>80&&len<4500))return [];
  const ux=vx/len,uy=vy/len;
  const pick=(token,hold,sign)=>{
    const p=graph.nodes[hold];let best=null;
    for(const e of graph.edges){
      if(!e.runway||normal(e.taxiway)!==token)continue;
      const b=graph.nodes[e.from],c=graph.nodes[e.to];if(!b||!c)continue;
      const p0=toXY(b,p.lat),p1=toXY(c,p.lat);
      const dx=p1.x-p0.x,dy=p1.y-p0.y,length=Math.hypot(dx,dy);
      if(length<.01)continue;
      const alignment=sign*(dx*ux+dy*uy)/length;
      if(alignment<.975)continue;
      const d=Math.hypot(p0.x-toXY(p,p.lat).x,p0.y-toXY(p,p.lat).y);
      if(d<12||d>155)continue;
      if(!best||d<best.distance)best={id:e.from,distance:d};
    }
    return best;
  };
  const jCenter=pick("BT13R",j,-1),aCenter=pick("BT31L",a,1);
  if(!jCenter||!aCenter)return [];
  const jp=toXY(graph.nodes[jCenter.id],graph.nodes[j].lat),
    ap=toXY(graph.nodes[aCenter.id],graph.nodes[j].lat);
  const bx=ap.x-jp.x,by=ap.y-jp.y,
    along=bx*ux+by*uy,cross=Math.abs(bx*uy-by*ux);
  if(along<30||along>4500||cross>45)return [];
  const attrs={runway:true,runwayUse:bt13.runway,
    sourcePage:601,bidirectional:false,requiresExplicitClearance:true,
    geometry:"axis-between-reviewed-runway-vectors-QA-NOT-SURVEYED",
    runwayAccessCandidate:true,bridgedLengthMeters:Math.round(Math.hypot(bx,by))};
  return [{from:jCenter.id,to:aCenter.id,taxiway:"BT31L",...attrs},
    {from:aCenter.id,to:jCenter.id,taxiway:"BT13R",...attrs}];
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
  const bridges=reviewedAxisBridge(graph);
  const runwayEdges=[...graph.edges,...bridges].filter(e=>e.runway&&normal(e.taxiway)===bt&&
    graph.nodes[e.from]&&graph.nodes[e.to]);
  const additions=[...bridges],nodes={...graph.nodes},access=[],splits=new Map();
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
const api={build,candidates,nearestOnEdge,reviewedAxisBridge};
root.JEPPIRAN_TAXI_RUNWAY=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
