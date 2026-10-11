/* JEPPIRAN Taxi Engine v1 — airport-independent, source-backed SIM QA.
 * ICAO/cycle live in DATA, not in routing logic. No inferred junctions,
 * invisible runway crossings, fake stand connectors or chart interpolation.
 * Module works in a browser (window.JEPPIRAN_TAXI_ENGINE) or Node/CommonJS.
 */
(function(root){
"use strict";
const M=111195,MAX_EDGE=20000,VALID_ID=/^[A-Z0-9][A-Z0-9_.:-]{0,63}$/;
const upper=x=>String(x||"").trim().toUpperCase();
function distance(a,b){
  const lat=(a.lat+b.lat)*Math.PI/360;
  return Math.hypot((a.lat-b.lat)*M,(a.lon-b.lon)*M*Math.cos(lat));
}
function point(p){
  return p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&
    Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
}
class MinHeap{
  constructor(){this.a=[]}
  push(value){const a=this.a;let i=a.length;a.push(value);
    while(i>0){const p=(i-1)>>1;if(a[p].cost<=value.cost)break;a[i]=a[p];i=p}
    a[i]=value}
  pop(){const a=this.a,first=a[0],last=a.pop();
    if(a.length){let i=0;while(i*2+1<a.length){
      let j=i*2+1;if(j+1<a.length&&a[j+1].cost<a[j].cost)j++;
      if(last.cost<=a[j].cost)break;a[i]=a[j];i=j
    }a[i]=last}return first}
  get length(){return this.a.length}
}
function validate(data){
  const errors=[];
  if(!data||typeof data!=="object")return {ok:false,errors:["Missing airport network"]};
  if(data.engineVersion!==1)errors.push("engineVersion must equal 1");
  if(!/^[A-Z]{4}$/.test(data.airport||""))errors.push("airport must be an ICAO code");
  if(!/^[0-9]{4}$/.test(String(data.cycle||"")))errors.push("cycle must match a four-digit chart cycle");
  if(data.simulatorTestOnly!==true||data.verified!==false)
    errors.push("This engine requires simulatorTestOnly:true and verified:false");
  if(data.coordinateSystem!=="WGS84")errors.push("coordinateSystem must equal WGS84");
  if(!data.source||typeof data.source.provider!=="string"||
     !data.source.provider.trim()||!data.source.document)
    errors.push("Named provider and chart/source document are required");
  const nodes=data.nodes||{},edges=data.edges||[],stands=data.stands||{},
    runways=data.runways||{},taxiways=data.taxiways||{};
  if(!nodes||Array.isArray(nodes)||!Object.keys(nodes).length)
    errors.push("No mapped nodes (scaffolds cannot activate)");
  if(!Array.isArray(edges)||!edges.length)
    errors.push("No surveyed/chart-digitized edges (scaffolds cannot activate)");
  for(const [id,p] of Object.entries(nodes)){
    if(!VALID_ID.test(id)||!point(p))errors.push("Invalid geodetic node "+id);
  }
  if(!Array.isArray(edges))return {ok:false,errors};
  const used=new Set();
  for(let i=0;i<edges.length;i++){
    const e=edges[i],prefix="edge["+i+"]";
    if(!nodes[e.from]||!nodes[e.to]||e.from===e.to){
      errors.push(prefix+" has disconnected/invalid endpoints");continue;
    }
    const label=upper(e.label||e.taxiway);
    if(!label||!VALID_ID.test(label))errors.push(prefix+" lacks an approved label");
    if(!["taxiway","apron","stand","runway","connector"].includes(e.kind))
      errors.push(prefix+" has unknown kind");
    if(!["mapped","qa","projected","blocked"].includes(e.quality))
      errors.push(prefix+" must declare mapped/qa/projected/blocked quality");
    if(e.kind==="runway"&&(!e.physicalRunway||
      !Object.values(runways).some(r=>r?.physicalId===e.physicalRunway)))
      errors.push(prefix+" runway edge has no named physical runway");
    if(e.kind!=="runway"&&/^BT[0-9]/.test(label))
      errors.push(prefix+" BT edge must be runway kind");
    const pts=Array.isArray(e.geometry)?e.geometry:[nodes[e.from],nodes[e.to]];
    if(pts.length<2||pts.some(p=>!point(p)))
      errors.push(prefix+" geometry must be >=2 coordinate points");
    else{
      if(distance(pts[0],nodes[e.from])>7||
         distance(pts.at(-1),nodes[e.to])>7)
        errors.push(prefix+" geometry endpoints must match the original nodes (7 m)");
      let total=0;
      for(let k=1;k<pts.length;k++)total+=distance(pts[k-1],pts[k]);
      if(total<.01||total>MAX_EDGE)errors.push(prefix+" has implausible length");
    }
    if(!e.source&&!(nodes[e.from]?.source&&nodes[e.to]?.source))
      errors.push(prefix+" missing chart/source provenance");
    const identity=e.from+">"+e.to+"|"+label;
    if(used.has(identity))errors.push(prefix+" duplicate directed named edge");
    used.add(identity);
  }
  for(const [id,value] of Object.entries(stands)){
    const n=typeof value==="string"?value:value?.node;
    if(!/^[A-Z0-9]{1,10}$/.test(id)||!nodes[n])errors.push("Stand "+id+" lacks a mapped node");
  }
  for(const [name,entry] of Object.entries(taxiways)){
    if(!VALID_ID.test(name)||!nodes[entry?.terminalNode])
      errors.push("Taxiway "+name+" must have a mapped terminalNode");
  }
  for(const [id,r] of Object.entries(runways)){
    if(!/^[0-3][0-9][LRC]?$/.test(id)||!r?.physicalId)
      errors.push("Runway "+id+" must have a physicalId");
    if(r?.goalNode&&!nodes[r.goalNode])
      errors.push("Runway "+id+" goalNode does not exist");
    if(r?.goalNode&&!["hold","access-qa","threshold"].includes(r.goalKind))
      errors.push("Runway "+id+" goalKind must identify its exact meaning");
    if(r?.axis){
      if(!Array.isArray(r.axis)||r.axis.length<2||r.axis.some(p=>!point(p)))
        errors.push("Runway "+id+" has invalid independent axis");
      if(!r.axisSource)errors.push("Runway "+id+" axis requires chart provenance");
    }
  }
  return {ok:errors.length===0,errors};
}
function runwayToken(raw){
  const x=upper(raw).replace(/^RUNWAY\s*/,"").replace(/^RWY\s*/,"");
  return /^[0-3][0-9][LRC]?$/.test(x)?x:null;
}
function normalizeStand(s){
  return upper(s).replace(/^STAND\s*/,"").replace(/^ST/,"").replace(/^P(?=[A-Z0-9])/,"");
}
function tokenize(s){
  return upper(s).replace(/[,→>]+/g," ").replace(/\bSTAND\s+([A-Z0-9]+)/g,"ST$1")
    .replace(/\bRUNWAY\s+([0-9])/g,"RWY$1")
    .replace(/\bRWY\s+([0-9])/g,"RWY$1").split(/\s+/).filter(Boolean);
}
function parse(raw,net){
  const tokens=tokenize(raw);
  if(!tokens.length)return {error:"Enter a stand, taxiway sequence or runway"};
  const stand=t=>{
    const id=normalizeStand(t);
    return net.stands[id]&&/^(?:ST|STAND|P)?[A-Z0-9]+$/.test(t)?id:null;
  };
  let startStand=null,destination=null,via=[];
  if(tokens.length===1){
    const id=stand(tokens[0]);
    if(id)return {startStand:null,destination:{kind:"stand",id},via:[]};
    const run=runwayToken(tokens[0]);
    if(run)return {startStand:null,destination:{kind:"runway",id:run},via:[]};
  }
  if(tokens.length>1&&stand(tokens[0])){
    startStand=stand(tokens.shift());
  }
  const final=tokens.at(-1),destStand=final&&stand(final);
  if(destStand){
    destination={kind:"stand",id:destStand};tokens.pop();
  }else{
    const runway=runwayToken(final);
    if(runway&&tokens.length>=1){destination={kind:"runway",id:runway};tokens.pop()}
  }
  via=tokens.map(upper);
  if(via.some(t=>!VALID_ID.test(t)))return {error:"Unknown taxiway label syntax"};
  if(!via.length&&!destination)return {error:"Specify a destination or a named taxiway"};
  if(via.some(t=>/^BT/.test(t)&&!Object.values(net.edges).some(e=>
    upper(e.label||e.taxiway)===t&&e.kind==="runway")))
    return {error:"Unknown explicit runway-use segment: "+
      via.find(t=>/^BT/.test(t))};
  return {startStand,destination,via};
}
function create(data){
  const checked=validate(data);
  if(!checked.ok)throw Error("Invalid taxi graph "+(data?.airport||"")+": "+checked.errors.slice(0,8).join("; "));
  // Frozen original objects are not modified; calculations use private views.
  const {nodes,edges,stands,runways,taxiways}=data,adj=new Map(),standNodes=new Set();
  for(const value of Object.values(stands))
    standNodes.add(typeof value==="string"?value:value.node);
  for(const [i,e] of edges.entries()){
    if(e.quality==="blocked"||e.closed||e.militaryOnly)continue;
    const pts=Array.isArray(e.geometry)?e.geometry:[nodes[e.from],nodes[e.to]];
    let length=0;for(let k=1;k<pts.length;k++)length+=distance(pts[k-1],pts[k]);
    const forward={edgeIndex:i,from:e.from,to:e.to,label:upper(e.label||e.taxiway),
      kind:e.kind,quality:e.quality,physicalRunway:e.physicalRunway||null,
      source:e.source||data.source,geometry:pts,length};
    const add=d=>{if(!adj.has(d.from))adj.set(d.from,[]);adj.get(d.from).push(d)};
    add(forward);
    if(e.bidirectional!==false)add({...forward,from:e.to,to:e.from,
      geometry:pts.slice().reverse()});
  }
  const allNodes=[...adj.keys()];
  function nearest(p,maxMeters=65){
    if(!point(p)||p.accuracy>35||p.groundspeed>23)return null;
    let best=null,min=maxMeters;
    for(const id of allNodes){
      if(standNodes.has(id))continue;
      const d=distance(nodes[id],p);
      if(d<=min){min=d;best=id}
    }
    return best&&{node:best,metres:Math.round(min)};
  }
  function destinationNode(dest){
    if(!dest)return null;
    if(dest.kind==="stand"){
      const s=stands[dest.id],id=typeof s==="string"?s:s?.node;
      return id?{id,description:"ST"+dest.id,kind:"stand"}:
        {error:"Stand "+dest.id+" has no verified mapped connector"};
    }
    const r=runways[dest.id];
    if(!r)return {error:"RWY "+dest.id+" is recognized but has no airport-specific runway record"};
    if(!r.goalNode)return {error:"RWY "+dest.id+" has no reviewed access/holding/threshold goal. Cannot invent one"};
    return {id:r.goalNode,description:"RWY "+dest.id+" · "+r.goalKind,
      kind:r.goalKind,physicalId:r.physicalId};
  }
  function plan(raw,opt={}){
    const cmd=typeof raw==="string"?parse(raw,data):raw;
    if(cmd.error)return {error:cmd.error};
    const waypoints=cmd.via||[];
    const from=cmd.startStand?destinationNode({kind:"stand",id:cmd.startStand}):
      opt.startNode&&nodes[opt.startNode]?{id:opt.startNode}:
      nearest(opt.position,opt.maxSnapMeters??65);
    if(!from||from.error)return {error:from?.error||"No mapped start within 65 m; select an explicit stand or valid simulator position"};
    const originId=from.id||from.node;
    if(!originId||!nodes[originId])return {error:"Start position is not on a mapped graph node"};
    const goal=destinationNode(cmd.destination);
    if(goal?.error)return {error:goal.error};
    // Bare taxiway commands run to their SOURCE-DEFINED terminal, never the
    // first edge or an arbitrarily chosen nearby intersection.
    const inferred=!goal&&waypoints.length?
      taxiways[waypoints.at(-1)]?.terminalNode:null;
    if(!goal&&!inferred)return {error:"Taxiway endpoint not mapped; cannot choose a fictitious terminal"};
    const target=goal?.id||inferred;
    const queue=new MinHeap(),prev=new Map(),scores=new Map();
    const key=(node,phase)=>node+"|"+phase;
    const origin=key(originId,0);
    scores.set(origin,0);queue.push({node:originId,phase:0,cost:0});
    let answer=null,iterations=0;
    while(queue.length&&iterations++<500000){
      const cur=queue.pop(),curKey=key(cur.node,cur.phase);
      if(cur.cost!==scores.get(curKey))continue;
      if(cur.node===target&&cur.phase===waypoints.length){
        answer=curKey;break;
      }
      for(const e of adj.get(cur.node)||[]){
        if(standNodes.has(e.to)&&e.to!==target)continue;
        if(standNodes.has(cur.node)&&cur.node!==originId)continue;
        if(e.quality==="projected"&&!opt.allowProjectedQA)continue;
        let phase=cur.phase;
        if(!waypoints.length){
          if(e.kind==="runway")continue;
        }else{
          const current=waypoints[phase-1],next=waypoints[phase];
          if(e.label===next){
            phase++;
          }else if(phase>0&&e.label===current){
            // Continue walking the complete physical centreline of this way.
          }else if(phase===0&&["apron","stand","connector"].includes(e.kind)){
            // A stand's chart-mapped lead-out before the first named TWY.
          }else continue;
          if(e.kind==="runway"){
            if(!/^BT/.test(e.label)||!waypoints.includes(e.label)||
              !e.physicalRunway)continue;
          }else if(/^BT/.test(e.label))continue;
        }
        const nextKey=key(e.to,phase),cost=cur.cost+e.length;
        if(cost+1e-7>=(scores.get(nextKey)??Infinity))continue;
        scores.set(nextKey,cost);
        prev.set(nextKey,{previous:curKey,edge:e});
        queue.push({node:e.to,phase,cost});
      }
    }
    if(!answer)return {error:"No source-connected ground path. Runway crossings, unreviewed connectors or incomplete taxiways remain blocked"};
    const directed=[],path=[target];let k=answer;
    while(k!==origin){
      const entry=prev.get(k);
      if(!entry)return {error:"Disconnected predecessor: route rejected"};
      directed.push(entry.edge);k=entry.previous;path.push(entry.edge.from);
    }
    directed.reverse();path.reverse();
    const names=[];
    for(const e of directed)if(!["APRON","STAND","CONNECTOR"].includes(e.label)&&names.at(-1)!==e.label)
      names.push(e.label);
    return {route:{airport:data.airport,cycle:data.cycle,path,
      lengthMetres:Math.round(scores.get(answer)),taxiways:names,
      destination:goal?.description||"END "+waypoints.at(-1),
      terminalKind:goal?.kind||"taxiway-end",
      edges:directed.map(e=>({from:e.from,to:e.to,label:e.label,kind:e.kind,
        quality:e.quality,physicalRunway:e.physicalRunway,
        geometry:e.geometry,source:e.source,lengthMetres:e.length})),
      explicitRunway:directed.some(e=>e.kind==="runway"),
      simQa:true},parsed:cmd};
  }
  function linework(route){
    if(!route?.edges)return [];
    const lines=[];
    for(const e of route.edges){
      const style=e.quality==="projected"?"dashed-amber":"solid-magenta";
      let current=lines.at(-1);
      if(current&&current.style===style&&current.label===e.label&&
        distance(current.coordinates.at(-1),e.geometry[0])<.5){
        current.coordinates.push(...e.geometry.slice(1));
        current.lengthMetres+=e.lengthMetres;
      }else lines.push({style,label:e.label,kind:e.kind,
        physicalRunway:e.physicalRunway,coordinates:e.geometry.slice(),
        lengthMetres:e.lengthMetres,simQa:true});
    }
    return lines;
  }
  function deviation(route,p){
    if(!route?.edges||!point(p))return Infinity;
    let lowest=Infinity,c=Math.cos(p.lat*Math.PI/180);
    for(const e of route.edges)for(let i=1;i<e.geometry.length;i++){
      const a=e.geometry[i-1],b=e.geometry[i],
        x=(a.lon-p.lon)*M*c,y=(a.lat-p.lat)*M,
        dx=(b.lon-a.lon)*M*c,dy=(b.lat-a.lat)*M,
        sq=dx*dx+dy*dy;
      if(sq<1e-6)continue;
      const t=Math.max(0,Math.min(1,-(x*dx+y*dy)/sq));
      lowest=Math.min(lowest,Math.hypot(x+t*dx,y+t*dy));
    }
    return lowest;
  }
  function monitor(active,p,time=Date.now()){
    const track=active.monitor||(active.monitor={count:0,last:0});
    if(!point(p)||p.accuracy>35||p.groundspeed>23){
      track.count=0;return {status:"position-unreliable"};
    }
    const d=deviation(active.route,p);
    if(d<=45){track.count=0;return {status:"on-route",deviationMetres:d}}
    if(++track.count<2)return {status:"checking",deviationMetres:d};
    if(time-track.last<3000)return {status:"cooldown",deviationMetres:d};
    track.last=time;
    if(active.route?.explicitRunway)return {status:"reclearance-required",deviationMetres:d,
      message:"Off runway route: request new ATC clearance; never improvise a crossing."};
    const replacement=plan(active.command,{position:p,maxSnapMeters:65});
    if(!replacement.route)return {status:"unmapped",deviationMetres:d,error:replacement.error};
    track.count=0;active.route=replacement.route;
    return {status:"replanned",route:replacement.route,deviationMetres:d};
  }
  function destinations(){
    return {stands:Object.keys(stands).sort(),runways:Object.entries(runways)
      .map(([id,r])=>({id,physicalId:r.physicalId,goalKind:r.goalKind||null,
        mapped:!!r.goalNode}))};
  }
  return {airport:data.airport,cycle:data.cycle,source:data.source,simulatorTestOnly:true,
    parse:raw=>parse(raw,data),plan,linework,deviation,monitor,destinations,
    nearest,getNode:id=>nodes[id]||null,validation:checked};
}
function fromLegacy(old,settings={}){
  if(!old?.nodes||!Array.isArray(old.edges))throw Error("Invalid legacy graph");
  const physical=settings.physicalRunways||{};
  const runways=settings.runways||{};
  const originalSource=old.source||settings.source;
  if(!originalSource?.provider)throw Error("Legacy graph lacks source/provider");
  const edges=old.edges.map(e=>{
    const label=upper(e.taxiway),runway=e.runway===true;
    const quality=e.closed||e.military?"blocked":
      e.runwayAccessCandidate||/projected|not-surveyed/i.test(e.geometry||"")?"projected":"qa";
    return {from:e.from,to:e.to,label,kind:runway?"runway":
      e.allowStandAccess?"apron":"taxiway",bidirectional:e.bidirectional!==false,
      quality,closed:e.closed,militaryOnly:e.military,
      physicalRunway:runway?physical[label]||null:null,
      source:{provider:originalSource.provider,
        document:originalSource.document||"Original network source",
        page:e.sourcePage||null,feature:e.sourcePath??e.osmWay??null}};
  });
  const stands={};
  for(const [id,s] of Object.entries(old.stands||{}))
    if((typeof s==="string"?s:s?.node)&&/^[A-Z0-9]{1,10}$/.test(id))
      stands[id]={node:typeof s==="string"?s:s.node};
  const taxiways={};
  for(const [id,t] of Object.entries(old.taxiways||{})){
    const last=t?.nodes?.at(-1)||t?.exitNode;
    if(last&&old.nodes[last])taxiways[id]={terminalNode:last};
  }
  return {engineVersion:1,airport:old.airport,cycle:String(old.cycle),
    simulatorTestOnly:true,verified:false,coordinateSystem:"WGS84",
    source:originalSource.document?originalSource:
      {...originalSource,document:"Original chart/OSM source graph"},
    nodes:old.nodes,edges,stands,taxiways,runways};
}
const api={version:"1.0.0",validate,create,parse,fromLegacy,distance};
root.JEPPIRAN_TAXI_ENGINE=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
