/* JEPPIRAN ADC -> Routable Graph Workflow v2
 * Pure JavaScript: browser + Node. NO inferred taxi clearances.
 * Chart pixels are PDF page-local. A second chart is NEVER implicitly
 * connected to the first. Every routed edge must have reviewed lineage.
 */
(function(root){"use strict";
const U=x=>String(x||"").trim().toUpperCase();
const finite=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const hyp=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const round=x=>Math.round(x*1000)/1000;
const SOURCE="SOURCE_PDF";
const STAGES=[
  ["source","Read pages, verify source fingerprint and dimensions"],
  ["inventory","Identify physical runways, taxiway names, stands and layout pages"],
  ["geometry","Trace taxiway centerlines and individual stand lead-out curves"],
  ["junctions","Locate true touch points and split traced lines into segments"],
  ["semantics","Attach verified taxiway/stand names and directions to segments"],
  ["runway-access","Mark hold-short, gate, runway entry and backtrack connections"],
  ["page-registration","Align overlapping ADC and parking diagrams with audited control points"],
  ["quality","Test connectivity, dead ends, duplicates and crossing safety"],
  ["release","Generate chart overlays and routeable network only after approval"]
];
function nearest(poly,p){
 let best=null,prior=0;
 for(let i=1;i<poly.length;i++){
  const a=poly[i-1],b=poly[i],dx=b[0]-a[0],dy=b[1]-a[1],len2=dx*dx+dy*dy;
  const t=len2?Math.max(0,Math.min(1,((p[0]-a[0])*dx+(p[1]-a[1])*dy)/len2)):0;
  const q=[a[0]+dx*t,a[1]+dy*t],distance=hyp(q,p),progress=prior+Math.sqrt(len2)*t;
  if(!best||distance<best.distance)best={distance,progress,point:q,index:i-1,t};
  prior+=Math.sqrt(len2);
 }
 return best;
}
function length(poly){return poly.slice(1).reduce((n,p,i)=>n+hyp(poly[i],p),0)}
function pointAt(poly,s){
 let prev=0;
 for(let i=1;i<poly.length;i++){
  const d=hyp(poly[i-1],poly[i]);
  if(s<=prev+d||i===poly.length-1){
   const t=d?Math.max(0,Math.min(1,(s-prev)/d)):0;
   return [0,1].map(k=>round(poly[i-1][k]+(poly[i][k]-poly[i-1][k])*t));
  }prev+=d;
 }return poly[0];
}
function section(poly,start,end){
 const arr=[pointAt(poly,start)],mid=0;
 let progress=0;
 for(let i=1;i<poly.length;i++){
  progress+=hyp(poly[i-1],poly[i]);
  if(progress>start+1e-5&&progress<end-1e-5)arr.push(poly[i]);
 }
 arr.push(pointAt(poly,end));return arr;
}
function compile(input){
 const issues=[],jobs=[],block=(id,message,evidence=null)=>issues.push({code:id,message,evidence,blocking:true});
 if(!input||!/^[A-Z]{4}$/.test(input.airport||"")||!/^\d{4}$/.test(String(input.cycle||"")))
  throw Error("Airport/cycle identity invalid");
 const inventory=input.inventory||{},traces=input.traces||[],junctions=input.junctions||[],
  gates=input.runwayGates||[],links=input.pageLinks||[];
 const runways=inventory.runways||[],stands=inventory.stands||[],taxiways=inventory.taxiways||[];
 const knownTaxi=new Set(taxiways.map(t=>U(typeof t==="string"?t:t.id)));
 const knownStands=new Set(stands.map(s=>U(typeof s==="string"?s:s.id)));
 const expectedPages=new Set((input.pages||[]).map(p=>Number(p.page)));
 if(!input.source?.sha256||!/^[a-f0-9]{64}$/.test(input.source.sha256)||!expectedPages.size)
  block("SOURCE_MISSING","Source fingerprint and chart-page manifest required");
 for(const p of input.pages||[])if(!Number.isFinite(p.width)||!Number.isFinite(p.height)||
  p.width<100||p.height<100)block("PAGE_DIMENSIONS","Invalid PDF dimensions",p.page);
 if(!runways.length||!stands.length||!taxiways.length)
  block("INVENTORY_MISSING","Physical runways, all stands and taxiway names must be inventoried");
 for(const r of runways)if(!Array.isArray(r.ends)||r.ends.length!==2||
   !Number.isFinite(r.publishedLengthM)||r.publishedLengthM<=100||
   !r.physicalId)block("RUNWAY_IDENTITY","Physical runway ends and published length required",r.physicalId);
 const byId=new Map(),approved=[];
 for(const t of traces){
  if(!t?.id||byId.has(t.id)){block("TRACE_DUPLICATE","Missing/duplicate source trace id",t?.id);continue}
  byId.set(t.id,t);
  if(!expectedPages.has(Number(t.page)))block("TRACE_PAGE","Trace refers to another chart page",t.id);
  const points=t.points;
  if(!Array.isArray(points)||points.length<2||points.some(p=>!finite(p))||length(points)<.2){
   block("TRACE_GEOMETRY","Invalid or degenerate PDF polyline",t.id);continue}
  if(!Array.isArray(t.sourceDrawingIds)||!t.sourceDrawingIds.length)
   block("TRACE_PROVENANCE","Original PDF drawing ids required",t.id);
  if(t.reviewed===true&&t.source==="SOURCE_PDF"){
   if(!["taxiway","stand-lead","runway-axis","runway-connector"].includes(t.kind))
    block("TRACE_KIND","Unknown reviewed line class",t.id);
   else if(t.kind==="taxiway"&&!knownTaxi.has(U(t.label)))
    block("TRACE_LABEL","Taxiway segment missing a declared label",t.id);
   else if(t.kind==="stand-lead"&&!knownStands.has(U(t.standId)))
    block("STAND_TRACE_ID","Stand lead must name its actual stand",t.id);
   else approved.push(t);
  }
 }
 const reviewedById=new Map(approved.map(t=>[t.id,t]));
 const perTrace=new Map(approved.map(t=>[t.id,[]]));
 const nodeMap=new Map(),nodes={},edges=[],useId={};
 function newNode(page,p,kind,semanticKey,verified=true){
   const key=semanticKey||"P"+page+"_"+round(p[0])+"_"+round(p[1]);
   if(nodeMap.has(key))return nodeMap.get(key);
   const id="N"+(nodeMap.size+1);
   nodeMap.set(key,id);nodes[id]={page,point:p.map(round),kind,verified};
   return id;
 }
 // Source-PDF endpoints share a node ONLY through explicit reviewed junctions,
 // not because two labels happen to be near each other.
 const assigned=new Map();
 for(const j of junctions){
  if(j.reviewed!==true)continue;
  if(!j.id||!finite(j.point)||!expectedPages.has(Number(j.page))||
     !Array.isArray(j.touches)||j.touches.length<2){
   block("JUNCTION_INVALID","A verified junction requires a point and >=2 lines",j.id);continue}
  let ok=true;
  for(const tid of j.touches){
   const t=reviewedById.get(tid);
   if(!t||Number(t.page)!==Number(j.page)||nearest(t.points,j.point)?.distance>.8){
    block("JUNCTION_FIT","Touch point must lie on BOTH reviewed source polylines",j.id+":"+tid);ok=false;
   }
  }
  if(!ok)continue;
  const nid=newNode(j.page,j.point,j.kind||"junction","J_"+j.page+"_"+j.id);
  for(const tid of j.touches){
   perTrace.get(tid).push({distance:nearest(reviewedById.get(tid).points,j.point).progress,node:nid,id:j.id});
   assigned.set(tid+"@"+j.id,nid);
  }
 }
 for(const t of approved){
  const total=length(t.points),stop=perTrace.get(t.id)||[];
  const cuts=[{distance:0,node:newNode(t.page,t.points[0],"endpoint","E_"+t.id+"_START")},
   ...stop,{distance:total,node:newNode(t.page,t.points.at(-1),"endpoint","E_"+t.id+"_END")}]
   .sort((a,b)=>a.distance-b.distance);
  // If a reviewed touch is effectively on the endpoint, replace the
  // endpoint node with its verified junction identity (no spurious gap).
  const unique=[];
  for(const c of cuts){
   if(unique.length&&Math.abs(c.distance-unique.at(-1).distance)<.2){
    if(c.id)unique.at(-1).node=c.node;
   }else unique.push({...c});
  }
  for(let i=1;i<unique.length;i++){
   const a=unique[i-1],b=unique[i],geometry=section(t.points,a.distance,b.distance);
   if(b.distance-a.distance<.2||a.node===b.node)continue;
   edges.push({id:t.id+"_"+i,from:a.node,to:b.node,kind:t.kind,label:U(t.label||t.standId||t.physicalRunway),
    page:t.page,points:geometry,sourceDrawingIds:t.sourceDrawingIds,
    reviewed:true,bidirectional:t.oneWay!==true,requiresClearance:t.kind==="runway-connector",
    sourceTrace:t.id,source:SOURCE});
  }
 }
 const present=new Set(approved.filter(t=>t.kind==="taxiway").map(t=>U(t.label)));
 const standTraces=new Set(approved.filter(t=>t.kind==="stand-lead").map(t=>U(t.standId)));
 const absentTaxi=[...knownTaxi].filter(t=>!present.has(t));
 const absentStands=[...knownStands].filter(s=>!standTraces.has(s));
 if(absentTaxi.length)block("TAXIWAY_UNTRACED",absentTaxi.length+" named taxiways lack reviewed centerlines",absentTaxi);
 if(absentStands.length)block("STAND_LEADS_UNTRACED",absentStands.length+" stand lead-outs require source tracing",absentStands);
 for(const t of approved.filter(t=>t.kind==="stand-lead")){
  const connected=junctions.some(j=>j.reviewed&&j.touches?.includes(t.id)&&j.touches.some(id=>{
   const other=reviewedById.get(id);return other?.kind==="taxiway"||other?.kind==="stand-lead"}));
  if(!connected)block("STAND_DISCONNECTED","Stand lead requires verified contact with named apron taxiway",t.standId);
 }
 const taxiJunctions=junctions.filter(j=>j.reviewed&&
  j.touches?.filter(id=>reviewedById.get(id)?.kind==="taxiway").length>=2);
 if(present.size>1&&!taxiJunctions.length)
  block("TAXI_JUNCTIONS_UNVERIFIED","No reviewed intersections between named taxiways");
 for(const g of gates){
  if(g.reviewed!==true)continue;
  const p1=reviewedById.get(g.taxiTraceId),p2=reviewedById.get(g.runwayTraceId);
  if(!g.holdShortReviewed||!finite(g.holdPoint)||!p1||!p2||
     p2.kind!=="runway-axis"||Number(p1.page)!==Number(p2.page)||
     nearest(p1.points,g.holdPoint).distance>.8)
   block("RUNWAY_GATE_INVALID","Verified entry requires named hold-short and mapped runway axis",g.id);
 }
 if(!gates.length||gates.some(g=>g.reviewed!==true))
  block("RUNWAY_GATES_UNVERIFIED","Runway hold-short and entry locations not fully confirmed",
   gates.filter(g=>!g.reviewed).map(g=>g.id));
 for(const link of links){
  if(link.reviewed!==true||!link.controlPoints||link.controlPoints.length<3)
   block("PAGE_ALIGNMENT_PENDING","ADC/parking links need >=3 reviewed control-point pairs",link.id);
 }
 if(expectedPages.size>1&&!links.length)block("PAGE_ALIGNMENT_PENDING","No verified alignment between distinct page coordinate frames");
 if(approved.length&&!junctions.some(j=>j.reviewed))
  block("NODE_CONTACTS_UNVERIFIED","Source lines are not connected until reviewed contacts are mapped");
 // Do not silently promote mere geometric crossings to legal connections.
 const blocking=new Set(issues.map(x=>x.code));
 function job(id,title,pending,required){
  return {id,title,status:pending?"PENDING":"READY",blocking:pending,required,blockingIssues:issues.filter(x=>x.code===id).map(x=>x.message)};
 }
 jobs.push(job("source",STAGES[0][1],blocking.has("SOURCE_MISSING")||blocking.has("PAGE_DIMENSIONS"),["PDF source hash, page number, dimensions"]));
 jobs.push(job("inventory",STAGES[1][1],blocking.has("INVENTORY_MISSING")||blocking.has("RUNWAY_IDENTITY"),["runway polygons + ends, stand labels, taxiway names"]));
 jobs.push(job("geometry",STAGES[2][1],!!absentTaxi.length||!!absentStands.length||blocking.has("TRACE_GEOMETRY"),["source-Bezier traced centerlines for all names and stand leads"]));
 jobs.push(job("junctions",STAGES[3][1],blocking.has("NODE_CONTACTS_UNVERIFIED")||blocking.has("JUNCTION_FIT")||blocking.has("TAXI_JUNCTIONS_UNVERIFIED")||!junctions.length,["reviewed endpoint-to-endpoint and crossing contacts"]));
 jobs.push(job("semantics",STAGES[4][1],blocking.has("TRACE_LABEL")||absentTaxi.length>0||absentStands.length>0,["verified labels, directions, stand association"]));
 jobs.push(job("runway-access",STAGES[5][1],blocking.has("RUNWAY_GATES_UNVERIFIED")||blocking.has("RUNWAY_GATE_INVALID"),["hold position, runway gate, permission flag, backtrack alignment"]));
 jobs.push(job("page-registration",STAGES[6][1],blocking.has("PAGE_ALIGNMENT_PENDING"),["3+ audited matched points per page link"]));
 jobs.push(job("quality",STAGES[7][1],issues.length>0,["all edges source-backed; connectivity/turn restrictions and dead ends tested"]));
 const releaseApproved=input.releaseReviewed===true&&issues.length===0;
 jobs.push(job("release",STAGES[8][1],!releaseApproved,["manual QA approval; source fingerprint unchanged; no unsafe gap"]));
 if(!releaseApproved)block("NOT_ROUTEABLE","One or more QA gates still block routing/release");
 return {schemaVersion:2,engine:"JEPPIRAN_ADC_WORKFLOW",airport:input.airport,cycle:String(input.cycle),
  sourceSha256:input.source?.sha256||null,coordinateSystem:"PDF_PAGE_LOCAL_NOT_WGS84",
  summary:{pages:expectedPages.size,runways:runways.length,taxiways:knownTaxi.size,stands:knownStands.size,
   reviewedSourceTraces:approved.length,untracedTaxiways:absentTaxi.length,
   untracedStandLeads:absentStands.length,reviewedIntersections:taxiJunctions.length,
   approvedRunwayGates:gates.filter(g=>g.reviewed).length,discoveredGraphNodes:Object.keys(nodes).length,
   reviewedGraphEdges:edges.length,routeable:releaseApproved},
  jobs,issues,nodes,edges,
  releaseStatus:releaseApproved?"REVIEWED_CHART_GRAPH_ONLY":"BLOCKED_INCOMPLETE_SOURCE_GRAPH",
  requirements:{flightOperationalApproval:false,georeferenced:false,routeableInSimulatorQA:releaseApproved}};
}
function fromSurvey(survey){
 if(survey?.schemaVersion!==2)throw Error("Expected native airport ADC survey schemaVersion 2");
 const pages=(survey.source?.pages||[]).map(page=>({page,width:survey.source.pdfSize[0],height:survey.source.pdfSize[1]}));
 return {airport:survey.airport,cycle:String(survey.cycle),source:{sha256:survey.source.sha256},
  pages,
  inventory:{runways:(survey.runwayPolygons||[]).map(x=>({physicalId:x.physicalId,ends:x.ends,
   publishedLengthM:x.publishedLengthM,sourceDrawingIds:[x.sourcePdfDrawingId]})),
   taxiways:(survey.taxiways||[]).map(x=>({id:x.id})),
   stands:(survey.stands||[]).map(x=>({id:"ST"+x.id,page:x.source.page,labelPosition:[x.source.x,x.source.y]}))},
  traces:[],junctions:[],runwayGates:[],pageLinks:[],releaseReviewed:false};
}
const api={version:"2.0.0",stages:STAGES,compile,fromSurvey,nearest};
root.JEPPIRAN_ADC_WORKFLOW=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
