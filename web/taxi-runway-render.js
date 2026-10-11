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
// Construct the SCHEMATIC centreline from opposite ADC pavement-edge
// anchors, not from the parking-detail J/A positions. In the current V2621
// PDF, H is on one runway border, M is opposite H on the other border;
// H->D follows the runway long axis. The original taxi BT vectors inherited
// a cross-chart offset that visibly drifted onto the black runway border.
// This midline is graphic QA and NOT survey-grade georeferencing.
function adcMidline(graph){
  if(graph?.airport!=="OIMM"||graph.cycle!=="2621")return null;
  const get=(name,index=0)=>{
    const n=graph.taxiways?.[name]?.nodes?.[index],p=n&&graph.nodes?.[n];
    return p?.sourcePage===601&&Array.isArray(p.pdfPoint)?p:null;
  };
  const h=get("H"),m=get("M"),d=get("D");
  if(!h||!m||!d)return null;
  const mid={lat:(h.lat+m.lat)/2,lon:(h.lon+m.lon)/2};
  const end={lat:d.lat+(m.lat-h.lat)/2,lon:d.lon+(m.lon-h.lon)/2};
  const earth=111195,c=Math.cos(mid.lat*Math.PI/180);
  const dx=(end.lon-mid.lon)*earth*c,dy=(end.lat-mid.lat)*earth;
  const sq=dx*dx+dy*dy,width=Math.hypot((m.lon-h.lon)*earth*c,(m.lat-h.lat)*earth);
  if(!(sq>2500**2&&sq<5000**2&&width>70&&width<250))return null;
  const project=p=>{
    const px=(p.lon-mid.lon)*earth*c,py=(p.lat-mid.lat)*earth;
    const rawT=(px*dx+py*dy)/sq,t=Math.max(0,Math.min(1,rawT));
    return {lat:mid.lat+(end.lat-mid.lat)*t,lon:mid.lon+(end.lon-mid.lon)*t,t,rawT};
  };
  return {start:mid,end,spanMetres:Math.sqrt(sq),
    graphicWidthMetres:width,project,provenance:"V2621 ADC H/M/D BOUNDARY MIDPOINT QA NOT SURVEYED"};
}
// This geometry exists ONLY for visualizing the approved simulation test
// on the ADC. It never rewrites the underlying OIMM graph or grants runway
// access. Solid magenta remains straight along the same midpoint axis;
// turn-in/out starts ONLY at the graph's known (or projected QA) connection.
function displayRuns(graph,route){
  const spec=route?.runwayRender||parts(graph,route);
  if(!spec)return null;
  const axis=adcMidline(graph);
  const runs=spec.runs.map(run=>{
    let type=run.type;
    const source=run.nodes.map(id=>graph.nodes?.[id]);
    let coordinates=source.map(p=>p&&{lat:p.lat,lon:p.lon});
    if(run.type==="runway-axis"){
      if(!axis||coordinates.some(p=>!p))type="unverified";
      else{
        const projected=coordinates.map(p=>axis.project(p));
        const values=projected.map(p=>p.rawT);
        // The backtrack must advance consistently along the runway. If the
        // supplied graph doubles back or jumps past the known ADC limits,
        // leave a gap rather than pretending its shape is authoritative.
        const sign=run.steps[0]?.way==="BT13R"?-1:1;
        if(projected.some(p=>p.rawT<-.045||p.rawT>1.045)||
          values.some((v,i)=>i&&sign*(v-values[i-1])<-.003)){
          type="unverified";
        }else coordinates=projected.map(({lat,lon})=>({lat,lon}));
      }
    }
    return {...run,type,coordinates};
  });
  for(let i=0;i<runs.length;i++){
    const run=runs[i];if(run.type!=="projected-access")continue;
    // Anchor both ends of every QA connection to its neighbouring
    // straight runway-axis segment, not its old oblique source vertex.
    const prev=runs[i-1],next=runs[i+1];
    if(prev?.type==="runway-axis"&&run.coordinates.length)
      run.coordinates[0]=prev.coordinates.at(-1);
    if(next?.type==="runway-axis"&&run.coordinates.length)
      run.coordinates[run.coordinates.length-1]=next.coordinates[0];
  }
  return {runs,axis,invalid:runs.filter(x=>x.type==="unverified"),
    runway:runs.filter(x=>x.type==="runway-axis"),
    source:axis?.provenance||"NO ADC MIDLINE"};
}
const api={classify,parts,adcMidline,displayRuns};
root.JEPPIRAN_TAXI_RENDER=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
