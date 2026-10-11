/* JEPPIRAN TAXI preview · verified graphs only · NOT FOR ACTUAL NAVIGATION */
(function(){
"use strict";
const ns="http://www.w3.org/2000/svg", taxi={auto:null,graphRequest:null,active:false,trace:false,startSelect:false,testStart:null,airport:"",graph:null,standReference:null,selectedStand:"",showStands:false,showNetwork:false,route:null,manual:new Map(),prompted:"",networkAudit:null,networkOpen:false,highlightTaxiway:"",insGroups:null,standGroupAudit:null,standGroupOpen:false};
const $=id=>document.getElementById(id);
const name=s=>String(s||"").trim().toUpperCase().replace(/\s+/g," ");
function parse(raw){
  const s=name(raw);
  if(!s)return {error:"Enter a stand, taxiway sequence or published procedure"};
  if(taxi.airport==="OIMM"&&taxi.graph){
    const tokens=s.replace(/STAND\s*/g,"ST").replace(/[,→>]+/g," ").split(/\s+/).filter(Boolean);
    // In Mashhad, STD109 is a common slip for ST109; preserve STD3 for
    // airports that actually have letter-prefixed stand D3.
    const stand=t=>{const k=t.replace(/^(ST|P)/,"");
      return taxi.graph.stands[k]?k:(/^D\d+$/.test(k)&&taxi.graph.stands[k.slice(1)]?k.slice(1):null)};
    if(tokens.length===1&&stand(tokens[0]))return {kind:"stand",destination:stand(tokens[0])};
    if(tokens.length===1&&["RAMP","APRON"].includes(tokens[0]))
      return {kind:"auto",destination:"MAIN APRON"};
    if(tokens.length===2&&tokens.join(" ")==="MAIN APRON")
      return {kind:"auto",destination:"MAIN APRON"};
    const runwayToken=t=>/^(?:RWY)?(?:13R|13L|31R|31L)$/.test(t)||
      /^RUNWAY(?:13R|13L|31R|31L)$/.test(t);
    if(tokens.length===1&&runwayToken(tokens[0]))
      return {kind:"auto",destination:tokens[0]};
    if(tokens.length===2&&["RUNWAY","RWY"].includes(tokens[0])&&runwayToken(tokens[1]))
      return {kind:"auto",destination:tokens[1]};
    if(tokens.length===2&&stand(tokens[0])&&runwayToken(tokens[1]))
      return {kind:"auto",startStand:stand(tokens[0]),destination:tokens[1]};
    if(tokens.length===2&&stand(tokens[0])&&["RAMP","APRON"].includes(tokens[1]))
      return {kind:"auto",startStand:stand(tokens[0]),destination:"MAIN APRON"};
    if(tokens.length===3&&stand(tokens[0])&&["RWY","RUNWAY"].includes(tokens[1])&&runwayToken(tokens[2]))
      return {kind:"auto",startStand:stand(tokens[0]),destination:tokens[2]};
    if(tokens.length===3&&tokens[0]==="RUNWAY"&&runwayToken(tokens[1])&&stand(tokens[2]))
      return {kind:"auto",destination:stand(tokens[2])};
    const startStand=tokens.length>1?stand(tokens[0]):null;if(startStand)tokens.shift();
    const destination=tokens.length?stand(tokens[tokens.length-1]):null;if(destination)tokens.pop();
    const taxiways=[],stops=[];
    for(const t of tokens){
      const k=t.replace(/^\//,"");
      if(!/^[A-Z][A-Z0-9]*$/.test(k))return {error:"Unknown token: "+t};
      if(t.startsWith("/"))stops.push(taxiways.length);taxiways.push(k);
    }
    if(startStand||taxiways.length)return {kind:"sequence",startStand,destination,taxiways,stops};
  }
  // Procedure designator is RUNWAY + PROCEDURE, no whitespace: 34L2A not 34L 2A.
  if(/^\d{2}[LRC]?\s+\d+[A-Z][A-Z0-9-]*$/.test(s))
    return {error:"No space between runway and taxi procedure. Use "+s.replace(/\s+/g,"")};
  if(/^\d{2}[LRC]?\d+[A-Z][A-Z0-9-]*$/.test(s))return {kind:"procedure",key:s};
  // Published stand identifiers are not interchangeable with same-named taxiways.
  if(/^ST[A-Z][0-9]{1,3}[A-Z]?$/.test(s)&&taxi.networkAudit?.standLeads?.[s.slice(2)])
    return {kind:"publishedStand",destination:s.slice(2)};
  const registered=Object.prototype.hasOwnProperty.call(taxi.standReference?.stands||{},s)||
    Object.prototype.hasOwnProperty.call(taxi.graph?.stands||{},s);
  if(registered||/^(ST|P)\d{1,4}[A-Z]?$/.test(s)||(taxi.airport==="OMDB"&&/^[A-HQS]\d{1,3}[LR]$/.test(s)))
    return {kind:"stand",destination:s};
  const parts=s.replace(/[,→>]+/g," ").split(" ").filter(Boolean),stops=[],taxiways=[];
  // Explicit ST prefix distinguishes PARKING STAND D3 from TAXIWAY D3.
  // E.g. STD3 T5 N2 = Stand D3, then taxiways T5 and N2.
  const leadingStand=parts.length>1?parts[0].match(/^ST([A-Z][0-9]{1,3}[A-Z]?)$/):null;
  const startStand=leadingStand?leadingStand[1]:null;
  if(startStand)parts.shift();
  let destination=null;
  if(parts.length>1&&(/^(ST|P)\d{1,4}[A-Z]?$/.test(parts[parts.length-1])||
      Object.prototype.hasOwnProperty.call(taxi.standReference?.stands||{},parts[parts.length-1])||
      Object.prototype.hasOwnProperty.call(taxi.graph?.stands||{},parts[parts.length-1])||
      (taxi.airport==="OMDB"&&/^[A-HQS]\d{1,3}[LR]$/.test(parts[parts.length-1]))))
    destination=parts.pop();
  for(const part of parts){
    if(!/^\/?[A-Z][A-Z0-9-]{0,11}$/.test(part))return {error:"Unknown token: "+part};
    if(part.startsWith("/"))stops.push(taxiways.length);
    taxiways.push(part.replace(/^\//,""));
  }
  return taxiways.length?{kind:"sequence",taxiways,stops,destination,startStand}:{error:"No taxiways entered"};
}
const dist=(a,b)=>Math.hypot((Number(a.lat)-Number(b.lat))*111195,
  (Number(a.lon)-Number(b.lon))*111195*Math.cos((Number(a.lat)+Number(b.lat))*Math.PI/360));
function adjacent(graph,options={}){
  // Reuse the physical node graph already indexed for this airport/cycle.
  // All known junctions are in memory; no PDF scanning or OSM fetch on GO.
  if(window.JEPPIRAN_TAXI_ADJACENCY)return window.JEPPIRAN_TAXI_ADJACENCY.nodeLinks(graph,options);
  const links={};
  for(const e of graph.edges){
    if(e.closed||e.military||!graph.nodes[e.from]||!graph.nodes[e.to])continue;
    if(e.runway&&!(options.runwayWay&&e.taxiway===options.runwayWay&&
      graph.runwayBacktracks?.[options.runwayWay]?.requiresExplicitClearance))continue;
    const d=dist(graph.nodes[e.from],graph.nodes[e.to]);
    if(!(d>(graph.airport==="OIMM"?0.00001:0.1)&&d<12000))continue;
    (links[e.from]??=[]).push({to:e.to,way:name(e.taxiway),cost:d,access:e.allowStandAccess===true});
    if(e.bidirectional!==false)(links[e.to]??=[]).push({to:e.from,way:name(e.taxiway),cost:d,access:e.allowStandAccess===true});
  }
  return links;
}
function shortest(graph,start,goal,requested,links){
  const edges=links||adjacent(graph),ways=requested?.taxiways||[],slash=requested?.stops||[];
  // Opt-in, bounded, REAL unnamed centerlines between named OSM taxiways.
  // These are simulator previews only, never invented straight connectors.
  const unmapped=window.JEPPIRAN_TAXI_UNNAMED;
  const namedNodes=new Map();
  if(ways.length>1)for(const e of graph.edges){
    const label=name(e.taxiway);
    if(!ways.includes(label)||e.closed||e.runway||e.military)continue;
    if(!namedNodes.has(label))namedNodes.set(label,new Set());
    namedNodes.get(label).add(e.from);namedNodes.get(label).add(e.to);
  }
  const isDirect=(from,to)=>{
    const left=namedNodes.get(from),right=namedNodes.get(to);
    return !!(left&&right&&[...left].some(id=>right.has(id)));
  };
  const bridges=(graph.simulatorTestOnly&&unmapped?.enabled(graph))?
    ways.slice(0,-1).map((from,i)=>isDirect(from,ways[i+1])?
      new Map():unmapped.scan(graph,from,ways[i+1],
        {maxMeters:graph.qaUnnamedConnectorMaxMeters,maxEdges:graph.qaUnnamedConnectorMaxEdges})):[];
  const key=(n,i,u)=>n+"~"+i+"~"+u,first=key(start,0,0),
    seen=new Map([[first,0]]),previous=new Map(),heap=[];
  const push=(item)=>{
    heap.push(item);let i=heap.length-1;
    while(i>0){const p=(i-1)>>1;if(heap[p].w<=heap[i].w)break;
      [heap[i],heap[p]]=[heap[p],heap[i]];i=p;}
  };
  const pop=()=>{
    const result=heap[0],last=heap.pop();
    if(heap.length){
      heap[0]=last;let i=0;
      while(true){
        let j=i,l=2*i+1,r=l+1;
        if(l<heap.length&&heap[l].w<heap[j].w)j=l;
        if(r<heap.length&&heap[r].w<heap[j].w)j=r;
        if(j===i)break;
        [heap[i],heap[j]]=[heap[j],heap[i]];i=j;
      }
    }
    return result;
  };
  push({n:start,i:0,u:0,w:0,k:first});
  let final=null,limit=0;
  while(heap.length&&limit++<150000){
    const p=pop();if(p.w!==seen.get(p.k))continue;
    if((!goal||p.n===goal)&&(!ways.length||(p.i===ways.length-1&&p.u===1))){
      final=p;break;
    }
    function add(n,i,u,extra,hold,move,viaNodes=null,bridgeInfo=null){
      const k=key(n,i,u),w=p.w+extra;
      if(w>=(seen.get(k)??Infinity))return;
      seen.set(k,w);previous.set(k,{prev:p.k,n:p.n,hold,move,viaNodes,bridgeInfo});push({n,i,u,w,k});
    }
    if(ways.length&&p.u&&p.i+1<ways.length){
      add(p.n,p.i+1,0,0,slash.includes(p.i+1),false);
      for(const mapped of bridges[p.i]?.get(p.n)||[]){
        add(mapped.end,p.i+1,0,mapped.length,slash.includes(p.i+1),true,
          mapped.nodes,{from:ways[p.i],to:ways[p.i+1],
            lengthMeters:mapped.length,edgeCount:mapped.nodes.length-1,approval:"OSM_QA_ONLY"});
      }
    }
    for(const e of edges[p.n]||[]){
      if(ways.length&&e.way!==ways[p.i]){
        if(requested.allowStandAccess&&e.access&&p.i===0&&p.u===0)add(e.to,p.i,0,e.cost,false,true);
        else if(requested.allowStandExit&&e.access&&p.i===ways.length-1&&p.u===1)add(e.to,p.i,1,e.cost,false,true);
        continue;
      }
      add(e.to,p.i,1,e.cost,false,true);
    }
  }
  if(!final)return null;
  const reverse=[final.n],rawHolds=[],mappedUnnamedTransitions=[];
  for(let k=final.k;previous.has(k);){
    const p=previous.get(k);
    if(p.hold)rawHolds.push(reverse.length-1);
    if(p.bridgeInfo)mappedUnnamedTransitions.push(p.bridgeInfo);
    if(p.move){
      if(p.viaNodes){
        // Preserve every mapped OSM node, so the rendered route follows
        // the actual connected geometry without cutting across the chart.
        for(let j=p.viaNodes.length-2;j>=0;j--)reverse.push(p.viaNodes[j]);
      }else reverse.push(p.n);
    }
    k=p.prev;
  }
  return {path:reverse.reverse(),holds:rawHolds.map(i=>reverse.length-1-i),
    length:Math.round(final.w),mappedUnnamedTransitions:mappedUnnamedTransitions.reverse()};
}
function firstUnmappedTransition(graph,ways){
  // Diagnose a missing named-taxiway junction on the OSM source only.
  const nodeNames=new Map();
  for(const e of graph.edges||[]){
    const label=name(e.taxiway);
    if(!label||e.closed||e.runway)continue;
    for(const id of [e.from,e.to]){
      if(!nodeNames.has(id))nodeNames.set(id,new Set());
      nodeNames.get(id).add(label);
    }
  }
  for(let i=1;i<ways.length;i++){
    const from=ways[i-1],to=ways[i];
    if(from===to)continue;
    let found=false;
    for(const group of nodeNames.values())if(group.has(from)&&group.has(to)){found=true;break}
    if(!found&&window.JEPPIRAN_TAXI_UNNAMED?.connected(graph,from,to))found=true;
    if(!found)return {from,to};
  }
  return null;
}
// Demo starts at the mapped end of the requested first taxiway nearest to the
// approximate published stand AREA, never at the stand itself. It cannot infer
// a pushback connector from proximity. Applies only to an explicit D3/T5 QA.
function demoFromStandArea(graph,parsed){
  const stand=parsed.startStand&&taxi.networkAudit?.standLeads?.[parsed.startStand];
  const first=parsed.taxiways?.[0];
  if(!stand?.insApprox||parsed.startStand!=="D3"||first!=="T5")return null;
  const onWay=graph.edges.filter(e=>name(e.taxiway)===first&&!e.closed&&!e.runway);
  const degree=new Map();
  for(const e of onWay){
    degree.set(e.from,(degree.get(e.from)||0)+1);
    degree.set(e.to,(degree.get(e.to)||0)+1);
  }
  const endpoints=[...degree].filter(([,count])=>count===1).map(([id])=>id)
    .filter(id=>graph.nodes[id]);
  if(endpoints.length!==2)return null;
  const approx=stand.insApprox;
  endpoints.sort((a,b)=>dist(graph.nodes[a],approx)-dist(graph.nodes[b],approx));
  // A large ambiguity would make the stand-side endpoint indefensible.
  const near=dist(graph.nodes[endpoints[0]],approx),far=dist(graph.nodes[endpoints[1]],approx);
  if(!(near<600&&far-near>250))return null;
  const route=shortest(graph,endpoints[0],null,parsed,adjacent(graph));
  return route?{...route,start:endpoints[0],fromStandArea:true}:null;
}
function demoRoute(graph,parsed){
  // Select a sample start ON the first requested OSM taxiway. This is a
  // source-attributed QA preview, never an assumed aircraft position.
  if(parsed.kind!=="sequence"||parsed.destination)return null;
  const first=parsed.taxiways[0],candidates=new Set();
  for(const e of graph.edges){
    if(name(e.taxiway)===first&&!e.closed&&!e.runway){candidates.add(e.from);candidates.add(e.to);}
  }
  const links=adjacent(graph);
  let best=null;
  for(const start of candidates){
    const route=shortest(graph,start,null,parsed,links);
    if(route && (!best||route.length<best.length))best={...route,start};
  }
  return best;
}
function graphOk(d,icao){
  return d&&
    (d.verified===true||(d.verified===false&&d.simulatorTestOnly===true&&d.coordinateSystem==="WGS84"&&
      ((d.source?.provider==="OpenStreetMap contributors"&&d.source?.license==="ODbL 1.0")||
       (icao==="OIMM"&&d.source?.provider==="Jeppesen"&&d.source?.pages?.includes(601)&&d.source?.pages?.includes(603)&&
        Object.keys(d.stands||{}).length===34&&Object.keys(d.taxiways||{}).length===18))))&&
    d.airport===icao&&String(d.cycle)===String(manifest?.cycle)&&
    d.nodes&&typeof d.nodes==="object"&&Object.keys(d.nodes).length>1&&
    Array.isArray(d.edges)&&d.edges.length>0&&Object.values(d.nodes).every(n=>
      Number.isFinite(n.lat)&&Number.isFinite(n.lon)&&Math.abs(n.lat)<=90&&Math.abs(n.lon)<=180);
}
async function loadStandReference(icao){
  taxi.standReference=null;taxi.selectedStand="";
  const button=$("taxiQaStands");
  if(button){button.textContent="STANDS";button.classList.remove("on");}
  taxi.showStands=false;
  if(icao!=="OMDB")return;
  try{
    const response=await fetch("./data/taxi-stands/OMDB.json",{cache:"no-store"});
    if(!response.ok)throw Error("Stand reference unavailable");
    const d=await response.json(),entries=Object.entries(d.stands||{});
    if(d.airport!=="OMDB"||d.kind!=="stand-position-reference"||d.coordinateSystem!=="WGS84"||
       d.verifiedForTaxiRouting!==false||String(d.forCycle)!==String(manifest?.cycle)||
       !entries.length||entries.some(([id,p])=>!/^[A-HQS]\\d{1,3}[LR]?$/.test(id)||
          !Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
          p.lat<25.2||p.lat>25.35||p.lon<55.2||p.lon>55.5))
      throw Error("Invalid or mismatched stand reference");
    if(taxi.airport!==icao)return;
    taxi.standReference=d;
    if(button)button.textContent="STANDS ("+entries.length+")";
    message("OMDB: "+entries.length+" AIP stand positions across "+new Set(entries.map(([,v])=>v.apron)).size+" aprons. STAND POSITIONS ONLY; routing disabled until connectivity QA.",true);
    draw();
  }catch(error){
    if(taxi.airport===icao)message("Stand reference unavailable: "+error.message,true);
  }
}
// Reusable cross-airport INS groups → OSM proximity audit (NOT auto-routing).
// A separate exact stand coordinate + chart-validated lead-out is required to
// promote a group candidate to an executable taxi connector.
async function loadStandGroups(icao){
  taxi.insGroups=null;taxi.standGroupAudit=null;renderStandGroupPanel();
  try{
    const req=await fetch("./data/taxi-stands/"+encodeURIComponent(icao)+"-ins-groups.json",{cache:"no-store"});
    if(req.status===404)return;
    if(!req.ok)throw Error("Could not load published INS group inventory");
    const groups=await req.json();
    if(taxi.airport!==icao)return;
    taxi.insGroups=groups;
    refreshStandGroupAudit();
  }catch(e){
    if(taxi.airport===icao)message("INS group inventory unavailable: "+e.message,true);
  }
}
function refreshStandGroupAudit(){
  taxi.standGroupAudit=null;
  const engine=window.JEPPIRAN_STAND_TOPOLOGY;
  if(taxi.graph&&taxi.insGroups&&engine?.validate(taxi.insGroups,taxi.graph)){
    try{taxi.standGroupAudit=engine.audit(taxi.insGroups,taxi.graph)}catch(e){
      console.warn("INS stand candidate audit skipped",e);
    }
  }
  renderStandGroupPanel();
}
function renderStandGroupPanel(){
  const panel=$("taxiQaStandGroups"),choices=$("taxiQaStandGroupList"),info=$("taxiQaStandGroupInfo");
  if(!panel||!choices||!info)return;
  panel.hidden=!(taxi.active&&taxi.insGroups&&taxi.standGroupOpen);
  if(panel.hidden)return;
  const report=taxi.standGroupAudit;
  const previous=choices.value;
  choices.replaceChildren();
  if(!report){
    info.textContent="Loading grouped INS coordinates and the ground network…";
    return;
  }
  const opts=report.groups||[];
  for(let i=0;i<opts.length;i++){
    const opt=document.createElement("option");opt.value=String(i);
    opt.textContent=opts[i].group+" · "+opts[i].candidates.length+" proximity candidates";
    choices.appendChild(opt);
  }
  let selected=Number(previous);
  if(!Number.isInteger(selected)||selected<0||selected>=opts.length)selected=0;
  choices.value=String(selected);
  const record=opts[selected];
  info.textContent="INS printed group: "+record.group+" (page "+record.page+"). "+
    "Coordinates rounded to 0.1 minute; NOT a stand survey.\n"+
    "Nearest OSM taxiway names by geometric proximity (NOT physical connections): "+
    (record.candidates.map(c=>c.taxiway+" ~"+Math.round(c.distanceMeters)+"m").join(" · ")||"no nearby named line")+
    "\n0 validated stand/lead-out links. Pushback and runway restrictions need chart-based QA.";
}
async function loadNetworkAudit(icao){
  taxi.networkAudit=null;taxi.highlightTaxiway="";
  if(icao!=="LTFM"){renderNetworkAudit();return}
  try{
    const resp=await fetch("./data/taxi-audits/LTFM.json",{cache:"no-store"});
    if(!resp.ok)throw Error("Network inventory not available");
    const d=await resp.json();
    if(d.airport!=="LTFM"||String(d.cycle)!==String(manifest?.cycle)||
      d.routeApproved!==false||!d.taxiways||
      Object.keys(d.taxiways).length!==131||
      Object.keys(d.chartOnlyTaxiwayLabels||{}).length!==41)
      throw Error("Incomplete or mismatched network QA inventory");
    if(taxi.airport!==icao)return;
    taxi.networkAudit=d;
    renderNetworkAudit();
  }catch(error){
    if(taxi.airport===icao){
      renderNetworkAudit();
      message("LTFM taxiway inventory not loaded: "+error.message,true);
    }
  }
}
function renderNetworkAudit(){
  const panel=$("taxiQaNetwork"),list=$("taxiQaNames"),search=$("taxiQaFilter"),
    info=$("taxiQaDetails");
  if(!panel||!list||!info)return;
  panel.hidden=!(taxi.active&&taxi.networkOpen&&taxi.airport==="LTFM");
  if(panel.hidden)return;
  const d=taxi.networkAudit;
  list.replaceChildren();
  if(!d){info.textContent="Loading network inventory…";return}
  const query=name(search?.value||"");
  const names=[...new Set([...Object.keys(d.taxiways),
    ...Object.keys(d.chartOnlyTaxiwayLabels||{})])].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  for(const label of names){
    if(query&&!label.includes(query))continue;
    const entry=d.taxiways[label],chartOnly=!entry;
    const opt=document.createElement("option");
    opt.value=label;
    opt.textContent=chartOnly?
      label+" · CHART LABEL · NO MAPPED CENTERLINE":
      label+" · "+entry.edges+" OSM segments"+(entry.neighbors.length?" · "+entry.neighbors.length+" junction labels":" · NO NAMED JUNCTION");
    if(label===taxi.highlightTaxiway)opt.selected=true;
    list.appendChild(opt);
  }
  if(!taxi.highlightTaxiway){
    info.textContent=d.stats.totalTaxiwayNamesForReview+" taxiway labels for QA · "+
      d.stats.namedTaxiways+" OSM mapped · "+d.stats.additionalAdcLabelsWithoutSameNamedOsm+
      " chart-only labels without matched mapped geometry · "+d.stats.nodes+
      " graph nodes · "+d.stats.edges+" edges. Select a label to inspect its topology.";
    return;
  }
  const item=d.taxiways[taxi.highlightTaxiway];
  if(!item){
    info.textContent="TWY "+taxi.highlightTaxiway+
      " · CHART LABEL FOUND on 30-9 · NO MATCHED OSM CENTERLINE."+
      "\nCenterline geometry not digitized. Automatic routing must remain disabled here."+
      "\nDo NOT reinterpret a differently named OSM taxiway as this one.";
    return;
  }
  const neighbors=item.neighbors.map(x=>x.taxiway).join(", ")||"None at shared OSM nodes";
  info.textContent="TWY "+taxi.highlightTaxiway+" · "+item.lengthMeters+" m · "+
    item.edges+" mapped segments · "+item.parts+" connected named parts."+
    "\nDirect named-node junctions: "+neighbors+
    "\n"+(item.chartTokenSeen?"Name appears in Jeppesen chart text.":"NOT found in Jeppesen chart text — nomenclature conflict.")+
    " OSM GEOMETRY ONLY; chart-aligned verification / NOTAM review PENDING. No stand connector inferred.";
}
function publishedStandMessage(stand){
  const x=taxi.networkAudit?.standLeads?.[stand];
  if(!x)return "";
  const variants=[x.standard&&"STANDARD: "+x.standard.description,
    x.alternate1&&"ALTERNATE 1: "+x.alternate1.description,
    x.alternate2&&"ALTERNATE 2: "+x.alternate2.description].filter(Boolean);
  return "PUBLISHED PUSHBACK ("+x.sourceChart+", stand "+stand+") · "+
    variants.join(" · ")+" · "+
    (x.caution||"Pushback direction subject to ATC clearance.")+
    " · Lead-out geometry NOT mapped. Select applicable ATC pushback instruction.";
}
function message(s,warning=false){
  const t=$("taxiQaStatus"),detail=$("taxiQaStatusDetails"),full=$("taxiQaFullMessage");
  if(!t)return;
  // Prevent multi-paragraph chart citations and pushback options from blocking
  // the entire ADC. Full text stays available on demand, not discarded.
  const value=String(s||"");
  const paragraphs=value.split(/(?<=\.)\s+(?=[A-Z])/);
  const compact=value.length>200?
    (paragraphs[0]?.length<155?paragraphs[0]:value.slice(0,157).replace(/\s+\S*$/,"")+"…"):
    value;
  t.textContent=compact;
  t.classList.toggle("warning",warning);
  if(detail&&full){
    full.textContent=value;
    detail.hidden=value.length<=200;
    detail.open=false;
  }
}
async function fetchGraph(icao){
  taxi.graph=null;
  message("Checking verified ground network for "+icao+"…");
  try{
    const r=await fetch("./data/taxi-networks/"+encodeURIComponent(icao)+".json",{cache:"no-store"});
    if(!r.ok)throw Error("Not digitized");
    const d=await r.json();
    if(!graphOk(d,icao))throw Error("Invalid, unverified, or wrong-cycle network");
    if(taxi.airport!==icao)return null;
    taxi.graph=d;
    refreshStandGroupAudit();
    if(taxi.networkOpen)renderNetworkAudit();
    if(icao==="OIMM"){
      taxi.standReference={stands:d.stands,airport:icao,source:d.source};
      $("taxiQaStands").textContent="STANDS (34)";
      $("taxiQaInput").placeholder="ST109 · 13R · ST113 31L · ST109 J BT13R H";
      fillOimmQuickDestinations(d);
      message("OIMM · 34 stands · 18 taxiways · Jeppesen 10-9 / 10-9B. Explicit backtracks: ST109 J BT13R H or ST113 A BT31L D. PARKING opens the detail chart.");
      draw();return d;
    }
    message(d.simulatorTestOnly?
      "LTFM SIM QA · "+d.edges.length+" mapped OSM taxi centerlines · © OpenStreetMap contributors (ODbL). NOT AIP-VERIFIED. Connect simulator or choose SET START.":
      "Verified airport ground graph loaded.");
    return d;
  }catch(e){
    if(taxi.airport!==icao)return;
    message("No verified ground network yet for "+icao+". Automatic routing disabled; use TRACE QA to test drawing on this chart.",true);
    return null;
  }
}
// Share an in-flight graph load across TAXI open and GO. Avoid duplicate
// no-store downloads and prevent a stale request from clobbering a new route.
function loadGraph(icao){
  if(taxi.graph?.airport===icao&&graphOk(taxi.graph,icao))return Promise.resolve(taxi.graph);
  if(taxi.graphRequest?.airport===icao)return taxi.graphRequest.promise;
  const promise=fetchGraph(icao);
  taxi.graphRequest={airport:icao,promise};
  promise.then(()=>{if(taxi.graphRequest?.promise===promise)taxi.graphRequest=null;});
  return promise;
}
function isAdc(c){
  return c?.category==="Airport"&&(/AIRPORT DIAGRAM|AERODROME CHART|AERODROME LAYOUT|\bADC\b/i.test(c.name||"")||
    /^(10|20|30)-9$/i.test(c.chart_number||""));
}
function overview(){
  return charts.find(c=>c.airport===selectedAirport&&isAdc(c))||null;
}
function openAdc(){
  const c=overview();if(!c){message("ADC overview not found",true);return}
  if(Number(selectedChart?.page)!==Number(c.page))selectChart(c);
}
function fillOimmQuickDestinations(graph){
  const row=$("taxiQaAutoRow"),select=$("taxiQaAutoDestination");
  if(!row||!select)return;
  row.hidden=false;
  const runwayOptions=["13R","31L","13L","31R"].map(id=>{
    const ok=!!window.JEPPIRAN_TAXI_AUTO?.goal(graph,id).node;
    return '<option value="'+id+'"'+(ok?'':' disabled')+'>RWY '+id+
      (ok?' · HOLD SHORT':' · NOT MAPPED')+'</option>';
  }).join("");
  select.innerHTML='<option value="">Choose a destination (live position or SET START)</option>'+
    '<option value="RAMP">MAIN RAMP · NEAREST CONNECTED ENTRY</option>'+
    runwayOptions+Object.keys(graph.stands).sort((a,b)=>Number(a)-Number(b))
      .map(id=>'<option value="ST'+id+'">STAND '+id+'</option>').join("");
}
function view(){
  if($("taxiQaPanel"))return;
  const panel=document.createElement("section");
  panel.id="taxiQaPanel";panel.className="taxi-qa-panel";panel.hidden=true;
  panel.innerHTML='<div class="taxi-qa-title"><strong>TAXI <small>QA TEST</small></strong>'+
    '<span id="taxiQaAirport"></span><span class="taxi-qa-build">R13</span><button id="taxiQaToolsBtn" type="button" aria-expanded="false" aria-controls="taxiQaButtons">TOOLS ▾</button>'+
    '<button id="taxiQaClose" type="button" aria-label="Close taxi panel">×</button></div>'+
    '<label for="taxiQaInput">Stand STD3 T5 N2 · Hold /N2 · Procedure 34L2A</label>'+
    '<div class="taxi-qa-entry"><input id="taxiQaInput" autocomplete="off" spellcheck="false" placeholder="Stand / taxiways / procedure"><button id="taxiQaGo" type="button">GO</button></div>'+
    '<div id="taxiQaAutoRow" class="taxi-qa-entry" hidden><select id="taxiQaAutoDestination" aria-label="Select stand or runway hold" style="min-width:0;width:100%;background:#112c45;color:#e6f7ff;border:1px solid #467c9a;border-radius:10px;padding:10px;font-size:14px"></select></div>'+
    '<div id="taxiQaRoutePreview" class="taxi-route-preview" hidden aria-label="Mapped taxiway segment preview"></div>'+
    '<div id="taxiQaGuidance" hidden style="margin:3px 0;padding:8px 12px;border-radius:10px;background:#15374c;color:#c9f9f9;font-size:12px;font-weight:700"></div>'+
    '<div id="taxiQaStatus" role="status" aria-live="polite"></div>'+
    '<details id="taxiQaStatusDetails" class="taxi-status-details" hidden><summary>Pushback details / full message</summary><div id="taxiQaFullMessage"></div></details>'+
    '<div id="taxiQaButtons" class="taxi-qa-buttons"><button id="taxiQaAdc" type="button">ADC</button><button id="taxiQaOimmParking" type="button" hidden>PARKING</button><button id="taxiQaOimmNetwork" type="button" hidden aria-pressed="false">NETWORK</button><button id="taxiQaNetworkBtn" type="button" aria-pressed="false">NETWORK</button><button id="taxiQaStart" type="button" aria-pressed="false">SET START</button><button id="taxiQaDemo" type="button">DEMO ROUTE</button><button id="taxiQaStands" type="button" aria-pressed="false">STANDS</button><button id="taxiQaTrace" type="button">TRACE QA</button><button id="taxiQaHold" type="button">HOLD HERE</button><button id="taxiQaUndo" type="button">UNDO</button><button id="taxiQaClear" type="button">CLEAR</button></div>'+
    '<section id="taxiQaNetwork" class="taxi-audit-panel" hidden><strong>ISTANBUL · TAXIWAY INVENTORY / SIM QA ONLY</strong>'+
    '<input id="taxiQaFilter" type="search" autocomplete="off" spellcheck="false" placeholder="Find A, T5, N2…">'+
    '<select id="taxiQaNames" size="8" aria-label="Select mapped taxiway"></select>'+
    '<div id="taxiQaDetails" role="status"></div>'+
    '<div class="taxi-audit-row"><button id="taxiQaD3" type="button">STAND D3 PUSHBACK</button><button id="taxiQaParking" type="button">PARKING 30-9B</button></div>'+
    '<small>OSM segments are NOT official clearance or verified stand connectors.</small></section>'+
    '<section id="taxiQaStandGroups" class="taxi-ins-groups" hidden>'+
    '<strong>LTFM INS STAND GROUPS · CANDIDATE AUDIT ONLY</strong>'+
    '<select id="taxiQaStandGroupList" size="5" aria-label="Published stand coordinate groups"></select>'+
    '<div id="taxiQaStandGroupInfo" role="status"></div>'+
    '<small>Do not taxi using nearest-line estimates. Official geometry and pushback clearance required.</small></section>'+
    '<div id="taxiQaStandMap" hidden aria-label="Geographic reference-only stand map"></div>'+
    '<small class="taxi-qa-warning">SIMULATOR QA ONLY · NOT FOR ACTUAL NAVIGATION</small>';
  document.querySelector("#chartsView .viewer-pane")?.appendChild(panel);
  $("taxiQaClose").onclick=()=>toggle(false);
  const setToolsOpen=open=>{
    panel.classList.toggle("tools-expanded",!!open);
    const btn=$("taxiQaToolsBtn");
    btn.setAttribute("aria-expanded",String(!!open));
    btn.textContent=open?"TOOLS ▴":"TOOLS ▾";
  };
  $("taxiQaToolsBtn").onclick=()=>setToolsOpen(!panel.classList.contains("tools-expanded"));
  $("taxiQaGo").onclick=go;
  $("taxiQaAutoDestination").addEventListener("change",()=>{
    const value=$("taxiQaAutoDestination").value;
    if(value)$("taxiQaInput").value=value;
  });
  $("taxiQaInput").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}};
  $("taxiQaAdc").onclick=openAdc;
  $("taxiQaNetworkBtn").onclick=()=>{
    taxi.networkOpen=!taxi.networkOpen;
    $("taxiQaNetworkBtn").classList.toggle("on",taxi.networkOpen);
    $("taxiQaNetworkBtn").setAttribute("aria-pressed",String(taxi.networkOpen));
    renderNetworkAudit();
  };
  $("taxiQaFilter").addEventListener("input",renderNetworkAudit);
  $("taxiQaNames").addEventListener("change",()=>{
    taxi.highlightTaxiway=$("taxiQaNames").value;
    renderNetworkAudit();
    draw();
  });
  $("taxiQaD3").onclick=()=>{
    message(publishedStandMessage("D3")||"Published stand D3 procedure inventory unavailable.",true);
    $("taxiQaInput").value="STD3 T5 N2";
  };
  $("taxiQaParking").onclick=()=>{
    const c=charts.find(x=>x.airport==="LTFM"&&x.chart_number==="30-9B");
    if(c)selectChart(c);
    else message("Parking chart 30-9B not in cycle",true);
  };
  $("taxiQaOimmParking").onclick=()=>{const c=charts.find(c=>c.airport==="OIMM"&&Number(c.page)===603);if(c)selectChart(c)};
  $("taxiQaOimmNetwork").onclick=()=>{
    taxi.showNetwork=!taxi.showNetwork;$("taxiQaOimmNetwork").classList.toggle("on",taxi.showNetwork);
    $("taxiQaOimmNetwork").setAttribute("aria-pressed",String(taxi.showNetwork));draw();
  };
  $("taxiQaDemo").onclick=()=>{
    if(taxi.airport==="OIMM"&&taxi.graph){if(!$("taxiQaInput").value.trim())$("taxiQaInput").value="ST101 A";go({demo:true});return}
    if(taxi.airport!=="LTFM"||!taxi.graph){
      message("Demo route is available only for the loaded LTFM centerline network.",true);return;
    }
    // Preview the user's entered route rather than silently replacing it.
    // Only use the pre-vetted sample if the input is empty.
    if(!$("taxiQaInput").value.trim())$("taxiQaInput").value="A4 A A7 B /B8A";
    const candidate=parse($("taxiQaInput").value);
    if(candidate.error){message(candidate.error,true);return}
    if(candidate.kind!=="sequence"){
      message("DEMO ROUTE needs named taxiways (e.g. STD3 T5 N2). It does not simulate a stand pushback.",true);
      return;
    }
    go({demo:true});
  };
  $("taxiQaStart").onclick=()=>{
    taxi.startSelect=!taxi.startSelect;taxi.trace=false;
    $("taxiQaStart").classList.toggle("on",taxi.startSelect);
    $("taxiQaStart").setAttribute("aria-pressed",String(taxi.startSelect));
    $("taxiQaTrace").classList.remove("on");
    message(taxi.startSelect?
      "SIM QA: tap your starting point ON the ADC taxiway centerline, then press GO. This overrides live GPS for this TEST only.":
      "Start placement cancelled.");
  };
  $("taxiQaStandGroupList").addEventListener("change",renderStandGroupPanel);
  $("taxiQaStands").onclick=()=>{
    if(taxi.airport==="LTFM"||taxi.insGroups){
      taxi.standGroupOpen=!taxi.standGroupOpen;
      $("taxiQaStands").classList.toggle("on",taxi.standGroupOpen);
      $("taxiQaStands").setAttribute("aria-pressed",String(taxi.standGroupOpen));
      if(taxi.standGroupOpen)$("taxiQaPanel").classList.add("tools-expanded");
      renderStandGroupPanel();
      message(taxi.standGroupAudit?
        taxi.standGroupAudit.groupCount+" printed LTFM stand coordinate groups available for QA; all links remain unverified.":
        "Loading INS stand coordinate groups; none may be used as a verified connector.",true);
      return;
    }
    taxi.showStands=!taxi.showStands;
    $("taxiQaStands").classList.toggle("on",taxi.showStands);
    $("taxiQaStands").setAttribute("aria-pressed",String(taxi.showStands));
    draw();
    if(taxi.airport==="OIMM"&&taxi.graph)message("34 Jeppesen parking positions. Enter a stand number to highlight it; ST101 A previews its chart guideline to A.");
    else if(!taxi.standReference)message("No AIP stand-position reference loaded for this airport.",true);
    else message("AIP stand POSITIONS only. No lead-in, pushback or taxiway topology is validated.",true);
  };
  $("taxiQaTrace").onclick=()=>{taxi.trace=!taxi.trace;taxi.startSelect=false;taxi.route=null;
    $("taxiQaStart").classList.remove("on");$("taxiQaStart").setAttribute("aria-pressed","false");
    $("taxiQaTrace").classList.toggle("on",taxi.trace);
    message(taxi.trace?"Manual QA mode: TAP ALONG the printed taxiway centerline; mark STOP with HOLD HERE.":"Manual trace paused.");
    draw();};
  $("taxiQaHold").onclick=()=>{
    const p=currentManual();if(!p.points.length){message("Add a centerline point first.",true);return}
    if(!p.holds.includes(p.points.length-1))p.holds.push(p.points.length-1);
    draw();message("Red perpendicular hold-short marker at the selected point.");
  };
  $("taxiQaUndo").onclick=()=>{
    const p=currentManual();p.points.pop();p.holds=p.holds.filter(i=>i<p.points.length);draw();
  };
  $("taxiQaClear").onclick=()=>{
    taxi.auto=null;taxi.route=null;taxi.manual.delete(Number(selectedChart?.page));taxi.trace=false;taxi.testStart=null;taxi.startSelect=false;
    $("taxiQaStart").classList.remove("on");$("taxiQaStart").setAttribute("aria-pressed","false");
    $("taxiQaTrace").classList.remove("on");draw();message("Cleared.");
  };
  $("pdfStage")?.addEventListener("pointerup",mark);
}
function toggle(on){
  view();taxi.active=on;
  $("taxiQaPanel").hidden=!on;
  if(!on){taxi.trace=false;taxi.startSelect=false;$("taxiQaTrace").classList.remove("on");$("taxiQaStart").classList.remove("on")}
  if(on){
    $("taxiQaAirport").textContent=selectedAirport;
    updateAirportControls();
    if(taxi.airport!==selectedAirport){taxi.airport=selectedAirport;taxi.route=null;taxi.auto=null;taxi.testStart=null;loadGraph(selectedAirport);loadStandReference(selectedAirport);loadNetworkAudit(selectedAirport);loadStandGroups(selectedAirport);}
    $("taxiQaInput").focus();
  }
  renderNetworkAudit();renderStandGroupPanel();draw();
}
function openTaxi(){
  if(!selectedAirport)return;
  const c=overview();
  if(!c){dialog("TAXI","No ADC chart for "+selectedAirport);return}
  if(!isAdc(selectedChart))selectChart(c);
  toggle(true);
}
function nearest(graph,pos,firstTaxiway=null){
  let node=null,d=Infinity;
  // A cleared sequence must start at the requested first taxiway, never
  // jump silently from an unrelated nearest centerline.
  const candidates=firstTaxiway?
    new Set(graph.edges.filter(e=>name(e.taxiway)===firstTaxiway).flatMap(e=>[e.from,e.to])):
    null;
  for(const [id,p] of Object.entries(graph.nodes)){
    if(candidates&&!candidates.has(id))continue;
    const x=dist(pos,p);if(x<d){d=x;node=id}
  }
  return d<=(firstTaxiway?85:120)?node:null;
}
function syncAirport(){
  if(!taxi.active||taxi.airport===selectedAirport)return;
  taxi.airport=selectedAirport;taxi.graph=null;taxi.route=null;taxi.auto=null;taxi.testStart=null;taxi.prompted="";
  taxi.networkAudit=null;taxi.highlightTaxiway="";
  $("taxiQaAirport").textContent=selectedAirport;
  updateAirportControls();
  loadGraph(selectedAirport);
  loadStandReference(selectedAirport);
  loadNetworkAudit(selectedAirport);
  loadStandGroups(selectedAirport);
  renderNetworkAudit();
}
function updateAirportControls(){
  const oimm=selectedAirport==="OIMM";
  $("taxiQaOimmParking").hidden=!oimm;$("taxiQaOimmNetwork").hidden=!oimm;
  $("taxiQaNetworkBtn").hidden=oimm;
  if($("taxiQaAutoRow"))$("taxiQaAutoRow").hidden=!oimm;
  if(oimm&&taxi.graph)fillOimmQuickDestinations(taxi.graph);
  document.querySelector('label[for="taxiQaInput"]').textContent=oimm?
    "Mashhad: ST109 Q BT31L D · ST109 B BT31L D · ST113 RAMP · ST109":
    "LTFM example: A4 A A7 B B8A · Hold: /B8A · 34L2A format";
}
// AUTO requires an actual start (simulator/device/SET START) or an explicit
// stand. It NEVER silently guesses a departure point on a taxiway.
function updateTaxiGuidance(pos){
  const label=$("taxiQaGuidance"),state=taxi.auto;
  if(!label)return;
  if(!taxi.active||taxi.airport!=="OIMM"||!state||state.previewOnly||!pos){
    label.hidden=true;return;
  }
  const p=window.JEPPIRAN_TAXI_AUTO?.progress?.(taxi.graph,state.route,pos);
  if(!p){label.hidden=true;return}
  label.hidden=false;
  label.textContent="LIVE TAXI QA · "+(p.remainingMeters<20?
    "NEAR "+state.target.name:
    "NEXT "+(p.nextTaxiways.join(" → ")||"APRON CENTRELINE")+
      " · "+p.remainingMeters+" m TO "+state.target.name)+
    (p.deviationMeters>45?" · OFF ROUTE":"")+
    " · FOLLOW ATC CLEARANCE";
}
function oimmAutoGo(p){
  const engine=window.JEPPIRAN_TAXI_AUTO;
  if(!engine){message("AUTO routing module not loaded. Reload this PWA.",true);return}
  const explicitStart=p.startStand&&taxi.graph.stands[p.startStand];
  const actual=taxi.testStart||lastPosition;
  if(!explicitStart&&!actual){
    const place=engine.goal(taxi.graph,p.destination);
    if(place.kind==="stand"){
      taxi.selectedStand=place.name.slice(2);taxi.showStands=true;
      $("taxiQaStands").classList.add("on");draw();
    }
    message("Select SIMULATOR / DEVICE POSITION, use SET START, or enter a start stand (ST113 13R). No departure point has been assumed.",true);
    return;
  }
  const result=engine.route(taxi.graph,{destination:p.destination,
    startStand:p.startStand,position:explicitStart?null:actual});
  if(!result.route){message(result.error,true);return}
  const preview=!!explicitStart||!!taxi.testStart;
  const r={...result.route,airport:"OIMM",previewOnly:preview,
    startStand:p.startStand||null};
  taxi.route=r;
  taxi.auto={target:result.target,route:r,monitor:{count:0,last:0},
    airport:"OIMM",previewOnly:preview};
  if(result.target.kind==="stand"){
    taxi.selectedStand=result.target.name.slice(2);
    taxi.showStands=true;$("taxiQaStands").classList.add("on");
  }
  const from=explicitStart?"ST"+p.startStand+" → ":"POSITION → ";
  const routeNames=result.route.taxiways.join(" → ")||"CONNECTED APRON CENTRELINE";
  message((preview?"CHART PREVIEW":"LIVE AUTO ROUTE")+" · "+from+routeNames+
    " → "+result.target.name+" · "+result.route.length+" m"+
    (result.target.warning?" · "+result.target.warning:"")+
    " · GRAPH ONLY, NOT ATC TAXI CLEARANCE.");
  draw();
  updateTaxiGuidance(actual);
}
function oimmGo(p,options){
  const g=taxi.graph,ways=p.taxiways||[],stand=g.stands[p.destination];
  if(p.kind==="procedure"){message("No named taxi procedure is published in the supplied OIMM layout charts.",true);return}
  const bt=ways.filter(way=>g.runwayBacktracks?.[way]);
  const backtrack=bt.length===1?g.runwayBacktracks[bt[0]]:null;
  // Every chart-identified civilian runway access is a potential BT entrance.
  // Do not hardcode J/A or a fixed exit taxiway. Require an explicit named
  // approach and named exit around the runway token; geometry decides success.
  const ix=bt.length===1?ways.indexOf(bt[0]):-1;
  if(bt.length>1||(bt.length===1&&!(ix>0&&ix<ways.length-1&&
      g.taxiways[ways[ix-1]]&&g.taxiways[ways[ix+1]]))){
    message(bt.length===1?bt[0]+" requires an explicit approach taxiway → "+bt[0]+
      " → exit taxiway sequence, actual mapped runway access and ATC clearance.":
      "Only one explicit runway-use segment is supported per test route.",true);return;
  }
  const qa=bt.length?window.JEPPIRAN_TAXI_RUNWAY?.build(g,bt[0]):null;
  if(bt.length&&!qa?.graph){
    message("Runway access module unavailable. Cannot invent a crossing; reload to try again.",true);return;
  }
  const working=qa?.graph||g;
  const selectedAccess=bt.length?qa.access.find(x=>x.taxiway===ways[ix-1]):null;
  if(bt.length&&!selectedAccess){
    message(ways[ix-1]+" has no mapped/within-tolerance holding-point connection to " +
      bt[0]+" in V2621. No runway crossing drawn.",true);return;
  }
  for(const way of ways){
    if(!g.taxiways[way]&&!g.runwayBacktracks?.[way]){message("Taxiway not found on OIMM charts: "+way,true);return}
    if(g.taxiways[way]?.militaryOnly){message(way+" is military-only on Jeppesen 10-1P. It remains visible in NETWORK.",true);return}
  }
  if(stand){taxi.selectedStand=p.destination;taxi.showStands=true;$("taxiQaStands").classList.add("on")}
  const from=g.stands[p.startStand],pos=taxi.testStart||lastPosition;
  let start=from?.node||(pos?nearest(g,pos):null),preview=!!from||options.demo===true;
  const last=ways[ways.length-1],entry=g.taxiways[last],
    goal=stand?.node||(bt.length&&last===g.runwayBacktracks[bt[0]].toTaxiway?
      entry?.nodes?.at(-1):entry?.exitNode);
  const links=adjacent(working,{runwayWay:bt[0]}),request={...p,taxiways:ways,allowStandAccess:true,allowStandExit:!!stand};
  let planned=null;
  if(!start&&stand&&p.kind==="stand"){
    draw();message("Stand "+p.destination+" highlighted on the chart. Published INS: "+stand.publishedINS.published+". Use ST"+p.destination+" A to test a departure guideline.");return;
  }
  if(!start&&ways.length){
    // A named-way preview uses a visible graph start, never a fake aircraft fix.
    const candidates=new Set(g.edges.filter(e=>e.taxiway===ways[0]&&!e.military).flatMap(e=>[e.from,e.to]));
    const goals=goal?[goal]:(entry?.nodes||[]);
    for(const n of candidates)for(const target of goals){
      const result=shortest(working,n,target,request,links);
      if(result&&(!planned||result.length>planned.length)){planned=result;start=n;}
    }
    preview=true;
  }
  if(!start){message("Select a stand start (ST101 A), connect simulator position, or use SET START.",true);draw();return}
  if(!planned){
    const goals=goal?[goal]:(entry?.nodes||[null]);
    for(const target of goals){const result=shortest(working,start,target,request,links);if(result&&(!planned||result.length<planned.length))planned=result;}
  }
  if(!planned||planned.path.length<2){
    message("No connected chart path for this input. Runways and the construction area have no automatic crossing links.",true);draw();return;
  }
  // A sequence names PHYSICAL connected segments. Reject any implicit
  // centreline-to-terminal shortcut, and preserve every runway-axis node.
  const rendered=window.JEPPIRAN_TAXI_RENDER?.parts(working,{...planned,taxiways:ways});
  if(bt.length&&(!rendered||!rendered.runway.length||rendered.invalid.length)){
    message("No complete mapped runway-centreline path for "+bt[0]+
      "; no line is drawn across an unverified taxiway/runway gap.",true);
    return;
  }
  if(bt.length){
    const terminal=rendered.steps.at(-1);
    if(terminal?.way!==last||terminal?.type!=="taxiway"||
       planned.path.at(-1)!==(entry?.nodes?.at(-1)||entry?.exitNode)){
      message("Exit taxiway "+last+" does not reach its complete mapped endpoint. Refusing a shortened path.",true);
      return;
    }
  }
  planned.holds=[...new Set([...planned.holds,...planned.path.flatMap((n,i)=>working.holdNodes[n]?[i]:[])])];
  if(p.stops?.includes(0)&&planned.holds.length===0)planned.holds.push(planned.path.length-1);
  taxi.route={...planned,graph:working,airport:"OIMM",previewOnly:preview,
    taxiways:ways,startStand:p.startStand||null,runwayRender:rendered};
  if(from)taxi.selectedStand=p.startStand;
  message((preview?"CHART PREVIEW":"SIMULATOR TEST")+" · "+(from?"ST"+p.startStand+" → ":"")+
    (ways.join(" → ")||"ST"+p.destination)+" · "+planned.length+" m"+
    (goal&&g.holdNodes[goal]?" · HOLD SHORT RWY "+g.holdNodes[goal].runway:"")+
    (bt.length?" · EXPLICIT RWY "+bt[0].slice(2)+
      " via "+ways[ix-1]+" → "+ways[ix+1]+
      " · "+(selectedAccess?.confidence==="LONG-REACH-QA-UNVERIFIED"?
        "LONG-REACH UNVERIFIED "+selectedAccess.distanceMeters+"m; geometry may omit paved connector. ":
        "Chart-hold projection (not surveyed). ")+
      (rendered?.projections?.length?
        " UNVERIFIED HOLD-TO-AXIS SECTIONS SHOWN AS DASHED AMBER, NOT AS TAXI CENTRELINE. ":"")+
      "Runway access requires ATC clearance.":"")+
    (from?.pushbackRequired?" · South stand: push-back required per 10-1P1.":""));
  draw();
}
function go(options={}){
  syncAirport();
  // Published LTFM procedures use exact pre-extracted chart vectors, NOT an
  // OSM guessed link between a stand and the first taxiway.
  const publisher=window.JEPPIRAN_PUBLISHED_TAXI;
  const typed=$("taxiQaInput")?.value||"";
  if(publisher?.recognize(typed,taxi.airport)){
    taxi.route=null;taxi.auto=null;draw();
    publisher.go(typed,taxi.airport);
    return;
  }
  publisher?.clear();
  if(taxi.airport==="OIMM"&&!taxi.graph){
    // An unavailable graph must never leave a previously drawn taxi route.
    taxi.route=null;draw();
    if(options.graphRetried){
      message("Mashhad taxi graph is unavailable. Check your offline download or connection and reopen TAXI.",true);
      return;
    }
    const airport=taxi.airport,input=$("taxiQaInput").value;
    message("Loading Mashhad stand and taxiway network…");
    loadGraph(airport).then(loaded=>{
      if(!taxi.active||taxi.airport!==airport||$("taxiQaInput")?.value!==input)return;
      if(loaded)go({...options,graphRetried:true});
      else message("Mashhad taxi graph could not be loaded. No route was drawn; retry after reconnecting.",true);
    });
    return;
  }
  const p=parse($("taxiQaInput").value);
  if(p.error){message(p.error,true);return}
  taxi.trace=false;$("taxiQaTrace").classList.remove("on");
  // Never leave an old route on the ADC after a new route fails validation.
  taxi.route=null;taxi.auto=null;updateTaxiGuidance(null);draw();
  if(p.kind==="publishedStand"){
    message(publishedStandMessage(p.destination)||"This stand has no approved digitized pushback geometry.",true);
    return;
  }
  if(!taxi.graph){
    if(p.kind==="stand"&&taxi.standReference?.stands[p.destination]){
      taxi.selectedStand=p.destination;taxi.showStands=true;
      $("taxiQaStands").classList.add("on");
      $("taxiQaStands").setAttribute("aria-pressed","true");
      draw();
      const lead=taxi.standReference.publishedLeadInTopology?.cases?.[p.destination];
      const leadText=lead?" Published lead-in: "+lead.publishedApproach.join(" / ")+". "+lead.directionNote:"";
      message("Stand "+p.destination+": published AIP POSITION selected"+(georefByPage.get(Number(selectedChart?.page))?" and highlighted.":", but this chart has no validated georeferencing to display the point.")+leadText+" Centerline connector geometry still unverified; no route generated.",true);
    }else if(p.startStand){
      message("STAND "+p.startStand+" recognized, but this airport has no loaded stand/lead-out graph. No route drawn.",true);
    }else message("Parsed "+p.kind+". No verified taxiway + stand connector network for "+selectedAirport+"; automatic routing is disabled.",true);
    return;
  }
  if(taxi.airport==="OIMM"){
    if(p.kind==="stand"&&p.destination){
      oimmAutoGo({kind:"auto",destination:p.destination});return;
    }
    if(p.kind==="auto"){oimmAutoGo(p);return}
    oimmGo(p,options);return
  }
  if(p.kind==="sequence"){
    const nameConflict=p.taxiways.find(n=>taxi.networkAudit?.taxiways?.[n]?.chartTokenSeen===false);
    if(nameConflict){
      message("NAME CONFLICT: OSM TWY "+nameConflict+
        " has no matching taxiway-label token on the supplied Jeppesen ADC/PDC/GMC charts. "+
        "Do not route this name until the centerline nomenclature is reviewed.",true);
      return;
    }
    const chartOnly=p.taxiways.find(n=>taxi.networkAudit?.chartOnlyTaxiwayLabels?.[n]);
    if(chartOnly){
      message("TWY "+chartOnly+" is printed on Jeppesen LTFM 30-9, but its "+
        "centerline is missing from the current OSM graph. Geometry must be digitized "+
        "and chart-validated before routing. Nothing invented.",true);
      return;
    }
    const missing=firstUnmappedTransition(taxi.graph,p.taxiways);
    if(missing){
      message("OSM MAP GAP: no mapped direct junction "+missing.from+" → "+missing.to+
        ". This input cannot be joined without inventing a taxiway. For a ROUTING DEMO, press DEMO ROUTE (A4 A A7 B /B8A).",true);
      return;
    }
  }
  if(p.startStand&&!options.demo&&!taxi.testStart){
    // Pressing GO should give a useful, clearly labeled partial preview rather
    // than filling the screen with a paragraph and drawing nothing.
    const preview=taxi.graph.simulatorTestOnly&&p.kind==="sequence"&&
      !p.destination?demoFromStandArea(taxi.graph,p):null;
    if(preview){
      taxi.route={...preview,graph:taxi.graph,airport:selectedAirport,
        previewOnly:true,standLinkVerified:false,taxiways:p.taxiways.slice(),
        startStand:p.startStand};
      const bridgeText=(preview.mappedUnnamedTransitions||[]).map(x=>
        x.from+" → "+x.to+" uses "+x.edgeCount+" real unnamed OSM edges (~"+
        Math.round(x.lengthMeters)+"m)").join("; ");
      message("QA PREVIEW · "+p.taxiways.join(" → ")+" · "+preview.length+
        "m on mapped OSM centerlines"+(bridgeText?" (including "+bridgeText+")":"")+
        ". Stand "+p.startStand+" → "+p.taxiways[0]+
        " pushback/lead-out is NOT mapped or chart-verified. "+
        "Not a stand-to-runway route. "+publishedStandMessage(p.startStand),true);
      draw();
      return;
    }
    message("STAND "+p.startStand+" recognized, but its lead-out geometry to "+
      p.taxiways[0]+" is not mapped. Press DEMO ROUTE for a separate mapped taxiway segment. "+
      publishedStandMessage(p.startStand),true);
    return;
  }
  // When a stand name is given, a simulator fix MUST NOT be misrepresented
  // as its verified parking connector; only an explicit QA start can be used.
  let startPosition=p.startStand?taxi.testStart:(taxi.testStart||lastPosition);
  let start=startPosition?nearest(taxi.graph,startPosition,p.kind==="sequence"?p.taxiways[0]:null):null;
  let demo=false,planned=null,info="";
  if(p.kind==="sequence"&&!p.destination&&(!start||options.demo===true)&&taxi.graph.simulatorTestOnly){
    // The requested simulator-only QA experience should work without
    // moving the aircraft. NEVER claim that this is an aircraft-origin route.
    const sample=demoRoute(taxi.graph,p);
    if(!sample){
      message("No joined OSM route contains all entered taxiways in this exact order. Check route against current ADC.",true);
      return;
    }
    demo=true;planned=sample;
    start=sample.start;
    startPosition=taxi.graph.nodes[start];
  }else if(!start){
    message("No centerline near aircraft on the first named taxiway. Use SET START to tap the correct ADC centerline, or DEMO ROUTE to preview a separate sample route.",true);
    return;
  }
  if(p.kind==="procedure"){
    const choices=(taxi.graph.procedures||[]).filter(x=>name(x.key)===p.key&&
      Array.isArray(x.nodes)&&x.nodes.length>1&&x.nodes.every(id=>taxi.graph.nodes[id]));
    if(!choices.length){message("Published procedure not digitized: "+p.key,true);return}
    choices.sort((a,b)=>dist(startPosition,taxi.graph.nodes[a.nodes[0]])-dist(startPosition,taxi.graph.nodes[b.nodes[0]]));
    if(dist(startPosition,taxi.graph.nodes[choices[0].nodes[0]])>700 ||
      (choices[1]&&dist(startPosition,taxi.graph.nodes[choices[1].nodes[0]])-
        dist(startPosition,taxi.graph.nodes[choices[0].nodes[0]])<35)){
      message("Procedure start location is ambiguous. Do not guess arrival/departure.",true);return;
    }
    planned={path:choices[0].nodes,holds:choices[0].holdIndices||[]};
    info="Nearest verified PROCEDURE START · "+(choices[0].operation||"");
  }else{
    const stand=p.destination,stands=taxi.graph.stands||{},
      goal=typeof stands[stand]==="string"?stands[stand]:stands[stand]?.node;
    if(stand&&!taxi.graph.nodes[goal]){message("Stand "+stand+" is not mapped.",true);return}
    if(!goal&&p.kind==="stand"){message("Stand not mapped.",true);return}
    const links=adjacent(taxi.graph);
    if(!planned)planned=shortest(taxi.graph,start,goal||null,p.kind==="sequence"?p:null,links);
    info=p.kind==="stand"?"SHORTEST DISTANCE SUGGESTION · NOT ATC CLEARANCE":"TAXIWAY SEQUENCE";
  }
  if(!planned||planned.path.length<2){message("No connected path matching ALL named taxiways, in that order. Verify the clearance or data; nothing invented.",true);return}
  taxi.route={...planned,graph:taxi.graph,airport:selectedAirport,previewOnly:demo};
  if(demo){
    const noStandLink=p.startStand?"STAND "+p.startStand+" → "+p.taxiways[0]+" NOT MAPPED. This is ONLY "+
      p.taxiways.join(" → ")+" from a separate OSM demo point. ":"";
    const bridgeNote=(planned.mappedUnnamedTransitions||[]).map(x=>x.from+" → "+
      x.to+" via "+x.edgeCount+" existing unnamed OSM segments (~"+
      Math.round(x.lengthMeters)+"m)").join("; ");
    message("DEMO PREVIEW · "+noStandLink+"NOT THE AIRCRAFT POSITION · "+planned.path.length+
      " nodes · "+(planned.length||0)+" m · "+(bridgeNote?"UNNAMED LINKS: "+bridgeNote+" · ":"")+
      "OSM DATA NOT AIP VERIFIED.",true);
  }else{
    message("SIMULATION QA · "+(p.startStand?"MANUAL POST-PUSHBACK QA START (STAND "+
      p.startStand+" LEAD-OUT NOT MAPPED) · ":"")+info+" · "+planned.path.length+" nodes · "+(planned.length||0)+
      " m. OSM SOURCE · NOT APPROVED FOR ACTUAL NAVIGATION.",true);
  }
  draw();
}
function currentManual(){
  const page=Number(selectedChart?.page);
  if(!taxi.manual.has(page))taxi.manual.set(page,{points:[],holds:[]});
  return taxi.manual.get(page);
}
function mark(e){
  if(!taxi.active||!(taxi.trace||taxi.startSelect)||!(isAdc(selectedChart)||(taxi.airport==="OIMM"&&Number(selectedChart?.page)===603))||e.button!==0)return;
  const canvas=$("pdfCanvas");if(!canvas)return;
  const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(!(x>=0&&x<=1&&y>=0&&y<=1))return;
  if(taxi.startSelect){
    const m=georefByPage.get(Number(selectedChart?.page));
    if(!m){message("This chart is not georeferenced. Open main ADC first.",true);return}
    const px=x*m.width-m.meanX,py=y*m.height-m.meanY,det=m.xLon*m.yLat-m.xLat*m.yLon;
    if(!Number.isFinite(det)||Math.abs(det)<1e-8){message("Invalid geographic transform.",true);return}
    taxi.testStart={lon:m.meanLon+(px*m.yLat-py*m.xLat)/det,
      lat:m.meanLat+(py*m.xLon-px*m.yLon)/det};
    taxi.startSelect=false;$("taxiQaStart").classList.remove("on");$("taxiQaStart").setAttribute("aria-pressed","false");
    message("TEST START saved from ADC · press GO. Simulator GPS remains connected and unchanged.");
    draw();return;
  }
  currentManual().points.push({x,y});draw();
  message("MANUAL TRACE QA: "+currentManual().points.length+" points. Never use as automatically calculated taxi guidance.");
}
function s(tag,attrs){
  const t=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs))t.setAttribute(k,v);
  return t;
}
function paintPath(svg,pts,holds,width,isCalculatedTaxiRoute=false,exactPolyline=false){
  if(pts.length<2)return;
  // Minimal corner rounding; never use broad splines that cut taxiway corners.
  let d="M "+pts[0].x+" "+pts[0].y;
  for(let i=1;i<pts.length;i++){
    const p=pts[i];
    if(!exactPolyline&&i<pts.length-1){
      const prev=pts[i-1],next=pts[i+1],a=Math.hypot(p.x-prev.x,p.y-prev.y),b=Math.hypot(next.x-p.x,next.y-p.y);
      if(a>0&&b>0){
        const r=Math.min(2,a*.08,b*.08);
        d+=" L "+(p.x+(prev.x-p.x)*r/a)+" "+(p.y+(prev.y-p.y)*r/a);
        d+=" Q "+p.x+" "+p.y+" "+(p.x+(next.x-p.x)*r/b)+" "+(p.y+(next.y-p.y)*r/b);
        continue;
      }
    }
    d+=" L "+p.x+" "+p.y;
  }
  const stroke=Math.max(1.05,width*.00155);
  svg.appendChild(s("path",{d,fill:"none",stroke:"rgba(11,8,33,.24)","stroke-width":stroke+.65,"stroke-linejoin":"round","stroke-linecap":"round"}));
  const line=s("path",{d,fill:"none",stroke:isCalculatedTaxiRoute?"rgba(244,36,188,.57)":"rgba(244,36,188,.64)",
    "stroke-width":stroke,"stroke-linejoin":"round","stroke-linecap":"round"});
  if(isCalculatedTaxiRoute){
    line.setAttribute("class","taxi-route-line");
    // User requirement: continuous smooth magenta path even after HOLD SHORT.
    // Directional chevrons: follow the digitized node-to-node centerline,
    // never cut curves/corners or infer unconnected shortcuts.
    for(let n=1;n<pts.length;n++){
      const a=pts[n-1],b=pts[n],dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy);
      if(len<24)continue;
      const ux=dx/len,uy=dy/len,perpX=-uy,perpY=ux;
      for(let at=25;at<len-10;at+=56){
        const x=a.x+ux*at,y=a.y+uy*at,size=Math.max(3.5,stroke*2.2);
        svg.appendChild(s("path",{d:"M "+(x-ux*size+perpX*size*.6)+" "+(y-uy*size+perpY*size*.6)+
          " L "+x+" "+y+" L "+(x-ux*size-perpX*size*.6)+" "+(y-uy*size-perpY*size*.6),
          fill:"none",stroke:"rgba(251,166,229,.62)","stroke-width":Math.max(.85,stroke*.6),
          "stroke-linecap":"round","stroke-linejoin":"round","class":"taxi-route-chevron"}));
      }
    }
  }
  svg.appendChild(line);
  for(const i of holds){
    const p=pts[i];if(!p)continue;
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],
      dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,q=stroke*3;
    svg.appendChild(s("line",{x1:p.x+nx*q,y1:p.y+ny*q,x2:p.x-nx*q,y2:p.y-ny*q,
      stroke:"#ff1626","stroke-width":stroke*1.6,"stroke-linecap":"square"}));
  }
}
function drawStandMap(){
  const el=$("taxiQaStandMap");
  if(!el)return;
  if(taxi.airport==="OIMM"){el.hidden=true;return}
  el.hidden=!(taxi.active&&taxi.showStands&&taxi.standReference);
  if(el.hidden)return;
  const entries=Object.entries(taxi.standReference.stands);
  const W=380,H=208,pad=14,latMin=Math.min(...entries.map(([,v])=>v.lat)),
    latMax=Math.max(...entries.map(([,v])=>v.lat)),lonMin=Math.min(...entries.map(([,v])=>v.lon)),
    lonMax=Math.max(...entries.map(([,v])=>v.lon)),cos=Math.cos((latMin+latMax)*Math.PI/360);
  const extentX=Math.max(0.00001,(lonMax-lonMin)*cos),extentY=Math.max(0.00001,latMax-latMin),
    scale=Math.min((W-2*pad)/extentX,(H-2*pad-25)/extentY);
  const offsetX=(W-extentX*scale)/2,offsetY=25+(H-25-extentY*scale)/2;
  el.style.cssText="margin:8px 0 0;padding:8px;border:1px solid #426b86;border-radius:8px;background:#091a2a";
  el.replaceChildren();
  const label=document.createElement("div");label.textContent=entries.length+" surveyed stand reference points · WGS84 · not a taxiway chart";
  label.style.cssText="font-size:10px;color:#abc7da;padding:0 0 6px";
  el.appendChild(label);
  const svg=s("svg",{viewBox:"0 0 "+W+" "+H,role:"img","aria-label":"Georeferenced position-only sketch of OMDB stands, by apron"});
  svg.style.cssText="display:block;width:100%;max-height:240px;background:#0d2b42;border-radius:6px";
  const colors={C:"#38d4fb",E:"#8cfd9e",G:"#fc9d4d",H:"#c69aff",Q:"#ff9ad1"};
  for(const [id,p] of entries){
    const x=offsetX+(p.lon-lonMin)*cos*scale,y=offsetY+(latMax-p.lat)*scale;
    const active=taxi.selectedStand===id;
    const dot=s("circle",{cx:x,cy:y,r:active?5:2.1,fill:active?"#fff099":(colors[p.apron]||"#9bd9ff"),stroke:"#092130","stroke-width":active?2:0.6});
    const tooltip=s("title",{});tooltip.textContent=id+" · "+p.lat.toFixed(6)+", "+p.lon.toFixed(6);
    dot.appendChild(tooltip);svg.appendChild(dot);
    if(active){const txt=s("text",{x:x+7,y:y-7,fill:"#fff5af","font-size":"12","font-weight":"bold",stroke:"#10243a","stroke-width":"3","paint-order":"stroke"});txt.textContent=id;svg.appendChild(txt)}
  }
  let lx=12;
  for(const [apron,color] of Object.entries(colors)){
    svg.appendChild(s("circle",{cx:lx,cy:12,r:4,fill:color}));
    const txt=s("text",{x:lx+7,y:15,fill:"#d9ecfa","font-size":"10"});
    txt.textContent="APRON "+apron;svg.appendChild(txt);lx+=67;
  }
  const n=s("text",{x:W-10,y:H-10,fill:"#8ab9d3","font-size":"11","text-anchor":"end"});n.textContent="N ↑";svg.appendChild(n);
  el.appendChild(svg);
  const note=document.createElement("small");
  note.textContent="Geographically scaled point sketch only. No centreline, pushback, turn, hold or routing connections are implied.";
  note.style.cssText="display:block;color:#c4d9ea;margin-top:5px;font-size:10px";
  el.appendChild(note);
}
function renderRoutePreview(){
  const container=$("taxiQaRoutePreview"),r=taxi.route;
  if(!container)return;
  const panel=$("taxiQaPanel");
  container.hidden=!(taxi.active&&r?.airport===selectedAirport&&r.path?.length>1);
  if(container.hidden){
    container.replaceChildren();container.dataset.routeKey="";
    panel?.classList.remove("has-preview");
    return;
  }
  // A new route must appear ABOVE the actions/status on the first tap of GO.
  // Collapse tools only when the preview changes, not on ordinary redraws.
  const routeKey=[r.airport,r.startStand||"",r.path?.[0],r.path?.at(-1),
    r.path?.length,r.length||0].join("|");
  if(container.dataset.routeKey!==routeKey){
    container.dataset.routeKey=routeKey;
    panel?.classList.remove("tools-expanded");
    const button=$("taxiQaToolsBtn");
    if(button){button.textContent="TOOLS ▾";button.setAttribute("aria-expanded","false")}
    if(panel)panel.scrollTop=0;
  }
  panel?.classList.add("has-preview");
  const nodes=r.path.map(id=>r.graph.nodes[id]).filter(Boolean);
  if(nodes.length<2){container.hidden=true;return}
  // QA context map: preserve true WGS84 local geometry (north-up), but show
  // adjacent taxiway centerlines so a straight N/S path has usable context.
  // This is NOT a calibration of the PDF airport diagram.
  const lat0=nodes.reduce((a,p)=>a+p.lat,0)/nodes.length;
  const lon0=nodes.reduce((a,p)=>a+p.lon,0)/nodes.length;
  const cos=Math.cos(lat0*Math.PI/180),W=370,H=160,pad=19;
  const asMeters=p=>({x:(p.lon-lon0)*111195*cos,y:(p.lat-lat0)*111195});
  const local=nodes.map(asMeters);
  const xs=local.map(p=>p.x),ys=local.map(p=>p.y);
  const xmin=Math.min(...xs),xmax=Math.max(...xs),ymin=Math.min(...ys),ymax=Math.max(...ys);
  const midX=(xmin+xmax)/2,midY=(ymin+ymax)/2;
  const xSpan=Math.max(500,(xmax-xmin)*1.38),
    ySpan=Math.max(360,(ymax-ymin)*1.35);
  const scale=Math.min((W-2*pad)/xSpan,(H-2*pad)/ySpan);
  const toScreen=p=>{
    const m=asMeters(p);
    return {x:W/2+(m.x-midX)*scale,y:H/2-(m.y-midY)*scale};
  };
  const pts=nodes.map(toScreen);
  const root=s("svg",{viewBox:"0 0 "+W+" "+H,role:"img",
    "aria-label":r.airport==="OIMM"?
      "Local chart-derived taxiway network with highlighted route; not the printed ADC":
      "Local OSM network context with a highlighted taxiway path; NOT georeferenced to airport chart"});
  // Only render nearby segments; preserve any disconnected/unnamed gaps as
  // actual gaps. Never snap named lines or stand coordinates to one another.
  const background=s("g",{"aria-hidden":"true"});
  let backgroundSegments=0;
  for(const e of r.graph.edges||[]){
    if(e.closed||e.runway||!r.graph.nodes[e.from]||!r.graph.nodes[e.to])continue;
    const a=toScreen(r.graph.nodes[e.from]),b=toScreen(r.graph.nodes[e.to]);
    if(Math.max(a.x,b.x)<-3||Math.min(a.x,b.x)>W+3||
       Math.max(a.y,b.y)<-3||Math.min(a.y,b.y)>H+3)continue;
    const named=e.taxiway&&name(e.taxiway)!=="UNNAMED";
    background.appendChild(s("line",{
      x1:a.x.toFixed(2),y1:a.y.toFixed(2),x2:b.x.toFixed(2),y2:b.y.toFixed(2),
      stroke:named?"#668fa8":"#334e62",
      "stroke-width":named?"1.15":".65",
      "stroke-linecap":"round",opacity:named?".80":".47"
    }));
    backgroundSegments++;
    if(backgroundSegments>=850)break;
  }
  root.appendChild(background);
  const chain=pts.map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
  const sections=r.airport==="OIMM"&&r.runwayRender?.runs;
  if(sections){
    for(const segment of sections){
      if(segment.type==="unverified")continue;
      const strip=pts.slice(segment.startIndex,segment.endIndex+1)
        .map(p=>p.x.toFixed(2)+","+p.y.toFixed(2)).join(" ");
      const approximate=segment.type==="projected-access";
      root.appendChild(s("polyline",{points:strip,fill:"none",
        stroke:approximate?"rgba(255,182,92,.8)":"rgba(244,43,184,.64)",
        "stroke-width":approximate?"2.2":"1.9",
        "stroke-dasharray":approximate?"4 5":undefined,
        "stroke-linecap":"round","stroke-linejoin":"round",
        "class":approximate?"taxi-preview-unverified-projection":"taxi-preview-centerline"}));
    }
  }else{
    root.appendChild(s("polyline",{points:chain,fill:"none",stroke:"rgba(24,10,38,.33)",
      "stroke-width":"3.4","stroke-linecap":"round","stroke-linejoin":"round"}));
    root.appendChild(s("polyline",{points:chain,fill:"none",stroke:"rgba(244,43,184,.64)",
      "stroke-width":"1.9","stroke-linecap":"round","stroke-linejoin":"round"}));
  }
  // Clearly mark ONLY the traversed real OSM edges that have no taxiway name.
  if(r.mappedUnnamedTransitions?.length){
    for(let i=1;i<r.path.length;i++){
      const before=r.path[i-1],after=r.path[i];
      const isMappedUnnamed=r.graph.edges.some(e=>name(e.taxiway)==="UNNAMED"&&
        !e.runway&&!e.closed&&((e.from===before&&e.to===after)||
        (e.bidirectional!==false&&e.from===after&&e.to===before)));
      if(!isMappedUnnamed)continue;
      const p=pts[i-1],q=pts[i];
      root.appendChild(s("line",{x1:p.x,y1:p.y,x2:q.x,y2:q.y,
        stroke:"rgba(255,195,112,.87)","stroke-width":"2.1","stroke-dasharray":"3 3",
        "stroke-linecap":"round"}));
    }
  }
  root.appendChild(s("circle",{cx:pts[0].x,cy:pts[0].y,r:5.4,fill:"#25e8f5",stroke:"#071a2d","stroke-width":1.5}));
  const end=pts[pts.length-1];
  root.appendChild(s("circle",{cx:end.x,cy:end.y,r:5.4,fill:"#fef0ff",stroke:"#071a2d","stroke-width":1.5}));
  const note=(label,p,dx,dy,color)=>{
    const t=s("text",{x:Math.max(6,Math.min(W-105,p.x+dx)),y:Math.max(15,Math.min(H-8,p.y+dy)),
      fill:color,"font-size":"11","font-weight":"800",
      stroke:"#09192a","stroke-width":"3","paint-order":"stroke"});
    t.textContent=label;root.appendChild(t);
  };
  const firstName=r.taxiways?.[0]||"START";
  const lastName=r.taxiways?.at(-1)||"END";
  note(firstName+" · START",pts[0],9,14,"#79efff");
  note(lastName+" · END",end,9,-9,"#fff7fd");
  note("N ↑",{x:W-24,y:14},0,0,"#b7d8e9");
  note(r.airport==="OIMM"?"CHART-DERIVED · NOT ADC":"OSM CONTEXT · NOT ADC",
    {x:9,y:H-8},0,0,"#a8bbc9");
  const caption=document.createElement("strong");
  const waypointText=r.taxiways?.join(" → ")||"MAPPED QA SECTION";
  caption.textContent=r.startStand&&r.standLinkVerified===false?
    "STAND "+r.startStand+" UNMAPPED · mapped "+waypointText+" · "+(r.length||0)+" m":
    (r.startStand?"ST"+r.startStand+" → ":"")+waypointText+" · "+(r.length||0)+" m";
  const warning=document.createElement("small");
  const model=georefByPage.get(Number(selectedChart?.page));
  const mappedLinks=(r.mappedUnnamedTransitions||[]).map(x=>
    x.from+"→"+x.to+": "+x.edgeCount+" unlabeled mapped OSM segments (~"+
    Math.round(x.lengthMeters)+"m)").join("; ");
  warning.textContent=r.airport==="OIMM"?
    "Chart-derived test geometry · confirm exact position and clearance · NOT FOR NAVIGATION":
    (model?"OSM-only QA: overlay on georeferenced chart is unapproved.":
      "No usable ADC georeference: route shown here, NOT positioned on printed chart.")+
    (r.startStand&&r.standLinkVerified===false?" Stand "+r.startStand+
      " lead-out NOT mapped.":"")+
    (mappedLinks?" Dashed amber link(s): "+mappedLinks+"; not chart-verified.":"")+
    " NOT FOR NAVIGATION.";
  container.replaceChildren(caption,root,warning);
}
function draw(){
  syncAirport();
  drawStandMap();
  renderRoutePreview();
  const layer=$("chartTransformLayer"),canvas=$("pdfCanvas");if(!layer||!canvas)return;
  layer.querySelector(".taxi-qa-overlay")?.remove();
  if(!taxi.active)return;
  const model=georefByPage.get(Number(selectedChart?.page)),w=model?.width||1000,h=model?.height||1000;
  const svg=s("svg",{class:"taxi-qa-overlay",viewBox:"0 0 "+w+" "+h,preserveAspectRatio:"none"});
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;z-index:12;pointer-events:none";
  if(taxi.airport==="OIMM"&&taxi.showNetwork&&taxi.graph&&model){
    const normal=[],military=[],runway=[];
    for(const e of taxi.graph.edges){
      const a=taxi.graph.nodes[e.from],b=taxi.graph.nodes[e.to],pa=projectGeo(model,a.lat,a.lon),pb=projectGeo(model,b.lat,b.lon);
      if(pa&&pb)(e.runway?runway:e.military?military:normal).push("M "+pa.x+" "+pa.y+" L "+pb.x+" "+pb.y);
    }
    for(const [parts,color] of [[normal,"#3ccfff"],[military,"#ffb348"],[runway,"#ff6db1"]])svg.appendChild(s("path",{d:parts.join(" "),fill:"none",stroke:color,"stroke-width":.7,opacity:.85}));
    for(const [id,item] of Object.entries(taxi.graph.labelInventory)){
      const p=projectGeo(model,item.labelCentre.lat,item.labelCentre.lon);if(!p)continue;
      const t=s("text",{x:p.x,y:p.y,fill:"#e6faff","font-size":7,"font-weight":"bold",stroke:"#07273a","stroke-width":2,"paint-order":"stroke"});t.textContent=id;svg.appendChild(t);
    }
  }
  if(taxi.showStands&&taxi.standReference&&model){
    const pins=s("g",{"class":"taxi-stand-reference-pins"});
    for(const [id,coord] of Object.entries(taxi.standReference.stands)){
      const p=projectGeo(model,coord.lat,coord.lon);
      if(!p)continue;
      const selected=taxi.selectedStand===id;
      pins.appendChild(s("circle",{cx:p.x,cy:p.y,r:selected?6:2.4,
        fill:selected?"#fff099":({"C":"#38d4fb","E":"#8cfd9e","G":"#fc9d4d","H":"#c69aff","Q":"#ff9ad1"}[coord.apron]||"#38d4fb"),stroke:"#062238","stroke-width":selected?1.7:0.8}));
      if(selected||taxi.airport==="OIMM"){
        const label=s("text",{x:p.x+(selected?8:3),y:p.y-(selected?8:3),fill:"#f9faff","font-size":selected?10:5,
          "font-weight":"900",stroke:"#052333","stroke-width":"3","paint-order":"stroke"});
        label.textContent=id;pins.appendChild(label);
      }
    }
    svg.appendChild(pins);
  }
  // Printed parking-label positions and their nearby graph projections
  // remain distinctly DASHED; these are QA markers, NEVER a taxi route.
  const sp=taxi.standPreview;
  if(sp&&taxi.airport==="LTFM"&&selectedAirport==="LTFM"&&model){
    const center=projectGeo(model,sp.position.lat,sp.position.lon);
    if(center){
      const stroke=Math.max(1.2,w*.0015);
      const group=s("g",{class:"taxi-stand-candidate-preview"});
      for(const candidate of (sp.candidates||[])){
        if(!candidate.projectedPoint)continue;
        const to=projectGeo(model,candidate.projectedPoint.lat,candidate.projectedPoint.lon);
        if(!to)continue;
        group.appendChild(s("line",{x1:center.x,y1:center.y,x2:to.x,y2:to.y,
          stroke:candidate.chartNamedTaxiwayMatch?"#e07dff":"#46dffc",
          "stroke-width":stroke,"stroke-dasharray":"4 5",opacity:".74"}));
        group.appendChild(s("circle",{cx:to.x,cy:to.y,r:stroke*2,fill:"none",
          stroke:candidate.chartNamedTaxiwayMatch?"#e07dff":"#46dffc",
          "stroke-width":stroke}));
      }
      group.appendChild(s("circle",{cx:center.x,cy:center.y,r:stroke*4.5,
        fill:"rgba(240,37,191,.15)",stroke:"#f025c2","stroke-width":stroke*2}));
      const t=s("text",{x:center.x+stroke*6,y:center.y-stroke*4,
        fill:"#fcf7fd","font-size":Math.max(6,w*.012),
        "font-weight":"bold",stroke:"#101622","stroke-width":Math.max(2,w*.004),"paint-order":"stroke"});
      t.textContent="ST "+sp.id+" · APPROX / UNVERIFIED";group.appendChild(t);
      svg.appendChild(group);
    }
  }
  const r=taxi.route;
  // Display selected OSM taxiway on the georeferenced ADC without inventing
  // any connection to another name or a parking stand.
  if(taxi.highlightTaxiway&&taxi.graph&&taxi.airport===selectedAirport&&model){
    const stroke=Math.max(2,w*.0042);
    let hits=0;
    for(const e of taxi.graph.edges){
      if(e.closed||e.runway||name(e.taxiway)!==taxi.highlightTaxiway)continue;
      const a=taxi.graph.nodes[e.from],b=taxi.graph.nodes[e.to];
      if(!a||!b)continue;
      const pa=projectGeo(model,a.lat,a.lon),pb=projectGeo(model,b.lat,b.lon);
      if(!pa||!pb)continue;
      svg.appendChild(s("line",{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y,
        stroke:"#25082c","stroke-width":stroke+2.5,"stroke-linecap":"round"}));
      svg.appendChild(s("line",{x1:pa.x,y1:pa.y,x2:pb.x,y2:pb.y,
        stroke:"rgba(245,45,193,.55)","stroke-width":Math.max(.95,stroke*.52),"stroke-linecap":"round",
        "class":"taxi-audit-highlight"}));
      hits++;
    }
    if(hits===0&&taxi.networkOpen){
      // Standalone status tells the user when chart alignment cannot be shown.
      const info=$("taxiQaDetails");
      if(info)info.dataset.mapShown="false";
    }
  }
  if(r&&r.airport===selectedAirport&&model){
    const spec=r.airport==="OIMM"&&r.runwayRender;
    if(spec){
      // An actual runway backtrack follows ONLY the ordered runway-axis
      // centreline edges. A projected hold-to-axis leg (107m at Q in the
      // current source, for example) is NOT a surveyed taxi connector: show
      // its uncertainty explicitly instead of a solid direct shortcut.
      for(const span of spec.runs){
        const nodes=span.nodes.map(id=>r.graph.nodes[id])
          .map(p=>p?projectGeo(model,p.lat,p.lon):null);
        if(nodes.some(p=>!p))continue;
        if(span.type==="projected-access"){
          svg.appendChild(s("polyline",{points:nodes.map(p=>p.x+","+p.y).join(" "),
            fill:"none",stroke:"rgba(255,185,92,.83)",
            "stroke-width":Math.max(1.2,w*.00145),
            "stroke-dasharray":"3.5 5","stroke-linecap":"round",
            "stroke-linejoin":"round","class":"taxi-unverified-runway-access"}));
        }else if(span.type!=="unverified"){
          const holdPositions=(r.holds||[]).filter(i=>
            i>=span.startIndex&&i<=span.endIndex).map(i=>i-span.startIndex);
          // NO smoothing; every polyline vertex matches its mapped graph node.
          paintPath(svg,nodes,holdPositions,w,true,true);
        }
      }
    }else{
      let segment=[],holdPositions=[];
      for(let i=0;i<r.path.length;i++){
        const pt=r.graph.nodes[r.path[i]],p=pt?projectGeo(model,pt.lat,pt.lon):null;
        if(!p){paintPath(svg,segment,holdPositions,w,true);segment=[];holdPositions=[];continue;}
        if(r.holds.includes(i))holdPositions.push(segment.length);
        segment.push(p);
      }
      paintPath(svg,segment,holdPositions,w,true);
    }
  }
  // No DEMO START / QA START decorations on the airport chart. The selected
  // internal test origin remains available for route calculation only.
  const manual=taxi.manual.get(Number(selectedChart?.page));
  if(manual)paintPath(svg,manual.points.map(p=>({x:p.x*w,y:p.y*h})),manual.holds,w);
  layer.appendChild(svg);
  window.dispatchEvent(new Event("jeppiran-taxi-route-updated"));
}
// Distance to actual mapped route segments (metres), not an invented corridor.
// A departure/arrival route is QA-only and must never be used as a clearance.
function routeDeviationMeters(pos){
  const r=taxi.route;
  if(!taxi.active||!r||r.previewOnly||r.airport!==selectedAirport||!isAdc(selectedChart)||
     !pos||!Number.isFinite(Number(pos.lat))||!Number.isFinite(Number(pos.lon)))return null;
  let min=Infinity;
  const path=r.path||[];
  for(let i=1;i<path.length;i++){
    const a=r.graph.nodes[path[i-1]],b=r.graph.nodes[path[i]];
    if(!a||!b)continue;
    const cos=Math.cos(Number(pos.lat)*Math.PI/180);
    const ax=(a.lon-pos.lon)*111195*cos,ay=(a.lat-pos.lat)*111195;
    const bx=(b.lon-pos.lon)*111195*cos,by=(b.lat-pos.lat)*111195;
    const dx=bx-ax,dy=by-ay,den=dx*dx+dy*dy;
    if(den<.01)continue;
    const u=Math.max(0,Math.min(1,-(ax*dx+ay*dy)/den));
    min=Math.min(min,Math.hypot(ax+u*dx,ay+u*dy));
  }
  return Number.isFinite(min)?min:null;
}
function chartHint(){
  if(!taxi.active||!lastPosition||!selectedChart||!isAdc(selectedChart))return;
  const base=overview();if(!base)return;
  const candidates=charts.filter(c=>c.airport===selectedAirport&&c.category==="Airport"&&
    Number(c.page)!==Number(base.page)&&
    /PARKING|DOCKING|APRON|TAXI ROUTE/i.test(c.name||""));
  const match=candidates.find(c=>{
    const m=georefByPage.get(Number(c.page));if(!m)return false;
    const p=projectGeo(m,lastPosition.lat,lastPosition.lon);
    return p&&p.x>m.width*.1&&p.x<m.width*.9&&p.y>m.height*.1&&p.y<m.height*.9;
  });
  if(!match||taxi.prompted===String(match.page))return;
  taxi.prompted=String(match.page);
  document.querySelector(".taxi-chart-hint")?.remove();
  const bar=document.createElement("div");bar.className="taxi-chart-hint";
  const label=document.createElement("span");label.textContent="Detailed chart available: "+(match.chart_number||match.name);
  const jump=document.createElement("button");jump.textContent="SWITCH";jump.onclick=()=>{bar.remove();selectChart(match)};
  const no=document.createElement("button");no.textContent="×";no.onclick=()=>bar.remove();
  bar.append(label,jump,no);document.querySelector("#chartsView .viewer-pane")?.appendChild(bar);
  setTimeout(()=>bar.remove(),12000);
}
function previewStandCandidate(id,entry){
  if(taxi.airport!=="LTFM"||!entry||!entry.position)return false;
  taxi.standPreview={id,...entry};draw();return true;
}
window.JEPPIRAN_TAXI={open:openTaxi,parse,openAdc,draw,routeDeviationMeters,previewStandCandidate};
window.addEventListener("jeppiran-chart-rendered",()=>{draw();chartHint()});
function monitorOimmAuto(e){
  chartHint();
  const state=taxi.auto,pos=e?.detail;
  if(!taxi.active||taxi.airport!=="OIMM"||!state||state.previewOnly||
     !taxi.graph||!pos||taxi.route!==state.route)return;
  const engine=window.JEPPIRAN_TAXI_AUTO;
  if(!engine)return;
  updateTaxiGuidance(pos);
  // At the target hold/stand, stop monitoring, rather than proposing an
  // unauthorized movement after reaching the end of the planned segment.
  const finish=taxi.graph.nodes[state.target.node];
  if(finish&&engine.metres(finish,pos)<20){
    state.monitor.count=0;return;
  }
  const change=engine.reroute(taxi.graph,state,pos);
  if(change.action==="replanned"){
    taxi.route={...change.route,airport:"OIMM",previewOnly:false};
    taxi.auto={target:state.target,route:taxi.route,monitor:state.monitor,
      airport:"OIMM",previewOnly:false};
    message("AUTO RE-ROUTE · New connected route: "+taxi.route.taxiways.join(" → ")+
      " → "+state.target.name+" · "+taxi.route.length+
      " m. Recheck ATC clearance; runway crossing still prohibited.");
    draw();
    updateTaxiGuidance(pos);
  }else if(change.action==="unmapped"){
    message("OFF ROUTE · "+change.error+" Existing route is not an authorized clearance.",true);
  }
}
window.addEventListener("jeppiran-position",monitorOimmAuto);
// The chart toolbar owns the TAXI button and opens this API after the script
// loads. Do not attach a second listener: its button may be rebuilt mid-render.
})();
