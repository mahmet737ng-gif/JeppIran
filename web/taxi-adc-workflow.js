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
// Audited per-page registration. >=4 independent control pairs (three
// would fit any affine transform perfectly and cannot detect an outlier).
// The math is done HERE, not trusted from a hand-entered RMS field.
function solve3(A,b){
 const m=A.map((r,i)=>[...r,b[i]]);
 for(let j=0;j<3;j++){
  let max=j;for(let i=j+1;i<3;i++)if(Math.abs(m[i][j])>Math.abs(m[max][j]))max=i;
  if(Math.abs(m[max][j])<1e-7)return null;
  [m[j],m[max]]=[m[max],m[j]];
  const d=m[j][j];for(let k=j;k<4;k++)m[j][k]/=d;
  for(let i=0;i<3;i++)if(i!==j){
   const c=m[i][j];for(let k=j;k<4;k++)m[i][k]-=c*m[j][k]
  }
 }
 return m.map(row=>row[3]);
}
function fitPages(pairs){
 if(!Array.isArray(pairs)||pairs.length<4||
     pairs.some(p=>!finite(p.from)||!finite(p.to)))
  return {ok:false,error:"Need >=4 independent valid PDF page control-point pairs"};
 const A=[[0,0,0],[0,0,0],[0,0,0]], bx=[0,0,0],by=[0,0,0];
 for(const p of pairs){
  const v=[p.from[0],p.from[1],1];
  for(let i=0;i<3;i++){
   for(let j=0;j<3;j++)A[i][j]+=v[i]*v[j];
   bx[i]+=v[i]*p.to[0];by[i]+=v[i]*p.to[1];
  }
 }
 const cx=solve3(A,bx),cy=solve3(A,by);
 if(!cx||!cy)return {ok:false,error:"Registration controls are nearly collinear"};
 const map=p=>[cx[0]*p[0]+cx[1]*p[1]+cx[2],
                cy[0]*p[0]+cy[1]*p[1]+cy[2]];
 const rms=Math.sqrt(pairs.reduce((sum,p)=>{
  const q=map(p.from);return sum+hyp(q,p.to)**2},0)/pairs.length);
 const determinant=cx[0]*cy[1]-cx[1]*cy[0];
 if(!Number.isFinite(rms)||Math.abs(determinant)<1e-5||rms>.75)
  return {ok:false,error:"Invalid/warped PDF chart transform",rmsErrorPt:round(rms)};
 return {ok:true,rmsErrorPt:round(rms),affine:{x:cx,y:cy},map};
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
 // A runway stripe or its printed label is NOT a taxi entry. An entry requires
 // a source-traced, connected taxi -> connector -> runway-axis path and a
 // published/verified hold-short point. Never create a shortcut across a stripe.
 const axes=new Set(approved.filter(t=>t.kind==="runway-axis").map(t=>U(t.physicalRunway||t.label)));
 for(const runway of runways){
   if(!axes.has(U(runway.physicalId)))
     block("RUNWAY_AXIS_UNTRACED","Physical runway axis needs reviewed original PDF geometry",runway.physicalId);
 }
 for(const g of gates){
  if(g.reviewed!==true)continue;
  const taxi=reviewedById.get(g.taxiTraceId),
    runway=reviewedById.get(g.runwayTraceId),
    access=reviewedById.get(g.connectorTraceId);
  const joins=junctions.filter(j=>j.reviewed===true&&j.touches?.includes(g.connectorTraceId));
  const taxiTouch=joins.some(j=>j.touches.includes(g.taxiTraceId));
  const runwayTouch=joins.some(j=>j.touches.includes(g.runwayTraceId));
  if(!g.holdShortReviewed||!finite(g.holdPoint)||!finite(g.runwayPoint)||
     !taxi||!runway||!access||access.kind!=="runway-connector"||
     runway.kind!=="runway-axis"||!g.physicalRunway||!g.runwayEnd||
     !runways.some(r=>U(r.physicalId)===U(g.physicalRunway)&&
       r.ends.map(U).includes(U(g.runwayEnd)))||
     U(runway.physicalRunway||runway.label)!==U(g.physicalRunway)||
     [taxi,runway,access].some(t=>Number(t.page)!==Number(g.page))||
     nearest(taxi.points,g.holdPoint).distance>.8||
     nearest(access.points,g.holdPoint).distance>.8||
     nearest(runway.points,g.runwayPoint).distance>.8||
     nearest(access.points,g.runwayPoint).distance>.8||
     !taxiTouch||!runwayTouch)
   block("RUNWAY_GATE_INVALID","Gate must have reviewed taxi/connector/axis junctions and verified hold line",g.id);
 }
 for(const runway of runways){
  if(!gates.some(g=>g.reviewed===true&&U(g.physicalRunway)===U(runway.physicalId)))
   block("RUNWAY_GATES_UNVERIFIED","Each physical runway needs a reviewed entry and hold point",runway.physicalId);
 }
 if(gates.some(g=>g.reviewed!==true))
  block("RUNWAY_GATES_UNVERIFIED","Unreviewed runway gate candidates remain",gates.filter(g=>!g.reviewed).map(g=>g.id));
 const geometryPages=new Set(approved.map(t=>Number(t.page)));
 const routingPages=new Set(input.routingPages||[...geometryPages]);
 // Two PDF pages never share coordinates. A portal must be created only
 // from two VERIFIED source junctions and audited page registration.
 if(routingPages.size>1){
  if(!links.length)block("PAGE_ALIGNMENT_PENDING","Missing reviewed registration and junction portals between ADC/Parking");
  for(const link of links){
   const fit=fitPages(link.controlPoints);
   const fromJ=junctions.find(j=>j.reviewed&&j.id===link.fromJunction&&Number(j.page)===Number(link.fromPage));
   const toJ=junctions.find(j=>j.reviewed&&j.id===link.toJunction&&Number(j.page)===Number(link.toPage));
   if(link.reviewed!==true||!fit.ok||!fromJ||!toJ||
      !expectedPages.has(Number(link.fromPage))||!expectedPages.has(Number(link.toPage))||
      Number(link.fromPage)===Number(link.toPage)||
      hyp(fit.map(fromJ.point),toJ.point)>.75){
    block("PAGE_ALIGNMENT_PENDING",
      "Page link needs four audited noncollinear controls, fitted RMS<=.75pt and real matching junctions",link.id);
    continue;
   }
   const from=nodeMap.get("J_"+link.fromPage+"_"+link.fromJunction),
     to=nodeMap.get("J_"+link.toPage+"_"+link.toJunction);
   if(!from||!to){block("PAGE_ALIGNMENT_PENDING","Registered page portal nodes not found",link.id);continue}
   edges.push({id:"PORTAL_"+link.id,from,to,kind:"page-transfer",label:"CHART_PORTAL",
     reviewed:true,source:SOURCE,sourceDrawingIds:link.sourceDrawingIds||[],
     registrationRmsPt:fit.rmsErrorPt,
     bidirectional:true,requiresClearance:false,notGroundDistance:true});
  }
 }
 // Validate physical graph connectivity rather than the appearance of a
 // line on top of a runway, label, or another chart page.
 const adjacency=new Map(),connect=(a,b)=>{if(!adjacency.has(a))adjacency.set(a,new Set());adjacency.get(a).add(b)};
 for(const e of edges){connect(e.from,e.to);if(e.bidirectional)connect(e.to,e.from)}
 function reachable(start){
  const seen=new Set([start]),q=[start];
  for(let i=0;i<q.length;i++)for(const n of adjacency.get(q[i])||[])
   if(!seen.has(n)){seen.add(n);q.push(n)}
  return seen;
 }
 const standSources=approved.filter(t=>t.kind==="stand-lead");
 const runwayNodes=new Set(edges.filter(e=>e.kind==="runway-axis").flatMap(e=>[e.from,e.to]));
 for(const t of standSources){
  const initial=nodeMap.get("E_"+t.id+"_START");
  if(!initial)continue;
  const seen=reachable(initial);
  if(![...runwayNodes].some(n=>seen.has(n))&&runwayNodes.size)
   block("DISCONNECTED_STAND","Stand lead has no reviewed path to runway via explicit gate",t.standId);
 }
 if(approved.length&&!edges.length)block("NO_ROUTABLE_EDGES","No reviewed graph edges exist");
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
 jobs.push(job("runway-access",STAGES[5][1],blocking.has("RUNWAY_GATES_UNVERIFIED")||blocking.has("RUNWAY_GATE_INVALID")||blocking.has("RUNWAY_AXIS_UNTRACED"),["hold position, runway gate, permission flag, backtrack alignment"]));
 jobs.push(job("page-registration",STAGES[6][1],blocking.has("PAGE_ALIGNMENT_PENDING"),["3+ audited matched points per page link"]));
 jobs.push(job("quality",STAGES[7][1],issues.length>0,["all edges source-backed; connectivity/turn restrictions and dead ends tested"]));
 const releaseApproved=input.releaseReviewed===true&&issues.length===0&&
  edges.length>0&&standSources.length===knownStands.size&&
  gates.length>0;
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
  inventory:{runways,stands,taxiways},
  gates:gates.filter(g=>g.reviewed===true).map(g=>{
    const t=junctions.find(j=>j.reviewed&&j.touches?.includes(g.taxiTraceId)&&
      j.touches?.includes(g.connectorTraceId));
    const a=junctions.find(j=>j.reviewed&&j.touches?.includes(g.runwayTraceId)&&
      j.touches?.includes(g.connectorTraceId));
    return {...g,holdNode:t?nodeMap.get("J_"+g.page+"_"+t.id):null,
      runwayNode:a?nodeMap.get("J_"+g.page+"_"+a.id):null};
  }),
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
  traces:[],junctions:[],runwayGates:[],pageLinks:[],
  routingPages:[survey.qaCharts?.mainADC?.page,survey.qaCharts?.parking?.page].filter(Number.isInteger),
  releaseReviewed:false};
}
const api={version:"2.3.0",stages:STAGES,compile,fromSurvey,nearest,fitPages};
root.JEPPIRAN_ADC_WORKFLOW=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
