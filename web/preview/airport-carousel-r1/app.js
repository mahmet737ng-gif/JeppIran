/* JeppIran V2621 — isolated airport-carousel-r1 preview.
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
let codes=["OIII"], metadata={},selected=0,centerOffset=0,raf=0,animationToken=0,gesture=null;
let chartManifest=null,charts=null,wxCache=null,wxCacheAt=0,metarRequest=0;
const wrap=i=>(i%codes.length+codes.length)%codes.length;
const clamp=(n,min,max)=>Math.max(min,Math.min(max,n));
const getCode=i=>codes[wrap(i)];
const getProfile=code=>metadata[code]||{};
const current=()=>getCode(selected);
const slotStep=()=>el.carousel.clientWidth/(innerWidth<=690?5.5:innerWidth<=1040?7.3:9.25);
const visibleRadius=()=>innerWidth<=690?2:innerWidth<=1040?3:4;
function preferredIndex(code){return codes.indexOf(code)}
function makeAirportButton(index,relative){
  const code=getCode(index),data=getProfile(code);
  const button=document.createElement("button");
  button.type="button";button.className="airport-token";
  button.setAttribute("aria-label",code+" "+(data.iata||fallbackIata[code]||"")+" "+(data.name||""));
  button.dataset.airport=code;
  const icao=document.createElement("span"),iata=document.createElement("span");
  icao.className="icao";iata.className="iata";
  icao.textContent=code;iata.textContent=data.iata||fallbackIata[code]||"—";
  button.append(icao,iata);
  const dist=Math.abs(relative-centerOffset),active=relative===0;
  if(active){button.classList.add("active");button.setAttribute("aria-current","true");}
  const opacity=dist<.5?1:clamp(1-(dist-1)*.155,.26,.97);
  button.style.setProperty("--slot-width",slotStep()*1.15+"px");
  button.style.setProperty("--shift",(relative-centerOffset)*slotStep()+"px");
  button.style.setProperty("--scale",active?"1":String(clamp(1-(dist-1)*.035,.86,1)));
  button.style.setProperty("--opacity",opacity.toFixed(3));
  button.addEventListener("click",()=>{
    if(gesture?.moved||performance.now()<suppressTapUntil)return;
    centerOn(selected+relative,true);
  });
  return button;
}
let suppressTapUntil=0;
function paintTrack(){
  const radius=visibleRadius(),fragment=document.createDocumentFragment();
  for(let relative=-(radius+2);relative<=radius+2;relative++){
    const distance=Math.abs(relative-centerOffset);
    if(distance>radius+.75)continue;
    fragment.append(makeAirportButton(selected+relative,relative));
  }
  el.track.replaceChildren(fragment);
}
function resetWeather(){
  el.category.textContent="WX —";el.category.className="flight-category unknown";
  el.dot.className="flight-dot unknown";el.clouds.textContent="—";el.temp.textContent="—";
  el.wind.textContent="— / — kt";el.qnh.textContent="QNH —";
  el.weatherStatus.textContent="Checking available METAR…";
}
function artwork(code){return `${ROOT}airport-profile-posters-v3/${code}.webp`}
let bgTicket=0;
function updateImage(code){
  // Only the immutable approved poster is used; no synthetic airport imagery.
  const ticket=++bgTicket,img=new Image();
  img.onload=()=>{if(ticket===bgTicket)el.scenery.style.backgroundImage=`url("${artwork(code)}")`};
  img.onerror=()=>{if(ticket===bgTicket)el.scenery.style.backgroundImage="none"};
  img.src=artwork(code);
}
function updateSelected(){
  const code=current(),d=getProfile(code),fallback=fallbackNames[code];
  el.name.textContent=d.name||(fallback&&fallback[0])||code+" Airport";
  const city=d.city||fallback&&fallback[1]?.split(",")[0]||"",country=d.country||fallback&&fallback[1]?.split(",").slice(1).join(",").trim()||"";
  const elevation=Number.isFinite(d.elevation)?d.elevation:(fallback&&fallback[2]);
  el.place.textContent=(city&&country?city+", "+country:city||country||"Location unavailable")+"  │  Elevation "+(Number.isFinite(elevation)?elevation.toLocaleString("en-US")+" ft":"unavailable");
  $("#chartsAirport").textContent=code;
  updateImage(code);resetWeather();void updateMetar(code);
}
function stopAnimation(){animationToken++;if(raf)cancelAnimationFrame(raf);raf=0;}
function goIndex(index){
  const indexWrapped=wrap(index);
  if(selected===indexWrapped){centerOffset=0;paintTrack();return;}
  selected=indexWrapped;centerOffset=0;paintTrack();updateSelected();
}
function centerOn(target,animated){
  if(!animated){stopAnimation();goIndex(target);return;}
  const delta=target-selected;
  if(!delta){settle();return;}
  changeBy(delta);
}
function settle(){
  const delta=Math.round(centerOffset);
  // centerOffset represents dragged displacement in units, final selected index is shifted oppositely.
  goIndex(selected+delta);
}
function animateGlide(targetOffset,duration){
  stopAnimation();const token=animationToken,start=centerOffset,begin=performance.now();
  function tick(time){
    if(token!==animationToken)return;
    const t=clamp((time-begin)/duration,0,1),ease=1-Math.pow(1-t,3);
    centerOffset=start+(targetOffset-start)*ease;
    // normalize during animation for large moves to keep centered slots populated
    const carry=Math.trunc(centerOffset);
    if(carry){selected=wrap(selected+carry);centerOffset-=carry;}
    paintTrack();
    if(t<1)raf=requestAnimationFrame(tick);
    else {raf=0;const end=Math.round(centerOffset);const prev=selected;goIndex(selected+end);if(prev!==selected)updateSelected();else {paintTrack();}}
  }
  raf=requestAnimationFrame(tick);
}
function moveBy(steps){stopAnimation();centerOffset=0;paintTrack();goIndex(selected+steps)}
function changeBy(steps){ // animated movement with direct-index wrap handling
  stopAnimation();const start=selected;
  const n=Math.abs(steps),dir=Math.sign(steps);
  if(!n)return;
  let from=0;const total=Math.min(n,8);const begin=performance.now(),duration=Math.min(560,180+total*45),token=animationToken;
  function animate(time){
    if(token!==animationToken)return;
    const t=clamp((time-begin)/duration,0,1),v=dir*total*(1-Math.pow(1-t,3));
    const shift=Math.trunc(v);selected=wrap(start+shift);centerOffset=v-shift;paintTrack();
    if(t<1)raf=requestAnimationFrame(animate);else {selected=wrap(start+dir*total);centerOffset=0;paintTrack();updateSelected();raf=0;}
  }
  raf=requestAnimationFrame(animate);
}
// Gesture: finger and carousel move 1:1 while held. Release speed controls number of airports crossed.
function pointerDown(e){
  if(e.button!==0 && e.pointerType==="mouse")return;
  stopAnimation();gesture={id:e.pointerId,startX:e.clientX,lastX:e.clientX,lastT:performance.now(),history:[{x:e.clientX,t:performance.now()}],moved:false};
  el.carousel.classList.add("dragging");el.carousel.setPointerCapture(e.pointerId);
}
function pointerMove(e){
  if(!gesture||gesture.id!==e.pointerId)return;
  const dx=e.clientX-gesture.startX;
  if(Math.abs(dx)>5)gesture.moved=true;
  if(!gesture.moved)return;
  const now=performance.now();gesture.history.push({x:e.clientX,t:now});
  gesture.history=gesture.history.filter(p=>now-p.t<=110);
  const offset=dx/slotStep();
  centerOffset=-offset; // moving left reveals later airports
  const carry=Math.trunc(centerOffset);
  if(carry){selected=wrap(selected+carry);centerOffset-=carry;gesture.startX+=-carry*slotStep();}
  paintTrack();
}
function pointerUp(e){
  if(!gesture||gesture.id!==e.pointerId)return;
  const info=gesture;gesture=null;el.carousel.classList.remove("dragging");
  try{el.carousel.releasePointerCapture(e.pointerId)}catch(_){}
  if(!info.moved)return;
  suppressTapUntil=performance.now()+200;
  const now=performance.now(),recent=info.history.filter(p=>now-p.t<110),first=recent[0]||{x:info.startX,t:now-1},last=recent[recent.length-1]||{x:info.lastX,t:now};
  const velocity=(last.x-first.x)/Math.max(12,last.t-first.t); // screen px per ms
  const inertia=clamp((-velocity*270)/slotStep(),-5.5,5.5);
  const total=clamp(centerOffset+inertia,-6.5,6.5);
  const target=Math.round(total); // snap to airport corresponding to gesture velocity
  changeByFromDrag(target);
}
function changeByFromDrag(n){
  const startSelected=selected,startOffset=centerOffset,token=++animationToken;
  const dest=clamp(n,-6,6),duration=clamp(180+Math.abs(dest-startOffset)*65,220,660),startTime=performance.now();
  function frame(t){
    if(token!==animationToken)return;
    const p=clamp((t-startTime)/duration,0,1),x=startOffset+(dest-startOffset)*(1-Math.pow(1-p,3));
    const whole=Math.trunc(x);
    selected=wrap(startSelected+whole);centerOffset=x-whole;paintTrack();
    if(p<1)raf=requestAnimationFrame(frame);else {selected=wrap(startSelected+dest);centerOffset=0;raf=0;paintTrack();updateSelected();}
  }
  raf=requestAnimationFrame(frame);
}
el.carousel.addEventListener("pointerdown",pointerDown);
el.carousel.addEventListener("pointermove",pointerMove);
el.carousel.addEventListener("pointerup",pointerUp);
el.carousel.addEventListener("pointercancel",()=>{gesture=null;el.carousel.classList.remove("dragging");centerOffset=0;paintTrack()});
el.carousel.addEventListener("dragstart",e=>e.preventDefault());
el.carousel.addEventListener("wheel",e=>{if(Math.abs(e.deltaX)>Math.abs(e.deltaY)||e.shiftKey){e.preventDefault();changeBy(Math.sign(e.deltaX||e.deltaY));}},{passive:false});
el.carousel.addEventListener("keydown",e=>{
  if(e.key==="ArrowLeft"||e.key==="ArrowRight"){e.preventDefault();changeBy(e.key==="ArrowRight"?1:-1)}
  else if(e.key==="Home"){e.preventDefault();centerOn(0,false)}
  else if(e.key==="End"){e.preventDefault();centerOn(codes.length-1,false)}
});
$("#prevAirport").addEventListener("click",()=>changeBy(-1));
$("#nextAirport").addEventListener("click",()=>changeBy(1));
window.addEventListener("resize",()=>{centerOffset=0;paintTrack()},{passive:true});
function showResults(){
 const value=el.search.value.trim().toUpperCase();el.results.replaceChildren();
 if(!value){el.results.hidden=true;return;}
 const matches=codes.filter(c=>c.includes(value)||String(getProfile(c).iata||fallbackIata[c]||"").toUpperCase().includes(value)||String(getProfile(c).name||"").toUpperCase().includes(value)).slice(0,12);
 if(!matches.length){el.results.hidden=true;return;}
 for(const code of matches){const b=document.createElement("button");b.type="button";const label=document.createElement("b"),small=document.createElement("small");label.textContent=code+" · "+(getProfile(code).iata||fallbackIata[code]||"—");small.textContent=getProfile(code).name||"Airport";b.append(label,small);b.onclick=()=>{centerOn(preferredIndex(code),false);el.search.value="";el.results.hidden=true;el.carousel.focus()};el.results.append(b)}
 el.results.hidden=false;
}
el.search.addEventListener("input",showResults);
el.search.addEventListener("keydown",e=>{if(e.key==="Escape")el.results.hidden=true;else if(e.key==="Enter"&&!el.results.hidden){e.preventDefault();el.results.querySelector("button")?.click()}});
document.addEventListener("click",e=>{if(!e.target.closest(".search-box"))el.results.hidden=true});
function normalizeRaw(row){const s=typeof row==="string"?row:row?.raw||row?.rawText||row?.rawOb||"";return String(s||"").trim()}
async function readSourceMetar(code){
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
 try{const {raw,source}=await readSourceMetar(code);if(req!==metarRequest||current()!==code)return;
  const d=decode(raw);
  const category=window.JEPPIRAN_FLIGHT_CATEGORY?.classify(raw)?.code||"UNKNOWN",key=category.toLowerCase();
  el.category.textContent=category==="UNKNOWN"?"WX —":category;
  el.category.className="flight-category "+key;
  el.dot.className="flight-dot "+key;
  el.clouds.textContent=d.cloud;el.temp.textContent=d.tval;el.wind.textContent=d.wind;el.qnh.textContent=d.qnh;
  el.weatherStatus.textContent=source+" · Verify observation timestamp · Not for navigation";
 }catch(_){if(req!==metarRequest||current()!==code)return;el.weatherStatus.textContent="METAR unavailable — no weather values invented";}
}
async function openCharts(){
 const code=current(),dialog=$("#chartDialog"),groups=$("#chartGroups");
 $("#chartDialogTitle").textContent=code+" · "+el.name.textContent;
 groups.textContent="Loading published charts…";dialog.showModal();
 try{
  if(!chartManifest||!charts){const [m,c]=await Promise.all([fetch(ROOT+"data/charts-manifest.json").then(r=>{if(!r.ok)throw Error("Chart manifest unavailable");return r.json()}),fetch(ROOT+"data/charts-current.json").then(r=>{if(!r.ok)throw Error("Chart index unavailable");return r.json()})]);chartManifest=m;charts=c;}
  if(!dialog.open)return;
  groups.replaceChildren();const airport=chartManifest.airports?.[code];
  if(!airport){groups.textContent="Charts not found for this airport";return;}
  const positions=new Map((airport.global_pages||[]).map((n,i)=>[Number(n),i+1]));
  for(const [display,cats] of [["STAR",["STAR"]],["SID",["SID"]],["AIRPORT",["AIRPORT"]],["APP",["APPROACH"]]]){
   const rows=charts.filter(c=>c.airport===code&&cats.includes(String(c.category).toUpperCase()));
   const details=document.createElement("details"),summary=document.createElement("summary");details.className="chart-group";summary.textContent=display+"  ("+rows.length+")";details.append(summary);
   for(const item of rows){const page=positions.get(Number(item.page));if(!page)continue;const link=document.createElement("a");link.target="_blank";link.rel="noopener noreferrer";link.href=ROOT+"charts/"+encodeURIComponent(code)+".pdf#page="+page;link.textContent=(item.chart_number?item.chart_number+" · ":"")+item.name;details.append(link)}
   groups.append(details);
  }
 }catch(e){groups.textContent="Published charts could not be loaded: "+e.message;}
}
$("#showCharts").addEventListener("click",openCharts);
$("#closeCharts").addEventListener("click",()=>$("#chartDialog").close());
$("#chartDialog").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.close()});
async function boot(){
 try{
  const manifestResponse=await fetch(ROOT+"data/charts-manifest.json",{cache:"no-store"});
  if(!manifestResponse.ok)throw Error("Airport list unavailable");
  const manifest=await manifestResponse.json();
  const newCodes=Object.keys(manifest.airports||{}).sort();if(!newCodes.length)throw Error("Empty airport list");
  codes=newCodes;
  const info=await fetch(ROOT+"data/airport-profiles.json",{cache:"no-store"});
  if(info.ok){const parsed=await info.json();metadata=parsed.airports||{}}
  selected=Math.max(0,codes.indexOf("OIII"));centerOffset=0;
  paintTrack();updateSelected();
 }catch(e){el.weatherStatus.textContent="Airport source unavailable: "+e.message;paintTrack();updateSelected();}
}
void boot();
})();