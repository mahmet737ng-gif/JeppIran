/* All directed stand, runway, taxiway connectivity QA for a reviewed graph. */
"use strict";
const fs=require("node:fs"),path=require("node:path"),E=require("../../web/taxi-engine.js");
const up=x=>String(x||"").toUpperCase();
function expected(S,T,R){const standRunway=S*R*2,standStand=S*(S-1),
 taxiStand=T*S*2,taxiRunway=T*R*2,taxiTaxi=T*(T-1);
 return {standRunway,standStand,taxiStand,taxiRunway,taxiTaxi,
 total:standRunway+standStand+taxiStand+taxiRunway+taxiTaxi};
}
function assess(inv,graph){
 const stands=[...new Set((inv.stands||[]).map(s=>up(s.id)))];
 const taxis=[...new Set((inv.taxiways||[]).map(s=>up(s.id)))];
 const runways=[...new Set((inv.runwayPolygons||[]).flatMap(r=>r.ends).map(up))];
 const totals=expected(stands.length,taxis.length,runways.length);
 const refuse=reason=>({airport:inv.airport,cycle:inv.cycle,ready:false,
  expected:totals,passed:0,failed:totals.total,executed:0,
  reason,simulatorOnly:true,flightApproval:false});
 if(!stands.length||!taxis.length||!runways.length)return refuse("INVENTORY_MISSING");
 if(!graph||graph.enabled!==true||graph.source?.reviewStatus!=="SIM_QA_REVIEWED"||
    graph.source?.sha256!==inv.source?.sha256||
    graph.airport!==inv.airport||String(graph.cycle)!==String(inv.cycle))
   return refuse("NO_SOURCE_REVIEWED_GRAPH");
 const verified=E.validate(graph);
 if(!verified.ok)return refuse("GRAPH_VALIDATION_FAILED: "+verified.errors.join("; "));
 const router=E.create(graph),cases=[],failures=[];
 const test=(kind,from,to,command,opt,originNode,targetNode)=>{
  const result=router.plan(command,opt||{}),route=result.route;
  const reason=!route?(result.error||"no route"):
   !route.edges?.length?"no physical segments":
   !originNode||!targetNode?"missing reviewed source endpoint":
   route.path?.[0]!==originNode||route.path?.at(-1)!==targetNode?
     "path endpoints do not match requested named stand/taxiway/runway":
   route.edges.some(e=>e.kind==="runway")?"implicit runway crossing":
   route.edges.some(e=>!e.source||!["mapped","qa"].includes(e.quality))?
    "unapproved source edge":null;
  const ok=!reason;
  cases.push({kind,from,to,ok,reason:reason||null});
  if(reason&&failures.length<120)failures.push(kind+" "+from+" → "+to+": "+reason);
 };
 for(const s of stands)for(const r of runways){
  test("standRunway","ST"+s,"RWY"+r,"ST"+s+" RWY"+r,{},
    typeof graph.stands[s]==="string"?graph.stands[s]:graph.stands[s]?.node,
    graph.runways?.[r]?.goalNode);
  test("standRunway","RWY"+r,"ST"+s,"RWY"+r+" ST"+s,{},
    graph.runways?.[r]?.goalNode,
    typeof graph.stands[s]==="string"?graph.stands[s]:graph.stands[s]?.node);
 }
 for(const a of stands)for(const b of stands)if(a!==b)
  test("standStand","ST"+a,"ST"+b,"ST"+a+" ST"+b,{},
    typeof graph.stands[a]==="string"?graph.stands[a]:graph.stands[a]?.node,
    typeof graph.stands[b]==="string"?graph.stands[b]:graph.stands[b]?.node);
 for(const tw of taxis)for(const s of stands){
  test("taxiStand",tw,"ST"+s,tw+" ST"+s,{},
    graph.taxiways?.[tw]?.terminalNode,
    typeof graph.stands[s]==="string"?graph.stands[s]:graph.stands[s]?.node);
  test("taxiStand","ST"+s,tw,"ST"+s+" "+tw,{},
    typeof graph.stands[s]==="string"?graph.stands[s]:graph.stands[s]?.node,
    graph.taxiways?.[tw]?.terminalNode);
 }
 for(const tw of taxis)for(const r of runways){
  test("taxiRunway",tw,"RWY"+r,tw+" RWY"+r,{},
    graph.taxiways?.[tw]?.terminalNode,graph.runways?.[r]?.goalNode);
  test("taxiRunway","RWY"+r,tw,r+" "+tw,{},
    graph.runways?.[r]?.goalNode,graph.taxiways?.[tw]?.terminalNode);
 }
 for(const a of taxis)for(const b of taxis)if(a!==b)
  test("taxiTaxi",a,b,a+" "+b,{startNode:graph.taxiways?.[a]?.terminalNode},
    graph.taxiways?.[a]?.terminalNode,graph.taxiways?.[b]?.terminalNode);
 const passed=cases.filter(c=>c.ok).length;
 return {airport:inv.airport,cycle:inv.cycle,expected:totals,executed:cases.length,
  passed,failed:totals.total-passed,ready:passed===totals.total&&cases.length===totals.total,
  simulatorOnly:true,flightApproval:false,failures,cases};
}
if(require.main===module){
 const [icaoRaw,...rest]=process.argv.slice(2),icao=up(icaoRaw);
 try{
  if(!/^[A-Z]{4}$/.test(icao))throw Error("ICAO required");
  const root=path.resolve(__dirname,"../..");
  const inv=JSON.parse(fs.readFileSync(path.join(root,"web/data/taxi-surveys",icao+".json"),"utf8"));
  const p=path.join(root,"web/data/taxi-networks",icao+".json");
  const graph=fs.existsSync(p)?JSON.parse(fs.readFileSync(p,"utf8")):null;
  const report=assess(inv,graph);
  const i=rest.indexOf("--report");
  if(i>=0&&rest[i+1]){
   const dst=path.resolve(rest[i+1]);fs.mkdirSync(path.dirname(dst),{recursive:true});
   fs.writeFileSync(dst,JSON.stringify(report,null,2)+"\n");
  }
  console.log(JSON.stringify({...report,cases:undefined,failures:report.failures?.slice(0,15)},null,2));
  if(!report.ready)process.exitCode=4;
 }catch(e){console.error(e.message);process.exitCode=5}
}
module.exports={expected,assess};
