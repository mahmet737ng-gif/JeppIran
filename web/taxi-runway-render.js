/* OIMM V2621 explicit taxi/backtrack line presentation, simulator QA only.
 * Only the connected centreline node sequence can be drawn as magenta.
 * The chart-derived holding-bar -> runway-axis "projected" foot is NOT a
 * surveyed taxiway centreline: draw it separately as a dashed QA gap.
 * The original graph and its ATC-clearance constraints are never modified.
 */
(function(root){
"use strict";
const upper=v=>String(v||"").trim().toUpperCase();
const cache=new WeakMap();
function lookup(graph){
  if(cache.has(graph))return cache.get(graph);
  const edges=new Map();
  for(const e of graph.edges||[]){
    if(!graph.nodes[e.from]||!graph.nodes[e.to]||e.closed||e.military)continue;
    const key=e.from+">"+e.to;
    if(!edges.has(key))edges.set(key,[]);
    edges.get(key).push(e);
    if(e.bidirectional!==false){
      const rev=e.to+">"+e.from;
      if(!edges.has(rev))edges.set(rev,[]);
      edges.get(rev).push({...e,from:e.to,to:e.from});
    }
  }
  cache.set(graph,edges);
  return edges;
}
function classify(edge,graph){
  if(edge.runwayAccessCandidate&&/projected-hold-to-runway/i.test(edge.geometry||""))
    return {type:"projected-access",confidence:edge.confidence||"CHART-PROJECTION-QA"};
  // R17 chart-digitized BT geometry is a centreline plus TWO shoulder
  // projections. The first/last leg leaves the runway axis and must never
  // appear as a straight solid line across pavement to a named taxiway.
  // Tag based on the original chart graph anchors, not pixel coordinates.
  const bt=graph?.runwayBacktracks?.[upper(edge.taxiway)];
  if(bt&&edge.runway&&!edge.runwayAccessCandidate&&
     edge.geometry==="reviewed-ADC-runway-axis"){
    const first=graph.taxiways?.[bt.fromTaxiway]?.exitNode;
    const to=graph.taxiways?.[bt.toTaxiway];
    const last=to?.nodes?.[0]||to?.exitNode;
    if(edge.from===first||edge.to===last){
      return {type:"projected-access",
        confidence:"ADC SHOULDER-TO-AXIS TRANSITION QA · NOT SURVEYED"};
    }
  }
  if(edge.runway){
    if(/^(reviewed-ADC-runway-axis|axis-between-reviewed-runway-vectors-QA-NOT-SURVEYED|QA runway-axis segment split)$/.test(edge.geometry||""))
      return {type:"runway-axis",confidence:edge.geometry};
    return {type:"unverified",confidence:edge.geometry||"UNKNOWN RUNWAY GEOMETRY"};
  }
  return {type:"taxiway",confidence:edge.geometry||"CHART-VECTOR"};
}
function parts(graph,route){
  const path=route?.path||[];
  if(graph?.airport!=="OIMM"||path.length<2)return null;
  const links=lookup(graph),steps=[],runs=[];
  let run=null;
  for(let i=1;i<path.length;i++){
    const from=path[i-1],to=path[i],candidates=links.get(from+">"+to)||[];
    // Prefer the intended explicit taxi sequence; refuse unknown links rather
    // than classifying a coincident spatial neighbour as verified pavement.
    const match=candidates.find(e=>e.runway&&upper(route.taxiways?.join(" ")).includes(upper(e.taxiway)))||
      candidates.find(e=>!e.runway)||candidates[0];
    const meta=match?classify(match,graph):{type:"unverified",confidence:"MISSING PHYSICAL EDGE"};
    const item={from,to,edge:match||null,way:upper(match?.taxiway),...meta};
    steps.push(item);
    if(!run||run.type!==item.type){
      run={type:item.type,way:item.way,nodes:[from,to],startIndex:i-1,endIndex:i,steps:[item]};
      runs.push(run);
    }else{
      run.nodes.push(to);run.steps.push(item);run.endIndex=i;
    }
  }
  const projections=steps.filter(s=>s.type==="projected-access");
  const invalid=steps.filter(s=>s.type==="unverified");
  const runway=steps.filter(s=>s.type==="runway-axis");
  return {steps,runs,projections,invalid,runway,
    incomplete:invalid.length>0||projections.length>0,
    renderedRunwayNodeCount:new Set(runway.flatMap(s=>[s.from,s.to])).size};
}
const api={classify,parts};
root.JEPPIRAN_TAXI_RENDER=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
