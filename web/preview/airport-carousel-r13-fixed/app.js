/* JeppIran V2621 — isolated airport-carousel-r13 fresh-cache Carousel preview.
 * No changes to source airport assets, PDF pages, georeferencing or main app.
 * Display-only. Aviation weather must come from a real METAR, never mock data.
 */
(()=>{
"use strict";
const ROOT="../../";
const WX_CACHE_URL="https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/wx-cache/wx-live.json";
const WX_CACHE_API="https://api.github.com/repos/mahmet737ng-gif/JeppIran/contents/wx-live.json?ref=wx-cache";
const fallbackIata=Object.freeze({OIII:"THR",OIIE:"IKA",OIMM:"MHD",OISS:"SYZ",OIFM:"IFN",OIKB:"BND",OITT:"TBZ",OIAW:"AWZ",OIBK:"KIH",OICC:"KSH",OIYY:"AZD",OIBB:"BUZ",OIMB:"XBJ",OIAW:"AWZ",OITR:"OMH",OIHH:"HDM",OIAA:"ABD",OIBA:"AEU",OIBP:"PGU",OIMN:"BJB",OING:"GBT",OIHR:"AJK",OISL:"LRR",OIKK:"KER",OIGG:"RAS",OIMS:"AFZ",OISY:"YES",OIZH:"ZAH",OITL:"ADU",OITZ:"JWN",OIKY:"SYJ",OICK:"KHD",OIKM:"BXR",OITM:"ACP",OIZC:"ZBR",OIMT:"TCX",OIPK:"PYK",OISR:"LFM",OITU:"IMQ",LTFM:"IST",LTAC:"ESB",OMDB:"DXB",OMDW:"DWC",OOMS:"MCT",ORBI:"BGW",ORER:"EBL",ORMM:"BSR",ORNI:"NJF",OTHH:"DOH",UGTB:"TBS",UGSB:"BUS",UDYZ:"EVN",OPIS:"ISB",OPKC:"KHI"});
const fallbackNames={OIII:["Mehrabad International Airport","Tehran, Iran",3962],OIIE:["Imam Khomeini International Airport","Tehran, Iran",3305],OIMM:["Mashhad International Airport","Mashhad, Iran",3263]};
const $=sel=>document.querySelector(sel);
const el={carousel:$("#airportCarousel"),track:$("#carouselTrack"),name:$("#airportName"),place:$("#airportPlace"),scenery:$("#scenery"),category:$("#flightCategory"),dot:$("#flightDot"),clouds:$("#clouds"),temp:$("#temperature"),wind:$("#wind"),qnh:$("#qnh"),weatherStatus:$("#weatherStatus"),search:$("#airportSearch"),results:$("#searchResults")};
// Shipped full V2621 manifest set: 78 airports available before any network request.
const BUILTIN_AIRPORT_CODES=Object.freeze(["LTAC","LTFM","OIAA","OIAM","OIAW","OIBA","OIBB","OIBK","OIBL","OIBP","OIBQ","OIBS","OIBV","OICC","OICI","OICK","OICS","OICZ","OIFE","OIFM","OIFP","OIFS","OIGG","OIHH","OIHR","OIIE","OIII","OIIP","OIKB","OIKJ","OIKK","OIKM","OIKQ","OIKR","OIKY","OIMB","OIMJ","OIMM","OIMN","OIMS","OIMT","OINE","OING","OINN","OINR","OINZ","OISF","OISL","OISR","OISS","OISY","OITK","OITL","OITM","OITR","OITT","OITU","OITZ","OIYY","OIZB","OIZC","OIZH","OIZI","OIZS","OMDB","OMDW","OOMS","OPIS","OPKC","ORBI","ORER","ORMM","ORNI","ORSJ","OTHH","UDYZ","UGSB","UGTB"]);
let codes=[...BUILTIN_AIRPORT_CODES], metadata={},selected=BUILTIN_AIRPORT_CODES.indexOf("OIII"),visualPos=selected,raf=0,animationToken=0,gesture=null;
const carouselButtons=new Map();
let chartManifest=null,charts=null,wxCache=null,wxCacheAt=0,metarRequest=0;
let chartCatalogPromise=null,activeChartCategory=null,chartSheetToken=0,activeChartRows=[];
let chartVisualPos=0,chartSelected=0,chartFrame=0,chartToken=0,chartGesture=null,chartSearchRows=[];
let previewQueuedIndex=-1,previewSelectionFrame=0;
const chartButtons=new Map();
const wrap=i=>(i%codes.length+codes.length)%codes.length;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const getCode=i=>codes[wrap(i)];
const APPROVED_AIRPORT_NAMES=Object.freeze({
  ORBI:"Baghdad International Airport",
  OIAW:"Ahwaz International Airport"
});
const getProfile=code=>{
  const data=metadata[code]||{};
  return APPROVED_AIRPORT_NAMES[code]?{...data,name:APPROVED_AIRPORT_NAMES[code]}:data;
};
const current=()=>getCode(selected);
const slotStep=()=>el.carousel.clientWidth/(innerWidth<=690?6.35:innerWidth<=1040?8.1:10.25);
const visibleRadius=()=>innerWidth<=690?2:innerWidth<=1040?3:4;
function preferredIndex(code){return codes.indexOf(code)}
// Every airport button is created once. Continuous interpolation updates only its
// transform, font size and opacity — never replace DOM nodes mid-gesture.
const wrappedDelta=(index,position)=>{
  const n=codes.length;
  return ((index-position+n/2)%n+n)%n-n/2;
};
const smoothstep=t=>t*t*(3-2*t);
let suppressTapUntil=0;
let displayedProfileCode="",profileMetarTimer=0;
const profilePanel=$(".selected-airport");
// Weather is fetched only after the carousel has settled; transient airports
// still update their name, city, elevation and approved imagery immediately.
function planProfileWeather(code){
  clearTimeout(profileMetarTimer);
  ++metarRequest;
  profileMetarTimer=setTimeout(()=>{
    if(displayedProfileCode===code&&!document.body.classList.contains("has-chart-preview")&&
       !document.body.classList.contains("chart-selected")){
      void updateMetar(code);
    }
  },380);
}
function renderAirportProfile(code,force=false){
  if(!force&&code===displayedProfileCode)return;
  displayedProfileCode=code;
  const d=getProfile(code),fallback=fallbackNames[code];
  el.name.textContent=d.name||fallback?.[0]||code+" Airport";
  const city=d.city||fallback?.[1]?.split(",")[0]||"";
  const country=d.country||fallback?.[1]?.split(",").slice(1).join(",").trim()||"";
  const elevation=Number.isFinite(d.elevation)?d.elevation:fallback?.[2];
  el.place.textContent=(city&&country?city+", "+country:city||country||"Location unavailable")+
    "  │  Elevation "+(Number.isFinite(elevation)?elevation.toLocaleString("en-US")+" ft":"unavailable");
  profilePanel.dataset.profileAirport=code;
  updateImage(code);
  resetWeather();
  planProfileWeather(code);
}
function beginAirportBrowsing(){
  if(activeChartCategory)closeProcedureCategory();
  else if(document.body.classList.contains("has-chart-preview")||
          document.body.classList.contains("chart-selected"))hideInlineChart();
}
function makeAirportButton(index){
  const code=getCode(index),data=getProfile(code),button=document.createElement("button");
  button.type="button";button.className="airport-token";
  button.dataset.airport=code;
  button.setAttribute("aria-label",code+" "+(data.iata||fallbackIata[code]||"")+" "+(data.name||""));
  button.tabIndex=-1;
  const icao=document.createElement("span"),iata=document.createElement("span");
  icao.className="icao";iata.className="iata";
  icao.textContent=code;iata.textContent=data.iata||fallbackIata[code]||"—";
  button.append(icao,iata);
  button.addEventListener("click",()=>{
    if(gesture?.moved||performance.now()<suppressTapUntil)return;
    centerOn(index,true);
  });
  return button;
}
function buildTrack(){
  carouselButtons.clear();
  const fragment=document.createDocumentFragment();
  for(let i=0;i<codes.length;i++){
    const button=makeAirportButton(i);
    carouselButtons.set(i,button);
    fragment.append(button);
  }
  el.track.replaceChildren(fragment);
}
function paintTrack(){
  const radius=visibleRadius(),step=slotStep();
  const compact=innerWidth<=690;
  const mid=wrap(Math.round(visualPos));
  for(const [index,button] of carouselButtons){
    const d=wrappedDelta(index,visualPos),distance=Math.abs(d);
    const visible=distance<=radius+1.2;
    button.style.visibility=visible?"visible":"hidden";
    button.style.pointerEvents=visible?"auto":"none";
    button.tabIndex=visible?0:-1;
    if(!visible)continue;
    const focus=smoothstep(clamp(1-distance/1.12,0,1));
    const opacity=distance<.45?1:clamp(1-Math.max(0,distance-.5)*.17,.24,1);
    button.style.setProperty("--slot-width",(step*1.28).toFixed(2)+"px");
    button.style.setProperty("--shift",(d*step).toFixed(3)+"px");
    button.style.setProperty("--scale","1");
    button.style.setProperty("--opacity",opacity.toFixed(3));
    button.style.setProperty("--icao-size",((compact?13:17)+(compact?14:23)*focus).toFixed(2)+"px");
    button.style.setProperty("--iata-size",((compact?9:10)+(compact?5:8)*focus).toFixed(2)+"px");
    button.style.setProperty("--guide-opacity",focus.toFixed(3));
    button.style.zIndex=String(100-Math.floor(distance*10));
    const active=index===mid;
    button.classList.toggle("active",active);
    if(active)button.setAttribute("aria-current","true");
    else button.removeAttribute("aria-current");
  }
  // Render the profile of whichever ICAO is passing through the center,
  // not merely the final snap destination.
  renderAirportProfile(getCode(mid));
}
function resetWeather(){
  el.category.textContent="WX —";el.category.className="flight-category unknown";
  el.dot.className="flight-dot unknown";el.clouds.textContent="—";el.temp.textContent="—";
  el.wind.textContent="— / — kt";el.qnh.textContent="QNH —";
  el.weatherStatus.textContent="Checking available METAR…";
}
function artwork(code){return `${ROOT}airport-profile-posters-v3/${code}.webp`}
const posterImages=new Map();
function preloadPoster(code){
  if(posterImages.has(code))return;
  const img=new Image();
  img.decoding="async";img.src=artwork(code);
  posterImages.set(code,img);
  while(posterImages.size>12)posterImages.delete(posterImages.keys().next().value);
}
function updateImage(code){
  // The previous onload callback discarded the poster for airports crossed
  // during an animated swipe. Update the CSS target immediately, then the
  // browser can load the source-approved image without a race.
  el.scenery.dataset.airport=code;
  el.scenery.style.setProperty("background-image",`url("${artwork(code)}")`,"important");
  const index=codes.indexOf(code);
  if(index>=0)for(const off of [-2,-1,1,2])preloadPoster(codes[wrap(index+off)]);
}
function updateSelected(){
  renderAirportProfile(current());
  // A profile can reach center before selected changes when a swipe is underway.
  // Recheck its METAR once its ICAO becomes the committed selection.
  if(displayedProfileCode===current()&&
     el.weatherStatus.textContent==="Checking available METAR…")planProfileWeather(current());
  if(activeChartCategory)void refreshProcedureCategory(activeChartCategory);
}
function stopAnimation(){animationToken++;if(raf)cancelAnimationFrame(raf);raf=0;}
function commitPosition(target){
  const next=wrap(Math.round(target)),changed=selected!==next;
  if(changed)beginAirportBrowsing();
  visualPos=next;selected=next;
  paintTrack();
  if(changed)updateSelected();
}
// Animated easing runs on an unwrapped floating airport index. This avoids
// discrete index switches halfway through an animation (the old "name jump").
function animateTo(target,duration){
  stopAnimation();
  const origin=visualPos,begin=performance.now(),token=animationToken;
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(reduced){commitPosition(target);return;}
  const distance=Math.abs(target-origin);
  if(distance>.01)beginAirportBrowsing();
  const ms=duration??clamp(210+distance*67,225,720);
  function frame(t){
    if(token!==animationToken)return;
    const p=clamp((t-begin)/ms,0,1);
    const ease=1-Math.pow(1-p,3);
    visualPos=origin+(target-origin)*ease;
    paintTrack();
    if(p<1)raf=requestAnimationFrame(frame);
    else {raf=0;commitPosition(target);}
  }
  raf=requestAnimationFrame(frame);
}
function centerOn(target,animated){
  const index=wrap(target);
  const delta=wrappedDelta(index,visualPos);
  if(animated)animateTo(visualPos+delta);
  else {stopAnimation();if(Math.abs(delta)>.01)beginAirportBrowsing();commitPosition(index);}
}
function changeBy(steps){
  if(!Number.isFinite(steps)||!steps)return;
  animateTo(visualPos+clamp(Math.round(steps),-8,8));
}
// Finger tracks the text one-for-one; a fast flick adds a bounded, damped glide
// and the stop always snaps to a real airport position.
function pointerDown(e){
  if(e.button!==0&&e.pointerType==="mouse")return;
  if(gesture)return;
  stopAnimation();
  const now=performance.now();
  gesture={id:e.pointerId,startX:e.clientX,startPos:visualPos,
    history:[{x:e.clientX,t:now}],moved:false};
  el.carousel.classList.add("dragging");
  // Leave native button click intact; capture only after an actual swipe.
}
function pointerMove(e){
  if(!gesture||gesture.id!==e.pointerId)return;
  const dx=e.clientX-gesture.startX;
  if(Math.abs(dx)>5&&!gesture.moved){
    gesture.moved=true;
    beginAirportBrowsing();
    try{el.carousel.setPointerCapture(e.pointerId)}catch(_){}
  }
  if(!gesture.moved)return;
  const now=performance.now();
  gesture.history.push({x:e.clientX,t:now});
  gesture.history=gesture.history.filter(item=>now-item.t<=120);
  visualPos=gesture.startPos-dx/slotStep();
  paintTrack();
}
function pointerUp(e){
  if(!gesture||gesture.id!==e.pointerId)return;
  const info=gesture;
  gesture=null;
  el.carousel.classList.remove("dragging");
  if(info.moved){try{el.carousel.releasePointerCapture(e.pointerId)}catch(_){}}
  if(!info.moved){
    animateTo(Math.round(visualPos),200);
    return;
  }
  suppressTapUntil=performance.now()+240;
  const now=performance.now();
  const points=info.history.filter(p=>now-p.t<=115);
  const first=points[0]||{x:info.startX,t:now};
  const last=points[points.length-1]||first;
  const velocity=(last.x-first.x)/Math.max(15,last.t-first.t);
  const projected=clamp(-velocity*240/slotStep(),-5.5,5.5);
  const target=Math.round(visualPos+projected);
  animateTo(target,clamp(215+Math.abs(target-visualPos)*70,220,690));
}
el.carousel.addEventListener("pointerdown",pointerDown);
el.carousel.addEventListener("pointermove",pointerMove);
el.carousel.addEventListener("pointerup",pointerUp);
el.carousel.addEventListener("pointercancel",()=>{
  gesture=null;el.carousel.classList.remove("dragging");
  animateTo(Math.round(visualPos),230);
});
el.carousel.addEventListener("dragstart",e=>e.preventDefault());
el.carousel.addEventListener("wheel",e=>{
  if(Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey){
    e.preventDefault();
    const delta=e.deltaX||e.deltaY;
    changeBy(Math.sign(delta)*clamp(Math.round(Math.abs(delta)/85),1,4));
  }
},{passive:false});
el.carousel.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
    e.preventDefault();changeBy(e.key==="ArrowRight"?1:-1);
  }else if(e.key==="Home"){
    e.preventDefault();centerOn(0,true);
  }else if(e.key==="End"){
    e.preventDefault();centerOn(codes.length-1,true);
  }
});
$("#prevAirport").addEventListener("click",()=>changeBy(-1));
$("#nextAirport").addEventListener("click",()=>changeBy(1));
window.addEventListener("resize",()=>paintTrack(),{passive:true});
function showResults(){
 const value=el.search.value.trim().toUpperCase();el.results.replaceChildren();
 if(!value){el.results.hidden=true;return;}
 const matchRank=code=>{
   const icao=code.toUpperCase(),iata=String(getProfile(code).iata||fallbackIata[code]||"").toUpperCase();
   const name=String(getProfile(code).name||"").toUpperCase();
   if(icao===value||iata===value)return 0;
   if(icao.startsWith(value))return 1;
   if(iata.startsWith(value))return 2;
   if(name.startsWith(value))return 3;
   if(icao.includes(value)||iata.includes(value))return 4;
   return 5;
 };
 const matches=codes.filter(c=>c.includes(value)||String(getProfile(c).iata||fallbackIata[c]||"").toUpperCase().includes(value)||String(getProfile(c).name||"").toUpperCase().includes(value))
   .sort((a,b)=>matchRank(a)-matchRank(b)||preferredIndex(a)-preferredIndex(b));
 if(!matches.length){el.results.hidden=true;return;}
 // Each letter centers the strongest match in the airport wheel.
 centerOn(preferredIndex(matches[0]),true);
 for(const code of matches){const b=document.createElement("button");b.type="button";const label=document.createElement("b"),small=document.createElement("small");label.textContent=code+" · "+(getProfile(code).iata||fallbackIata[code]||"—");small.textContent=getProfile(code).name||"Airport";b.append(label,small);b.onclick=()=>{centerOn(preferredIndex(code),false);el.search.value="";el.results.hidden=true;el.carousel.focus()};el.results.append(b)}
 el.results.hidden=false;
}
el.search.addEventListener("input",showResults);
el.search.addEventListener("keydown",e=>{if(e.key==="Escape")el.results.hidden=true;else if(e.key==="Enter"&&!el.results.hidden){e.preventDefault();el.results.querySelector("button")?.click()}});
document.addEventListener("click",e=>{if(!e.target.closest(".search-box"))el.results.hidden=true});
function normalizeRaw(row){const s=typeof row==="string"?row:row?.raw||row?.rawText||row?.rawOb||"";return String(s||"").trim()}
async function readSourceMetar(code){
 // Batch fetched at startup holds all 78 ICAOs. No repeated full-file fetch
 // on each intermediate airport while swiping the Carousel.
 const pre=window.JEPPIRAN_AIRPORT_PREFETCH;
 if(pre){
  try{
   // A cached result wins immediately; don't block rendering on a
   // revalidation request against GitHub that might take 12 seconds.
   const all=pre.get("metar")||await Promise.race([
     pre.ready("metar"),new Promise(resolve=>setTimeout(()=>resolve(null),1700))
   ]);
   if(all?.stations){wxCache=all;wxCacheAt=Date.now()}
  }catch(_){}
 }
 if(!wxCache||Date.now()-wxCacheAt>1000*60){
  try{const res=await fetch(WX_CACHE_URL+"?t="+Math.floor(Date.now()/300000),{cache:"no-store",mode:"cors"});if(!res.ok)throw Error("Weather cache offline");wxCache=await res.json();wxCacheAt=Date.now();}
  catch(_){try{const r=await fetch(WX_CACHE_API+"&t="+Math.floor(Date.now()/300000),{mode:"cors",cache:"no-store"});if(r.ok){const doc=await r.json();wxCache=JSON.parse(atob(String(doc.content).replace(/\s+/g,"")));wxCacheAt=Date.now()}}catch(_){}}
 }
 const cached=normalizeRaw(wxCache?.stations?.[code]?.metar);
 if(cached)return {raw:cached,source:"JeppIran cached METAR"};
 const attempts=[
  {url:"https://rotatepilot.com/api/v1/metar?icao="+encodeURIComponent(code)+"&taf=1",pick:d=>d?.raw},
  {url:"https://metars.eu/api/metars/"+encodeURIComponent(code),pick:d=>d?.raw||d?.rawText||d?.data?.raw||d?.data?.rawText||d?.data?.[0]?.raw}
 ];
 for(const a of attempts){try{const r=await fetch(a.url,{mode:"cors",cache:"no-store"});if(!r.ok)continue;const json=await r.json();const raw=normalizeRaw(a.pick(json));if(raw)return {raw,source:"Live METAR provider"};}catch(_){}}
 throw Error("METAR unavailable");
}
function decode(raw){
 const tokens=raw.toUpperCase().trim().split(/\s+/),base=tokens.slice(0,Math.max(0,tokens.findIndex(x=>/^(?:RMK|NOSIG|TEMPO|BECMG)$/.test(x)))||undefined); // current observation only
 const arr=base.length?base:tokens;
 const cloud=arr.find(t=>/^(FEW|SCT|BKN|OVC|VV)\d{3}(?:CB|TCU)?$/.test(t))|| (arr.includes("CAVOK")?"CAVOK":arr.includes("SKC")?"SKC":"—");
 const temp=arr.find(t=>/^M?\d{2}\/M?\d{2}$/.test(t));
 const tval=temp?temp.split("/")[0].replace(/^M/,"-")+"°C":"—";
 const wind=arr.find(t=>/^(?:\d{3}|VRB)\d{2,3}(?:G\d{2,3})?KT$/.test(t));
 const match=wind?.match(/^(\d{3}|VRB)(\d{2,3})(?:G(\d{2,3}))?KT$/);
 const w=match?(match[1]==="VRB"?"VRB":String(Number(match[1])).padStart(3,"0")+"°")+" / "+Number(match[2])+" kt"+(match[3]?" G"+Number(match[3]):""):"— / — kt";
 const pressure=arr.find(t=>/^Q\d{4}$/.test(t)||/^A\d{4}$/.test(t));
 const qnh=pressure?.startsWith("Q")?"QNH "+pressure.slice(1)+" hPa":pressure?.startsWith("A")?"QNH "+(Number(pressure.slice(1))/100).toFixed(2)+" inHg":"QNH —";
 return {cloud,tval,wind:w,qnh};
}
async function updateMetar(code){
 const req=++metarRequest;
 try{const {raw}=await readSourceMetar(code);
  if(req!==metarRequest||displayedProfileCode!==code||
    document.body.classList.contains("has-chart-preview")||
    document.body.classList.contains("chart-selected"))return;
  const d=decode(raw);
  const category=window.JEPPIRAN_FLIGHT_CATEGORY?.classify(raw)?.code||"UNKNOWN",key=category.toLowerCase();
  el.category.textContent=category==="UNKNOWN"?"WX —":category;
  el.category.className="flight-category "+key;
  el.dot.className="flight-dot "+key;
  el.clouds.textContent=d.cloud;el.temp.textContent=d.tval;el.wind.textContent=d.wind;el.qnh.textContent=d.qnh;
  // The airport profile displays the actual METAR report, not a source/advisory message.
  el.weatherStatus.textContent=raw;
 }catch(_){if(req!==metarRequest||displayedProfileCode!==code)return;el.weatherStatus.textContent="METAR unavailable — no weather values invented";}
}
/* PREVIEW-ONLY CHART DOCK — STAR / SID / AIRPORT / APP.
 * Source stays V2621, every href resolves to the existing airport PDF's
 * precise published page. Do not mutate the original JeppIran chart viewer.
 */

