/* JEPPIRAN LTFM printed taxiway name anchors · SIM QA only.
 * These are text locations (from PDF graticule), not road centerline segments.
 * The original graph remains authoritative: never create guessed links.
 */
(function(root){
"use strict";
let promise=null,selected="";
const name=s=>String(s||"").trim().toUpperCase();
const selector=()=>document.getElementById("taxiQaNames");
async function source(){
  if(promise)return promise;
  promise=fetch("./data/taxi-chart-labels/LTFM.json",{cache:"no-store"}).then(r=>{
    if(!r.ok)throw Error("Chart label index unavailable");
    return r.json()
  }).then(d=>{
    if(d.airport!=="LTFM"||String(d.cycle)!=="2621"||
      Object.keys(d.missingCenterlineLabels||{}).length!==41)throw Error("Wrong-cycle chart labels");
    return d
  });
  try{return await promise}catch(e){promise=null;throw e}
}
function remove(){document.querySelectorAll(".taxi-chart-name-pins").forEach(x=>x.remove())}
async function paint(){
  remove();
  if(!selected||typeof selectedAirport==="undefined"||selectedAirport!=="LTFM"||
    typeof selectedChart==="undefined"||name(selectedChart?.chart_number)!=="30-9"||
    !document.getElementById("taxiQaPanel")||document.getElementById("taxiQaPanel").hidden)return;
  const current=selected;
  let data;try{data=await source()}catch(_){return}
  if(current!==selected)return;
  const entry=data.missingCenterlineLabels?.[selected];
  if(!entry||!entry.labelPoints?.length)return;
  const layer=document.getElementById("chartTransformLayer");
  if(!layer)return;
  const ns="http://www.w3.org/2000/svg";
  const svg=document.createElementNS(ns,"svg");
  svg.setAttribute("viewBox","0 0 612 792");
  svg.setAttribute("class","taxi-chart-name-pins");
  svg.style.cssText="position:absolute;inset:0;width:100%;height:100%;pointer-events:none;z-index:16";
  for(const p of entry.labelPoints){
    const circle=document.createElementNS(ns,"circle");
    for(const [k,v] of Object.entries({cx:p.x,cy:p.y,r:"3.4",fill:"none",stroke:"#5ce7ff","stroke-width":"1.3","stroke-dasharray":"2 2"}))circle.setAttribute(k,v);
    svg.appendChild(circle);
    const label=document.createElementNS(ns,"text");
    label.setAttribute("x",String(p.x+5));label.setAttribute("y",String(p.y-6));
    label.setAttribute("fill","#5ce7ff");label.setAttribute("font-size","5");
    label.setAttribute("font-weight","700");label.setAttribute("stroke","#121b2c");
    label.setAttribute("stroke-width","1.8");label.setAttribute("paint-order","stroke");
    label.textContent=selected+" · LABEL ONLY";svg.appendChild(label);
  }
  layer.appendChild(svg);
}
document.addEventListener("change",event=>{
  if(event.target?.id!=="taxiQaNames")return;
  selected=name(selector()?.value);paint()
},true);
document.addEventListener("input",event=>{
  if(event.target?.id==="taxiQaFilter"){selected="";remove()}
},true);
root.addEventListener("jeppiran-taxi-route-updated",paint);
root.addEventListener("jeppiran-chart-rendered",paint);
root.JEPPIRAN_CHART_LABEL_PINS={paint,source,clear(){selected="";remove()}};
})(typeof window!=="undefined"?window:globalThis);
