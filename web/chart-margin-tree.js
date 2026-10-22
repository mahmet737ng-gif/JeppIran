/* JEPPIRAN CHART MARGIN TREE — OWNER LOCK 2026-10-20.
   The navigation lives INSIDE the PDF transform layer, over its left white
   paper margin. It must never reserve page/gutter width or alter CDFA data. */
(()=>{
  "use strict";
  const categories=[["STAR","STAR"],["SID","SID"],["Airport","AIRPORT"],["Approach","APP"]];
  const fallbackIata={OIII:"THR",OIIE:"IKA",OIMM:"MHD",OISS:"SYZ",OIFM:"IFN",OIKB:"BND",OITT:"TBZ",OIAW:"AWZ",OIBK:"KIH",OICC:"KSH",OIYY:"AZD",OIAA:"ABD",LTFM:"IST",LTAC:"ESB",OMDB:"DXB",OMDW:"DWC",OOMS:"MCT",OTHH:"DOH",ORBI:"BGW",ORER:"EBL",ORNI:"NJF",OPIS:"ISB",OPKC:"KHI",UGTB:"TBS",UGSB:"BUS",UDYZ:"EVN"};
  const fallbackCountry=code=>({
    OI:"Iran",LT:"Turkey",OM:"United Arab Emirates",OO:"Oman",
    OR:"Iraq",OT:"Qatar",OP:"Pakistan",UG:"Georgia",UD:"Armenia"
  })[String(code).slice(0,2)]||"";
  const escape=s=>String(s||"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  let query="",open=true,airportOpen=true;
  // The PDF margin tree scales and pans with the chart. Convert the status
  // bar clearance from viewport pixels into PDF-local coordinates on iPad.
  const MIN_TOP_CLEARANCE=58;
  let safeFrame=0;
  function positionTreeBelowStatusBar(){
    const host=document.getElementById("jpMarginChartTree");
    if(!host)return;
    if(!document.body.classList.contains("viewer-fullscreen")||
       !document.getElementById("chartsView")?.classList.contains("chart-open")){
      host.style.removeProperty("top");
      host.style.removeProperty("max-height");
      return;
    }
    const layer=host.parentElement,layerRect=layer.getBoundingClientRect();
    const scale=layer.offsetWidth>0?layerRect.width/layer.offsetWidth:1;
    if(!Number.isFinite(scale)||scale<.1)return;
    const safeInset=parseFloat(getComputedStyle(document.body).paddingTop)||0;
    const clearance=Math.max(MIN_TOP_CLEARANCE,safeInset+15);
    const localTop=Math.max(5,(clearance-layerRect.top)/scale);
    const localHeight=Math.max(96,(window.innerHeight-clearance-18)/scale);
    host.style.top=localTop.toFixed(2)+"px";
    host.style.maxHeight=localHeight.toFixed(2)+"px";
  }
  function queueSafePosition(){
    if(safeFrame)return;
    safeFrame=requestAnimationFrame(()=>{
      safeFrame=0;
      positionTreeBelowStatusBar();
    });
  }
  // Schedule only during layout changes and chart interaction, never a loop.
  window.addEventListener("resize",queueSafePosition,{passive:true});
  window.addEventListener("orientationchange",queueSafePosition,{passive:true});
  document.addEventListener("fullscreenchange",queueSafePosition);
  document.addEventListener("webkitfullscreenchange",queueSafePosition);
  document.addEventListener("scroll",queueSafePosition,{capture:true,passive:true});
  document.addEventListener("pointermove",queueSafePosition,{passive:true});
  document.addEventListener("touchmove",queueSafePosition,{passive:true});
  new MutationObserver(queueSafePosition).observe(document.body,{
    attributes:true,attributeFilter:["class"]
  });

  const opened=new Set();
  const airportInfo=code=>{
    const meta=airportMetadata?.[code]||{};
    const legacy=AIRPORTS?.[code]||[];
    return {code,iata:meta.iata||fallbackIata[code]||"",
      city:meta.city||legacy[1]||"",country:meta.country||fallbackCountry(code)};
  };
  const matchesAirport=(code,q)=>{
    const meta=airportInfo(code);
    return [meta.code,meta.iata,meta.city,meta.country].some(v=>String(v).toUpperCase().includes(q));
  };
  function goToChart(c){
    if(!c)return;
    const code=displayAirportCode(c);
    if(code!==selectedAirport)selectAirport(code);
    if(!document.getElementById("chartsView")?.classList.contains("active"))route("charts");
    selectChart(c);
  }
  function putFocusInView(container,element){
    if(!container||!element)return;
    const rect=element.getBoundingClientRect(), parent=container.getBoundingClientRect();
    if(rect.top<parent.top)container.scrollTop-=parent.top-rect.top+12;
    else if(rect.bottom>parent.bottom)container.scrollTop+=rect.bottom-parent.bottom+12;
  }
  function refresh(){
    const host=document.getElementById("jpMarginChartTree"),list=host?.querySelector(".jp-margin-tree-list");
    if(!host||!list||!selectedChart)return;
    host.classList.toggle("is-open",open);
    host.querySelector(".jp-margin-tree-toggle").setAttribute("aria-expanded",String(open));
    host.querySelector(".jp-margin-tree-toggle").textContent=open?"‹":"☰";
    host.querySelector(".jp-margin-tree-search").value=query;
    list.replaceChildren();
    if(!open)return;
    const current=selectedAirport;
    const q=query.trim().toUpperCase();
    const sequence=(charts||[]).filter(c=>categories.some(([cat])=>cat===(c.category||"")));
    const codes=q
      ? [...new Set(sequence.map(displayAirportCode))].filter(code=>
          matchesAirport(code,q)||sequence.some(c=>displayAirportCode(c)===code&&
            String(displayChartName(c)).toUpperCase().includes(q)))
      : [current];
    codes.sort((a,b)=>(a===current?-1:b===current?1:a.localeCompare(b)));
    let highlighted=null,count=0;
    for(const code of codes){
      const meta=airportInfo(code),all=sequence.filter(c=>displayAirportCode(c)===code);
      const airportMatch=!q||matchesAirport(code,q);
      const filtered=q&&!airportMatch?all.filter(c=>String(displayChartName(c)).toUpperCase().includes(q)):all;
      if(!filtered.length)continue;
      const airport=document.createElement("button");
      airport.type="button";airport.className="jp-margin-tree-airport"+(code===current?" is-current":"");
      airport.textContent=(airportOpen||q?"▾ ":"▸ ")+code+(meta.iata?" / "+meta.iata:"");
      airport.title=[meta.city,meta.country].filter(Boolean).join(", ");
      airport.setAttribute("aria-expanded",String(airportOpen||!!q));
      airport.addEventListener("click",()=>{airportOpen=!airportOpen;refresh()});
      list.appendChild(airport);
      if(!airportOpen&&!q)continue;
      for(const [cat,label] of categories){
        const rows=filtered.filter(c=>c.category===cat).sort((a,b)=>Number(a.page)-Number(b.page));
        if(!rows.length)continue;
        const expanded=!!q||opened.has(code+":"+cat);
        const group=document.createElement("button");
        group.type="button";group.className="jp-margin-tree-category";
        group.textContent=(expanded?"▾ ":"▸ ")+label+" ("+rows.length+")";
        group.setAttribute("aria-expanded",String(expanded));
        group.addEventListener("click",()=>{const key=code+":"+cat;opened.has(key)?opened.delete(key):opened.add(key);refresh()});
        list.appendChild(group);
        if(!expanded)continue;
        for(const c of rows){
          if(count++>=260)break;
          const selected=!!selectedChart&&Number(c.page)===Number(selectedChart.page)&&
            displayAirportCode(c)===displayAirportCode(selectedChart);
          const b=document.createElement("button");
          b.type="button";b.className="jp-margin-tree-chart"+(selected?" is-selected":"");
          b.dataset.chartPage=String(c.page);
          const number=displayChartNumber(c);
          b.textContent=(number?number+" · ":"")+displayChartName(c);
          b.title=b.textContent;
          b.setAttribute("aria-current",selected?"page":"false");
          b.addEventListener("click",()=>goToChart(c));
          list.appendChild(b);
          if(selected)highlighted=b;
        }
      }
    }
    if(!list.children.length){
      const empty=document.createElement("p");empty.className="jp-margin-tree-empty";
      empty.textContent="No airports or procedures match";list.appendChild(empty);
    }
    if(!q&&highlighted)requestAnimationFrame(()=>putFocusInView(list,highlighted));
  }
  function attach(){
    const layer=document.getElementById("chartTransformLayer");
    if(!layer||!selectedChart)return;
    let host=layer.querySelector("#jpMarginChartTree");
    if(!host){
      host=document.createElement("aside");
      host.id="jpMarginChartTree";
      host.className="jp-margin-chart-tree";
      host.setAttribute("aria-label","Airport chart tree in the white PDF margin");
      host.innerHTML='<div class="jp-margin-tree-header"><button class="jp-margin-tree-toggle" type="button" aria-label="Toggle chart list" aria-expanded="true">‹</button><strong>CHARTS</strong></div><div class="jp-margin-tree-content"><input class="jp-margin-tree-search" type="search" placeholder="ICAO · IATA · city · country · procedure" aria-label="Search airports and procedures" autocomplete="off"><div class="jp-margin-tree-list" role="navigation" aria-label="Available airport charts"></div></div>';
      const toggle=host.querySelector(".jp-margin-tree-toggle");
      toggle.addEventListener("click",()=>{open=!open;refresh()});
      host.querySelector(".jp-margin-tree-search").addEventListener("input",e=>{query=e.target.value;refresh();e.target.focus()});
      host.addEventListener("pointerdown",e=>e.stopPropagation());
      host.addEventListener("pointermove",e=>e.stopPropagation());
      host.addEventListener("pointerup",e=>e.stopPropagation());
      host.addEventListener("wheel",e=>e.stopPropagation(),{passive:true});
      layer.appendChild(host);
    }
    opened.add(selectedAirport+":"+(selectedChart.category||""));
    refresh();
    queueSafePosition();
  }
  window.addEventListener("jeppiran-chart-rendered",attach);
  // Chart selection and PDF decode occur asynchronously. Tree updates only
  // after the matching immutable PDF page has finished rendering.
  document.addEventListener("DOMContentLoaded",attach);
})();