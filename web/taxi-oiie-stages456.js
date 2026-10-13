/* JEPPIRAN OIIE stages 4-6: printed-grid registration, runway-gate review,
 * and fail-closed bidirectional routing QA. Cycle 2621; SIMULATOR QA ONLY.
 * The input PDF's native tick labels were independently checked (p380/382/383).
 * A grid alignment is NOT proof of a physical taxiway junction/hold short.
 */
(function(root){"use strict";
const SOURCE="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6e46ce8a7ab6";
const PAGE=Object.freeze({ADC:380,PASSENGER:382,CARGO:383,SALAM:383});
const REGIONS=[
 {id:"ADC",page:380,lat:[24,26],lon:[7,11],x:[-187.8,5001.01899],y:[-154.09422,1825.24616],
  rms:[0.057,0.82],gridLabels:[6,9],bounds:[84,83,525,782],exclude:[]},
 {id:"PASSENGER",page:382,lat:[24.4,24.9],lon:[8.5,9.6],x:[-736.83352,18499.9983],y:[-598.78197,5835.0113],
  rms:[1.213,0.193],gridLabels:[11,24],bounds:[84,53,525,782],exclude:[]},
 {id:"CARGO",page:383,lat:[24,24.6],lon:[9.9,11.3],x:[-600.12857,14884.186],y:[-490.37143,5618.52811],
  rms:[3.042,1.276],gridLabels:[14,30],bounds:[84,53,525,782],exclude:[[316.68,419.04,525,781.56]]},
 {id:"SALAM",page:383,lat:[25.8,26],lon:[7.3,7.7],x:[-798.00003,21094.4197],y:[-762.11996,6317.87012],
  rms:[2.093,1.8],gridLabels:[6,10],bounds:[316.68,419.04,525,781.56],exclude:[]}
];
const RUNWAYS=[
 {physicalId:"11L_29R",ends:["11L","29R"],publishedLengthM:4198,sourcePage:380,
  holdShortCandidates:[],gateApproval:"NO_REVIEWED_HOLD_SHORT_OR_ENTRY"},
 {physicalId:"11R_29L",ends:["11R","29L"],publishedLengthM:4092,sourcePage:380,
  holdShortCandidates:[],gateApproval:"NO_REVIEWED_HOLD_SHORT_OR_ENTRY"}
];
const U=x=>String(x||"").trim().toUpperCase();
const isPoint=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const inBox=(p,b,tol=0)=>p[0]>=b[0]-tol&&p[0]<=b[2]+tol&&p[1]>=b[1]-tol&&p[1]<=b[3]+tol;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const DRAWINGS={380:1478,382:361,383:461};
const validSourceIds=(a,page)=>Array.isArray(a)&&a.length>0&&
 a.every(n=>Number.isInteger(n)&&n>=0&&(!page||n<DRAWINGS[page]));
function fromGeo(r,lat,lon){
 if(!Number.isFinite(lat)||!Number.isFinite(lon))return null;
 const lm=(lat-35)*60,om=(lon-51)*60;
 if(lm<r.lat[0]-0.001||lm>r.lat[1]+0.001||om<r.lon[0]-0.001||om>r.lon[1]+0.001)return null;
 const p=[r.x[0]*lm+r.x[1],r.y[0]*om+r.y[1]];
 return inBox(p,r.bounds,4)&&!r.exclude.some(b=>inBox(p,b,0))?p:null;
}
function toGeo(r,p){
 if(!isPoint(p)||!inBox(p,r.bounds)||r.exclude.some(b=>inBox(p,b)))return null;
 const lm=(p[0]-r.x[1])/r.x[0],om=(p[1]-r.y[1])/r.y[0];
 if(lm<r.lat[0]-0.01||lm>r.lat[1]+0.01||om<r.lon[0]-0.01||om>r.lon[1]+0.01)return null;
 return {lat:35+lm/60,lon:51+om/60};
}
function regionAt(page,p){
 const regions=REGIONS.filter(r=>r.page===Number(page));
 return regions.find(r=>toGeo(r,p)!==null)||null;
}
function register(fromPage,fromPoint,toPage,toRegion){
 const src=regionAt(fromPage,fromPoint);
 if(!src)return {ok:false,reason:"Source point outside calibrated subchart"};
 const geo=toGeo(src,fromPoint);
 const candidates=REGIONS.filter(r=>r.page===Number(toPage)&&(!toRegion||r.id===toRegion));
 const match=candidates.map(r=>({region:r.id,point:fromGeo(r,geo.lat,geo.lon)})).find(x=>x.point);
 if(!match)return {ok:false,reason:"No geographically overlapping destination subchart",sourceRegion:src.id};
 return {ok:true,sourceRegion:src.id,targetRegion:match.region,point:match.point,geo,
  qa:"GRID_REGISTRATION_ONLY_NOT_PHYSICAL_CONNECTIVITY"};
}
function graphQA(nodes,edges,gates){
 const errors=[],okNodes=new Map(),safeEdges=[],approvedGates=new Map();
 const refuse=(code,id)=>errors.push({code,id});
 for(const n of nodes||[]){
  if(!n?.id||okNodes.has(n.id)||n.reviewed!==true||!isPoint(n.point)||
    !validSourceIds(n.sourceDrawingIds,n.page)){refuse("UNVERIFIED_NODE",n?.id);continue}
  const r=regionAt(n.page,n.point);
  if(!r||r.id!==n.region){refuse("NODE_REGION",n.id);continue}
  if(!["stand","taxiway","hold-short","runway"].includes(n.kind)){refuse("NODE_KIND",n.id);continue}
  okNodes.set(n.id,{...n});
 }
 const byId=new Map((edges||[]).map(e=>[e.id,e]));
 for(const g of gates||[]){
  const hold=okNodes.get(g.holdNode),runway=okNodes.get(g.runwayNode);
  const published=RUNWAYS.find(r=>r.physicalId===U(g.physicalRunway)&&r.ends.includes(U(g.runwayEnd)));
  if(g.reviewed!==true||!g.id||!published||!hold||hold.kind!=="hold-short"||
     !runway||runway.kind!=="runway"||U(runway.label)!==U(g.runwayEnd)||
     !g.holdShortReviewed||!validSourceIds(g.holdShortDrawingIds,hold.page)||
     !Array.isArray(g.connectorEdgeIds)||!g.connectorEdgeIds.length||
     !g.connectorEdgeIds.every(id=>byId.get(id)?.reviewed===true)){
    refuse("RUNWAY_GATE_NOT_APPROVED",g?.id);continue;
  }
  approvedGates.set(g.id,g);
 }
 for(const e of edges||[]){
  const a=okNodes.get(e.from),b=okNodes.get(e.to);
  if(!e.id||e.reviewed!==true||!a||!b||!validSourceIds(e.sourceDrawingIds,a?.page)||
    !["taxi","stand-lead","runway-axis","runway-connector","page-portal"].includes(e.kind)){
   refuse("EDGE_UNREVIEWED_OR_MISSING_SOURCE",e?.id);continue;
  }
  if(e.kind!=="page-portal"&&
    (!Array.isArray(e.points)||e.points.length<2||e.points.some(p=>!isPoint(p))||
     dist(e.points[0],a.point)>.8||dist(e.points.at(-1),b.point)>.8||
     e.points.some(p=>!inBox(p,regionAt(a.page,a.point).bounds,2)))){
    refuse("EDGE_GEOMETRY_UNVERIFIED",e.id);continue;
   }
  if(e.kind==="page-portal"){
   const r=register(a.page,a.point,b.page,b.region);
   if(a.page===b.page||!r.ok||dist(r.point,b.point)>5||
      !validSourceIds(e.pageRegistrationSourceIds)||e.portalReviewed!==true){
    refuse("UNAPPROVED_PAGE_PORTAL",e.id);continue;
   }
  }else if(a.page!==b.page||a.region!==b.region){
   refuse("ILLEGAL_CROSS_PAGE_EDGE",e.id);continue;
  }
  if(e.kind==="runway-axis"&&(a.kind!=="runway"||b.kind!=="runway"||
      !RUNWAYS.some(r=>r.ends.includes(U(a.label))&&r.ends.includes(U(b.label))))){
   refuse("UNREVIEWED_RUNWAY_AXIS",e.id);continue;
  }
  if(e.kind==="runway-connector"){
   const gate=approvedGates.get(e.gateId);
   if(!gate||!gate.connectorEdgeIds.includes(e.id)||
      ![gate.holdNode,gate.runwayNode].includes(a.id)||
      ![gate.holdNode,gate.runwayNode].includes(b.id)){
    refuse("RUNWAY_ACCESS_BLOCKED",e.id);continue;
   }
  }else if(e.kind!=="runway-axis"&&(a.kind==="runway"||b.kind==="runway")){
   refuse("RUNWAY_SHORTCUT_BLOCKED",e.id);continue;
  }
  safeEdges.push({...e});
 }
 // Incomplete runway gates may NEVER authorize a route to a runway.
 const validGates=[...approvedGates.values()].filter(g=>
  g.connectorEdgeIds.every(id=>safeEdges.some(e=>e.id===id)));
 const activeRunwayNodes=new Set(validGates.map(g=>g.runwayNode));
 const adj=new Map();
 for(const e of safeEdges){
  const add=(a,b)=>{if(!adj.has(a))adj.set(a,[]);adj.get(a).push({to:b,edge:e.id})};
  add(e.from,e.to);
  if(e.bidirectional===true)add(e.to,e.from);
 }
 function path(from,to){
  if(!okNodes.has(from)||!okNodes.has(to))return null;
  const seen=new Set([from]),q=[from],back=new Map();
  for(let i=0;i<q.length;i++)for(const step of adj.get(q[i])||[]){
   if(seen.has(step.to))continue;
   seen.add(step.to);back.set(step.to,{node:q[i],edge:step.edge});q.push(step.to);
  }
  if(!seen.has(to))return null;
  const result=[];for(let cur=to;cur!==from;cur=back.get(cur).node)result.push(back.get(cur).edge);
  return result.reverse();
 }
 const stands=[...okNodes.values()].filter(n=>n.kind==="stand");
 const destinations=[...activeRunwayNodes].map(id=>okNodes.get(id));
 const certified=[];
 for(const st of stands)for(const r of destinations){
  const outward=path(st.id,r.id),returnTrip=path(r.id,st.id);
  if(outward&&returnTrip)certified.push({from:st.id,to:r.id,outbound:outward,return: returnTrip});
 }
 return {nodes:[...okNodes.values()],edges:safeEdges,gates:validGates,certified,issues:errors,
  partialRouteable:certified.length>0,checks:{reviewedNodes:okNodes.size,reviewedEdges:safeEdges.length,
   reviewedGates:validGates.length,bidirectionalPairs:certified.length}};
}
function evaluate(opts={}){
 const src=opts.sourceSha256||opts.source?.sha256;
 const valid=U(opts.airport)==="OIIE"&&String(opts.cycle)==="2621"&&src===SOURCE;
 if(!valid)return {ok:false,routeable:false,reason:"SOURCE_CYCLE_OR_AIRPORT_MISMATCH"};
 const registration=REGIONS.map(r=>({id:r.id,page:r.page,latTickCount:r.gridLabels[0],lonTickCount:r.gridLabels[1],
  residualPt:r.rms,status:r.rms.every(v=>v<=3.1)?"GRID_QA":"REVIEW_REQUIRED"}));
 const graph=graphQA(opts.graph?.nodes||[],opts.graph?.edges||[],opts.graph?.gates||[]);
 return {ok:true,airport:"OIIE",cycle:"2621",sourceSha256:SOURCE,phase4:{status:"GRID_REGISTERED_PORTALS_PENDING",
  regions:registration,crossPageTaxiPortalsApproved:graph.edges.filter(e=>e.kind==="page-portal").length},
 phase5:{status:graph.gates.length?"GATES_PARTIALLY_APPROVED":"HOLD_SHORT_AND_RUNWAY_ENTRIES_PENDING",
  physicalRunways:RUNWAYS,approvedGates:graph.gates.length},
 phase6:{status:graph.partialRouteable?"PARTIAL_SIMULATOR_QA_ONLY":"ROUTING_BLOCKED",
  ...graph.checks,issues:graph.issues,certified:graph.certified},
 routeable:graph.partialRouteable,approvedGraph:graph};
}
const api={version:"2621.4-6.1",sourceSha256:SOURCE,regions:REGIONS,runways:RUNWAYS,regionAt,
 fromGeo,toGeo,register,graphQA,evaluate};
root.JEPPIRAN_OIIE_STAGES456=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
