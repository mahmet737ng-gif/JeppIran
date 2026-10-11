/* JEPPIRAN / OIMM automatic connected-ground routing · simulator QA only.
 * This module NEVER creates graph edges or enters a runway without an explicit
 * runway-use route. Runway-number destinations stop at the reviewed hold short.
 * Runway access is inferred only from a source-reviewed existing BT origin.
 */
(function(root){
"use strict";
const cache=new WeakMap(),METERS=111195;
const norm=s=>String(s||"").trim().toUpperCase();
function metres(a,b){
  const lat=(Number(a.lat)+Number(b.lat))*Math.PI/360;
  return Math.hypot((Number(a.lat)-Number(b.lat))*METERS,
    (Number(a.lon)-Number(b.lon))*METERS*Math.cos(lat));
}
class Heap {
  constructor(){this.items=[]}
  push(v){let a=this.items,i=a.length;a.push(v);
    while(i>0){const p=(i-1)>>1;if(a[p].cost<=v.cost)break;a[i]=a[p];i=p}
    a[i]=v}
  pop(){const a=this.items,first=a[0],last=a.pop();
    if(a.length){let i=0;
      while(i*2+1<a.length){let c=i*2+1;
        if(c+1<a.length&&a[c+1].cost<a[c].cost)c++;
        if(last.cost<=a[c].cost)break;a[i]=a[c];i=c}
      a[i]=last}return first}
  get size(){return this.items.length}
}
function index(graph){
  if(cache.has(graph))return cache.get(graph);
  const links=new Map(),standNodes=new Set(Object.values(graph.stands||{}).map(s=>s.node||s));
  const accessible=new Set();
  for(const e of graph.edges||[]){
    // Runway crossing/backtracking is NEVER permitted by AUTO.
    if(e.closed||e.military||e.runway||!graph.nodes[e.from]||!graph.nodes[e.to])continue;
    const a=graph.nodes[e.from],b=graph.nodes[e.to],length=metres(a,b);
    if(!(length>.00001&&length<12000))continue;
    const way=norm(e.taxiway);
    const add=(from,to)=>{if(!links.has(from))links.set(from,[]);
      links.get(from).push({to,way,length,standAccess:e.allowStandAccess===true})};
    add(e.from,e.to);if(e.bidirectional!==false)add(e.to,e.from);
    accessible.add(e.from);accessible.add(e.to);
  }
  const data={links,standNodes,accessible:[...accessible]};
  cache.set(graph,data);return data;
}
function goal(graph,token){
  const wanted=norm(token).replace(/^RUNWAY\s*/,"").replace(/^RWY\s*/,"");
  const m=wanted.match(/^(?:ST|P)?(\d{3})$/);
  if(m&&graph.stands?.[m[1]]){
    return {kind:"stand",name:"ST"+m[1],node:graph.stands[m[1]].node};
  }
  if(/^\d{2}[LRC]?$/.test(wanted)){
    const way=graph.runwayBacktracks?.["BT"+wanted]?.fromTaxiway;
    const hold=way&&graph.taxiways?.[way]?.exitNode;
    if(hold&&graph.nodes?.[hold]&&graph.holdNodes?.[hold]){
      return {kind:"runway-hold",name:"RWY "+wanted,node:hold,approachTaxiway:way,
        warning:"HOLD SHORT at TWY "+way+" · runway entry/threshold NOT mapped as an automatic route"};
    }
    return {error:"RWY "+wanted+" has no reviewed automatic runway-entry hold/threshold connector. No route invented."};
  }
  return {error:"Unknown stand or runway destination: "+token};
}
function bestStart(graph,position,maxSnapMeters=65){
  if(!position||!Number.isFinite(position.lat)||!Number.isFinite(position.lon))return null;
  const g=index(graph);let closest=null,meters=Infinity;
  for(const id of g.accessible){
    const d=metres(position,graph.nodes[id]);
    if(d<meters){closest=id;meters=d}
  }
  return meters<=maxSnapMeters?{node:closest,distanceMeters:meters}:null;
}
function solve(graph,start,finish,{sourceStand=null}={}){
  const data=index(graph),links=data.links;
  if(!graph.nodes[start]||!graph.nodes[finish])return null;
  const q=new Heap(),score=new Map([[start,0]]),prev=new Map();
  q.push({node:start,cost:0});
  let steps=0;
  while(q.size&&steps++<240000){
    const cur=q.pop();
    if(cur.cost!==score.get(cur.node))continue;
    if(cur.node===finish)break;
    for(const e of links.get(cur.node)||[]){
      // Never traverse another aircraft's stand as an intermediate connector.
      if(data.standNodes.has(e.to)&&e.to!==finish)continue;
      if(data.standNodes.has(cur.node)&&cur.node!==start&&cur.node!==finish)continue;
      const next=cur.cost+e.length;
      if(next>=(score.get(e.to)??Infinity))continue;
      score.set(e.to,next);prev.set(e.to,{from:cur.node,way:e.way});q.push({node:e.to,cost:next});
    }
  }
  if(!score.has(finish))return null;
  const path=[finish],ways=[];
  for(let n=finish;n!==start;){
    const step=prev.get(n);if(!step)return null;
    ways.push(step.way);n=step.from;path.push(n);
  }
  path.reverse();ways.reverse();
  const names=[];
  for(const way of ways)if(way&&way!=="APRON"&&way!=="UNNAMED"&&names.at(-1)!==way)names.push(way);
  return {path,holds:[],length:Math.round(score.get(finish)),taxiways:names,
    graph,sourceStand,source:"CHART_GRAPH_ONLY"};
}
function route(graph,options={}){
  if(!graph||graph.airport!=="OIMM"||!graph.simulatorTestOnly)return {error:"OIMM simulator QA graph unavailable"};
  const target=goal(graph,options.destination);
  if(target.error)return {error:target.error};
  const stand=options.startStand&&graph.stands?.[String(options.startStand).replace(/^ST/i,"")];
  const source=stand?{node:stand.node,distanceMeters:0}:bestStart(graph,options.position);
  if(!source)return {error:"No connected ground centreline within 65 m of position. Select SET START at a mapped taxiway, or connect simulator. No guessed runway exit."};
  const found=solve(graph,source.node,target.node,{sourceStand:stand?options.startStand:null});
  if(!found)return {error:"No approved connection in existing OIMM ground graph; runways, military-only areas and unverified exits are excluded."};
  found.holds=found.path.flatMap((n,i)=>graph.holdNodes?.[n]?[i]:[]);
  if(target.kind==="runway-hold"&&!found.holds.includes(found.path.length-1))found.holds.push(found.path.length-1);
  return {route:found,target,snapMeters:source.distanceMeters};
}
function deviation(graph,route,position){
  if(!position||!route?.path?.length)return Infinity;
  const lat=Number(position.lat),lon=Number(position.lon),cos=Math.cos(lat*Math.PI/180);
  if(!Number.isFinite(lat)||!Number.isFinite(lon))return Infinity;
  let best=Infinity;
  for(let i=1;i<route.path.length;i++){
    const a=graph.nodes[route.path[i-1]],b=graph.nodes[route.path[i]];
    if(!a||!b)continue;
    const ax=(a.lon-lon)*METERS*cos,ay=(a.lat-lat)*METERS;
    const dx=(b.lon-a.lon)*METERS*cos,dy=(b.lat-a.lat)*METERS;
    const div=dx*dx+dy*dy;
    if(div<1e-6)continue;
    const t=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/div));
    best=Math.min(best,Math.hypot(ax+t*dx,ay+t*dy));
  }
  return best;
}
// Two sustained off-route fixes trigger replacement. Poor accuracy, airborne
// speed, graph gaps and runway occupancy never generate a speculative path.
function reroute(graph,active,position,now=Date.now()){
  if(!active?.route||!active.target||!position||!Number.isFinite(position.lat)||!Number.isFinite(position.lon))return {action:"idle"};
  const m=deviation(graph,active.route,position),state=active.monitor||(active.monitor={count:0,last:0});
  if(Number(position.accuracy)>35||Number(position.groundspeed)>23){
    state.count=0;return {action:"uncertain",deviation:m};
  }
  if(m<30){state.count=0;return {action:"on-route",deviation:m}}
  if(m<45){state.count=0;return {action:"near-route",deviation:m}}
  state.count++;
  if(state.count<2)return {action:"checking",deviation:m};
  if(now-state.last<3000)return {action:"cooldown",deviation:m};
  state.last=now;
  const result=route(graph,{destination:active.target.name,position});
  if(!result.route)return {action:"unmapped",deviation:m,error:result.error};
  state.count=0;
  return {action:"replanned",deviation:m,...result};
}
const api={index,goal,bestStart,solve,route,deviation,reroute,metres};
root.JEPPIRAN_TAXI_AUTO=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
