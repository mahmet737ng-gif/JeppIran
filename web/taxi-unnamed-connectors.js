/* JEPPIRAN QA connector engine v1: trace actual OSM UNNAMED segments only.
 * Explicit opt-in for simulator preview; never invent straight-line links.
 * No airport is approved for operational taxi/navigation by this module.
 */
(function(root){
"use strict";
const cache=new WeakMap(),M=111195;
const norm=x=>String(x||"").trim().toUpperCase();
const meters=(a,b)=>Math.hypot((a.lat-b.lat)*M,(a.lon-b.lon)*M*Math.cos((a.lat+b.lat)*Math.PI/360));
function enabled(graph){
  return graph?.simulatorTestOnly===true&&
    graph?.source?.provider==="OpenStreetMap contributors"&&
    graph?.qaMappedUnnamedConnectors===true;
}
function scan(graph,fromLabel,toLabel,options={}){
  if(!enabled(graph))return new Map();
  const from=norm(fromLabel),to=norm(toLabel),limit=Math.min(160,Math.max(20,Number(options.maxMeters)||120));
  const stepsMax=Math.min(12,Math.max(1,Math.round(Number(options.maxEdges)||8)));
  if(!from||!to||from===to)return new Map();
  let entries=cache.get(graph);if(!entries){entries=new Map();cache.set(graph,entries)}
  const cacheKey=from+"~"+to+"~"+limit+"~"+stepsMax;
  if(entries.has(cacheKey))return entries.get(cacheKey);
  const fromNodes=new Set(),toNodes=new Set(),unnamed=new Map(),allNamed=new Map();
  const add=(map,a,b,w)=>{if(!map.has(a))map.set(a,[]);map.get(a).push({to:b,cost:w})};
  for(const edge of graph.edges||[]){
    if(edge.closed||edge.runway||edge.military||!graph.nodes?.[edge.from]||!graph.nodes?.[edge.to])continue;
    const label=norm(edge.taxiway),distance=meters(graph.nodes[edge.from],graph.nodes[edge.to]);
    if(!(distance>0.00001&&distance<160))continue;
    if(label===from){fromNodes.add(edge.from);fromNodes.add(edge.to)}
    if(label===to){toNodes.add(edge.from);toNodes.add(edge.to)}
    if(label&&label!=="UNNAMED"){
      for(const id of [edge.from,edge.to]){
        if(!allNamed.has(id))allNamed.set(id,new Set());
        allNamed.get(id).add(label);
      }
    }else if(label==="UNNAMED"){
      add(unnamed,edge.from,edge.to,distance);
      if(edge.bidirectional!==false)add(unnamed,edge.to,edge.from,distance);
    }
  }
  const result=new Map();
  if(fromNodes.size&&toNodes.size){
    for(const start of fromNodes){
      // Tiny bounded Dijkstra; 8 directed edges / 120m at most per bridge.
      const q=[{id:start,path:[start],cost:0}],best=new Map([[start,0]]),found=[];
      while(q.length){
        q.sort((a,b)=>a.cost-b.cost);
        const state=q.shift();
        if(state.cost>(best.get(state.id)??Infinity)+.000001)continue;
        if(toNodes.has(state.id)&&state.path.length>1){
          found.push({end:state.id,nodes:state.path,length:+state.cost.toFixed(2),
            source:"MAPPED_OSM_UNNAMED_EDGES",approved:false});
          if(found.length>=3)break;
          continue;
        }
        if(state.path.length>stepsMax||state.cost>=limit)continue;
        // Do not transit across an unrelated named taxiway to cut corners.
        if(state.id!==start){
          const names=allNamed.get(state.id);
          if(names&&![...names].every(x=>x===from||x===to))continue;
        }
        for(const next of unnamed.get(state.id)||[]){
          const d=state.cost+next.cost,edgesCount=state.path.length;
          if(d>limit||edgesCount>stepsMax)continue;
          if(state.path.includes(next.to))continue;
          if(d+1e-7>=(best.get(next.to)??Infinity))continue;
          best.set(next.to,d);
          q.push({id:next.to,cost:d,path:[...state.path,next.to]});
        }
      }
      if(found.length)result.set(start,found);
    }
  }
  entries.set(cacheKey,result);
  return result;
}
function connected(graph,from,to){
  return scan(graph,from,to).size>0;
}
root.JEPPIRAN_TAXI_UNNAMED={enabled,scan,connected};
})(typeof window!=="undefined"?window:globalThis);
