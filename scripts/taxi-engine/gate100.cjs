/* JEPPIRAN TAXI ENGINE V4 — exhaustive all-stands x all-runway-ends gate.
 * Pure Node; no airport-specific code. Simulator QA ONLY, not navigation.
 * This is the LAST gate, not a geometry generator. Candidate ink, near-line
 * guesses and incomplete graphs cannot pass.
 */
"use strict";
const fs=require("node:fs");
const E=require("../../web/taxi-engine.js");
const U=x=>String(x||"").trim().toUpperCase();
function uniq(xs){return [...new Set(xs)]}
function audit100({inventory,graph,sourceSha256}={}){
 const failures=[],cases=[],reasons={},fail=(code,detail)=>{
  const msg=code+" · "+detail;failures.push(msg);reasons[code]=(reasons[code]||0)+1;
 };
 const no=(reason)=>({airport:inventory?.airport||graph?.airport||null,
  state:"NOT_READY",percent:0,readyForSimulatorTest:false,
  failures:[reason],cases:[],totals:{expected:0,passed:0,failed:0},reasons:{SOURCE:1}});
 if(!inventory)return no("SOURCE: Airport inventory missing");
 if(!graph){
  const stands=(inventory.stands||[]).length;
  const ends=(inventory.runwayPolygons||[]).reduce((sum,r)=>sum+(r.ends||[]).length,0);
  const expected=stands*ends*2;
  return {airport:inventory.airport,cycle:String(inventory.cycle),
    state:"NOT_READY",percent:0,readyForSimulatorTest:false,
    totals:{stands,taxiways:(inventory.taxiways||[]).length,
      runwayEnds:ends,expected,executed:0,passed:0,failed:expected},
    failureCount:1,reasons:{NO_PHYSICAL_GRAPH:1},
    failures:["NO_PHYSICAL_GRAPH · No complete source-reviewed taxiway, stand-lead, hold-short and page-portal network exists."],
    cases:[],simulatorCheckPending:false,flightOperationalApproval:false,
    note:"All "+expected+" mandatory source-reviewed stand↔runway directional tests remain blocked. SOURCE PDF graphics and georegistration are not sufficient."};
 }
 const icao=U(inventory.airport);
 if(!/^[A-Z]{4}$/.test(icao)||icao!==U(graph.airport))
  return no("SOURCE: Airport code mismatch");
 if(String(inventory.cycle)!==String(graph.cycle))
  fail("CYCLE","PDF and graph cycle mismatch");
 const source=inventory.source?.sha256;
 if(!/^[0-9a-f]{64}$/.test(source||"")||
    sourceSha256&&source!==sourceSha256||
    graph.source?.sha256!==source)
  fail("SOURCE","Original PDF SHA256 must match inventory and graph");
 const stands=uniq((inventory.stands||[]).map(s=>U(s.id)).filter(Boolean));
 const taxiways=uniq((inventory.taxiways||[]).map(t=>U(t.id)).filter(Boolean));
 const ends=uniq((inventory.runwayPolygons||[]).flatMap(r=>r.ends||[]).map(U).filter(Boolean));
 const physical=(inventory.runwayPolygons||[]).map(r=>r.physicalId);
 if(!stands.length||!taxiways.length||ends.length<2||physical.length<1)
  fail("INVENTORY","Missing source stands, named taxiways or both runway ends");
 if(stands.length!==(inventory.stands||[]).length)fail("INVENTORY","Duplicate stand IDs");
 if(taxiways.length!==(inventory.taxiways||[]).length)fail("INVENTORY","Duplicate taxiway IDs");
 if(ends.length!==(inventory.runwayPolygons||[]).length*2)
  fail("INVENTORY","Duplicate/missing runway designators");
 if(graph.enabled!==true||graph.source?.reviewStatus!=="SIM_QA_REVIEWED"||
    graph.simulatorTestOnly!==true)
  fail("REVIEW","Graph must be source-reviewed and enabled for simulator QA only");
 for(const id of stands)if(!graph.stands?.[id])fail("STAND_LEAD","ST"+id+" missing physical stand node");
 const presentTaxi=new Set((graph.edges||[]).filter(e=>
  !e.closed&&["mapped","qa"].includes(e.quality)&&
  e.kind==="taxiway").map(e=>U(e.taxiway||e.label)));
 for(const id of taxiways){
  const isAccess=/^R[1-6]$/.test(id);
  if(!presentTaxi.has(id)&&!(isAccess&&
     (graph.edges||[]).some(e=>U(e.label||e.taxiway)===id&&
      e.kind==="connector"&&e.quality==="mapped")))
    fail("TAXI_LINE",id+" has no source-reviewed polyline");
 }
 const usedHoldNodes=new Map();
 for(const end of ends){
  const r=graph.runways?.[end];
  if(r?.goalNode){
    if(usedHoldNodes.has(r.goalNode))
      fail("HOLD_SHORT","RWY "+end+" shares a published hold node with "+usedHoldNodes.get(r.goalNode));
    usedHoldNodes.set(r.goalNode,end);
  }
  if(!r?.holdShortReviewed||r.holdSource?.verified!==true||
     !Number.isInteger(r.holdSource?.page)||
     !Array.isArray(r.holdSource?.sourceDrawingIds)||
     !r.holdSource.sourceDrawingIds.length)
    fail("HOLD_SOURCE","RWY "+end+" lacks original PDF line/point evidence for its holding position");
  if(!r?.goalNode||r.goalKind!=="hold")
   fail("HOLD_SHORT",end+" needs real referenced hold-short goal, not runway stripe/threshold");
  if(!r?.axis||!r.axisSource)
   fail("RUNWAY_AXIS",end+" needs independent physical runway axis");
  if(r&&!physical.includes(r.physicalId))
   fail("RUNWAY_IDENTITY",end+" attached to unknown runway");
 }
 // A backtrack token must map to actual source-backed runway centerline,
 // never to a taxi apron edge or a freehand shortcut between parallel RWYs.
 for(const end of ends){
  const runway=graph.runways?.[end];
  const bt=(graph.edges||[]).filter(e=>
    U(e.label||e.taxiway)==="BT"+end&&e.kind==="runway"&&
    e.physicalRunway===runway?.physicalId&&
    ["mapped","qa"].includes(e.quality)&&e.source);
  if(!bt.length)fail("BACKTRACK","RWY "+end+" needs original-axis source-backed BT"+end+" segment(s)");
 }
 const checked=E.validate(graph);
 if(!checked.ok)for(const e of checked.errors)fail("GRAPH",e);
 let router=null;
 if(checked.ok){
  try{router=E.create(graph)}catch(err){fail("GRAPH",err.message)}
 }
 const expected=stands.length*ends.length*2;
 function inspect(route,id,kind,destination){
  if(!route?.route)return route?.error||"route unavailable";
  const r=route.route;
  if(!r.edges?.length)return "empty route";
  if(r.edges.some(e=>e.quality==="projected"||e.quality==="blocked"))
    return "unreviewed projected/blocked geometry";
  if(r.edges.some(e=>e.kind==="runway"))
    return "implicit runway crossing or backtrack";
  if(r.edges.some(e=>!e.source))
    return "edge without source";
  if(r.path?.[0]!==id)return "origin mismatch";
  if(r.path?.at(-1)!==destination)return "destination mismatch";
  return null;
 }
 if(router){
  for(const stand of stands){
   for(const runway of ends){
    const gate=graph.runways?.[runway]?.goalNode;
    const startEntry=graph.stands?.[stand];
    const start=typeof startEntry==="string"?startEntry:startEntry?.node;
    const out=router.plan("ST"+stand+" RWY "+runway);
    const back=gate?router.plan("ST"+stand,{startNode:gate}):{error:"No published hold node"};
    for(const [direction,route,origin,dest] of [
      ["OUTBOUND",out,start,gate],
      ["RETURN",back,gate,start]
    ]){
      const error=inspect(route,origin,direction,dest);
      cases.push({stand:"ST"+stand,runway,direction,
        ok:!error,reason:error||null,
        edgeCount:route?.route?.edges?.length||0,
        distanceMeters:route?.route?.lengthMetres||null});
      if(error)fail("ROUTE",stand+" "+direction+" "+runway+": "+error);
    }
   }
  }
 }
 const allPass=cases.length===expected&&cases.every(c=>c.ok);
 if(!allPass)fail("COVERAGE",cases.length+"/"+expected+" route directions evaluated");
 // Independent checker: all endpoints must have exactly two valid directions.
 for(const st of stands)for(const end of ends){
  if(cases.filter(c=>c.stand==="ST"+st&&c.runway===end&&c.ok).length!==2&&router)
   fail("BIDIRECTIONAL","ST"+st+" ↔ RWY "+end+" failed paired QA");
 }
 const passed=cases.filter(c=>c.ok).length;
 const ready=failures.length===0&&allPass;
 return {airport:icao,cycle:String(inventory.cycle),sourceSha256:source,
  state:ready?"READY_FOR_SIMULATOR_TEST":"NOT_READY",
  readyForSimulatorTest:ready,percent:ready?100:Math.floor(100*passed/Math.max(expected,1)),
  totals:{stands:stands.length,taxiways:taxiways.length,runwayEnds:ends.length,
    expected,executed:cases.length,passed,failed:expected-passed},
  failureCount:failures.length,reasons,failures,cases,
  simulatorCheckPending:ready,
  flightOperationalApproval:false,
  note:ready?"Every source-identified stand to every runway hold in BOTH directions passed synthetic graph QA. Human simulator comparison is NEXT; NOT FOR ACTUAL NAVIGATION.":"Do not announce completion, release guessed links, or offer taxi commands before 100% graph coverage."};
}
function main(argv){
 const [icaoRaw,...flags]=argv,icao=U(icaoRaw);
 if(!/^[A-Z]{4}$/.test(icao))throw Error("Usage: node scripts/taxi-engine/gate100.cjs OIIE [--report file.json]");
 const path=require("node:path"),dir=path.resolve(__dirname,"../..");
 const read=p=>JSON.parse(fs.readFileSync(path.join(dir,p),"utf8"));
 const inv=read("web/data/taxi-surveys/"+icao+".json");
 const candidate="web/data/taxi-networks/"+icao+".json";
 let graph=null;
 if(fs.existsSync(path.join(dir,candidate)))graph=read(candidate);
 const report=audit100({inventory:inv,graph});
 const idx=flags.indexOf("--report");
 if(idx>=0&&flags[idx+1]){
  const output=path.resolve(flags[idx+1]);fs.mkdirSync(path.dirname(output),{recursive:true});
  fs.writeFileSync(output,JSON.stringify(report,null,2)+"\n");
 }
 console.log(JSON.stringify({...report,cases:undefined,failures:report.failures.slice(0,25)},null,2));
 if(!report.readyForSimulatorTest)process.exitCode=4;
}
if(require.main===module){try{main(process.argv.slice(2))}catch(e){console.error(e);process.exitCode=5}}
module.exports={audit100};