/* R3: two-level airplane/chart selector. Category tabs appear directly under
 * active ICAO. Each tab expands a velocity-sensitive, horizontally draggable
 * carousel containing the actual V2621 chart titles (not mock data).
 */
const categoryMap=Object.freeze({STAR:"STAR",SID:"SID",AIRPORT:"AIRPORT",APP:"APPROACH"});
const procSection=$("#procedureDetails");
const procTrack=$("#procedureTrack");
const procWheel=$("#procedureWheel");
const chartWrap=n=>(n%chartSearchRows.length+chartSearchRows.length)%chartSearchRows.length;
function validProcedure(item){
  const source=chartManifest?.airports?.[item.airport];
  const page=Number(item.pdf_page);
  return Boolean(source&&page>0&&Number(source.global_pages?.[page-1])===Number(item.page));
}
function chartLink(item){
  if(!validProcedure(item))return "";
  const source=chartManifest.airports[item.airport];
  return ROOT+"charts/"+encodeURIComponent(source.file||item.airport+".pdf")+"#page="+Number(item.pdf_page);
}
function clearChartAnimation(){chartToken++;if(chartFrame)cancelAnimationFrame(chartFrame);chartFrame=0}
function clearChartButtons(){clearChartAnimation();if(previewSelectionFrame)cancelAnimationFrame(previewSelectionFrame);previewSelectionFrame=0;previewQueuedIndex=-1;chartButtons.clear();procTrack.replaceChildren();}
function closeProcedureCategory(){
  activeChartCategory=null;chartSheetToken++;
  clearChartButtons();chartGesture=null;
  procSection.classList.remove("open");
  procSection.setAttribute("aria-hidden","true");
  procSection.inert=true;
  document.body.classList.remove("category-open");
  // A collapsed STAR/SID/AIRPORT/APP rail must return to four adjacent tabs.
  // Preserve chart positions without carrying over any horizontal scroll gap.
  document.querySelectorAll(".category-shell").forEach(el=>el.classList.remove("active"));
  const categoryRail=document.querySelector(".procedure-categories");
  if(categoryRail){categoryRail.scrollLeft=0;requestAnimationFrame(()=>{if(!activeChartCategory)categoryRail.scrollLeft=0;});}
  document.querySelectorAll(".procedure-category").forEach(el=>{
    el.classList.remove("active");el.setAttribute("aria-expanded","false");
  });
  hideInlineChart();
}
function chartDelta(index,pos){
  const n=chartSearchRows.length;
  return n?((index-pos+n/2)%n+n)%n-n/2:0;
}
function chartWidth(){
  const wide=innerWidth>=900&&matchMedia("(orientation:landscape)").matches;
  // A nested chart body can be zero-width during its first layout pass.
  // The safe fallback and ResizeObserver below prevent invisible 0px tokens.
  const width=procWheel.clientWidth||procWheel.parentElement?.clientWidth||240;
  return Math.max(76,width/(wide?(innerWidth<1200?2.35:2.7):(innerWidth<=690?2.15:innerWidth<=1040?2.85:3.6)));
}
function buildProcedureWheel(){
  chartButtons.clear();
  const nodes=document.createDocumentFragment();
  for(let i=0;i<chartSearchRows.length;i++){
    const item=chartSearchRows[i],button=document.createElement("button");
    button.type="button";button.className="procedure-token";button.dataset.chartPage=String(item.page);
    button.setAttribute("aria-label",(item.chart_number||"")+" "+(item.name||""));
    const num=document.createElement("span"),title=document.createElement("span");
    num.className="procedure-number";title.className="procedure-title";
    num.textContent=item.chart_number||"—";title.textContent=item.name||"Chart "+item.page;
    button.append(num,title);
    button.addEventListener("click",()=>{
      if(chartGesture?.moved||performance.now()<chartSuppressTap)return;
      if(i!==chartSelected||Math.abs(chartVisualPos-chartSelected)>.01)centerProcedure(i,false);
      // A deliberate tap opens Classic; wheel movement alone stays a lightweight preview.
      void showInlineChart(item);
    });
    chartButtons.set(i,button);
    nodes.append(button);
  }
  procTrack.replaceChildren(nodes);
}
let chartSuppressTap=0;
function paintProcedureWheel(){
  const step=chartWidth(),radius=innerWidth<=690?1.5:2.1;
  const n=chartSearchRows.length;
  if(!n)return;
  const active=Math.round(chartVisualPos),activeIdx=chartWrap(active);
  for(const [index,button] of chartButtons){
    const delta=chartDelta(index,chartVisualPos),d=Math.abs(delta);
    const visible=d<=radius+.5;
    button.style.visibility=visible?"visible":"hidden";
    button.style.pointerEvents=visible?"auto":"none";
    button.tabIndex=visible?0:-1;
    if(!visible)continue;
    const focus=smoothstep(clamp(1-d/1.15,0,1));
    button.style.setProperty("--procedure-x",(delta*step).toFixed(2)+"px");
    button.style.setProperty("--procedure-w",(step*(innerWidth>=900&&matchMedia("(orientation:landscape)").matches?1.03:1.23)).toFixed(2)+"px");
    button.style.setProperty("--procedure-scale",(0.83+focus*.17).toFixed(3));
    button.style.setProperty("--procedure-opacity",clamp(1-Math.max(0,d-.4)*.28,.26,1).toFixed(3));
    button.style.setProperty("--procedure-title-size",(innerWidth>=900&&matchMedia("(orientation:landscape)").matches?13+focus*1.5:9+focus*(innerWidth<=690?1:2)).toFixed(2)+"px");
    button.style.zIndex=String(20-Math.floor(d*5));
    const on=index===activeIdx;
    button.classList.toggle("active",on);
    if(on)button.setAttribute("aria-current","true");
    else button.removeAttribute("aria-current");
  }
  // While swiping, update only a compact PDF thumbnail; never open Classic automatically.
  queueFocusedChart(activeIdx);
}
function commitProcedure(pos){
  chartSelected=chartWrap(Math.round(pos));
  chartVisualPos=chartSelected;
  paintProcedureWheel();
}
function glideProcedure(pos,duration){
  clearChartAnimation();
  const origin=chartVisualPos,token=chartToken,begin=performance.now();
  const reduced=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(reduced){commitProcedure(pos);return}
  const length=duration??clamp(200+Math.abs(pos-origin)*80,215,720);
  function frame(now){
    if(token!==chartToken)return;
    const t=clamp((now-begin)/length,0,1);
    chartVisualPos=origin+(pos-origin)*(1-Math.pow(1-t,3));
    paintProcedureWheel();
    if(t<1)chartFrame=requestAnimationFrame(frame);
    else{chartFrame=0;commitProcedure(pos);}
  }
  chartFrame=requestAnimationFrame(frame);
}
function centerProcedure(index,animate){
  if(!chartSearchRows.length)return;
  const delta=chartDelta(index,chartVisualPos);
  if(animate)glideProcedure(chartVisualPos+delta);
  else{clearChartAnimation();commitProcedure(index);}
}
function moveProcedure(direction){
  if(!chartSearchRows.length)return;
  // A deliberate navigation gesture exits full Classic to lightweight browsing.
  if(document.body.classList.contains("chart-selected"))hideInlineChart();
  glideProcedure(chartVisualPos+direction);
}
function displayProcedureRows(rows){
  chartSearchRows=rows.filter(validProcedure);
  $("#procedureCount").textContent=chartSearchRows.length+" chart"+(chartSearchRows.length===1?"":"s")+" · "+current()+" · "+activeChartCategory;
  chartSelected=0;chartVisualPos=0;
  clearChartButtons();
  buildProcedureWheel();paintProcedureWheel();
  const empty=$("#procedureEmpty");
  if(empty)empty.remove();
  if(!chartSearchRows.length){
    const status=document.createElement("div");
    status.id="procedureEmpty";status.className="procedure-empty";
    status.textContent=activeChartRows.length?
      "No matching charts in this category.":"No published charts in this category.";
    procTrack.append(status);
    showMiniChart(null);
  }else {
    paintProcedureWheel();
    queueFocusedChart(chartSelected,true);
    // Re-measure once the category body has expanded (especially on Safari).
    requestAnimationFrame(()=>{if(activeChartCategory&&chartSearchRows.length)paintProcedureWheel()});
  }
}
function filterProcedureRows(){
  const q=$("#procedureSearch").value.trim().toUpperCase();
  displayProcedureRows(activeChartRows.filter(c=>(
    String(c.chart_number||"")+" "+String(c.name||"")).toUpperCase().includes(q)));
}
async function loadPublishedCharts(){
  if(chartManifest&&charts)return [chartManifest,charts];
  if(!chartCatalogPromise){
    chartCatalogPromise=Promise.all([
      chartManifest?Promise.resolve(chartManifest):fetchJsonTimed(ROOT+"data/charts-manifest.json?carousel=r13",14000),
      fetchJsonTimed(ROOT+"data/charts-current.json?carousel=r13",14000),
      fetchJsonTimed(ROOT+"data/chart-briefing-titles-v2621.json",14000).catch(()=>null)
    ]).then(([m,c,brief])=>{
      if(!m?.airports||!Array.isArray(c))throw Error("Chart index is incomplete");
      if(brief?.cycle==="2621")for(const item of c){
        const label=brief.pages?.[String(item.page)];
        if(label?.icao===item.airport&&label.chart_number===item.chart_number&&label.name)
          item.name=label.name;
      }
      chartManifest=m;charts=c;return [m,c];
    }).catch(error=>{chartCatalogPromise=null;throw error});
  }
  return chartCatalogPromise;
}
async function refreshProcedureCategory(category){
  if(!activeChartCategory||activeChartCategory!==category)return;
  if(document.body.classList.contains("chart-selected"))hideInlineChart();
  const request=++chartSheetToken,code=current();
  clearChartButtons();
  chartSearchRows=[];activeChartRows=[];
  $("#procedureCount").textContent="Loading "+category+" charts · "+code+"…";
  // The narrow rail previously looked empty while its async chart index loaded.
  const loading=document.createElement("div");
  loading.id="procedureEmpty";loading.className="procedure-empty";
  loading.textContent="Loading "+category+" charts…";
  procTrack.replaceChildren(loading);
  try{
    const [,all]=await loadPublishedCharts();
    if(request!==chartSheetToken||activeChartCategory!==category||current()!==code)return;
    activeChartRows=all.filter(c=>c.airport===code&&
      String(c.category||"").toUpperCase()===categoryMap[category])
      .sort((a,b)=>Number(a.page)-Number(b.page));
    filterProcedureRows();
  }catch(error){
    if(request!==chartSheetToken||activeChartCategory!==category)return;
    $("#procedureCount").textContent="Charts unavailable";
    procTrack.replaceChildren();
    const status=document.createElement("div");
    status.className="procedure-empty";status.textContent="Unable to load V2621 charts: "+error.message;
    procTrack.append(status);
    showMiniChart(null);
  }
}
function toggleProcedureCategory(category){
  if(!(category in categoryMap))return;
  if(activeChartCategory===category){closeProcedureCategory();return;}
  activeChartCategory=category;
  const shell=document.querySelector('.category-shell[data-category="'+category+'"]');
  if(!shell)return;
  shell.querySelector(".category-body").append(procSection);
  procSection.inert=false;procSection.classList.add("open");
  procSection.setAttribute("aria-hidden","false");
  document.body.classList.add("category-open");
  // Always start the expanded rail at its actual selected category.
  // No stale scroll offset after switching away from a chart or using Back.
  const categoryRail=document.querySelector(".procedure-categories");
  if(categoryRail)categoryRail.scrollLeft=0;
  // Original Classic viewer mounts after the first valid chart selection.
  $("#procedureSearch").value="";
  document.querySelectorAll(".category-shell").forEach(el=>el.classList.toggle("active",el===shell));
  document.querySelectorAll(".procedure-category").forEach(el=>{
    const on=el.dataset.category===category;
    el.classList.toggle("active",on);
    el.setAttribute("aria-expanded",String(on));
  });
  hideInlineChart();
  void refreshProcedureCategory(category);
  requestAnimationFrame(()=>{if(activeChartCategory===category)paintProcedureWheel()});
}
document.querySelectorAll(".procedure-category").forEach(b=>
  b.addEventListener("click",()=>toggleProcedureCategory(b.dataset.category)));
