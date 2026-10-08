const RAW_ROOT="./data/";
const VERSION="V2620";
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
    const [m,c]=await Promise.all([
      fetch(RAW_ROOT+"charts-manifest.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("manifest");return r.json()}),
      fetch(RAW_ROOT+"charts-current.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("charts");return r.json()})
    ]);
    manifest=m; charts=Array.isArray(c)?c:(c.charts||[]);
    renderAirports();
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
  const list=$("#airportList"); list.innerHTML="";
  const keys=[...new Set(charts.map(c=>c.airport))].sort();
  const q=filter.trim().toUpperCase();
  keys.filter(icao=>{
    const meta=AIRPORTS[icao]||["",""];
    return !q || (icao+" "+meta.join(" ")).toUpperCase().includes(q);
  }).forEach(icao=>{
    const meta=AIRPORTS[icao]||["AIRPORT",""];
    const b=document.createElement("button");
    b.className="airport-item"+(icao===selectedAirport?" selected":"");
    const idx=(keys.indexOf(icao)%20)+1;
    b.style.setProperty("--airport-bg","url('./airport-images/airport_card_"+idx+".webp')");
    b.innerHTML="<span class='airport-shade'></span><span class='airport-copy'><b>"+escapeHtml(icao)+"</b><small>"+escapeHtml(meta[0]+(meta[1]?" • "+meta[1]:""))+"</small></span>";
    b.onclick=()=>selectAirport(icao);
    list.appendChild(b);
  });
}
$("#airportSearch").addEventListener("input",e=>renderAirports(e.target.value));

function selectAirport(icao){
  selectedAirport=icao; selectedChart=null; expanded=new Set(["Airport"]);
  renderAirports($("#airportSearch").value);
  $("#viewerAirport").textContent=icao+" • "+((AIRPORTS[icao]||[])[0]||"AIRPORT");
  $("#viewerChart").textContent="Select a chart";
  $("#treeAirport").textContent=icao;
  $("#pdfStage").innerHTML='<div class="empty-state"><img src="./logo.svg" alt=""><b>Select a chart</b><span>Choose Airport, STAR, SID, Approach or Other below.</span></div>';
  $("#offlinePdfBtn").disabled=true; currentPdfUrl="";
  renderTree();
  if(matchMedia("(orientation:portrait)").matches) $("#chartTreePane").scrollIntoView({behavior:"smooth",block:"end"});
}
function renderTree(){
  const root=$("#chartTree"); root.innerHTML="";
  if(!selectedAirport){root.innerHTML='<div class="status">Select an airport first.</div>';return}
  const airportCharts=charts.filter(c=>c.airport===selectedAirport).sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
  CATEGORY_ORDER.forEach(cat=>{
    const items=airportCharts.filter(c=>(c.category||"Other")===cat);
    if(!items.length)return;
    const wrap=document.createElement("div"); wrap.className="tree-group";
    const h=document.createElement("button"); h.className="tree-group-head";
    h.textContent=(expanded.has(cat)?"▼ ":"▶ ")+cat+" ("+items.length+")";
    h.onclick=()=>{expanded.has(cat)?expanded.delete(cat):expanded.add(cat);renderTree()};
    wrap.appendChild(h);
    if(expanded.has(cat)){
      items.forEach(c=>{
        const b=document.createElement("button");
        b.className="tree-item"+(selectedChart&&selectedChart.page===c.page?" selected":"");
        const number=c.chart_number?c.chart_number+" • ":"";
        b.innerHTML=escapeHtml(number+(c.name||("Chart "+c.page)));
        b.onclick=()=>selectChart(c); wrap.appendChild(b);
      });
    }
    root.appendChild(wrap);
  });
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
  stage.innerHTML='<div class="pdf-loading">Loading chart…</div><div class="pdf-canvas-wrap"><canvas id="pdfCanvas"></canvas></div>';
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
  await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;
  stage.querySelector(".pdf-loading")?.remove();
}
function selectChart(c){
  selectedChart=c; expanded.add(c.category||"Other"); renderTree();
  $("#viewerChart").textContent=(c.chart_number?c.chart_number+" • ":"")+(c.name||("Chart "+c.page));
  renderSelectedPdf(c).catch(e=>{
    $("#pdfStage").innerHTML='<div class="empty-state"><img src="./logo.svg" alt=""><b>Chart unavailable</b><span>'+escapeHtml(e.message)+'</span></div>';
  });
}
$("#offlinePdfBtn").addEventListener("click",async()=>{
  if(!currentPdfUrl)return;
  $("#offlinePdfBtn").disabled=true; $("#offlinePdfBtn").textContent="Saving…";
  try{await getPdfBytes(currentPdfUrl,true);$("#offlinePdfBtn").textContent="Saved Offline"}
  catch(e){$("#offlinePdfBtn").textContent="Save Offline";dialog("Offline chart","Could not save this airport PDF: "+e.message)}
  finally{setTimeout(()=>{$("#offlinePdfBtn").disabled=false;if($("#offlinePdfBtn").textContent==="Saved Offline")$("#offlinePdfBtn").textContent="Save Offline"},1800)}
});
$("#fullscreenBtn").addEventListener("click",async()=>{
  document.body.classList.toggle("viewer-fullscreen");
  if(document.body.classList.contains("viewer-fullscreen") && document.documentElement.requestFullscreen){
    try{await document.documentElement.requestFullscreen()}catch(e){}
  }else if(document.fullscreenElement && document.exitFullscreen){
    try{await document.exitFullscreen()}catch(e){}
  }
});

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
async function fetchWx(type,icao){
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
  badge.textContent=sourceLabel+" LIVE";
  badge.classList.add("live");
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  if(source==="gps") $("#useGpsBtn").classList.add("active");
  if(source==="xplane") $("#useXpBtn").classList.add("active");
  window.dispatchEvent(new CustomEvent("jeppiran-position",{detail:p}));
}
function clearPositionUi(message="Disconnected"){
  lastPosition=null;
  $("#positionSource").textContent="No source selected";
  $("#positionDot").classList.remove("live");
  ["#posLat","#posLon","#posAlt","#posHdg","#posGs","#posAcc"].forEach(s=>$(s).textContent="—");
  $("#simStatus").textContent=message;
  const badge=$("#viewerPositionBadge"); badge.textContent="GPS/SIM OFF"; badge.classList.remove("live");
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
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
    clearPositionUi(reasons[err.code]||("GPS error: "+err.message));
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

window.addEventListener("orientationchange",()=>setTimeout(()=>window.dispatchEvent(new Event("resize")),150));
if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
loadData();
const start=(location.hash||"#home").slice(1); const initial=["home","charts","wx","simulator"].includes(start)?start:"home"; renderRoute(initial); if(!location.hash)history.replaceState({route:initial},"","#"+initial);