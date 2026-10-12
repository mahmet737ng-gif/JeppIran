/* JEPPIRAN v2 chart-PDF network route planner.
 * Only accepts workflow-approved GRAPH, not raw vector/adjacency proposals.
 * Output is chart-space simulator QA; NEVER operational aircraft guidance.
 */
(function(root){"use strict";
const upper=s=>String(s||"").trim().toUpperCase();
function parse(raw,graph){
 const toks=upper(raw).replace(/[,→>]+/g," ").replace(/\bSTAND\s*/g,"ST")
   .replace(/\bRWY\s*/g,"RWY").split(/\s+/).filter(Boolean);
 if(toks.length<2||!/^ST[A-Z0-9]+$/.test(toks[0]))
  return {error:"Start with a chart-mapped stand (ST123 ...)"};
 const ends=(graph.inventory?.runways||[]).flatMap(r=>
   r.ends.map(v=>({name:upper(v),physicalId:upper(r.physicalId)})));
 const runId=x=>upper(x).replace(/^RUNWAY|^RWY|^BT/,"");
 const via=[],start=toks[0];
 if(!(graph.inventory?.stands||[]).some(s=>upper(typeof s==="string"?s:s.id)===start))
  return {error:"Stand is not named in approved graph: "+start};
 let destination=null;
 for(let i=1;i<toks.length;i++){
  const token=toks[i],run=ends.find(v=>v.name===runId(token));
  if(run){
    if(i===toks.length-1){
      destination={kind:"runway-hold",runway:run.name,physicalId:run.physicalId};
      continue;
    }
    via.push({label:run.physicalId,kind:"runway-use",designator:run.name});
  }else{
    const known=(graph.inventory?.taxiways||[]).some(t=>
       upper(typeof t==="string"?t:t.id)===token);
    if(!known)return {error:"Unrecognized taxiway "+token+"; no shortcut permitted"};
    via.push({label:token,kind:"taxiway"});
  }
 }
 return {start,via,destination};
}
function plan(graph,request){
 if(!graph||graph.engine!=="JEPPIRAN_ADC_WORKFLOW"||
   graph.summary?.routeable!==true||graph.releaseStatus!=="REVIEWED_CHART_GRAPH_ONLY")
   return {error:"ADC network not routeable: mandatory source QA still incomplete"};
 const cmd=parse(request,graph);
 if(cmd.error)return cmd;
 const edges=graph.edges||[],nodes=graph.nodes||{},gates=graph.gates||[];
 const byFrom=new Map();
 for(const e of edges){
  if(e.reviewed!==true||!nodes[e.from]||!nodes[e.to])continue;
  if(!byFrom.has(e.from))byFrom.set(e.from,[]);
  byFrom.get(e.from).push({...e,toNode:e.to});
  if(e.bidirectional){
   if(!byFrom.has(e.to))byFrom.set(e.to,[]);
   byFrom.get(e.to).push({...e,toNode:e.from,reversed:true});
  }
 }
 const standEdges=edges.filter(e=>e.kind==="stand-lead"&&e.label===cmd.start);
 if(!standEdges.length)return {error:"Stand has no approved lead-out geometry"};
 const start=standEdges[0].from;
 // Stages: finish the stand lead, then each named taxiway in order.
 // Unnamed connectors are traversed only when the user explicitly requests
 // intermediate runway use, not when stopping at a holding position.
 const labels=[{label:cmd.start,kind:"stand-lead"},...cmd.via];
 const terminalGates=cmd.destination?gates.filter(g=>upper(g.physicalRunway)===
   cmd.destination.physicalId&&g.holdNode):[];
 if(cmd.destination&&!terminalGates.length)
  return {error:"No reviewed hold-short for runway "+cmd.destination.runway};
 const goalNodes=new Set(terminalGates.map(g=>g.holdNode));
 const Q=[{node:start,stage:0,cost:0,path:[]}],best=new Map(),key=(n,k)=>n+"|"+k;
 let finished=null;
 // Tiny graphs run fast; workflow contains only human-reviewed geometries.
 while(Q.length){
  Q.sort((a,b)=>a.cost-b.cost);
  const q=Q.shift(),k=key(q.node,q.stage);
  if(best.has(k)&&best.get(k)<q.cost)continue;
  if(q.stage===labels.length-1){
   const goal=cmd.destination?goalNodes.has(q.node):
     q.path.length>0&&q.path.at(-1).label===labels.at(-1).label;
   if(goal){finished=q;break}
  }
  for(const e of byFrom.get(q.node)||[]){
   if(e.kind==="page-transfer"){
     const next={node:e.toNode,stage:q.stage,cost:q.cost+.01,
       path:[...q.path,e]};
     const nextKey=key(next.node,next.stage);
     if((best.get(nextKey)??Infinity)>next.cost){best.set(nextKey,next.cost);Q.push(next)}
     continue;
   }
   const current=labels[q.stage],upcoming=labels[q.stage+1];
   const canLabel=(s)=>e.label===s.label||
     (s.kind==="runway-use"&&e.kind==="runway-axis"&&
      e.label===s.label);
   let stage=-1;
   if(canLabel(current))stage=q.stage;
   else if(upcoming&&canLabel(upcoming))stage=q.stage+1;
   else if(e.kind==="runway-connector"&&
       (current.kind==="runway-use"||upcoming?.kind==="runway-use"))
     stage=upcoming?.kind==="runway-use"?q.stage+1:q.stage;
   if(stage<0)continue;
   if(e.kind==="runway-axis"&&!labels.some(l=>l.kind==="runway-use"))continue;
   // A runway-hold destination stops at the holding node BEFORE the
   // runway connector, never crossing because the route said RWY.
   if(cmd.destination&&e.kind==="runway-connector")continue;
   const next={node:e.toNode,stage,cost:q.cost+1,
     path:[...q.path,e]},nextKey=key(next.node,next.stage);
   if((best.get(nextKey)??Infinity)>next.cost){best.set(nextKey,next.cost);Q.push(next)}
  }
 }
 if(!finished)return {error:"No source-connected path matching the requested sequence"};
 const warnings=["CHART-SPACE SIMULATOR QA ONLY","NO ATC CLEARANCE",
   "PDF page units are NOT metres or WGS84"];
 return {ok:true,airport:graph.airport,requested:request,destination:cmd.destination,
   edges:finished.path.map(e=>({id:e.id,label:e.label,kind:e.kind,
       page:e.page,points:e.reversed?[...e.points].reverse():e.points,
       sourceDrawingIds:e.sourceDrawingIds})),
   warnings};
}
const api={version:"2.0.0",parse,plan};
root.JEPPIRAN_ADC_ROUTER=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