$("#collapseProcedure").addEventListener("click",closeProcedureCategory);
$("#procedureSearch").addEventListener("input",filterProcedureRows);
$("#procedurePrev").addEventListener("click",()=>moveProcedure(-1));
$("#procedureNext").addEventListener("click",()=>moveProcedure(1));
procWheel.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){
    e.preventDefault();moveProcedure(e.key==="ArrowLeft"?-1:1);
  }
});
procWheel.addEventListener("pointerdown",e=>{
  if(!chartSearchRows.length||chartGesture)return;
  if(e.button!==0&&e.pointerType==="mouse")return;
  clearChartAnimation();
  chartGesture={id:e.pointerId,startX:e.clientX,start:chartVisualPos,
    moved:false,history:[{x:e.clientX,t:performance.now()}]};
});
procWheel.addEventListener("pointermove",e=>{
  if(!chartGesture||chartGesture.id!==e.pointerId)return;
  const dx=e.clientX-chartGesture.startX;
  if(!chartGesture.moved&&Math.abs(dx)>5){
    chartGesture.moved=true;
    if(document.body.classList.contains("chart-selected"))hideInlineChart();
    try{procWheel.setPointerCapture(e.pointerId)}catch(_){}
  }
  if(!chartGesture.moved)return;
  const now=performance.now();
  chartGesture.history.push({x:e.clientX,t:now});
  chartGesture.history=chartGesture.history.filter(p=>now-p.t<120);
  chartVisualPos=chartGesture.start-dx/chartWidth();
  paintProcedureWheel();
});
procWheel.addEventListener("pointerup",e=>{
  if(!chartGesture||chartGesture.id!==e.pointerId)return;
  const g=chartGesture;chartGesture=null;
  if(g.moved){
    try{procWheel.releasePointerCapture(e.pointerId)}catch(_){}
    chartSuppressTap=performance.now()+230;
    const now=performance.now(),points=g.history.filter(p=>now-p.t<110);
    const a=points[0]||{x:g.startX,t:now},b=points[points.length-1]||a;
    const vx=(b.x-a.x)/Math.max(16,b.t-a.t);
    const projected=clamp(-vx*260/chartWidth(),-5,5);
    glideProcedure(Math.round(chartVisualPos+projected));
  }else glideProcedure(Math.round(chartVisualPos),180);
});
procWheel.addEventListener("pointercancel",()=>{
  chartGesture=null;glideProcedure(Math.round(chartVisualPos),230);
});
procWheel.addEventListener("dragstart",e=>e.preventDefault());
procWheel.addEventListener("wheel",e=>{
  if(Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey){
    e.preventDefault();moveProcedure(Math.sign(e.deltaX||e.deltaY));
  }
},{passive:false});
window.addEventListener("keydown",e=>{
  if(e.key==="Escape"&&activeChartCategory){e.preventDefault();closeProcedureCategory();}
});
window.addEventListener("resize",()=>paintProcedureWheel(),{passive:true});
if(typeof ResizeObserver!=="undefined"){
  new ResizeObserver(()=>{if(chartSearchRows.length)requestAnimationFrame(paintProcedureWheel)}).observe(procWheel);
}

