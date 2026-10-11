/* JEPPIRAN  Ground Survey Engine v1
 * The source ADC must be visually inventoried BEFORE generating a routable
 * ground graph.  "Topologically observed" NEVER means "geometrically surveyed".
 * The engine never guesses centerlines, stand coordinates, hold nodes, runway
 * entries, or a shortest path between visually nearby marks.
 */
(function(root){"use strict";
const id=s=>String(s||"").trim().toUpperCase().replace(/^(?:STAND[ -]*|ST[ -]*)?(\d+)$/,(whole,n)=>"ST"+Number(n));
const norm=s=>String(s||"").trim().toUpperCase();
function index(raw){
  if(!raw||raw.schemaVersion!==1||!/^[A-Z]{4}$/.test(raw.airport||"")||
      !Number.isInteger(raw.chart?.globalPage))throw Error("Invalid ADC survey identity");
  const tax=new Set((raw.taxiways||[]).map(x=>norm(x.id)));
  const stand=new Set((raw.stands||[]).map(x=>"ST"+Number(x.id)));
  if(!raw.physicalRunways?.length||!tax.size||!stand.size)
    throw Error("ADC inventory must include physical runways, taxiways and stands");
  const errors=[],adj=new Map(),connections=[];
  const known=new Set([...tax,...stand]);
  const add=(a,b,e)=>{
    if(!adj.has(a))adj.set(a,new Map());
    adj.get(a).set(b,e);
  };
  for(const e of raw.connections||[]){
    const a=norm(e.from),b=norm(e.to);
    if(!known.has(a)||!known.has(b)||a===b||e.geometryStatus!=="untraced"||
        e.confidence!=="visually_observed"||!String(e.evidence||"").trim())
      errors.push("Invalid observed ADC connection: "+a+" -> "+b);
    else{
      connections.push(e);add(a,b,e);add(b,a,e);
    }
  }
  if(errors.length)throw Error(errors.join("; "));
  if(raw.routeGeometryApproved!==false||raw.geometry?.approval!=="BLOCKED"||
    raw.geometry?.coordinateSpace!=="NOT_CALIBRATED")
    throw Error("Uncalibrated ADC source may not be marked route approved");
  const candidate=(raw.candidateConnections||[]).map(e=>({from:norm(e.from),to:norm(e.to),reason:e.notes||"Hold/centreline remains unverified"}));
  const runway=new Set(raw.physicalRunways.flatMap(x=>x.ends.map(norm)));
  return {
    airport:raw.airport,chartPage:raw.chart.globalPage,
    taxiways:[...tax],stands:[...stand],runways:[...runway],
    connections:[...connections],candidateConnections:candidate,
    routeGeometryApproved:false,
    neighbors(name){return [...(adj.get(norm(name))?.keys()||[])].sort()},
    parse(command){
      const tokens=norm(command).replace(/^(?:QA|SIM QA)\s+/,"").replace(/[>,]+/g," ").split(/\s+/).filter(Boolean).map(id);
      if(tokens.length<2)return {ok:false,error:"Enter a stand and one or more taxiway names"};
      for(const t of tokens){
        if(!known.has(t))return {ok:false,error:"Unrecognized or unscanned ADC identifier: "+t};
      }
      const traversed=[];
      for(let i=1;i<tokens.length;i++){
        const from=tokens[i-1],to=tokens[i],edge=adj.get(from)?.get(to);
        if(!edge)
          return {ok:false,error:"No observed direct adjacency: "+from+" -> "+to+". No shortcut invented.",
            confirmedPrefix:traversed};
        traversed.push({from,to,kind:edge.kind,evidence:edge.evidence});
      }
      return {ok:true,airport:raw.airport,tokens,segments:traversed,
        topologyStatus:"OBSERVED_IN_ADC",
        geometryStatus:"NOT_VECTOR_TRACED",
        canDraw:false,canRoute:false,
        notice:"Labels and adjacency are visually observed; the exact taxi centreline, pushback and hold positions have not been surveyed. No chart route drawn."};
    }
  };
}
const api={version:"1.0.0",index};
root.JEPPIRAN_TAXI_SURVEY=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
