const RAW_ROOT="https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/main/app/src/main/assets/";
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

function route(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  document.body.classList.remove("viewer-fullscreen");
  const el=$("#"+name+"View"); if(el) el.classList.add("active");
  history.replaceState(null,"","#"+name);
}
$$("[data-route]").forEach(b=>b.addEventListener("click",()=>route(b.dataset.route)));

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
    b.innerHTML="<b>"+escapeHtml(icao)+"</b><small>"+escapeHtml(meta[0]+(meta[1]?" • "+meta[1]:""))+"</small>";
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
  $("#openPdfBtn").disabled=true;
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
        b.innerHTML=escapeHtml(number+(c.name||("Chart "+c.page)))+"<small>PDF page "+escapeHtml(String(c.pdf_page||""))+"</small>";
        b.onclick=()=>selectChart(c); wrap.appendChild(b);
      });
    }
    root.appendChild(wrap);
  });
}
function selectChart(c){
  selectedChart=c; expanded.add(c.category||"Other"); renderTree();
  $("#viewerChart").textContent=(c.chart_number?c.chart_number+" • ":"")+(c.name||("Chart "+c.page));
  const info=manifest&&manifest.airports&&manifest.airports[selectedAirport];
  if(!info){dialog("PDF","No PDF URL is available for "+selectedAirport);return}
  const url=info.url+"#page="+encodeURIComponent(c.pdf_page||1)+"&zoom=page-width";
  const frame=document.createElement("iframe");
  frame.title=selectedAirport+" chart";
  frame.src=url;
  $("#pdfStage").replaceChildren(frame);
  $("#openPdfBtn").disabled=false;
  $("#openPdfBtn").onclick=()=>window.open(url,"_blank","noopener");
}
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
    if(!metarOk&&!tafOk){
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
    setWxStatus(icao+(metarOk&&tafOk?" • updated":" • partial update"));
  }finally{$("#getWxBtn").disabled=false}
}
async function fetchWx(type,icao){
  const url="https://aviationweather.gov/api/data/"+type+"?ids="+encodeURIComponent(icao)+"&format=raw";
  const r=await fetch(url,{headers:{Accept:"text/plain"}});
  if(!r.ok) throw new Error("HTTP "+r.status);
  return (await r.text()).trim();
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

window.addEventListener("orientationchange",()=>setTimeout(()=>window.dispatchEvent(new Event("resize")),150));
if("serviceWorker" in navigator) navigator.serviceWorker.register("./service-worker.js").catch(()=>{});
loadData();
const start=(location.hash||"#home").slice(1); route(["home","charts","wx"].includes(start)?start:"home");