/* The R5 page DOES NOT contain a home-made PDF renderer.
 * It embeds the original Classic JeppIran chart viewer, unmodified,
 * and asks the guarded same-origin bridge to select an indexed V2621 page.
 */
const classicHost=$("#classicViewerHost"),classicFrame=$("#classicViewerFrame");
const classicStatus=$("#classicViewerStatus");
let classicReady=false,classicRequested=null,classicConfirmedKey="",classicLoadStarted=false;
const miniHost=$("#miniChartPreview"),miniCanvas=$("#miniChartCanvas");
const miniStatus=$("#miniChartStatus"),miniTap=$("#miniPreviewTap");
// Earlier R13 HTML revisions shipped without #miniChartImage. A previously
// cached document can legitimately load a newer JS bundle. Repair that DOM
// mismatch in-place before any category/preview callback executes.
function ensureMiniChartImage(){
  let img=$("#miniChartImage");
  if(img)return img;
  img=document.createElement("img");
  img.id="miniChartImage";
  img.hidden=true;
  img.alt="Preview of selected published chart";
  img.decoding="async";
  img.style.cssText="display:block;max-width:100%;max-height:100%;width:auto;height:auto;object-fit:contain";
  if(miniTap)miniTap.insertBefore(img,miniCanvas||miniTap.firstChild);
  else miniHost?.append(img);
  return img;
}
const miniImage=ensureMiniChartImage();
const thumbWarmCache=new Map();
let miniItem=null,miniKey="",miniToken=0,miniTimer=0,miniRenderTask=null;
let miniLibraryPromise=null,miniPdfCache=new Map();
function cancelMiniDraw(){
  ++miniToken;clearTimeout(miniTimer);miniTimer=0;
  if(miniRenderTask){try{miniRenderTask.cancel()}catch(_){}miniRenderTask=null;}
}
function miniPdfLibrary(){
  if(!miniLibraryPromise)miniLibraryPromise=import(ROOT+"vendor/pdf.min.mjs").then(lib=>{
    lib.GlobalWorkerOptions.workerSrc=ROOT+"vendor/pdf.worker.min.mjs";
    return lib;
  }).catch(error=>{miniLibraryPromise=null;throw error});
  return miniLibraryPromise;
}
function thumbUrl(item){
  return ROOT+"chart-previews/"+encodeURIComponent(item.airport)+"/"+Number(item.pdf_page)+".jpg";
}
function warmAdjacentThumbs(){
  if(!chartSearchRows.length||miniHost.hidden)return;
  const center=chartSearchRows.findIndex(item=>item.airport===miniItem?.airport&&
    Number(item.page)===Number(miniItem?.page));
  if(center<0)return;
  for(const offset of [-2,-1,1,2]){
    const neighbor=chartSearchRows[chartWrap(center+offset)];
    if(!neighbor)continue;
    const url=thumbUrl(neighbor);
    if(thumbWarmCache.has(url))continue;
    const img=new Image();
    img.decoding="async";img.src=url;
    thumbWarmCache.set(url,img);
  }
  while(thumbWarmCache.size>16)thumbWarmCache.delete(thumbWarmCache.keys().next().value);
}
function miniPdfDocument(lib,url){
  if(!miniPdfCache.has(url)){
    const promise=lib.getDocument({url}).promise.catch(error=>{miniPdfCache.delete(url);throw error});
    miniPdfCache.set(url,promise);
    if(miniPdfCache.size>3)miniPdfCache.delete(miniPdfCache.keys().next().value);
  }
  return miniPdfCache.get(url);
}
function showMiniChart(item){
  if(!item||!validProcedure(item)){
    cancelMiniDraw();miniItem=null;miniKey="";
    miniHost.hidden=true;miniImage.hidden=true;
    document.body.classList.remove("has-chart-preview");
    planProfileWeather(displayedProfileCode);
    return;
  }
  const key=item.airport+":"+Number(item.page);
  if(miniKey===key&&!miniHost.hidden)return;
  cancelMiniDraw();
  miniKey=key;miniItem=item;
  // Browsing is deliberately NOT full chart mode; Classic opens only on tap.
  classicHost.hidden=true;classicRequested=null;
  document.body.classList.remove("chart-selected","preview-chart-fullscreen");
  miniHost.hidden=false;
  document.body.classList.add("has-chart-preview");
  ++metarRequest;clearTimeout(profileMetarTimer);
  $("#miniChartContext").textContent=item.airport+" · "+activeChartCategory+" · "+(item.chart_number||"");
  $("#miniChartTitle").textContent=item.name||"Chart "+item.page;
  miniStatus.hidden=false;miniStatus.textContent="Loading chart preview…";
  miniCanvas.hidden=true;miniImage.hidden=true;
  const token=miniToken;
  // The JPEG was generated from the real published PDF at deploy-time.
  // Loading a small image is far faster than repeatedly downloading/decoding
  // a full airport PDF with PDF.js while the user spins the carousel.
  const url=thumbUrl(item);
  miniImage.onload=()=>{
    if(token!==miniToken||miniHost.hidden)return;
    if(miniImage.naturalWidth<50){
      miniImage.onerror?.();
      return;
    }
    miniCanvas.hidden=true;miniImage.hidden=false;miniStatus.hidden=true;
    warmAdjacentThumbs();
  };
  miniImage.onerror=()=>{
    if(token!==miniToken||miniHost.hidden)return;
    miniImage.hidden=true;
    // Robust fallback for older mirrors / incomplete JPEG publication.
    miniStatus.textContent="Loading PDF fallback…";
    miniTimer=setTimeout(()=>{miniTimer=0;void drawMiniChart(item,token)},50);
  };
  miniImage.src=url;
}
async function drawMiniChart(item,token){
  try{
    const lib=await miniPdfLibrary();
    if(token!==miniToken||miniHost.hidden)return;
    const source=chartManifest.airports[item.airport];
    const url=ROOT+"charts/"+encodeURIComponent(source.file||item.airport+".pdf");
    const pdf=await miniPdfDocument(lib,url);
    if(token!==miniToken||miniHost.hidden)return;
    const pageNo=Number(item.pdf_page);
    if(pageNo<1||pageNo>pdf.numPages)throw Error("Page unavailable");
    const page=await pdf.getPage(pageNo);
    if(token!==miniToken||miniHost.hidden)return;
    const area=miniTap.getBoundingClientRect();
    const original=page.getViewport({scale:1});
    const fitScale=Math.min(Math.max(110,area.width-18)/original.width,
      Math.max(140,area.height-18)/original.height);
    // The thumbnail uses a capped pixel density; the full-resolution viewer is untouched.
    const scale=fitScale*Math.min(devicePixelRatio||1,1.4);
    const viewport=page.getViewport({scale});
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.ceil(viewport.width));
    canvas.height=Math.max(1,Math.ceil(viewport.height));
    const context=canvas.getContext("2d",{alpha:false});
    if(!context)throw Error("Canvas unavailable");
    const task=page.render({canvasContext:context,viewport});
    miniRenderTask=task;
    await task.promise;
    if(miniRenderTask===task)miniRenderTask=null;
    if(token!==miniToken||miniHost.hidden)return;
    // Commit a fully drawn thumbnail at once so fast swipes never flash half-rendered charts.
    miniCanvas.width=canvas.width;miniCanvas.height=canvas.height;
    miniCanvas.getContext("2d",{alpha:false}).drawImage(canvas,0,0);
    miniCanvas.style.width=Math.round(viewport.width/Math.min(devicePixelRatio||1,1.4))+"px";
    miniCanvas.style.height=Math.round(viewport.height/Math.min(devicePixelRatio||1,1.4))+"px";
    miniCanvas.hidden=false;miniStatus.hidden=true;
  }catch(error){
    if(token!==miniToken||miniHost.hidden)return;
    miniStatus.textContent="PDF preview unavailable. Tap Open chart to use Classic. "+(error?.message||"");
    miniStatus.hidden=false;miniCanvas.hidden=true;
  }
}
function openMiniChart(){
  if(miniItem&&validProcedure(miniItem))showInlineChart(miniItem);
}
$("#miniChartOpen").addEventListener("click",openMiniChart);
miniTap.addEventListener("click",openMiniChart);

