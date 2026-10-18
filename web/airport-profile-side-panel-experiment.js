/* Owner-requested OIII-only collapsible profile side-panel experiment. */
(() => {
  "use strict";
  const root=document.getElementById("airportProfile");
  if(!root)return;
  let queued=false;
  let active=false;
  let collapsed=false;

  function code(){
    return root.querySelector(".profile-icao")?.textContent.trim().toUpperCase()||"";
  }
  function remove(){
    root.querySelector(":scope > .jp-side-panel-toggle")?.remove();
    root.classList.remove("jp-side-panel-experiment","jp-side-panel-collapsed");
    active=false;
  }
  function label(button){
    const isClosed=root.classList.contains("jp-side-panel-collapsed");
    button.setAttribute("aria-expanded",String(!isClosed));
    button.setAttribute("aria-label",isClosed?"Open airport information panel":"Hide airport information panel");
    button.title=isClosed?"Open airport information":"Hide airport information";
    button.innerHTML=isClosed?'<span aria-hidden="true">‹</span>':'<span aria-hidden="true">›</span>';
  }
  function install(){
    if(active)return;
    active=true;
    root.classList.add("jp-side-panel-experiment");
    root.classList.toggle("jp-side-panel-collapsed",collapsed);
    const button=document.createElement("button");
    button.type="button";
    button.className="jp-side-panel-toggle";
    button.addEventListener("click",()=>{
      collapsed=!root.classList.contains("jp-side-panel-collapsed");
      root.classList.toggle("jp-side-panel-collapsed",collapsed);
      label(button);
    });
    label(button);
    root.append(button);
  }
  function apply(){
    queued=false;
    if(code()==="OIII")install();
    else if(active)remove();
  }
  function queue(){
    if(!queued){queued=true;requestAnimationFrame(apply)}
  }
  new MutationObserver(queue).observe(root,{childList:true,subtree:true});
  queue();
  window.JEPPIRAN_OIII_SIDE_PANEL_EXPERIMENT=Object.freeze({airport:"OIII",reversible:true});
})();
