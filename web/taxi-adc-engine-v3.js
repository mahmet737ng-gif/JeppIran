/* JEPPIRAN ADC ENGINE v3: airport-independent source-to-routing coordinator.
 * No automatic promotion of ambiguous source geometry or taxi clearance.
 * Works with ADC, same-page inset, separate Parking/Docking pages.
 */
(function(root){"use strict";
const U=x=>String(x||"").trim().toUpperCase();
const unique=a=>[...new Set(a)];
const REQUIRED=["DISCOVER","CLASSIFY","EXTRACT","TRACE","CONNECT","REGISTER","RESTRICT","TEST","RELEASE"];
function classifyLabel(raw,context={}){
 const original=U(raw).replace(/\s+/g,"");
 if(!original)return {kind:"UNKNOWN",value:original};
 if(/^(HS|HOTSPOT)[-_]?\d+[A-Z]?$/.test(original))
  return {kind:"HOTSPOT",value:original,routeToken:false};
 if(/^(RWY|RUNWAY)?(?:0?[1-9]|[12]\d|3[0-6])[LRC]?$/.test(original)&&
   (context.runwayDesignators||[]).some(x=>U(x)===original.replace(/^(RWY|RUNWAY)/,"")))
  return {kind:"RUNWAY",value:original.replace(/^(RWY|RUNWAY)/,""),routeToken:true};
 if(/^(STAND|ST)[-_]?[A-Z]?\d+[A-Z]?$/.test(original))
  return {kind:"STAND",value:original.replace(/^STAND/,"ST").replace(/[-_]/g,""),routeToken:true};
 const published=(context.taxiwayNames||[]).map(U);
 if(published.includes(original))return {kind:"TAXIWAY",value:original,routeToken:true};
 return {kind:"UNRESOLVED",value:original,routeToken:false,
  reason:"Label not verified in airport taxiway inventory"};
}
function pages(airport,entries){
 const groups={ADC:[],PARKING:[],DOCKING:[],BRIEFING:[],OTHER:[]};
 for(const p of entries||[]){
  if(p.airport&&U(p.airport)!==U(airport))continue;
  const title=U([p.title,p.chartNumber,p.section].filter(Boolean).join(" "));
  let type=/\b(ADC|AIRPORT DIAGRAM|AIRPORT CHART|10-9)\b/.test(title)?"ADC":
   /PARKING|APRON|STAND POSITIONS?/.test(title)?"PARKING":
   /DOCKING|STAND COORDINATES/.test(title)?"DOCKING":
   /BRIEFING|TAXI PROCEDURE|PUSHBACK/.test(title)?"BRIEFING":"OTHER";
  if(p.insetTypes?.includes("PARKING")&&type==="ADC")
   groups.PARKING.push({page:p.page,region:"INSET",parentPage:p.page});
  groups[type].push({page:p.page,region:"FULL",parentPage:null});
 }
 return {groups,complete:groups.ADC.length>0,
  pending:groups.ADC.length?[]:["ADC source page has not been identified"]};
}
function graphQA(g){
 const errs=[];
 if(!g||!g.reviewed||!g.nodes||!g.edges){return {passed:false,errors:["Reviewed graph required"]}}
 const nodes=g.nodes,neighbors=new Map();
 for(const n of Object.keys(nodes))neighbors.set(n,new Set());
 for(const e of g.edges){
  if(!nodes[e.from]||!nodes[e.to]||e.reviewed!==true||!e.sourceDrawingIds?.length){
   errs.push("Unverified/missing edge "+e.id);continue}
  neighbors.get(e.from).add(e.to);
  if(e.bidirectional)neighbors.get(e.to).add(e.from);
 }
 const reach=start=>{const seen=new Set([start]),queue=[start];
  for(let i=0;i<queue.length;i++)for(const id of neighbors.get(queue[i])||[])
   if(!seen.has(id)){seen.add(id);queue.push(id)}return seen};
 const stands=g.stands||{},gates=g.gates||{};
 for(const [id,stand] of Object.entries(stands)){
  if(!nodes[stand.node]||stand.verified!==true){errs.push("Stand not registered "+id);continue}
  const known=reach(stand.node);
  if(!Object.values(gates).some(v=>v.verified&&known.has(v.holdNode)))
   errs.push("Stand cannot reach verified runway hold "+id);
 }
 for(const [id,gate] of Object.entries(gates))
  if(gate.verified!==true||!nodes[gate.holdNode]||!gate.runwayEnd)
   errs.push("Invalid runway hold gate "+id);
 return {passed:errs.length===0,errors:errs,nodeCount:Object.keys(nodes).length,
  edgeCount:g.edges.length};
}
function adjacency(g){
 const map=new Map();
 for(const e of g.edges||[]){
  if(!e.reviewed)continue;
  for(const [a,b,reverse] of [[e.from,e.to,false],...(e.bidirectional?[[e.to,e.from,true]]:[])]){
   if(!map.has(a))map.set(a,[]);
   map.get(a).push({...e,from:a,to:b,reversed:reverse});
  }
 }
 return map;
}
function expand(g,from,to,via=[],opts={}){
 const qa=graphQA(g);if(!qa.passed)return {ok:false,error:"Ground graph not QA approved",issues:qa.errors};
 const labels=unique((g.taxiways||[]).map(t=>U(typeof t==="string"?t:t.id)));
 for(const name of via)if(!labels.includes(U(name)))
  return {ok:false,error:"Unknown taxiway "+name};
 const ad=adjacency(g),goals=new Set([to]),queue=[{node:from,viaIndex:0,cost:0,path:[]}],best=new Map();
 while(queue.length){
  queue.sort((a,b)=>a.cost-b.cost);
  const st=queue.shift(),key=st.node+"|"+st.viaIndex;
  if((best.get(key)??Infinity)<st.cost)continue;
  if(goals.has(st.node)&&st.viaIndex===via.length)
   return {ok:true,path:st.path,autoCompleted:st.path.map(e=>e.label),
    clarification:"Implicit intermediate taxiways were inserted based on reviewed connectivity"};
  for(const edge of ad.get(st.node)||[]){
   if(edge.kind==="runway-axis"&&!opts.allowRunwayUse)continue;
   if(edge.kind==="runway-connector"&&!opts.allowRunwayCrossing)continue;
   let next=st.viaIndex;
   if(via[next]&&U(edge.label)===U(via[next]))next++;
   // Never route through later requested taxiways in the wrong order.
   if(via.slice(next+1).some(label=>U(label)===U(edge.label)))continue;
   const nkey=edge.to+"|"+next;
   const newCost=st.cost+(edge.distanceM>0?edge.distanceM:1);
   if(newCost<(best.get(nkey)??Infinity)){
    best.set(nkey,newCost);
    queue.push({node:edge.to,viaIndex:next,cost:newCost,path:[...st.path,edge]});
   }
  }
 }
 return {ok:false,error:"No approved connected route for requested endpoints"};
}
function randomTests(g){
 const qa=graphQA(g);if(!qa.passed)return {passed:false,errors:qa.errors,tests:[]};
 const stands=Object.entries(g.stands||{}),gates=Object.entries(g.gates||{});
 const samples=[];
 for(const [sid,s] of stands)for(const [gid,gate] of gates){
  const result=expand(g,s.node,gate.holdNode);
  samples.push({from:"ST"+sid,to:gid,pass:result.ok,error:result.error});
 }
 for(let i=0;i<stands.length;i++)for(let j=i+1;j<stands.length;j++){
  if(samples.length>800)break;
  const res=expand(g,stands[i][1].node,stands[j][1].node);
  samples.push({from:"ST"+stands[i][0],to:"ST"+stands[j][0],pass:res.ok,error:res.error});
 }
 return {passed:samples.length>0&&samples.every(t=>t.pass),
  tests:samples,errors:samples.filter(x=>!x.pass)};
}
function evaluate(ctx){
 const ready=ctx||{},pageInfo=pages(ready.airport,ready.chartPages||[]);
 const labels=(ready.scannedLabels||[]).map(x=>classifyLabel(x,ready));
 const unknown=labels.filter(x=>x.kind==="UNRESOLVED");
 const tasks=[
  {id:"DISCOVER",ok:pageInfo.complete,reason:"Find ADC and any inset/separate Parking, Docking and Briefing pages"},
  {id:"CLASSIFY",ok:!!ready.taxonomiesApproved&&!unknown.length,reason:"Disambiguate HS hotspot vs actual taxiways and runway designators"},
  {id:"EXTRACT",ok:!!ready.inventoryComplete,reason:"Extract all taxiway, stand and runway attributes, lengths, widths and sources"},
  {id:"TRACE",ok:!!ready.centerlinesVerified,reason:"Review all original PDF centerlines and stand lead curves"},
  {id:"CONNECT",ok:!!ready.junctionsVerified,reason:"Verify every physical intersection and directional adjacency"},
  {id:"REGISTER",ok:!!ready.pagesRegistered,reason:"Align all parking/ADC pages via verified control points"},
  {id:"RESTRICT",ok:!!ready.runwayGatesVerified,reason:"Verify runway entrances, hold positions, crossings and restrictions"},
  {id:"TEST",ok:!!ready.graph?.reviewed&&randomTests(ready.graph).passed,reason:"Test stand↔runway, stand↔stand and reachable graph components"},
  {id:"RELEASE",ok:false,reason:"Only approved QA graph can publish; no automatic approval of uncertain map evidence"}
 ];
 const allPrerequisites=tasks.slice(0,-1).every(t=>t.ok);
 tasks.at(-1).ok=allPrerequisites&&ready.releaseApproved===true;
 return {version:"3.0.0",airport:U(ready.airport),pageInfo,labels,worklist:tasks,
  next:tasks.find(t=>!t.ok)||null,routeable:tasks.at(-1).ok,
  safety:"SIMULATOR QA ONLY. No operational taxi clearance, no invented connections."};
}
const api={version:"3.0.0",classifyLabel,pages,graphQA,expand,randomTests,evaluate};
root.JEPPIRAN_ADC_ENGINE_V3=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
