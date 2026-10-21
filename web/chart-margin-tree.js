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
  const opened=new Set();
  // iPad status bars occupy screen pixels, while this navigation tree lives
  // in a zoomed PDF coordinate space. Convert clearance to unscaled PDF px,
  // so the CLOCK/BATTERY area is never covered in fullscreen at any zoom.
  const TREE_SCREEN_CLEARANCE=48;
  let watchedLayer=null,layerTransformObserver=null,lastLayerScale=0,layoutFrame=0;
  function layerScale(layer){
    const width=layer?.offsetWidth||0;
    const rendered=layer?.getBoundingClientRect().width||0;
    return width>0&&rendered>0?rendered/width:1;
  }
  function positionTreeBelowStatusBar(){
    const host=document.getElementById("jpMarginChartTree");
    const layer=host?.parentElement;
    if(!host||!layer)return;
    if(!document.body.classList.contains("viewer-fullscreen")){
      host.style.removeProperty("top");
      host.style.removeProperty("max-height");
      return;
    }
    const rect=layer.getBoundingClientRect();
    const scale=layerScale(layer);
    const bodyInset=parseFloat(getComputedStyle(document.body).paddingTop)||0;
    const visualTop=window.visualViewport?.offsetTop||0;
    const screenTop=visualTop+Math.max(TREE_SCREEN_CLEARANCE,bodyInset+12);
    // Respect PDF margin coordinates: neither move/reflow the PDF canvas nor
    // position the list in a separate, fixed navigation column.
    const localTop=Math.max(8,Math.ceil((screenTop-rect.top)/scale));
    const viewportBottom=visualTop+(window.visualViewport?.height||window.innerHeight);
    const visibleHeight=(viewportBottom-Math.max(screenTop,rect.top+localTop*scale)-12)/scale;
    const paperHeight=layer.offsetHeight-localTop-8;
    const maxHeight=Math.max(38,Math.min(685,visibleHeight,paperHeight));
    const nextTop=localTop+"px",nextHeight=Math.floor(maxHeight)+"px";
    if(host.style.top!==nextTop)host.style.top=nextTop;
    if(host.style.maxHeight!==nextHeight)host.style.maxHeight=nextHeight;
  }
  function requestSafeTreePosition(){
    if(layoutFrame)return;
    layoutFrame=requestAnimationFrame(()=>{
      layoutFrame=0;positionTreeBelowStatusBar();
    });
  }
  function watchTreeLayer(layer){
    if(watchedLayer===layer)return;
    layerTransformObserver?.disconnect();
    watchedLayer=layer;
    lastLayerScale=layerScale(layer);
    layerTransformObserver=new MutationObserver(()=>{
      const now=layerScale(layer);
      // Panning must carry the tree WITH the paper. Adjust only for changes
      // in PDF zoom (or an actual viewport resize).
      if(Math.abs(now-lastLayerScale)>.002){
        lastLayerScale=now;
        requestSafeTreePosition();
      }
    });
    layerTransformObserver.observe(layer,{attributes:true,attributeFilter:["style"]});
  }
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
    watchTreeLayer(layer);
    // Apply immediately after each new PDF page, before the first user tap.
    positionTreeBelowStatusBar();
  }
  window.addEventListener("resize",requestSafeTreePosition);
  window.addEventListener("orientationchange",()=>setTimeout(requestSafeTreePosition,180));
  window.visualViewport?.addEventListener("resize",requestSafeTreePosition);
  window.addEventListener("fullscreenchange",requestSafeTreePosition);
  window.addEventListener("webkitfullscreenchange",requestSafeTreePosition);
  window.addEventListener("jeppiran-chart-rendered",attach);
  // Chart selection and PDF decode occur asynchronously. Tree updates only
  // after the matching immutable PDF page has finished rendering.
  document.addEventListener("DOMContentLoaded",attach);
})();