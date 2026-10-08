const RAW_ROOT="./data/";
const VERSION="V2620";
const WX_CACHE_RAW="https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/wx-cache/wx-live.json";
const WX_CACHE_API="https://api.github.com/repos/mahmet737ng-gif/JeppIran/contents/wx-live.json?ref=wx-cache";
const CATEGORY_ORDER=["Airport","STAR","SID","Approach","Other"];
const AIRPORTS={
"LTFM":["ISTANBUL AIRPORT","ISTANBUL"],"OIAA":["ABADAN AIRPORT","ABADAN"],"OIAM":["MAHSHAHR AIRPORT","MAHSHAHR"],
"OIAW":["AHWAZ AIRPORT","AHWAZ"],"OIBB":["BUSHEHR AIRPORT","BUSHEHR"],"OIBK":["KISH ISLAND","KISH ISLAND"],
"OIBP":["ASALOUYEH AIRPORT","ASALOUYEH"],"OICC":["KERMANSHAH AIRPORT","KERMANSHAH"],"OICI":["ILAM AIRPORT","ILAM"],
"OIFM":["ISFAHAN AIRPORT","ISFAHAN"],"OIGG":["RASHT AIRPORT","RASHT"],"OIHH":["HAMADAN AIRPORT","HAMADAN"],
"OIIE":["IMAM KHOMEINI INTERNATIONAL","TEHRAN"],"OIII":["MEHRABAD INTERNATIONAL","TEHRAN"],"OIIP":["KARAJ AIRPORT","KARAJ"],
"OIKK":["KERMAN AIRPORT","KERMAN"],"OIMB":["BIRJAND AIRPORT","BIRJAND"],"OIMM":["MASHHAD INTERNATIONAL","MASHHAD"],
"OIMN":["BOJNURD AIRPORT","BOJNURD"],"OIMS":["SABZEVAR AIRPORT","SABZEVAR"],"OING":["GORGAN AIRPORT","GORGAN"],
"OINZ":["SARI AIRPORT","SARI"],"OISS":["SHIRAZ INTERNATIONAL","SHIRAZ"],"OITL":["ARDABIL AIRPORT","ARDABIL"],
"OITR":["URMIA AIRPORT","URMIA"],"OITT":["TABRIZ INTERNATIONAL","TABRIZ"],"OIYY":["YAZD AIRPORT","YAZD"],
"OIZC":["CHABAHAR AIRPORT","CHABAHAR"],"OIZH":["ZAHEDAN INTERNATIONAL","ZAHEDAN"],"OMDB":["DUBAI INTERNATIONAL","DUBAI"],
"OOMS":["MUSCAT INTERNATIONAL","MUSCAT"],"ORBI":["BAGHDAD INTERNATIONAL","BAGHDAD"],"ORNI":["NAJAF INTERNATIONAL","NAJAF"],
"UDYZ":["ZVARTNOTS INTERNATIONAL","YEREVAN"],"UGSB":["BATUMI INTERNATIONAL","BATUMI"],"UGTB":["TBILISI INTERNATIONAL","TBILISI"]
};

let charts=[], manifest=null, selectedAirport="", selectedChart=null, expanded=new Set(["Airport"]);
let airportTreeExpanded=false;
let chartZoom=1, chartPanX=0, chartPanY=0;
let chartMetarTimer=null, chartMetarAirport="", chartMetarValue="";
let chartPointers=new Map(), pinchStartDistance=0, pinchStartZoom=1, panStart=null, swipeStart=null, lastTapAt=0;
let georefByPage=new Map(), githubWxCache=null, githubWxCacheAt=0;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];

function renderRoute(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  document.body.classList.remove("viewer-fullscreen");
  const el=$("#"+name+"View")||$("#homeView"); el.classList.add("active");
}
function route(name,replace=false){
  renderRoute(name);
  const hash="#"+name;
  if(location.hash!==hash){
    const fn=replace?"replaceState":"pushState";
    history[fn]({route:name},"",hash);
  }
}
$$("[data-route]").forEach(b=>b.addEventListener("click",e=>{
  e.preventDefault();
  const target=b.dataset.route;
  if(target==="home" && history.length>1 && location.hash!=="#home"){history.back()} else route(target);
}));
window.addEventListener("popstate",()=>renderRoute((location.hash||"#home").slice(1)));
window.JEPPIRAN_NAV_READY=true;

function dialog(title,text){
  $("#dialogTitle").textContent=title;
  $("#dialogText").textContent=text;
  const d=$("#messageDialog"); if(typeof d.showModal==="function") d.showModal(); else alert(title+"\n\n"+text);
}
$("#dialogClose").addEventListener("click",()=>$("#messageDialog").close());
$("#installHelpBtn").addEventListener("click",()=>dialog("Install JEPPIRAN on iPad","Open this page in Safari, tap Share, then choose Add to Home Screen. It will launch like an app."));
$("#infoCard").addEventListener("click",()=>dialog("JEPPIRAN "+VERSION,"iPad web/PWA build. Chart PDFs and weather require internet on first load. The app shell remains available offline."));
$("#themeBtn").addEventListener("click",()=>{
  document.documentElement.classList.toggle("light");
  localStorage.setItem("theme",document.documentElement.classList.contains("light")?"light":"dark");
});
if(localStorage.getItem("theme")==="light") document.documentElement.classList.add("light");