// Coalesce pointer events to one selection per animation frame.
// The original Classic iframe stays mounted, preserving the PDF renderer and toolbar.
function queueFocusedChart(index,immediate=false){
  // Reflow/ResizeObserver must never close a deliberately opened full Classic chart.
  if(document.body.classList.contains("chart-selected"))return;
  if(!activeChartCategory||!chartSearchRows.length)return;
  previewQueuedIndex=index;
  if(immediate){
    if(previewSelectionFrame)cancelAnimationFrame(previewSelectionFrame);
    previewSelectionFrame=0;
    displayFocusedChart();
  }else if(!previewSelectionFrame){
    previewSelectionFrame=requestAnimationFrame(()=>{
      previewSelectionFrame=0;
      displayFocusedChart();
    });
  }
}
function displayFocusedChart(){
  const row=chartSearchRows[chartWrap(previewQueuedIndex)];
  if(!row||!validProcedure(row)||!activeChartCategory)return;
  const key=row.airport+":"+Number(row.page);
  if(classicRequested&&classicRequested.icao+":"+classicRequested.page===key)return;
  showMiniChart(row);
}
function hideInlineChart(){
  cancelMiniDraw();miniKey="";miniItem=null;miniHost.hidden=true;
  miniCanvas.hidden=true;miniImage.hidden=true;
  document.body.classList.remove("has-chart-preview","preview-chart-fullscreen");
  planProfileWeather(displayedProfileCode);
  $("#previewCdfaBtn").hidden=true;
  classicFrame.contentWindow?.postMessage({type:"JEPPIRAN_PREVIEW_EXIT_FULLSCREEN_V1"},location.origin);
  classicRequested=null;
  if(previewSelectionFrame)cancelAnimationFrame(previewSelectionFrame);
  previewSelectionFrame=0;previewQueuedIndex=-1;
  classicHost.hidden=true;
  document.body.classList.remove("chart-selected");
  if(!activeChartCategory)document.querySelector(".procedure-categories")?.scrollTo({left:0,behavior:"instant"});
}
function dispatchClassicSelection(){
  if(!classicReady||!classicRequested||!classicFrame.contentWindow)return;
  classicFrame.contentWindow.postMessage({
    type:"JEPPIRAN_PREVIEW_SELECT_CHART_V1",
    icao:classicRequested.icao,
    page:classicRequested.page
  },location.origin);
}
function showInlineChart(item){
  cancelMiniDraw();miniHost.hidden=true;miniKey="";miniImage.hidden=true;
  document.body.classList.add("has-chart-preview");
  ++metarRequest;clearTimeout(profileMetarTimer);
  if(previewSelectionFrame)cancelAnimationFrame(previewSelectionFrame);
  previewSelectionFrame=0;
  if(!item||!validProcedure(item)){
    document.body.classList.remove("chart-selected");
    classicRequested=null;
    classicStatus.hidden=false;
    classicStatus.textContent="Select a published chart from the category.";
    classicHost.hidden=false;
    return;
  }
  classicHost.hidden=false;
  document.body.classList.add("chart-selected");
  classicRequested={icao:item.airport,page:Number(item.page)};
  const key=classicRequested.icao+":"+classicRequested.page;
  if(classicConfirmedKey!==key){
    classicStatus.hidden=false;
    classicStatus.textContent="Loading original Classic viewer · "+(item.chart_number||"")+"…";
  }else classicStatus.hidden=true;
  if(!classicLoadStarted){
    classicLoadStarted=true;
    classicFrame.src=ROOT+"index.html?jeppiranEmbedCharts=1#charts";
  }
  dispatchClassicSelection();
}
window.addEventListener("message",event=>{
  if(event.origin!==location.origin||event.source!==classicFrame.contentWindow)return;
  if(event.data?.type==="JEPPIRAN_PREVIEW_FULLSCREEN_V1"){
    const open=event.data.open===true;
    document.body.classList.toggle("preview-chart-fullscreen",open);
    $("#previewCdfaBtn").hidden=!open||event.data.cdfaAvailable!==true;
  }
  if(event.data?.type==="JEPPIRAN_PREVIEW_CDFA_STATUS_V1"){
    $("#previewCdfaBtn").dataset.available=String(event.data.available===true);
    $("#previewCdfaBtn").hidden=!document.body.classList.contains("preview-chart-fullscreen")||event.data.available!==true;
  }
  if(event.data?.type==="JEPPIRAN_PREVIEW_CLASSIC_READY_V1"){
    classicReady=true;
    dispatchClassicSelection();
  }
  if(event.data?.type==="JEPPIRAN_PREVIEW_CHART_SELECTED_V1"){
    const {icao,page}=event.data;
    const key=String(icao)+":"+Number(page);
    classicConfirmedKey=key;
    if(classicRequested&&key===classicRequested.icao+":"+classicRequested.page){
      classicStatus.hidden=true;
    }
  }
});

