/* JEPPIRAN · LTFM printed stand label index inspector (simulator QA).
 * This tool never approves a movement or turns proximity into graph edges.
 */
(function(root){"use strict";
let task=null,container=null,lastAirport="";
function getData(){
  if(!task)task=Promise.all([
    fetch("./data/taxi-stand-registry/LTFM.json",{cache:"no-store"}),
    fetch("./data/taxi-stand-candidates/LTFM.json",{cache:"no-store"}),
    fetch("./data/taxi-egress-geometry/LTFM.json",{cache:"no-store"}),
    fetch("./data/taxi-stand-leads/LTFM.json",{cache:"no-store"}),
    fetch("./data/taxi-stand-egress-routes/LTFM.json",{cache:"no-store"})
  ]).then(async([registryResponse,candidateResponse,egressResponse,leadResponse,routesResponse])=>{
    if(!registryResponse.ok||!candidateResponse.ok||!egressResponse.ok||!leadResponse.ok||!routesResponse.ok)
      throw Error("Published stand registry or mapped egress-edge geometry unavailable offline");
    const [registry,candidates,geometry,leads,routes]=await Promise.all([
      registryResponse.json(),candidateResponse.json(),egressResponse.json(),
      leadResponse.json(),routesResponse.json()]);
    if(registry.airport!=="LTFM"||candidates.airport!=="LTFM"||
       String(registry.cycle)!=="2621"||String(candidates.cycle)!=="2621"||
       Object.keys(registry.stands||{}).length<370||
       Object.keys(candidates.stands||{}).length<260||
       geometry.airport!=="LTFM"||String(geometry.cycle)!=="2621"||
       !geometry.stands||geometry.stats.standsWithMappedPublishedTaxiwayGeometry<195||
       leads.airport!=="LTFM"||String(leads.cycle)!=="2621"||
       leads.stats.exactJoinedStandIdentifiers<350||
       routes.airport!=="LTFM"||String(routes.cycle)!=="2621"||
       routes.stats.standsWithSourceContinuousPathToPublishedNamedTaxiway<300)
      throw Error("Wrong airport/cycle in merged stand inventory");
    const merged={airport:"LTFM",cycle:"2621",stats:registry.stats,
      leadStats:leads.stats,routeStats:routes.stats,stands:{}};
    for(const [id,record] of Object.entries(registry.stands))
      merged.stands[id]={...record,candidates:candidates.stands[id]?.candidates||[],
      egress:geometry.stands[id]||null,lead:leads.stands[id]||null,
      egressPaths:routes.stands[id]||null};
    return merged;
  }).catch(error=>{task=null;throw error});
  return task;
}
function text(tag,str,parent){
 const n=document.createElement(tag);n.textContent=str;parent.appendChild(n);return n
}
function install(){
 const panel=document.getElementById("taxiQaPanel");
 if(!panel||document.getElementById("taxiStandCandidateInspector"))return;
 const wrapper=document.createElement("section");wrapper.id="taxiStandCandidateInspector";
 wrapper.style.cssText="padding:9px 11px;margin:7px 0;border:1px solid rgba(164,205,226,.25);border-radius:10px;background:rgba(17,32,45,.75);color:#e7efff";
 text("strong","ISTANBUL · ALL STANDS / TAXIWAY RELATIONS (QA)",wrapper);
 const caption=text("div","Loading cycle 2621 Jeppesen label anchors...",wrapper);caption.style.fontSize="11px";
 const finder=document.createElement("input");finder.type="search";finder.placeholder="Find stand D3, 601, K50…";
 finder.style.cssText="display:block;width:100%;box-sizing:border-box;margin:7px 0;padding:7px;color:inherit;background:rgba(12,25,38,.8);border:1px solid #58687c;border-radius:6px";
 const list=document.createElement("select");list.size=5;list.style.cssText="display:block;width:100%;min-height:95px;color:inherit;background:#132536;border:1px solid #58687c;border-radius:6px";
 const pathSelect=document.createElement("select");
 pathSelect.id="taxiStandSourceRouteChoice";
 pathSelect.style.cssText="display:block;width:100%;min-height:32px;margin-top:7px;color:#f3d9ed;background:#21152c;border:1px solid #954f80;border-radius:6px";
 pathSelect.setAttribute("aria-label","Choose source-mapped stand exit route to published taxiway");
 const details=text("div","Select a stand to inspect candidate taxiways.",wrapper);
 details.style.cssText="white-space:pre-line;font-size:11px;line-height:1.5;padding-top:7px";
 wrapper.insertBefore(finder,details);wrapper.insertBefore(list,details);
 wrapper.insertBefore(pathSelect,details);
 panel.appendChild(wrapper);container=wrapper;
 getData().then(data=>{
  if(!wrapper.isConnected)return;
  const ids=Object.keys(data.stands).sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
  const stats=data.stats||{};
  caption.textContent=ids.length+" chart-mentioned stands: "+
    (stats.individuallyPrinted||0)+" individual label anchors / "+
    (stats.roundedGroupOnly||0)+" rounded INS groups · "+
    (stats.publishedPushbackStands||0)+" with published pushback taxiways · "+
    data.leadStats.exactJoinedStandIdentifiers+" stands with actual OSM parking-centerline geometry sharing exact taxi graph nodes · "+
    data.routeStats.standsWithSourceContinuousPathToPublishedNamedTaxiway+" continuous source paths to chart-named taxiways · "+
    (stats.publishedNameAndNearestEdgeAgreements||0)+" chart-pushback named nearby lines. Jeppesen/ATC approval pending.";
  function updateList(){
    const filter=finder.value.trim().toUpperCase();
    list.replaceChildren();
    for(const id of ids.filter(x=>x.includes(filter))){
      const option=document.createElement("option");option.value=id;option.textContent="ST "+id;
      list.appendChild(option)
    }
  }
  finder.oninput=updateList;
  list.onchange=()=>{
   const id=list.value, entry=data.stands[id];if(!entry)return;
   root.JEPPIRAN_TAXI?.previewStandCandidate?.(id,entry);
   const related=(entry.publishedPushbackTaxiways||[]).join(", ")||"none extracted";
   const mapped=(entry.egress?.publishedNamedTaxiwaySegments||[])
     .map(g=>g.taxiway+" ("+g.segments.length+" original OSM segments)").join(", ");
   const leadPaths=(entry.lead?.sourceParkingLeadVariants||[])
     .filter(x=>x.geometryContinuous);
   const fullPaths=entry.egressPaths?.physicalMappedSourcePaths||[];
   pathSelect.replaceChildren();
   const please=document.createElement("option");please.value="";
   please.textContent="Choose mapped stand exit to published taxiway";pathSelect.appendChild(please);
   fullPaths.forEach((route,index)=>{
     const opt=document.createElement("option");opt.value=String(index);
     opt.textContent="ST"+id+" → "+route.publishedTargetTaxiway+" · "+route.totalSourceGeometryLengthMetres+" m (OSM QA)";
     pathSelect.appendChild(opt);
   });
   pathSelect.onchange=()=>{
     const ix=Number(pathSelect.value);
     if(!pathSelect.value||!Number.isInteger(ix)||!fullPaths[ix])return;
     root.JEPPIRAN_TAXI?.previewStandSourceRoute?.(id,entry,fullPaths[ix]);
   };
   const available=fullPaths.map((x,i)=>
     ({idx:i,name:x.publishedTargetTaxiway,osmWay:x.parkingWay,
       distance:x.totalSourceGeometryLengthMetres}));
   const leadList=leadPaths.map(w=>"OSM parking way "+w.osmParkingWay+
     " · "+w.lengthMeters+" m · exact join "+w.exactTaxiGraphJoinNode+
     " ("+(w.taxiwayNamesAtGraphJoin||[]).join("/")+")").join("\n");
   const notes=(entry.candidates||[]).map(v=>" • "+(v.taxiway||"UNNAMED")+
     " · "+v.distanceMeters+" m"+(v.chartNamedTaxiwayMatch?" · matches published pushback name":" · proximity only")).join("\n");
   details.textContent="ST "+id+" · "+
    (entry.hasIndividualStandPosition?"printed parking label":"shared INS coordinate group (NOT a stand position)")+
    "\nPUBLISHED PUSHBACK TWYs: "+related+
    "\nCHARTS: "+(entry.sourcePushbackCharts||[]).join(", ")+
    "\nNON-GEOMETRIC INS GROUP: "+(entry.officialInsGroups||[]).map(x=>x.group).join(" | ")+
    "\nREAL OSM STAND CENTERLINE(S) ("+leadPaths.length+"):\n"+
    (leadList||"No original parking-position way connected to a taxi graph node")+
    "\nPHYSICALLY CONNECTED STAND TO PUBLISHED NAMED TWY ("+fullPaths.length+"):\n"+
    (available.map(x=>" • via "+x.name+" · "+x.distance+" m · OSM way "+x.osmWay).join("\n")||"No source-continuous path in the existing graph")+
    "\nNEARBY NAMED OSM EDGES: "+(mapped||"none independently chart corroborated")+
    "\nNEARBY GRAPH EDGES ("+entry.candidates.length+"):\n"+(notes||"No individual near-edge geometry")+
    "\nSOLID MAGENTA = original OSM parking/taxiway geometry, with exact shared OSM nodes. "+
    "Jeppesen pushback direction/clearance NOT verified. No straight-line connections invented.";
  };
  updateList();
 }).catch(e=>{caption.textContent=String(e.message||e);details.textContent="No generated connections loaded."});
}
async function viewStand(id){
  id=String(id||"").replace(/^(?:STAND\s*|ST)/i,"").trim().toUpperCase();
  const data=await getData(),entry=data.stands[id];
  if(!entry)return null;
  install();
  // install() fills the controls on a settled promise microtask; allow it to
  // complete before assigning select.value so direct STxxx search works.
  await Promise.resolve();
  if(container){
    const search=container.querySelector('input[type="search"]');
    const list=container.querySelector("select");
    if(search) {
      search.value=id;search.dispatchEvent(new Event("input",{bubbles:true}));
    }
    if(list){
      list.value=id;list.dispatchEvent(new Event("change",{bubbles:true}));
    }
  }
  return entry;
}
async function previewNamedSourceRoute(id,target){
  const data=await getData(),name=String(id||"").replace(/^(ST|STAND\s*)/i,"").toUpperCase(),
    goal=String(target||"").trim().toUpperCase(),entry=data.stands[name];
  if(!entry)return {error:"Stand "+name+" is not listed in the chart-indexed airport data."};
  await viewStand(name);
  const options=(entry.egressPaths?.physicalMappedSourcePaths||[])
    .filter(x=>x.publishedTargetTaxiway===goal);
  if(!options.length)return {error:"No source-continuous OSM stand exit to TWY "+goal+
    " from ST"+name+"; no shortcut or simulated straight connector is permitted."};
  if(options.length!==1)return {error:"Multiple source stand exits to "+goal+
    " from ST"+name+" ("+options.length+"). Choose a specific geometry in STAND ROUTES; none selected automatically."};
  root.JEPPIRAN_TAXI?.previewStandSourceRoute?.(name,entry,options[0]);
  const sourceOptions=container?.querySelector("#taxiStandSourceRouteChoice");
  if(sourceOptions){
    const index=(entry.egressPaths?.physicalMappedSourcePaths||[]).indexOf(options[0]);
    sourceOptions.value=String(index);
  }
  return {route:options[0],name};
}
root.JEPPIRAN_LTFM_STANDS={getData,viewStand,previewNamedSourceRoute};
function refresh(){
 const icao=typeof selectedAirport==="string"?selectedAirport:"";
 if(icao==="LTFM"){install();if(container)container.hidden=false}
 else if(container)container.hidden=true;
 lastAirport=icao
}
new MutationObserver(()=>{if(document.getElementById("taxiQaPanel")&&!container)refresh()})
  .observe(document.documentElement,{subtree:true,childList:true});
root.addEventListener("jeppiran-chart-rendered",refresh);
root.addEventListener("hashchange",refresh);
setTimeout(refresh,500);
})(typeof window!=="undefined"?window:globalThis);