async function loadData(){
  try{
    const [m,c,g]=await Promise.all([
      fetch(RAW_ROOT+"charts-manifest.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("manifest");return r.json()}),
      fetch(RAW_ROOT+"charts-current.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("charts");return r.json()}),
      fetch(RAW_ROOT+"chart-georef.json",{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(()=>null)
    ]);
    manifest=m; charts=Array.isArray(c)?c:(c.charts||[]);
    georefByPage=buildGeorefIndex(g);
    renderAirports();
    refreshPositionStatus();
    $("#updateSubtitle").textContent=(m.version||VERSION)+" data • "+Object.keys(m.airports||{}).length+" airports";
  }catch(e){
    $("#updateSubtitle").textContent="Unable to load online chart index";
    dialog("Chart data","Could not load the chart index. Check the internet connection and reload.");
  }
}
$("#updateCard").addEventListener("click",async()=>{
  $("#updateSubtitle").textContent="Checking…";
  await loadData();
  dialog("Chart data",manifest?("Current web data: "+(manifest.version||VERSION)+". Airport PDFs are loaded on demand."):"Unable to check updates.");
});

function renderAirports(filter=""){
  const list=$("#airportList");
  const oldScroll=list.scrollTop;
  list.innerHTML="";
  const keys=[...new Set(charts.map(c=>c.airport))].sort();
  const q=filter.trim().toUpperCase();
  keys.filter(icao=>{
    const meta=AIRPORTS[icao]||["",""];
    return !q || (icao+" "+meta.join(" ")).toUpperCase().includes(q);
  }).forEach(icao=>{
    const meta=AIRPORTS[icao]||["AIRPORT",""];
    const branch=document.createElement("div");
    branch.className="airport-branch"+(icao===selectedAirport?" selected":"");

    const b=document.createElement("button");
    b.className="airport-item"+(icao===selectedAirport?" selected":"");
    const idx=(keys.indexOf(icao)%20)+1;
    b.style.setProperty("--airport-bg","url('./airport-images/airport_card_"+idx+".webp')");
    const isSelected=icao===selectedAirport;
    const isOpen=isSelected&&airportTreeExpanded;
    b.setAttribute("aria-expanded",isOpen?"true":"false");
    b.innerHTML="<span class='airport-shade'></span><span class='airport-copy'><b>"+escapeHtml(icao)+"</b><small>"+escapeHtml(meta[0]+(meta[1]?" • "+meta[1]:""))+"</small></span><span class='airport-chevron'>"+(isOpen?"▾":"›")+"</span>";
    b.onclick=()=>selectAirport(icao);
    branch.appendChild(b);

    if(isOpen){
      const tree=document.createElement("div");
      tree.className="airport-inline-tree";
      renderTreeInto(tree);
      branch.appendChild(tree);
    }
    list.appendChild(branch);
  });
  requestAnimationFrame(()=>{list.scrollTop=oldScroll});
}
$("#airportSearch").addEventListener("input",e=>renderAirports(e.target.value));

function selectAirport(icao){
  if(icao===selectedAirport){
    airportTreeExpanded=!airportTreeExpanded;
    renderAirports($("#airportSearch").value);
    return;
  }

  selectedAirport=icao;
  selectedChart=null;
  airportTreeExpanded=true;
  expanded=new Set(["Airport"]);
  renderAirports($("#airportSearch").value);
  $("#viewerAirport").textContent=icao+" • "+((AIRPORTS[icao]||[])[0]||"AIRPORT");
  $("#viewerChart").textContent="Select a chart";
  $("#pdfStage").innerHTML='<div class="empty-state"><img src="./logo.svg" alt=""><b>Select a chart</b><span>Choose AIRPORT, STAR, SID or APP under '+escapeHtml(icao)+'.</span></div>';
  $("#offlinePdfBtn").disabled=true;
  currentPdfUrl="";
  hideChartMetar();
}

function renderTreeInto(root){
  root.innerHTML="";
  if(!selectedAirport)return;
  const airportCharts=charts.filter(c=>c.airport===selectedAirport).sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
  CATEGORY_ORDER.forEach(cat=>{
    const items=airportCharts.filter(c=>(c.category||"Other")===cat);
    if(!items.length)return;
    const wrap=document.createElement("div");
    wrap.className="tree-group inline-tree-group";
    const h=document.createElement("button");
    h.className="tree-group-head";
    const catLabel=cat==="Airport"?"AIRPORT":cat==="Approach"?"APP":cat.toUpperCase();
    const groupOpen=expanded.has(cat);
    h.setAttribute("aria-expanded",groupOpen?"true":"false");
    h.textContent=(groupOpen?"▼ ":"▶ ")+catLabel+" ("+items.length+")";
    h.onclick=e=>{
      e.stopPropagation();
      expanded.has(cat)?expanded.delete(cat):expanded.add(cat);
      renderAirports($("#airportSearch").value);
    };
    wrap.appendChild(h);
    if(expanded.has(cat)){
      items.forEach(c=>{
        const item=document.createElement("button");
        item.className="tree-item"+(selectedChart&&Number(selectedChart.page)===Number(c.page)?" selected":"");
        const number=c.chart_number?c.chart_number+" • ":"";
        item.innerHTML=escapeHtml(number+(c.name||("Chart "+c.page)));
        item.onclick=e=>{e.stopPropagation();selectChart(c)};
        wrap.appendChild(item);
      });
    }
    root.appendChild(wrap);
  });
}

function geoNum(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function geoBoundsContains(b,x,y,t=0){
  return !!b&&Number.isFinite(x)&&Number.isFinite(y)&&
    x>=b.left-t&&x<=b.right+t&&y>=b.top-t&&y<=b.bottom+t;
}
function makeGeoModel(item){
  if(!item||!Number.isInteger(Number(item.page)))return null;
  const allowed=new Set(["paired_printed_graticule_vector_ticks","single_axis_plus_conformal_scale"]);
  if(!allowed.has(item.validation&&item.validation.method))return null;
  const width=geoNum(item.width),height=geoNum(item.height),b=item.bounds||{};
  const bounds={left:geoNum(b.left),top:geoNum(b.top),right:geoNum(b.right),bottom:geoNum(b.bottom)};
  const points=Array.isArray(item.points)?item.points.map(p=>({x:geoNum(p.x),y:geoNum(p.y),lat:geoNum(p.lat),lon:geoNum(p.lon)})):[];
  if(points.length<4||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
     !geoBoundsContains({left:0,top:0,right:width,bottom:height},bounds.left,bounds.top)||
     !geoBoundsContains({left:0,top:0,right:width,bottom:height},bounds.right,bounds.bottom)||
     bounds.left>=bounds.right||bounds.top>=bounds.bottom||
     points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
       p.lat<-90||p.lat>90||p.lon<-180||p.lon>180||!geoBoundsContains(bounds,p.x,p.y)))return null;
  let excluded=(Array.isArray(item.excludedBounds)?item.excludedBounds:[]).map(x=>({
    left:geoNum(x.left),top:geoNum(x.top),right:geoNum(x.right),bottom:geoNum(x.bottom)
  })).filter(x=>Number.isFinite(x.left)&&Number.isFinite(x.top)&&Number.isFinite(x.right)&&Number.isFinite(x.bottom)&&
    x.left<x.right&&x.top<x.bottom&&geoBoundsContains(bounds,x.left,x.top)&&geoBoundsContains(bounds,x.right,x.bottom));
  excluded=excluded.filter(area=>!points.every(p=>geoBoundsContains(area,p.x,p.y)));
  const meanLon=points.reduce((a,p)=>a+p.lon,0)/points.length;
  const meanLat=points.reduce((a,p)=>a+p.lat,0)/points.length;
  const meanX=points.reduce((a,p)=>a+p.x,0)/points.length;
  const meanY=points.reduce((a,p)=>a+p.y,0)/points.length;
  let ll=0,bb=0,lb=0,lx=0,bx=0,ly=0,latY=0;
  points.forEach(p=>{
    const lon=p.lon-meanLon,lat=p.lat-meanLat;
    ll+=lon*lon;bb+=lat*lat;lb+=lon*lat;
    lx+=lon*(p.x-meanX);bx+=lat*(p.x-meanX);
    ly+=lon*(p.y-meanY);latY+=lat*(p.y-meanY);
  });
  const det=ll*bb-lb*lb;
  if(ll<=1e-16||bb<=1e-16||det<=1e-8*ll*bb)return null;
  const model={page:Number(item.page),width,height,bounds,excluded,meanLon,meanLat,meanX,meanY,
    xLon:(bb*lx-lb*bx)/det,xLat:(ll*bx-lb*lx)/det,
    yLon:(bb*ly-lb*latY)/det,yLat:(ll*latY-lb*ly)/det};
  const orientation=model.xLon*model.yLat-model.xLat*model.yLon;
  if(!Number.isFinite(orientation)||orientation>=0)return null;
  const maxResidual=Math.min(2,Math.max(0,geoNum(item.maxResidualPdfPoints)||0.75));
  for(const p of points){
    const q=projectGeoRaw(model,p.lat,p.lon);
    if(!q||Math.hypot(q.x-p.x,q.y-p.y)>maxResidual)return null;
  }
  return model;
}
function projectGeoRaw(model,lat,lon){
  if(!model||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return null;
  const x=model.meanX+model.xLon*(lon-model.meanLon)+model.xLat*(lat-model.meanLat);
  const y=model.meanY+model.yLon*(lon-model.meanLon)+model.yLat*(lat-model.meanLat);
  return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}
function projectGeo(model,lat,lon){
  const p=projectGeoRaw(model,lat,lon);
  if(!p||!geoBoundsContains(model.bounds,p.x,p.y,6)||model.excluded.some(b=>geoBoundsContains(b,p.x,p.y)))return null;
  return p;
}
function buildGeorefIndex(root){
  const map=new Map();
  if(!root||root.version!==2||root.coordinateSystem!=="WGS84"||root.coordinateSpace!=="pdf_points"||root.origin!=="top_left")return map;
  (Array.isArray(root.charts)?root.charts:[]).forEach(item=>{
    const model=makeGeoModel(item);
    if(model&&!map.has(model.page))map.set(model.page,model);
  });
  return map;
}
function hideAircraftMarker(){
  const m=$("#aircraftMarker"); if(m)m.classList.remove("visible");
}
function renderedGeoHeading(model,lat,heading,canvas){
  if(!Number.isFinite(heading))return 0;
  const r=Math.PI/180,cosLat=Math.cos(lat*r);
  if(Math.abs(cosLat)<1e-8)return 0;
  const east=Math.sin(heading*r)/cosLat,north=Math.cos(heading*r);
  const dx=(model.xLon*east+model.xLat*north)*canvas.clientWidth/model.width;
  const dy=(model.yLon*east+model.yLat*north)*canvas.clientHeight/model.height;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<1e-8)return 0;
  return Math.atan2(dx,-dy)/r;
}
function setPositionStatus(state,text,detail=""){
  const btn=$("#positionStatusBtn");
  if(!btn)return;
  btn.dataset.state=state||"off";
  btn.title=text||"Position status";
  btn.setAttribute("aria-label",text||"Position status");
  const dot=btn.querySelector(".position-status-dot");
  const label=btn.querySelector(".position-status-label");
  if(label)label.textContent=text||"GPS";
  btn.dataset.detail=detail||"";
}
function chartHasGeoref(){
  return !!(selectedChart&&georefByPage.get(Number(selectedChart.page)));
}
function refreshPositionStatus(){
  if(!activePositionSource){
    setPositionStatus("off","GPS OFF","No position source selected.");
    return;
  }
  if(!lastPosition){
    setPositionStatus("waiting",activePositionSource==="gps"?"GPS WAIT":"SIM WAIT","Waiting for a live position fix.");
    return;
  }
  const model=selectedChart&&georefByPage.get(Number(selectedChart.page));
  if(!selectedChart){
    setPositionStatus("live",activePositionSource==="gps"?"GPS LIVE":"SIM LIVE","Position is live. Open a chart to display the aircraft.");
    return;
  }
  if(!model){
    setPositionStatus("warning",activePositionSource==="gps"?"GPS LIVE":"SIM LIVE","Position is live, but this chart has no valid georeference.");
    return;
  }
  const p=projectGeo(model,Number(lastPosition.lat),Number(lastPosition.lon));
  if(!p){
    setPositionStatus("outside",(activePositionSource==="gps"?"GPS":"SIM")+" LIVE • OUTSIDE CHART","Position is live, but it is outside the mapped area of this chart.");
    return;
  }
  const acc=Number.isFinite(lastPosition.accuracy)?(" • ±"+Math.round(lastPosition.accuracy)+" m"):"";
  setPositionStatus("live",(activePositionSource==="gps"?"GPS":"SIM")+" LIVE"+acc,"Position is live and inside this chart.");
}

function updateAircraftMarker(){
  const canvas=$("#pdfCanvas"),chart=selectedChart,pos=lastPosition;
  if(!canvas||!chart||!pos){hideAircraftMarker();refreshPositionStatus();return}
  const model=georefByPage.get(Number(chart.page));
  if(!model){hideAircraftMarker();refreshPositionStatus();return}
  const p=projectGeo(model,Number(pos.lat),Number(pos.lon));
  if(!p){hideAircraftMarker();refreshPositionStatus();return}
  const wrap=$("#chartTransformLayer")||canvas.parentElement;
  let marker=$("#aircraftMarker");
  if(!marker){
    marker=document.createElement("div");
    marker.id="aircraftMarker";
    marker.className="aircraft-marker";
    marker.innerHTML='<span class="aircraft-pulse"></span><span class="aircraft-arrow"></span>';
    wrap.appendChild(marker);
  }else if(marker.parentElement!==wrap){
    wrap.appendChild(marker);
  }
  const x=p.x/model.width*canvas.clientWidth;
  const y=p.y/model.height*canvas.clientHeight;
  marker.style.left=x+"px";marker.style.top=y+"px";
  marker.style.setProperty("--aircraft-heading",renderedGeoHeading(model,Number(pos.lat),Number(pos.heading),canvas)+"deg");
  marker.classList.add("visible");
  refreshPositionStatus();
}

let pdfRenderToken=0,currentPdfUrl="";
async function pdfJs(){
  if(window.pdfjsLib)return window.pdfjsLib;
  try{
    const mod=await import("./vendor/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc="./vendor/pdf.worker.min.mjs";
    return mod;
  }catch(e){throw new Error("PDF renderer could not load. Connect once to initialize the web app.");}
}
async function getPdfBytes(url,save=true){
  const cache=await caches.open("jeppiran-chart-pdfs-v1");
  let res=await cache.match(url);
  if(!res){
    res=await fetch(url,{mode:"cors"});
    if(!res.ok)throw new Error("PDF HTTP "+res.status);
    if(save) await cache.put(url,res.clone());
  }
  return new Uint8Array(await res.arrayBuffer());
}
async function renderSelectedPdf(c){
  const token=++pdfRenderToken;
  const info=manifest&&manifest.airports&&manifest.airports[selectedAirport];
  if(!info)throw new Error("No PDF URL is available for "+selectedAirport);
  currentPdfUrl="./charts/"+encodeURIComponent(info.file||selectedAirport+".pdf");
  $("#offlinePdfBtn").disabled=false;
  const stage=$("#pdfStage");
  stage.innerHTML='<div class="pdf-loading">Loading chart…</div><div class="pdf-canvas-wrap"><div id="chartTransformLayer" class="chart-transform-layer"><canvas id="pdfCanvas"></canvas></div></div>';
  const lib=await pdfJs(), bytes=await getPdfBytes(currentPdfUrl,true);
  if(token!==pdfRenderToken)return;
  const doc=await lib.getDocument({data:bytes}).promise;
  const pageNo=Math.max(1,Math.min(doc.numPages,Number(c.pdf_page)||1));
  const page=await doc.getPage(pageNo);
  if(token!==pdfRenderToken)return;
  const wrap=stage.querySelector(".pdf-canvas-wrap"), canvas=$("#pdfCanvas");
  const base=page.getViewport({scale:1});
  const available=Math.max(320,stage.clientWidth-4);
  const dpr=Math.min(window.devicePixelRatio||1,2.5);
  const cssScale=available/base.width;
  const viewport=page.getViewport({scale:cssScale*dpr});
  canvas.width=Math.floor(viewport.width); canvas.height=Math.floor(viewport.height);
  canvas.style.width=Math.floor(viewport.width/dpr)+"px"; canvas.style.height=Math.floor(viewport.height/dpr)+"px";
  const layer=$("#chartTransformLayer");
  layer.style.width=canvas.style.width; layer.style.height=canvas.style.height;
  chartZoom=1;chartPanX=0;chartPanY=0;
  await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;
  stage.querySelector(".pdf-loading")?.remove();
  applyChartTransform();
  updateAircraftMarker();
}
function airportChartSequence(){
  return charts.filter(c=>c.airport===selectedAirport)
    .sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
}
function navigateChart(delta){
  if(!selectedChart||!selectedAirport)return;
  const seq=airportChartSequence();
  const idx=seq.findIndex(c=>Number(c.page)===Number(selectedChart.page));
  const next=idx+delta;
  if(idx<0||next<0||next>=seq.length)return;
  selectChart(seq[next],{keepTreeClosed:true});
}
function clampChartPan(){
  const stage=$("#pdfStage"),layer=$("#chartTransformLayer");
  if(!stage||!layer)return;
  const w=layer.offsetWidth*chartZoom,h=layer.offsetHeight*chartZoom;
  if(chartZoom<=1.001){
    chartPanX=0;
    const minY=Math.min(0,stage.clientHeight-h);
    chartPanY=Math.max(minY,Math.min(0,chartPanY));
    return;
  }
  const maxX=Math.max(0,(w-stage.clientWidth)/2+80);
  const maxY=Math.max(0,h-stage.clientHeight+80);
  chartPanX=Math.max(-maxX,Math.min(maxX,chartPanX));
  chartPanY=Math.max(-maxY,Math.min(80,chartPanY));
}
function applyChartTransform(){
  const layer=$("#chartTransformLayer");
  if(!layer)return;
  clampChartPan();
  layer.style.transform="translate3d("+chartPanX+"px,"+chartPanY+"px,0) scale("+chartZoom+")";
  layer.style.setProperty("--marker-inverse-scale",(1/chartZoom).toFixed(5));
  const label=$("#zoomValue"); if(label)label.textContent=Math.round(chartZoom*100)+"%";
  updateAircraftMarker();
}
function setChartZoom(next,{resetPan=false}={}){
  chartZoom=Math.max(1,Math.min(4,Number(next)||1));
  if(resetPan||chartZoom<=1.001){chartPanX=0;chartPanY=0}
  applyChartTransform();
}
function resetChartView(){setChartZoom(1,{resetPan:true})}
function zoomAround(next,cx,cy){
  const stage=$("#pdfStage");
  if(!stage){setChartZoom(next);return}
  const old=chartZoom;
  const z=Math.max(1,Math.min(4,next));
  if(Math.abs(z-old)<0.001)return;
  const r=stage.getBoundingClientRect();
  const px=cx-r.left-r.width/2,py=cy-r.top;
  const ratio=z/old;
  chartPanX=px-(px-chartPanX)*ratio;
  chartPanY=py-(py-chartPanY)*ratio;
  chartZoom=z;
  applyChartTransform();
}
$("#zoomOutBtn").addEventListener("click",()=>setChartZoom(chartZoom/1.25));
$("#zoomInBtn").addEventListener("click",()=>setChartZoom(chartZoom*1.25));
$("#zoomResetBtn").addEventListener("click",resetChartView);
$("#prevChartBtn").addEventListener("click",()=>navigateChart(-1));
$("#nextChartBtn").addEventListener("click",()=>navigateChart(1));

function setupChartGestures(){
  const stage=$("#pdfStage");
  if(!stage||stage.dataset.gestures==="1")return;
  stage.dataset.gestures="1";
  stage.addEventListener("wheel",e=>{
    if(!$("#pdfCanvas"))return;
    e.preventDefault();
    if(e.ctrlKey||e.metaKey){
      const factor=e.deltaY<0?1.12:1/1.12;
      zoomAround(chartZoom*factor,e.clientX,e.clientY);
    }else{
      chartPanY-=e.deltaY;
      if(chartZoom>1.001)chartPanX-=e.deltaX;
      applyChartTransform();
    }
  },{passive:false});
  stage.addEventListener("pointerdown",e=>{
    if(!$("#pdfCanvas"))return;
    try{stage.setPointerCapture(e.pointerId)}catch(_){}
    chartPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(chartPointers.size===1){
      panStart={x:e.clientX,y:e.clientY,panX:chartPanX,panY:chartPanY};
      swipeStart={x:e.clientX,y:e.clientY,time:Date.now()};
    }else if(chartPointers.size===2){
      const pts=[...chartPointers.values()];
      pinchStartDistance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      pinchStartZoom=chartZoom;
      panStart=null;swipeStart=null;
    }
  });
  stage.addEventListener("pointermove",e=>{
    if(!chartPointers.has(e.pointerId))return;
    chartPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(chartPointers.size===2){
      const pts=[...chartPointers.values()];
      const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      const cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;
      if(pinchStartDistance>0)zoomAround(pinchStartZoom*(dist/pinchStartDistance),cx,cy);
      return;
    }
    if(chartPointers.size===1&&panStart){
      const dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;
      const stageEl=$("#pdfStage"),layerEl=$("#chartTransformLayer");
      const canVerticalPan=!!(stageEl&&layerEl&&layerEl.offsetHeight*chartZoom>stageEl.clientHeight+1);
      if(chartZoom>1.001){
        chartPanX=panStart.panX+dx;
        chartPanY=panStart.panY+dy;
        applyChartTransform();
      }else if(canVerticalPan&&Math.abs(dy)>Math.abs(dx)*0.65){
        chartPanX=0;
        chartPanY=panStart.panY+dy;
        applyChartTransform();
      }
    }
  });
  const finishPointer=e=>{
    const start=swipeStart;
    chartPointers.delete(e.pointerId);
    if(chartPointers.size===0){
      if(chartZoom<=1.001&&start){
        const dx=e.clientX-start.x,dy=e.clientY-start.y,dt=Date.now()-start.time;
        if(dt<700&&Math.abs(dx)>80&&Math.abs(dx)>Math.abs(dy)*1.35){
          dx<0?navigateChart(1):navigateChart(-1);
        }else if(dt<320&&Math.hypot(dx,dy)<18){
          const now=Date.now();
          if(now-lastTapAt<330){
            zoomAround(chartZoom>1.2?1:2,e.clientX,e.clientY);
            lastTapAt=0;
          }else lastTapAt=now;
        }
      }
      panStart=null;swipeStart=null;pinchStartDistance=0;
    }else if(chartPointers.size===1&&chartZoom>1.001){
      const p=[...chartPointers.values()][0];
      panStart={x:p.x,y:p.y,panX:chartPanX,panY:chartPanY};
    }
  };
  stage.addEventListener("pointerup",finishPointer);
  stage.addEventListener("pointercancel",finishPointer);
}
setupChartGestures();

function selectChart(c,options={}){
  selectedChart=c;
  expanded.add(c.category||"Other");
  renderAirports($("#airportSearch").value);
  refreshPositionStatus();
  $("#viewerChart").textContent=(c.chart_number?c.chart_number+" • ":"")+(c.name||("Chart "+c.page));
  showChartMetar(true);
  renderSelectedPdf(c).catch(e=>{
    $("#pdfStage").innerHTML='<div class="empty-state"><img src="./logo.svg" alt=""><b>Chart unavailable</b><span>'+escapeHtml(e.message)+'</span></div>';
  });
}
function hideChartMetar(){
  if(chartMetarTimer){clearTimeout(chartMetarTimer);chartMetarTimer=null}
  const banner=$("#chartMetarBanner");
  if(banner)banner.classList.remove("visible");
}
function scheduleChartMetarHide(){
  if(chartMetarTimer)clearTimeout(chartMetarTimer);
  chartMetarTimer=setTimeout(hideChartMetar,30000);
}
async function showChartMetar(autoHide=true){
  if(!selectedAirport||!selectedChart)return;
  const icao=selectedAirport;
  const banner=$("#chartMetarBanner"),text=$("#chartMetarText");
  if(!banner||!text)return;
  chartMetarAirport=icao;
  const cached=wxCache[icao+":metar"]||"";
  chartMetarValue=cached;
  text.textContent=cached||("METAR "+icao+" • loading…");
  banner.classList.add("visible");
  if(autoHide)scheduleChartMetarHide();
  try{
    const raw=await fetchWx("metar",icao);
    if(icao!==selectedAirport||!selectedChart)return;
    chartMetarValue=raw;
    wxCache[icao+":metar"]=raw;
    wxCache[icao+":time"]=Date.now();
    localStorage.setItem("wxCache",JSON.stringify(wxCache));
    text.textContent=raw;
  }catch(_){
    if(!cached&&icao===selectedAirport)text.textContent="METAR "+icao+" unavailable";
  }
}
$("#positionStatusBtn").addEventListener("click",()=>{
  const btn=$("#positionStatusBtn");
  dialog("Position status",(btn&&btn.dataset.detail)||"No position information available.");
});

$("#chartMetarBtn").addEventListener("click",()=>{
  const banner=$("#chartMetarBanner");
  if(banner&&banner.classList.contains("visible"))hideChartMetar();
  else showChartMetar(true);
});
$("#chartMetarClose").addEventListener("click",e=>{e.stopPropagation();hideChartMetar()});
$("#chartMetarBanner").addEventListener("click",e=>{if(e.target.id!=="chartMetarClose")hideChartMetar()});

$("#offlinePdfBtn").addEventListener("click",async()=>{
  if(!currentPdfUrl)return;
  $("#offlinePdfBtn").disabled=true; $("#offlinePdfBtn").textContent="Saving…";
  try{await getPdfBytes(currentPdfUrl,true);$("#offlinePdfBtn").textContent="Saved Offline"}
  catch(e){$("#offlinePdfBtn").textContent="Save Offline";dialog("Offline chart","Could not save this airport PDF: "+e.message)}
  finally{setTimeout(()=>{$("#offlinePdfBtn").disabled=false;if($("#offlinePdfBtn").textContent==="Saved Offline")$("#offlinePdfBtn").textContent="Save Offline"},1800)}
});
async function refitSelectedChartForLayout(){
  if(!selectedChart)return;
  chartPointers.clear();
  panStart=null;swipeStart=null;pinchStartDistance=0;
  try{await renderSelectedPdf(selectedChart)}catch(e){
    $("#pdfStage").innerHTML='<div class="empty-state"><img src="./logo.svg" alt=""><b>Chart unavailable</b><span>'+escapeHtml(e.message)+'</span></div>';
  }
}

async function enterViewerFullscreen(){
  document.body.classList.add("viewer-fullscreen");
  const root=document.documentElement;
  const request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(request){try{await request.call(root)}catch(e){}}
  setTimeout(()=>refitSelectedChartForLayout(),180);
}
async function exitViewerFullscreen(exitNative=true){
  document.body.classList.remove("viewer-fullscreen");
  if(exitNative){
    const active=document.fullscreenElement||document.webkitFullscreenElement;
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(active&&exit){try{await exit.call(document)}catch(e){}}
  }
  setTimeout(()=>refitSelectedChartForLayout(),180);
}
$("#fullscreenBtn").addEventListener("click",enterViewerFullscreen);
$("#fullscreenExitBtn").addEventListener("click",()=>exitViewerFullscreen(true));
["fullscreenchange","webkitfullscreenchange"].forEach(name=>document.addEventListener(name,()=>{
  const active=document.fullscreenElement||document.webkitFullscreenElement;
  if(!active&&document.body.classList.contains("viewer-fullscreen"))exitViewerFullscreen(false);
}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("viewer-fullscreen"))exitViewerFullscreen(true)});

const wxCache=JSON.parse(localStorage.getItem("wxCache")||"{}");
$("#getWxBtn").addEventListener("click",getWx);
async function getWx(){
  const icao=$("#icaoInput").value.trim().toUpperCase();
  $("#icaoInput").value=icao;
  const rawMetar=$("#metarCheck").checked, rawTaf=$("#tafCheck").checked, decoded=$("#decodedCheck").checked;
  if(!/^[A-Z]{4}$/.test(icao)){setWxStatus("Insert a valid four-letter ICAO code.");return}
  if(!rawMetar&&!rawTaf&&!decoded){setWxStatus("Select METAR, TAF, DECODED, or a combination.");return}
  const needMetar=rawMetar||decoded, needTaf=rawTaf||decoded;
  $("#getWxBtn").disabled=true; setWxStatus(icao+" • getting data…");
  let metar="",taf="",metarOk=!needMetar,tafOk=!needTaf;
  try{
    const jobs=[];
    if(needMetar) jobs.push(fetchWx("metar",icao).then(v=>{metar=v;metarOk=true}).catch(()=>{}));
    if(needTaf) jobs.push(fetchWx("taf",icao).then(v=>{taf=v;tafOk=true}).catch(()=>{}));
    await Promise.all(jobs);
    const anyRequestedOk=(needMetar&&metarOk)||(needTaf&&tafOk);
    if(!anyRequestedOk){
      showCachedWx(icao,rawMetar,rawTaf,decoded);
      setWxStatus(icao+" • unable to update • cached data shown");
      return;
    }
    if(needMetar&&metarOk) wxCache[icao+":metar"]=metar;
    if(needTaf&&tafOk) wxCache[icao+":taf"]=taf;
    wxCache[icao+":time"]=Date.now(); localStorage.setItem("wxCache",JSON.stringify(wxCache));
    const m=metarOk?metar:(wxCache[icao+":metar"]||"No cached METAR.");
    const t=tafOk?taf:(wxCache[icao+":taf"]||"No cached TAF.");
    showWx(rawMetar,rawTaf,decoded,m,t);
    const requestedOk=(!needMetar||metarOk)&&(!needTaf||tafOk);
    setWxStatus(icao+(requestedOk?" • updated":" • partial update"));
  }finally{$("#getWxBtn").disabled=false}
}
function extractWxRaw(data,type){
  if(!data)return "";
  if(typeof data==="string")return data.trim();
  if(Array.isArray(data)){
    for(const row of data){const v=extractWxRaw(row,type);if(v)return v}
    return "";
  }
  if(type==="metar"){
    const v=data.raw||data.rawText||data.rawOb||data.raw_text;
    if(typeof v==="string"&&v.trim())return v.trim();
  }else{
    const direct=data.rawTAF||data.rawTaf||data.raw_text||data.rawText;
    if(typeof direct==="string"&&direct.trim())return direct.trim();
    if(data.taf){
      if(typeof data.taf==="string"&&data.taf.trim())return data.taf.trim();
      const nested=extractWxRaw(data.taf,"taf"); if(nested)return nested;
    }
  }
  for(const k of ["data","results","reports","items"]){
    if(data[k]){const v=extractWxRaw(data[k],type);if(v)return v}
  }
  return "";
}
async function loadGithubWxCache(){
  if(githubWxCache&&Date.now()-githubWxCacheAt<60000)return githubWxCache;
  const bust=Math.floor(Date.now()/300000);
  try{
    const r=await fetch(WX_CACHE_RAW+"?v="+bust,{cache:"no-store",mode:"cors"});
    if(!r.ok)throw new Error("GitHub raw "+r.status);
    githubWxCache=await r.json();githubWxCacheAt=Date.now();return githubWxCache;
  }catch(rawError){
    const r=await fetch(WX_CACHE_API+"&v="+bust,{cache:"no-store",mode:"cors",headers:{Accept:"application/vnd.github+json"}});
    if(!r.ok)throw rawError;
    const data=await r.json(),encoded=String(data.content||"").replace(/\s+/g,"");
    githubWxCache=JSON.parse(atob(encoded));githubWxCacheAt=Date.now();return githubWxCache;
  }
}
async function fetchWxGithubCache(type,icao){
  const data=await loadGithubWxCache(),row=data&&data.stations&&data.stations[icao];
  const raw=row&&row[type];
  if(typeof raw==="string"&&raw.trim())return raw.trim();
  throw new Error("No cached "+type.toUpperCase()+" for "+icao);
}
async function fetchWx(type,icao){
  try{return await fetchWxGithubCache(type,icao)}catch(_){}
  const code=encodeURIComponent(icao);
  const providers=[
    {
      url:"https://rotatepilot.com/api/v1/metar?icao="+code+"&taf=1",
      pick:data=>type==="metar"?(data&&data.raw):(data&&data.taf&&(data.taf.raw||data.taf.rawText))
    },
    {
      url:type==="metar"?"https://metars.eu/api/metars/"+code:"https://metars.eu/api/tafs/"+code,
      pick:data=>extractWxRaw(data,type)
    }
  ];
  let last=null;
  for(const p of providers){
    try{
      const r=await fetch(p.url,{mode:"cors",cache:"no-store",headers:{Accept:"application/json"}});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const data=await r.json();
      const raw=(p.pick(data)||"").toString().trim();
      if(raw)return raw;
      throw new Error("No "+type.toUpperCase()+" returned");
    }catch(e){last=e}
  }
  throw last||new Error("Weather service unavailable");
}
function showCachedWx(icao,m,t,d){
  showWx(m,t,d,wxCache[icao+":metar"]||"No cached METAR.",wxCache[icao+":taf"]||"No cached TAF.");
}
function showWx(showM,showT,showD,m,t){
  toggle("#metarBlock",showM); toggle("#tafBlock",showT); toggle("#decodedBlock",showD);
  $("#metarText").textContent=m||"No METAR available.";
  $("#tafText").textContent=t||"No TAF available.";
  $("#decodedText").innerHTML="";
  if(showD){
    const pre=document.createElement("pre");
    pre.textContent="METAR\n"+decodeMetar(m)+"\n\nTAF\n"+decodeTaf(t);
    $("#decodedText").appendChild(pre);
  }
}
function decodeMetar(raw){
  if(!raw||raw.startsWith("No cached"))return raw||"No METAR available.";
  const r=raw.split(/\n/).find(Boolean)||raw, tok=r.trim().split(/\s+/), out=[];
  const st=tok.find(x=>/^[A-Z]{4}$/.test(x)); if(st)out.push("Station: "+st);
  const time=tok.find(x=>/^\d{6}Z$/.test(x)); if(time)out.push("Observation: day "+time.slice(0,2)+" at "+time.slice(2,4)+":"+time.slice(4,6)+" UTC");
  const wind=tok.find(x=>/^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(x)); if(wind)out.push("Wind: "+wind);
  const vis=tok.find(x=>x==="CAVOK"||/^\d{4}$/.test(x)); if(vis)out.push("Visibility: "+(vis==="CAVOK"?"CAVOK":vis+" m"));
  const clouds=tok.filter(x=>/^(FEW|SCT|BKN|OVC|VV)\d{3}(CB|TCU)?$/.test(x)); if(clouds.length)out.push("Clouds: "+clouds.join(" • "));
  const td=tok.find(x=>/^M?\d{2}\/M?\d{2}$/.test(x)); if(td)out.push("Temperature / Dew point: "+td.replace(/M/g,"-")+" °C");
  const q=tok.find(x=>/^Q\d{4}$/.test(x)); if(q)out.push("QNH: "+q.slice(1)+" hPa");
  return out.length?out.join("\n"):r;
}
function decodeTaf(raw){
  if(!raw||raw.startsWith("No cached"))return raw||"No TAF available.";
  const clean=raw.replace(/\s+/g," ").trim();
  return clean.replace(/\b(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT\b/g,(m,d,s,g,gnum)=>{
    return "wind "+(d==="VRB"?"variable":d+"°")+" "+s+" kt"+(gnum?" gust "+gnum+" kt":"");
  }).replace(/\bCAVOK\b/g,"visibility CAVOK");
}
function setWxStatus(t){$("#wxStatus").textContent=t}
function toggle(sel,on){$(sel).classList.toggle("hidden",!on)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}


/* ===== Position sources: iOS GPS + X-Plane 11.5 WebSocket bridge ===== */
let activePositionSource=localStorage.getItem("positionSource")||"";
let gpsWatchId=null, bridgeSocket=null, lastPosition=null, lastGpsFix=null;

function positionNumber(v,d=5){return Number.isFinite(v)?Number(v).toFixed(d):"—"}
function updatePositionUi(p,source){
  lastPosition=p;
  const sourceLabel=source==="gps"?"DEVICE GPS":source==="xplane"?"X-PLANE 11.5":"POSITION";
  $("#positionSource").textContent=sourceLabel;
  $("#positionDot").classList.add("live");
  $("#posLat").textContent=positionNumber(p.lat,6);
  $("#posLon").textContent=positionNumber(p.lon,6);
  $("#posAlt").textContent=Number.isFinite(p.alt)?Math.round(p.alt)+" m":"—";
  $("#posHdg").textContent=Number.isFinite(p.heading)?Math.round((p.heading+360)%360)+"°":"—";
  $("#posGs").textContent=Number.isFinite(p.groundspeed)?Math.round(p.groundspeed*1.943844)+" kt":"—";
  $("#posAcc").textContent=Number.isFinite(p.accuracy)?Math.round(p.accuracy)+" m":source==="xplane"?"SIM":"—";
  $("#simStatus").textContent=sourceLabel+" • live";
  const badge=$("#viewerPositionBadge");
  if(badge){badge.textContent=sourceLabel+" LIVE";badge.classList.add("live")}
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  if(source==="gps") $("#useGpsBtn").classList.add("active");
  if(source==="xplane") $("#useXpBtn").classList.add("active");
  updateAircraftMarker();
  window.dispatchEvent(new CustomEvent("jeppiran-position",{detail:p}));
}
function clearPositionUi(message="Disconnected"){
  lastPosition=null;
  $("#positionSource").textContent="No source selected";
  $("#positionDot").classList.remove("live");
  ["#posLat","#posLon","#posAlt","#posHdg","#posGs","#posAcc"].forEach(s=>$(s).textContent="—");
  $("#simStatus").textContent=message;
  const badge=$("#viewerPositionBadge"); if(badge){badge.textContent="";badge.classList.remove("live")}
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  hideAircraftMarker();
  if(!/permission|unavailable|timed out|error/i.test(message))setPositionStatus("off","GPS OFF",message);
}
function stopGps(){
  if(gpsWatchId!==null && navigator.geolocation){navigator.geolocation.clearWatch(gpsWatchId)}
  gpsWatchId=null; lastGpsFix=null;
}
function stopBridge(){
  if(bridgeSocket){try{bridgeSocket.onclose=null;bridgeSocket.close()}catch(e){}}
  bridgeSocket=null;
}
function disconnectPosition(message="Disconnected"){
  stopGps(); stopBridge(); activePositionSource=""; localStorage.removeItem("positionSource"); clearPositionUi(message);
}
function bearingBetween(a,b){
  const r=Math.PI/180, p1=a.lat*r, p2=b.lat*r, dl=(b.lon-a.lon)*r;
  const y=Math.sin(dl)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return (Math.atan2(y,x)/r+360)%360;
}
function startDeviceGps(){
  stopBridge();
  if(!navigator.geolocation){clearPositionUi("Geolocation is not supported by this browser.");return}
  $("#simStatus").textContent="Requesting iOS location permission…";
  activePositionSource="gps"; localStorage.setItem("positionSource","gps");
  setPositionStatus("waiting","GPS WAIT","Requesting browser location permission and waiting for a fix.");
  if(gpsWatchId!==null) stopGps();
  gpsWatchId=navigator.geolocation.watchPosition(pos=>{
    const c=pos.coords;
    let heading=Number.isFinite(c.heading)?c.heading:null;
    const fix={lat:c.latitude,lon:c.longitude,alt:Number.isFinite(c.altitude)?c.altitude:null,
      heading,groundspeed:Number.isFinite(c.speed)?c.speed:null,accuracy:c.accuracy,timestamp:pos.timestamp};
    if(!Number.isFinite(fix.heading) && lastGpsFix){
      const moved=Math.hypot((fix.lat-lastGpsFix.lat)*111000,(fix.lon-lastGpsFix.lon)*111000*Math.cos(fix.lat*Math.PI/180));
      if(moved>4) fix.heading=bearingBetween(lastGpsFix,fix);
    }
    lastGpsFix=fix; updatePositionUi(fix,"gps");
  },err=>{
    const reasons={1:"Location permission denied.",2:"Location unavailable.",3:"Location request timed out."};
    const msg=reasons[err.code]||("GPS error: "+err.message);
    setPositionStatus("error","GPS ERROR",msg);
    clearPositionUi(msg);
  },{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
}
function connectXPlaneBridge(){
  stopGps(); stopBridge();
  const url=$("#bridgeUrl").value.trim();
  if(!/^wss?:\/\//i.test(url)){clearPositionUi("Bridge URL must start with ws:// or wss://");return}
  localStorage.setItem("bridgeUrl",url); activePositionSource="xplane"; localStorage.setItem("positionSource","xplane");
  $("#simStatus").textContent="Connecting to "+url+" …";
  try{bridgeSocket=new WebSocket(url)}catch(e){clearPositionUi("Could not open WebSocket: "+e.message);return}
  bridgeSocket.onopen=()=>{$("#simStatus").textContent="Bridge connected • waiting for X-Plane position…"};
  bridgeSocket.onmessage=e=>{
    try{
      const d=JSON.parse(e.data), lat=Number(d.lat), lon=Number(d.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return;
      updatePositionUi({lat,lon,alt:d.alt==null?null:Number(d.alt),heading:d.heading==null?null:Number(d.heading),
        groundspeed:(d.groundspeed??d.groundSpeedMps)==null?null:Number(d.groundspeed??d.groundSpeedMps),pitch:d.pitch==null?null:Number(d.pitch),roll:d.roll==null?null:Number(d.roll),
        accuracy:null,timestamp:Date.now()},"xplane");
    }catch(_){}
  };
  bridgeSocket.onerror=()=>{$("#simStatus").textContent="Bridge connection error. Check URL/firewall/TLS."};
  bridgeSocket.onclose=()=>{bridgeSocket=null;if(activePositionSource==="xplane")clearPositionUi("X-Plane bridge disconnected.")};
}
$("#useGpsBtn").addEventListener("click",startDeviceGps);
$("#startGpsBtn").addEventListener("click",startDeviceGps);
$("#useXpBtn").addEventListener("click",()=>{$("#bridgeUrl").focus()});
$("#connectBridgeBtn").addEventListener("click",connectXPlaneBridge);
$("#disconnectPositionBtn").addEventListener("click",()=>disconnectPosition());
const savedBridge=localStorage.getItem("bridgeUrl"); if(savedBridge) $("#bridgeUrl").value=savedBridge;
if(activePositionSource==="gps") setTimeout(startDeviceGps,500);
/* ===== End position sources ===== */

window.addEventListener("resize",()=>requestAnimationFrame(()=>{applyChartTransform();updateAircraftMarker()}));
window.addEventListener("orientationchange",()=>setTimeout(()=>{window.dispatchEvent(new Event("resize"));refitSelectedChartForLayout()},180));
if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
loadData();
const start=(location.hash||"#home").slice(1); const initial=["home","charts","wx","simulator"].includes(start)?start:"home"; renderRoute(initial); if(!location.hash)history.replaceState({route:initial},"","#"+initial);