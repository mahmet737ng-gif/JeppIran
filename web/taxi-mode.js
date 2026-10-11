/* JEPPIRAN TAXI preview · verified graphs only · NOT FOR ACTUAL NAVIGATION */
(function(){
"use strict";
const ns="http://www.w3.org/2000/svg", taxi={active:false,trace:false,airport:"",graph:null,standReference:null,selectedStand:"",showStands:false,route:null,manual:new Map(),prompted:""};
const $=id=>document.getElementById(id);
const name=s=>String(s||"").trim().toUpperCase().replace(/\s+/g," ");
function parse(raw){
  const s=name(raw);
  if(!s)return {error:"Enter a stand, taxiway sequence or published procedure"};
  // Procedure designator is RUNWAY + PROCEDURE, no whitespace: 34L2A not 34L 2A.
  if(/^\d{2}[LRC]?\s+\d+[A-Z][A-Z0-9-]*$/.test(s))
    return {error:"No space between runway and taxi procedure. Use "+s.replace(/\s+/g,"")};
  if(/^\d{2}[LRC]?\d+[A-Z][A-Z0-9-]*$/.test(s))return {kind:"procedure",key:s};
  const registered=Object.prototype.hasOwnProperty.call(taxi.standReference?.stands||{},s)||
    Object.prototype.hasOwnProperty.call(taxi.graph?.stands||{},s);
  if(registered||/^(ST|P)\d{1,4}[A-Z]?$/.test(s)||(taxi.airport==="OMDB"&&/^[A-HQS]\d{1,3}[LR]$/.test(s)))
    return {kind:"stand",destination:s};
  const parts=s.replace(/[,→>]+/g," ").split(" ").filter(Boolean),stops=[],taxiways=[];
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
  return taxiways.length?{kind:"sequence",taxiways,stops,destination}:{error:"No taxiways entered"};
}
const dist=(a,b)=>Math.hypot((Number(a.lat)-Number(b.lat))*111195,
  (Number(a.lon)-Number(b.lon))*111195*Math.cos((Number(a.lat)+Number(b.lat))*Math.PI/360));
function adjacent(graph){
  const links={};
  for(const e of graph.edges){
    if(e.closed||e.runway||!graph.nodes[e.from]||!graph.nodes[e.to])continue;
    const d=dist(graph.nodes[e.from],graph.nodes[e.to]);
    if(!(d>0.1&&d<12000))continue;
    (links[e.from]??=[]).push({to:e.to,way:name(e.taxiway),cost:d});
    if(e.bidirectional!==false)(links[e.to]??=[]).push({to:e.from,way:name(e.taxiway),cost:d});
  }
  return links;
}
function shortest(graph,start,goal,requested){
  const edges=adjacent(graph),ways=requested?.taxiways||[],slash=requested?.stops||[];
  // Dijkstra state: graph node, requested taxiway index, whether segment used.
  const key=(n,i,u)=>n+"~"+i+"~"+u,first=key(start,0,0),
    seen=new Map([[first,0]]),previous=new Map(),open=[{n:start,i:0,u:0,w:0,k:first}];
  let final=null,limit=0;
  while(open.length&&limit++<50000){
    open.sort((a,b)=>a.w-b.w);
    const p=open.shift();if(p.w!==seen.get(p.k))continue;
    if((!goal||p.n===goal)&&(!ways.length||(p.i===ways.length-1&&p.u===1))){
      final=p;break;
    }
    function add(n,i,u,extra,hold,move){
      const k=key(n,i,u),w=p.w+extra;
      if(w>=(seen.get(k)??Infinity))return;
      seen.set(k,w);previous.set(k,{prev:p.k,n:p.n,hold,move});
      open.push({n,i,u,w,k});
    }
    if(ways.length&&p.u&&p.i+1<ways.length)
      add(p.n,p.i+1,0,0,slash.includes(p.i+1),false);
    for(const e of edges[p.n]||[]){
      if(ways.length&&e.way!==ways[p.i])continue;
      add(e.to,p.i,1,e.cost,false,true);
    }
  }
  if(!final)return null;
  const reverse=[final.n],rawHolds=[];
  for(let k=final.k;previous.has(k);){
    const p=previous.get(k);
    if(p.hold)rawHolds.push(reverse.length-1);
    if(p.move)reverse.push(p.n);
    k=p.prev;
  }
  return {path:reverse.reverse(),holds:rawHolds.map(i=>reverse.length-1-i),length:final.w};
}
function graphOk(d,icao){
  return d&&d.verified===true&&d.airport===icao&&String(d.cycle)===String(manifest?.cycle)&&
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
function message(s,warning=false){
  const t=$("taxiQaStatus");if(t){t.textContent=s;t.classList.toggle("warning",warning);}
}
async function loadGraph(icao){
  taxi.graph=null;
  message("Checking verified ground network for "+icao+"…");
  try{
    const r=await fetch("./data/taxi-networks/"+encodeURIComponent(icao)+".json",{cache:"no-store"});
    if(!r.ok)throw Error("Not digitized");
    const d=await r.json();
    if(!graphOk(d,icao))throw Error("Invalid, unverified, or wrong-cycle network");
    if(taxi.airport!==icao)return;
    taxi.graph=d;message("Verified network loaded. Ready for taxi route input.");
  }catch(e){
    if(taxi.airport!==icao)return;
    message("No verified ground network yet for "+icao+". Automatic routing disabled; use TRACE QA to test drawing on this chart.",true);
  }
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
function view(){
  if($("taxiQaPanel"))return;
  const panel=document.createElement("section");
  panel.id="taxiQaPanel";panel.className="taxi-qa-panel";panel.hidden=true;
  panel.innerHTML='<div class="taxi-qa-title"><strong>TAXI <small>QA TEST</small></strong><span id="taxiQaAirport"></span><button id="taxiQaClose" type="button">×</button></div>'+
    '<label for="taxiQaInput">Stand C51L · K Z /Y · 34L2A (format example, not a DXB route)</label>'+
    '<div class="taxi-qa-entry"><input id="taxiQaInput" autocomplete="off" spellcheck="false" placeholder="Taxi clearance or stand"><button id="taxiQaGo" type="button">GO</button></div>'+
    '<div class="taxi-qa-buttons"><button id="taxiQaAdc" type="button">ADC</button><button id="taxiQaStands" type="button" aria-pressed="false">STANDS</button><button id="taxiQaTrace" type="button">TRACE QA</button><button id="taxiQaHold" type="button">HOLD HERE</button><button id="taxiQaUndo" type="button">UNDO</button><button id="taxiQaClear" type="button">CLEAR</button></div>'+
    '<div id="taxiQaStatus" role="status"></div><small class="taxi-qa-warning">NOT FOR ACTUAL NAVIGATION. Ground clearance and chart validation remain mandatory.</small>';
  document.querySelector("#chartsView .viewer-pane")?.appendChild(panel);
  $("taxiQaClose").onclick=()=>toggle(false);
  $("taxiQaGo").onclick=go;
  $("taxiQaInput").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}};
  $("taxiQaAdc").onclick=openAdc;
  $("taxiQaStands").onclick=()=>{
    taxi.showStands=!taxi.showStands;
    $("taxiQaStands").classList.toggle("on",taxi.showStands);
    $("taxiQaStands").setAttribute("aria-pressed",String(taxi.showStands));
    draw();
    if(!taxi.standReference)message("No AIP stand-position reference loaded for this airport.",true);
    else message("AIP stand POSITIONS only. No lead-in, pushback or taxiway topology is validated.",true);
  };
  $("taxiQaTrace").onclick=()=>{taxi.trace=!taxi.trace;taxi.route=null;
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
    taxi.route=null;taxi.manual.delete(Number(selectedChart?.page));taxi.trace=false;
    $("taxiQaTrace").classList.remove("on");draw();message("Cleared.");
  };
  $("pdfStage")?.addEventListener("pointerup",mark);
}
function toggle(on){
  view();taxi.active=on;
  $("taxiQaPanel").hidden=!on;
  if(!on){taxi.trace=false;$("taxiQaTrace").classList.remove("on")}
  if(on){
    $("taxiQaAirport").textContent=selectedAirport;
    if(taxi.airport!==selectedAirport){taxi.airport=selectedAirport;taxi.route=null;loadGraph(selectedAirport);loadStandReference(selectedAirport);}
    $("taxiQaInput").focus();
  }
  draw();
}
function openTaxi(){
  if(!selectedAirport)return;
  const c=overview();
  if(!c){dialog("TAXI","No ADC chart for "+selectedAirport);return}
  if(!isAdc(selectedChart))selectChart(c);
  toggle(true);
}
function nearest(graph,pos){
  let node=null,d=Infinity;
  for(const [id,p] of Object.entries(graph.nodes)){
    const x=dist(pos,p);if(x<d){d=x;node=id}
  }
  return d<=250?node:null;
}
function syncAirport(){
  if(!taxi.active||taxi.airport===selectedAirport)return;
  taxi.airport=selectedAirport;taxi.graph=null;taxi.route=null;taxi.prompted="";
  $("taxiQaAirport").textContent=selectedAirport;
  loadGraph(selectedAirport);
  loadStandReference(selectedAirport);
}
function go(){
  syncAirport();
  const p=parse($("taxiQaInput").value);
  if(p.error){message(p.error,true);return}
  taxi.trace=false;$("taxiQaTrace").classList.remove("on");
  if(!taxi.graph){
    if(p.kind==="stand"&&taxi.standReference?.stands[p.destination]){
      taxi.selectedStand=p.destination;taxi.showStands=true;
      $("taxiQaStands").classList.add("on");
      $("taxiQaStands").setAttribute("aria-pressed","true");
      draw();
      const lead=taxi.standReference.publishedLeadInTopology?.cases?.[p.destination];
      const leadText=lead?" Published lead-in: "+lead.publishedApproach.join(" / ")+". "+lead.directionNote:"";
      message("Stand "+p.destination+": published AIP POSITION selected"+(georefByPage.get(Number(selectedChart?.page))?" and highlighted.":", but this chart has no validated georeferencing to display the point.")+leadText+" Centerline connector geometry still unverified; no route generated.",true);
    }else message("Parsed "+p.kind+". No verified taxiway + stand connector network for "+selectedAirport+"; automatic routing is disabled.",true);
    return;
  }
  if(!lastPosition){message("No live aircraft fix. Connect GPS or simulator first.",true);return}
  const start=nearest(taxi.graph,lastPosition);
  if(!start){message("Aircraft >250 m from verified taxi graph.",true);return}
  let planned=null,info="";
  if(p.kind==="procedure"){
    const choices=(taxi.graph.procedures||[]).filter(x=>name(x.key)===p.key&&
      Array.isArray(x.nodes)&&x.nodes.length>1&&x.nodes.every(id=>taxi.graph.nodes[id]));
    if(!choices.length){message("Published procedure not digitized: "+p.key,true);return}
    choices.sort((a,b)=>dist(lastPosition,taxi.graph.nodes[a.nodes[0]])-dist(lastPosition,taxi.graph.nodes[b.nodes[0]]));
    if(dist(lastPosition,taxi.graph.nodes[choices[0].nodes[0]])>700 ||
      (choices[1]&&dist(lastPosition,taxi.graph.nodes[choices[1].nodes[0]])-
        dist(lastPosition,taxi.graph.nodes[choices[0].nodes[0]])<35)){
      message("Procedure start location is ambiguous. Do not guess arrival/departure.",true);return;
    }
    planned={path:choices[0].nodes,holds:choices[0].holdIndices||[]};
    info="Nearest verified PROCEDURE START · "+(choices[0].operation||"");
  }else{
    const stand=p.destination,stands=taxi.graph.stands||{},
      goal=typeof stands[stand]==="string"?stands[stand]:stands[stand]?.node;
    if(stand&&!taxi.graph.nodes[goal]){message("Stand "+stand+" is not mapped.",true);return}
    if(!goal&&p.kind==="stand"){message("Stand not mapped.",true);return}
    if(goal)planned=shortest(taxi.graph,start,goal,p.kind==="sequence"?p:null);
    else {
      for(const id of Object.keys(taxi.graph.nodes)){
        const candidate=shortest(taxi.graph,start,id,p);
        if(candidate&&(!planned||candidate.length<planned.length))planned=candidate;
      }
    }
    info=p.kind==="stand"?"SHORTEST DISTANCE SUGGESTION · NOT ATC CLEARANCE":"TAXIWAY SEQUENCE";
  }
  if(!planned||planned.path.length<2){message("No connected permitted route exists. Chart/clearance required.",true);return}
  taxi.route={...planned,graph:taxi.graph,airport:selectedAirport};
  message(info+" · "+planned.path.length+" nodes.");
  draw();
}
function currentManual(){
  const page=Number(selectedChart?.page);
  if(!taxi.manual.has(page))taxi.manual.set(page,{points:[],holds:[]});
  return taxi.manual.get(page);
}
function mark(e){
  if(!taxi.active||!taxi.trace||!isAdc(selectedChart)||e.button!==0)return;
  const canvas=$("pdfCanvas");if(!canvas)return;
  const r=canvas.getBoundingClientRect(),x=(e.clientX-r.left)/r.width,y=(e.clientY-r.top)/r.height;
  if(!(x>=0&&x<=1&&y>=0&&y<=1))return;
  currentManual().points.push({x,y});draw();
  message("MANUAL TRACE QA: "+currentManual().points.length+" points. Never use as automatically calculated taxi guidance.");
}
function s(tag,attrs){
  const t=document.createElementNS(ns,tag);
  for(const [k,v] of Object.entries(attrs))t.setAttribute(k,v);
  return t;
}
function paintPath(svg,pts,holds,width){
  if(pts.length<2)return;
  // Minimal corner rounding; never use broad splines that cut taxiway corners.
  let d="M "+pts[0].x+" "+pts[0].y;
  for(let i=1;i<pts.length;i++){
    const p=pts[i];
    if(i<pts.length-1){
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
  const stroke=Math.max(2,width*.0035);
  svg.appendChild(s("path",{d,fill:"none",stroke:"#1c0630","stroke-width":stroke+2,"stroke-linejoin":"round","stroke-linecap":"round"}));
  svg.appendChild(s("path",{d,fill:"none",stroke:"#f200d9","stroke-width":stroke,"stroke-linejoin":"round","stroke-linecap":"round"}));
  for(const i of holds){
    const p=pts[i];if(!p)continue;
    const a=pts[Math.max(0,i-1)],b=pts[Math.min(pts.length-1,i+1)],
      dx=b.x-a.x,dy=b.y-a.y,len=Math.hypot(dx,dy)||1,nx=-dy/len,ny=dx/len,q=stroke*3;
    svg.appendChild(s("line",{x1:p.x+nx*q,y1:p.y+ny*q,x2:p.x-nx*q,y2:p.y-ny*q,
      stroke:"#ff1626","stroke-width":stroke*1.6,"stroke-linecap":"square"}));
  }
}
function draw(){
  syncAirport();
  const layer=$("chartTransformLayer"),canvas=$("pdfCanvas");if(!layer||!canvas)return;
  layer.querySelector(".taxi-qa-overlay")?.remove();
  if(!taxi.active)return;
  const model=georefByPage.get(Number(selectedChart?.page)),w=model?.width||1000,h=model?.height||1000;
  const svg=s("svg",{class:"taxi-qa-overlay",viewBox:"0 0 "+w+" "+h,preserveAspectRatio:"none"});
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;z-index:12;pointer-events:none";
  if(taxi.showStands&&taxi.standReference&&model){
    const pins=s("g",{"class":"taxi-stand-reference-pins"});
    for(const [id,coord] of Object.entries(taxi.standReference.stands)){
      const p=projectGeo(model,coord.lat,coord.lon);
      if(!p)continue;
      const selected=taxi.selectedStand===id;
      pins.appendChild(s("circle",{cx:p.x,cy:p.y,r:selected?6:2.4,
        fill:selected?"#fff099":({"C":"#38d4fb","E":"#8cfd9e","G":"#fc9d4d","H":"#c69aff","Q":"#ff9ad1"}[coord.apron]||"#38d4fb"),stroke:"#062238","stroke-width":selected?1.7:0.8}));
      if(selected){
        const label=s("text",{x:p.x+8,y:p.y-8,fill:"#f9faff","font-size":"14",
          "font-weight":"900",stroke:"#052333","stroke-width":"3","paint-order":"stroke"});
        label.textContent=id;pins.appendChild(label);
      }
    }
    svg.appendChild(pins);
  }
  const r=taxi.route;
  if(r&&r.airport===selectedAirport&&model){
    let segment=[],holdPositions=[];
    for(let i=0;i<r.path.length;i++){
      const pt=r.graph.nodes[r.path[i]],p=pt?projectGeo(model,pt.lat,pt.lon):null;
      if(!p){paintPath(svg,segment,holdPositions,w);segment=[];holdPositions=[];continue;}
      if(r.holds.includes(i))holdPositions.push(segment.length);
      segment.push(p);
    }
    paintPath(svg,segment,holdPositions,w);
  }
  const manual=taxi.manual.get(Number(selectedChart?.page));
  if(manual)paintPath(svg,manual.points.map(p=>({x:p.x*w,y:p.y*h})),manual.holds,w);
  layer.appendChild(svg);
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
window.JEPPIRAN_TAXI={open:openTaxi,parse,openAdc,draw};
window.addEventListener("jeppiran-chart-rendered",()=>{draw();chartHint()});
window.addEventListener("jeppiran-position",chartHint);
document.getElementById("chartTaxiBtn")?.addEventListener("click",openTaxi);
})();