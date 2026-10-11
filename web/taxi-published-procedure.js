/* JEPPIRAN cached Jeppesen published ground-procedure traces · SIM QA ONLY.
 * Every magenta segment is an existing Jeppesen colored source vector stroke.
 * Stand leads/pushback, runway crossing clearance and ATC route authority are
 * NOT inferred. No nearest-stand straight connector is ever manufactured.
 */
(function(root) {
"use strict";
const cache=new Map();
const norm=s=>String(s||"").trim().toUpperCase();
let active=null,nonce=0;
function recognize(expression,airport) {
  if(airport!=="LTFM")return null;
  const s=norm(expression).replace(/\s+/g," ");
  const match=s.match(/^(?:ST([A-Z]\d{1,3}[A-Z]?) )?(?:(ARR|DEP) )?(\d{2}[LRC]?\d+[A-Z])$/);
  if(!match)return null;
  return {startStand:match[1]||null,operation:match[2]==="DEP"?"DEPARTURE":match[2]==="ARR"?"ARRIVAL":null,key:match[3]};
}
function status(msg) {
  const node=document.getElementById("taxiQaStatus");
  if(node){node.textContent=msg;node.classList.add("warning")}
  const more=document.getElementById("taxiQaFullMessage");
  if(more)more.textContent=msg;
}
async function load() {
  if(cache.has("LTFM"))return cache.get("LTFM");
  const request=(async()=>{
    for(const source of ["taxi-procedure-traces","taxi-procedures"]){
      try{
        const response=await fetch("./data/"+source+"/LTFM.json",{cache:"no-store"});
        if(!response.ok)continue;
        const info=await response.json();
        if(info.airport==="LTFM"&&String(info.cycle)==="2621"&&
          Array.isArray(info.procedures))return info;
      }catch(_){}
    }
    throw Error("Published route cache unavailable; no magenta route invented");
  })();
  cache.set("LTFM",request);
  try{return await request}catch(error){cache.delete("LTFM");throw error}
}
function clear() {
  nonce++;active=null;
  document.querySelectorAll(".taxi-published-vector-layer").forEach(x=>x.remove());
}
function paint() {
  document.querySelectorAll(".taxi-published-vector-layer").forEach(x=>x.remove());
  if(!active||typeof selectedAirport==="undefined"||selectedAirport!=="LTFM"||
     typeof selectedChart==="undefined"||norm(selectedChart?.chart_number)!=="30-9")return;
  const parent=document.getElementById("chartTransformLayer");
  if(!parent)return;
  const drawing=active.route.printedSegments;
  if(!Array.isArray(drawing)||drawing.length<2)return;
  const ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 612 792");
  svg.setAttribute("preserveAspectRatio","none");
  svg.setAttribute("class","taxi-published-vector-layer");
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:15";
  const path=document.createElementNS(ns,"path");
  const parts=[];
  for(const segment of drawing){
    if(!Array.isArray(segment)||segment.length!==4||!segment.every(Number.isFinite))continue;
    parts.push("M "+segment[0]+" "+segment[1]+" L "+segment[2]+" "+segment[3]);
  }
  path.setAttribute("d",parts.join(" "));
  path.setAttribute("fill","none");path.setAttribute("stroke","rgba(244,37,190,.74)");
  path.setAttribute("stroke-width","1.65");path.setAttribute("stroke-linejoin","round");
  path.setAttribute("stroke-linecap","round");
  svg.appendChild(path);
  parent.appendChild(svg);
}
async function go(textInput,airport) {
  const request=recognize(textInput,airport);
  if(!request)return false;
  clear();
  const ticket=nonce;
  status("Loading cached Jeppesen chart vector trace for "+request.key+"…");
  try{
    const data=await load();
    if(ticket!==nonce)return true;
    const matching=data.procedures.filter(r=>norm(r.key)===request.key&&
      (!request.operation||r.operation===request.operation));
    if(matching.length!==1){
      status(matching.length?"ARR/DEP designator ambiguous: enter DEP "+request.key+" or ARR "+request.key:
        "No published route found for "+request.key+".");return true;
    }
    const route=matching[0];
    if(!Array.isArray(route.printedSegments)||route.printedSegments.length<2){
      status("Published "+route.sourceChart+" route found: "+route.taxiways.join(" → ")+
        ". Vector geometry unavailable. No substitute path drawn.");return true;
    }
    active={route,request};
    // The published taxi chart and the main ADC share PDF-point axes for this
    // exact cycle. Open the ADC first, then show only source-extracted vectors.
    if(typeof selectedChart!=="undefined"&&norm(selectedChart?.chart_number)!=="30-9")
      root.JEPPIRAN_TAXI?.openAdc?.();
    const warning=request.startStand?" ST"+request.startStand+" → first procedure taxiway is UNMAPPED (stand pushback/lead-out not inferred).":"";
    status("CHART TRACE "+route.key+" · "+route.taxiways.join(" → ")+" · "+
      route.sourceChart+" · "+(route.holdShortOf||"ATC clearance limit")+"."+
      warning+" Simulator QA only; no runway crossing or ATC clearance inferred.");
    paint();
    setTimeout(()=>{if(ticket===nonce)paint()},150);
    setTimeout(()=>{if(ticket===nonce)paint()},650);
  }catch(e){if(ticket===nonce)status(String(e.message||e))}
  return true;
}
root.addEventListener("jeppiran-taxi-route-updated",paint);
root.addEventListener("jeppiran-chart-rendered",paint);
root.JEPPIRAN_PUBLISHED_TAXI={recognize,go,clear,paint,load};
})(typeof window!=="undefined"?window:globalThis);