async function fetchJsonTimed(url,timeoutMs=9000){
  const controller=new AbortController();
  const timer=setTimeout(()=>controller.abort(),timeoutMs);
  try{
    const response=await fetch(url,{cache:"no-store",signal:controller.signal});
    if(!response.ok)throw Error("HTTP "+response.status+" for "+url);
    return await response.json();
  } finally {clearTimeout(timer)}
}
function refreshCatalogView(){
  const was=current();
  stopAnimation();
  selected=Math.max(0,codes.indexOf(was));
  visualPos=selected;
  displayedProfileCode="";
  buildTrack();paintTrack();updateSelected();
}
async function boot(){
  // Show the full airport carousel, OIII poster and thin chart dock BEFORE any
  // fetch. A slow/blocked manifest must never leave an empty preview screen.
  buildTrack();
  paintTrack();
  updateSelected();
  try{
    const manifest=await fetchJsonTimed(ROOT+"data/charts-manifest.json",9500);
    const newCodes=Object.keys(manifest?.airports||{}).sort();
    if(newCodes.length!==BUILTIN_AIRPORT_CODES.length||
       newCodes.some((icao,index)=>icao!==BUILTIN_AIRPORT_CODES[index]))
       throw Error("Incomplete airport manifest: keep full built-in "+BUILTIN_AIRPORT_CODES.length+"-airport set");
    const selectedIcao=current();
    codes=newCodes;
    chartManifest=manifest;
    // Start the lightweight procedure-title index in the background, not
    // after the user taps STAR/SID/AIRPORT/APP for the first time.
    void loadPublishedCharts().catch(()=>{});
    selected=Math.max(0,codes.indexOf(selectedIcao));
    visualPos=selected;
    buildTrack();paintTrack();updateSelected();
  }catch(error){
    console.warn("Airport manifest unavailable; using the complete bundled "+BUILTIN_AIRPORT_CODES.length+"-airport V2621 catalog",error);
    // Full 78-airport selector stays functional even if the manifest is temporarily blocked.
  }
  try{
    const profiles=await fetchJsonTimed(ROOT+"data/airport-profiles.json",9500);
    if(profiles?.airports&&typeof profiles.airports==="object"){
      metadata=profiles.airports;
      refreshCatalogView();
    }
  }catch(error){
    console.warn("Optional airport profile index unavailable",error);
  }
}
// In the isolated APK the top logo must return to the airport selector,
// NEVER navigate into the bundled production Classic page.
if(["android-phone","android-carousel-qa"].includes(
  new URLSearchParams(location.search).get("platform"))){
  const brand=document.querySelector(".topline .brand");
  if(brand){
    brand.removeAttribute("href");
    brand.setAttribute("role","button");
    brand.setAttribute("tabindex","0");
    brand.addEventListener("click",()=>{
      if(activeChartCategory)closeProcedureCategory();
      else window.location.assign(new URL("../../index.html#home",location.href));
    });
    brand.addEventListener("keydown",event=>{
      if(event.key==="Enter"||event.key===" "){
        event.preventDefault();
        if(activeChartCategory)closeProcedureCategory();
        else window.location.assign(new URL("../../index.html#home",location.href));
      }
    });
  }
}
// Android OS back gesture closes a chart group before leaving Carousel QA.
window.jeppiranAndroidBack=()=>{
  if(document.body.classList.contains("preview-chart-fullscreen")){
    $("#previewFullscreenExit").click();return true;
  }
  if(document.fullscreenElement){void document.exitFullscreen().catch(()=>{});return true;}
  if(activeChartCategory){closeProcedureCategory();return true;}
  if(["android-phone","android-carousel-qa"].includes(
       new URLSearchParams(location.search).get("platform"))){
    window.location.assign(new URL("../../index.html#home",location.href));
    return true;
  }
  return false;
};
window.addEventListener("jeppiran-airport-briefings-updated",event=>{
  if(event.detail?.kind!=="metar"||!displayedProfileCode)return;
  if(document.body.classList.contains("has-chart-preview")||
     document.body.classList.contains("chart-selected"))return;
  clearTimeout(profileMetarTimer);
  void updateMetar(displayedProfileCode);
});
$("#previewFullscreenExit").addEventListener("click",()=>{
  classicFrame.contentWindow?.postMessage({type:"JEPPIRAN_PREVIEW_EXIT_FULLSCREEN_V1"},location.origin);
  document.body.classList.remove("preview-chart-fullscreen");
});
$("#previewCdfaBtn").addEventListener("click",()=>{
  classicFrame.contentWindow?.postMessage({type:"JEPPIRAN_PREVIEW_TOGGLE_CDFA_V1"},location.origin);
});
void boot();
})();