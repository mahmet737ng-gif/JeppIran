/* JEPPIRAN TAXI preview · verified graphs only · NOT FOR ACTUAL NAVIGATION */
(function(){
"use strict";
const ns="http://www.w3.org/2000/svg", taxi={active:false,trace:false,startSelect:false,testStart:null,airport:"",graph:null,standReference:null,selectedStand:"",showStands:false,route:null,manual:new Map(),prompted:""};
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
function shortest(graph,start,goal,requested,links){
  const edges=links||adjacent(graph),ways=requested?.taxiways||[],slash=requested?.stops||[];
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
    function add(n,i,u,extra,hold,move){
      const k=key(n,i,u),w=p.w+extra;
      if(w>=(seen.get(k)??Infinity))return;
      seen.set(k,w);previous.set(k,{prev:p.k,n:p.n,hold,move});push({n,i,u,w,k});
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
  return {path:reverse.reverse(),holds:rawHolds.map(i=>reverse.length-1-i),length:Math.round(final.w)};
}
function graphOk(d,icao){
  return d&&
    (d.verified===true||(d.verified===false&&d.simulatorTestOnly===true&&d.coordinateSystem==="WGS84"&&
      d.source?.provider==="OpenStreetMap contributors"&&d.source?.license==="ODbL 1.0"))&&
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
    taxi.graph=d;
    message(d.simulatorTestOnly?
      "LTFM SIM QA · "+d.edges.length+" mapped OSM taxi centerlines · © OpenStreetMap contributors (ODbL). NOT AIP-VERIFIED. Connect simulator or choose SET START.":
      "Verified airport ground graph loaded.");
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
    '<label for="taxiQaInput">LTFM example: A4 A A7 B B8A · Hold: /B8A · 34L2A format</label>'+
    '<div class="taxi-qa-entry"><input id="taxiQaInput" autocomplete="off" spellcheck="false" placeholder="Taxi clearance or stand"><button id="taxiQaGo" type="button">GO</button></div>'+
    '<div class="taxi-qa-buttons"><button id="taxiQaAdc" type="button">ADC</button><button id="taxiQaStart" type="button" aria-pressed="false">SET START</button><button id="taxiQaStands" type="button" aria-pressed="false">STANDS</button><button id="taxiQaTrace" type="button">TRACE QA</button><button id="taxiQaHold" type="button">HOLD HERE</button><button id="taxiQaUndo" type="button">UNDO</button><button id="taxiQaClear" type="button">CLEAR</button></div>'+
    '<div id="taxiQaStatus" role="status"></div><div id="taxiQaStandMap" hidden aria-label="Geographic reference-only stand map"></div><small class="taxi-qa-warning">NOT FOR ACTUAL NAVIGATION. Ground clearance and chart validation remain mandatory.</small>';
  document.querySelector("#chartsView .viewer-pane")?.appendChild(panel);
  $("taxiQaClose").onclick=()=>toggle(false);
  $("taxiQaGo").onclick=go;
  $("taxiQaInput").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();go()}};
  $("taxiQaAdc").onclick=openAdc;
  $("taxiQaStart").onclick=()=>{
    taxi.startSelect=!taxi.startSelect;taxi.trace=false;
    $("taxiQaStart").classList.toggle("on",taxi.startSelect);
    $("taxiQaStart").setAttribute("aria-pressed",String(taxi.startSelect));
    $("taxiQaTrace").classList.remove("on");
    message(taxi.startSelect?
      "SIM QA: tap your starting point ON the ADC taxiway centerline, then press GO. This overrides live GPS for this TEST only.":
      "Start placement cancelled.");
  };
  $("taxiQaStands").onclick=()=>{
    taxi.showStands=!taxi.showStands;
    $("taxiQaStands").classList.toggle("on",taxi.showStands);
    $("taxiQaStands").setAttribute("aria-pressed",String(taxi.showStands));
    draw();
    if(!taxi.standReference)message("No AIP stand-position reference loaded for this airport.",true);
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
    taxi.route=null;taxi.manual.delete(Number(selectedChart?.page));taxi.trace=false;taxi.testStart=null;taxi.startSelect=false;
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
    if(taxi.airport!==selectedAirport){taxi.airport=selectedAirport;taxi.route=null;taxi.testStart=null;loadGraph(selectedAirport);loadStandReference(selectedAirport);}
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
  taxi.airport=selectedAirport;taxi.graph=null;taxi.route=null;taxi.testStart=null;taxi.prompted="";
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
  const startPosition=taxi.testStart||lastPosition;
  if(!startPosition){message("Connect simulator/device GPS or tap SET START on the chart, then GO.",true);return}
  const start=nearest(taxi.graph,startPosition,p.kind==="sequence"?p.taxiways[0]:null);
  if(!start){message("No mapped centerline near the starting position"+(p.kind==="sequence"?" on taxiway "+p.taxiways[0]:"")+". Choose SET START on the correct centerline.",true);return}
  let planned=null,info="";
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
    planned=shortest(taxi.graph,start,goal||null,p.kind==="sequence"?p:null,links);
    info=p.kind==="stand"?"SHORTEST DISTANCE SUGGESTION · NOT ATC CLEARANCE":"TAXIWAY SEQUENCE";
  }
  if(!planned||planned.path.length<2){message("No connected path matching ALL named taxiways, in that order. Verify the clearance or data; nothing invented.",true);return}
  taxi.route={...planned,graph:taxi.graph,airport:selectedAirport};
  message("SIMULATION QA · "+info+" · "+planned.path.length+" nodes · "+(planned.length||0)+" m. OSM SOURCE · NOT APPROVED FOR ACTUAL NAVIGATION.",true);
  draw();
}
function currentManual(){
  const page=Number(selectedChart?.page);
  if(!taxi.manual.has(page))taxi.manual.set(page,{points:[],holds:[]});
  return taxi.manual.get(page);
}
function mark(e){
  if(!taxi.active||!(taxi.trace||taxi.startSelect)||!isAdc(selectedChart)||e.button!==0)return;
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
function drawStandMap(){
  const el=$("taxiQaStandMap");
  if(!el)return;
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
function draw(){
  syncAirport();
  drawStandMap();
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
  if(taxi.testStart&&model){
    const p=projectGeo(model,taxi.testStart.lat,taxi.testStart.lon);
    if(p){
      svg.appendChild(s("circle",{cx:p.x,cy:p.y,r:7,fill:"#06effc",stroke:"#042431","stroke-width":2}));
      const t=s("text",{x:p.x+11,y:p.y-9,fill:"#06effc","font-size":13,
        "font-weight":"900",stroke:"#041824","stroke-width":3,"paint-order":"stroke"});
      t.textContent="QA START";svg.appendChild(t);
    }
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