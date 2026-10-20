/* JEPPIRAN V2621 — searchable chart tree in the dedicated left PDF workspace margin.
 * Metadata only: no PDF, simulator, georeference, TAXI or CDFA changes. */
(()=>{
  "use strict";
  const workspace=document.getElementById("jpCdfaWorkspace");
  const view=document.getElementById("chartsView");
  if(!workspace||!view)return;
  const nav=document.createElement("aside");
  nav.id="jpChartMarginNav";
  nav.setAttribute("aria-label","Airport procedure chart tree");
  nav.innerHTML='<div class="jp-chart-margin-head"><strong id="jpChartMarginAirport"></strong><button id="jpChartMarginClose" type="button" aria-label="Collapse chart tree">×</button></div>'+
    '<input id="jpChartMarginSearch" type="search" aria-label="Search airports or procedures" placeholder="ICAO / IATA / city / procedure" autocomplete="off" />'+
    '<div id="jpChartMarginList" class="jp-chart-margin-list" role="tree"></div>';
  const toggle=document.createElement("button");
  toggle.id="jpChartMarginToggle";
  toggle.type="button";toggle.textContent="☰ CHARTS";
  toggle.setAttribute("aria-label","Show airport chart tree");
  toggle.setAttribute("aria-controls","jpChartMarginNav");
  toggle.setAttribute("aria-expanded","false");
  workspace.insertBefore(nav,workspace.firstChild);
  workspace.appendChild(toggle);
  const search=nav.querySelector("#jpChartMarginSearch");
  const list=nav.querySelector("#jpChartMarginList");
  const heading=nav.querySelector("#jpChartMarginAirport");
  const groups=[["Airport","AIRPORT"],["STAR","STAR"],["SID","SID"],["Approach","APP"],["Other","OTHER"]];
  const opened=new Set();
  let manuallyToggled=false,navOpen=false,lastPage=null;
  function available(){
    return typeof selectedChart!=="undefined"&&!!selectedChart &&
      typeof selectedAirport!=="undefined"&&!!selectedAirport;
  }
  function setOpen(next,manual=false){
    if(manual)manuallyToggled=true;
    navOpen=!!next&&available();
    view.classList.toggle("jp-chart-margin-open",navOpen);
    toggle.setAttribute("aria-expanded",String(navOpen));
    toggle.setAttribute("aria-label",navOpen?"Collapse airport chart tree":"Show airport chart tree");
    nav.setAttribute("aria-hidden",String(!navOpen));
    if(navOpen)revealCurrent();
    // The original PDF renderer must refit when the dedicated margin width changes.
    if(manual&&typeof refitSelectedChartForLayout==="function"&&document.getElementById("pdfCanvas")){
      setTimeout(()=>{if(available())void refitSelectedChartForLayout()},80);
    }
  }
  function revealCurrent(){
    if(!navOpen)return;
    const item=list.querySelector(".is-current");
    if(!item)return;
    requestAnimationFrame(()=>{
      const bounds=list.getBoundingClientRect(),itemBounds=item.getBoundingClientRect();
      if(itemBounds.top<bounds.top)list.scrollTop-=bounds.top-itemBounds.top+8;
      else if(itemBounds.bottom>bounds.bottom)list.scrollTop+=itemBounds.bottom-bounds.bottom+8;
    });
  }
  function selectedCode(){return String(selectedAirport||"");}
  function metaText(){
    const code=selectedCode(),rec=(airportMetadata&&airportMetadata[code])||{};
    const legacy=(AIRPORTS&&AIRPORTS[code])||[];
    const fixed=(AIRPORT_PROFILE&&AIRPORT_PROFILE[code])||{};
    return [code,rec.iata||fixed.iata||"",rec.city||legacy[1]||"",rec.country||"",
      rec.name||legacy[0]||""].join(" ").toUpperCase();
  }
  function render(){
    list.replaceChildren();
    if(!available()){heading.textContent="CHARTS";return;}
    heading.textContent=selectedCode()+" · CHARTS";
    const q=search.value.trim().toUpperCase();
    const airportMatch=q&&metaText().includes(q);
    const seq=charts.filter(c=>displayAirportCode(c)===selectedAirport)
      .sort((a,b)=>Number(a.page)-Number(b.page));
    let count=0;
    const savedScroll=list.scrollTop;
    for(const [key,label] of groups){
      const all=seq.filter(c=>(c.category||"Other")===key);
      if(!all.length)continue;
      const items=!q||airportMatch?all:all.filter(c=>
        (String(displayChartName(c))+" "+String(displayChartNumber(c))).toUpperCase().includes(q));
      if(!items.length)continue;
      count+=items.length;
      const group=document.createElement("section");
      group.className="jp-chart-margin-group";
      group.setAttribute("role","group");
      const isOpen=q.length>0||opened.has(key);
      const head=document.createElement("button");
      head.type="button";head.className="jp-chart-margin-category";
      head.setAttribute("aria-expanded",String(isOpen));
      head.textContent=(isOpen?"▾ ":"▸ ")+label+" ("+items.length+")";
      head.addEventListener("click",()=>{
        opened.has(key)?opened.delete(key):opened.add(key);
        render();
      });
      group.appendChild(head);
      if(isOpen){
        for(const c of items){
          const current=!!selectedChart&&Number(c.page)===Number(selectedChart.page);
          const row=document.createElement("button");
          row.type="button";
          row.className="jp-chart-margin-chart"+(current?" is-current":"");
          row.setAttribute("role","treeitem");
          row.setAttribute("aria-selected",String(current));
          const title=String(displayChartName(c)),number=String(displayChartNumber(c)||"");
          row.textContent=(number?number+" · ":"")+title;
          row.title=title;
          row.addEventListener("click",()=>{
            opened.add(key);
            if(!current)selectChart(c,{keepTreeClosed:true});
            else revealCurrent();
          });
          group.appendChild(row);
        }
      }
      list.appendChild(group);
    }
    if(!count){
      const empty=document.createElement("p");
      empty.className="jp-chart-margin-empty";
      empty.textContent="No matching airport or procedure";
      list.appendChild(empty);
    }
    list.scrollTop=savedScroll;
    revealCurrent();
  }
  function syncSelection(){
    if(!available()){setOpen(false);return;}
    const key=Number(selectedChart.page);
    const changed=key!==lastPage;lastPage=key;
    if(changed)opened.add(selectedChart.category||"Other");
    if(!manuallyToggled)setOpen(window.innerWidth>=720);
    render();
  }
  toggle.addEventListener("click",()=>setOpen(!navOpen,true));
  nav.querySelector("#jpChartMarginClose").addEventListener("click",()=>setOpen(false,true));
  search.addEventListener("input",render);
  nav.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();setOpen(false,true);toggle.focus();}});
  window.addEventListener("jeppiran-chart-selected",syncSelection);
  window.addEventListener("resize",()=>{
    if(!manuallyToggled&&available()&&navOpen!==(window.innerWidth>=720)){
      setOpen(window.innerWidth>=720);
      if(document.getElementById("pdfCanvas")&&typeof refitSelectedChartForLayout==="function")
        setTimeout(()=>{if(available())void refitSelectedChartForLayout()},80);
    }
  });
  syncSelection();
})();
