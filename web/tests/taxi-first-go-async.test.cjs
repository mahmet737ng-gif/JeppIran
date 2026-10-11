/* Taxi UI regression test: clicking GO before the airport graph finishes
 * loading must execute the entered route ONCE after the graph is ready.
 * Run from repo root: node web/tests/taxi-first-go-async.test.cjs
 * Synthetic browser stubs only; no flight or real-world validation.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const assert=require("node:assert/strict");
const source=fs.readFileSync(path.join(__dirname,"..","taxi-mode.js"),"utf8");
const from=source.indexOf("function go(options={}){");
const end=source.indexOf("\nfunction currentManual(){",from);
assert.ok(from!==-1&&end>from,"Taxi GO method not found");
const makeGo=new Function("taxi","$","syncAirport","window","draw",
  "loadGraph","genericGo","message","selectedAirport",
  source.slice(from,end)+"\nreturn go;");
async function test(label,numClicks,edit){
  const field={value:"ST4 A B"},calls=[],status=[];
  const taxi={airport:"OIAW",graph:null,genericEngine:null,
    active:true,goTicket:0,route:null,auto:null,genericMonitor:null};
  let complete;
  const pending=new Promise(resolve=>{complete=resolve});
  const go=makeGo(taxi,()=>field,()=>{}, {JEPPIRAN_PUBLISHED_TAXI:null},
    ()=>{},()=>pending,s=>calls.push(s),s=>status.push(s),"OIAW");
  for(let i=0;i<numClicks;i++)go();
  if(edit)edit(taxi,field);
  taxi.genericEngine={};
  complete({airport:"OIAW"});
  await pending;
  await Promise.resolve();
  await Promise.resolve();
  return {label,calls,status};
}
(async()=>{
  const first=await test("first GO",1);
  assert.deepEqual(first.calls,["ST4 A B"]);
  const repeated=await test("repeat GO",2);
  assert.deepEqual(repeated.calls,["ST4 A B"]);
  const edited=await test("edited route",1,(_,field)=>{field.value="ST5 A B"});
  assert.deepEqual(edited.calls,[]);
  const closed=await test("closed TAXI",1,taxi=>{taxi.active=false;taxi.goTicket++});
  assert.deepEqual(closed.calls,[]);
  const switched=await test("airport switch",1,taxi=>{taxi.airport="OIKK"});
  assert.deepEqual(switched.calls,[]);
  console.log("PASS Taxi GO: first-click auto-executes once; changed / closed / stale requests ignored");
})().catch(error=>{console.error(error);process.exitCode=1});
