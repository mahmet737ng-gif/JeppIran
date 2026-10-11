/* Reusable airport-specific taxi QA, without adding airport-specific logic.
 * Usage: node scripts/taxi-engine/audit-airport.cjs ICAO [--strict]
 * Draft mode reports gaps and does not imply published readiness.
 * Strict mode fails if a network is not fully enabled, reviewed and valid.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const engine=require("../../web/taxi-engine.js");
function audit(graph,{strict=false}={}){
  const issues=[],warning=[],stats={};
  const names=Object.keys(graph.nodes||{});
  const edges=Array.isArray(graph.edges)?graph.edges:[];
  const stands=Object.keys(graph.stands||{}),runways=Object.keys(graph.runways||{});
  stats.nodes=names.length;stats.edges=edges.length;
  stats.stands=stands.length;stats.runways=runways.length;
  stats.runwayEdges=edges.filter(x=>x.kind==="runway").length;
  stats.projectedEdges=edges.filter(x=>x.quality==="projected").length;
  stats.blockedEdges=edges.filter(x=>x.quality==="blocked").length;
  stats.sources=[...new Set(edges.map(x=>x.source?.document||graph.source?.document||"UNSOURCED"))];
  const checked=engine.validate(graph);
  if(!checked.ok)issues.push(...checked.errors);
  if(graph.enabled!==true)warning.push("Network disabled: cannot route in production PWA");
  if(graph.source?.reviewStatus!=="SIM_QA_REVIEWED")
    warning.push("Source reviewer has not signed off");
  if(!stands.length)warning.push("No stand connectors mapped");
  if(!runways.length)warning.push("No runway designators registered");
  for(const [id,runway] of Object.entries(graph.runways||{})){
    if(!runway.goalNode)warning.push("RWY "+id+" has no reviewed destination hold/access/threshold");
    if(!runway.axis)warning.push("RWY "+id+" has no source-backed independent axis");
  }
  const ready=checked.ok&&graph.enabled===true&&
    graph.source?.reviewStatus==="SIM_QA_REVIEWED";
  if(strict&&!ready)issues.push("Network not activated and source-reviewed");
  const tests=[];
  if(checked.ok){
    const instance=engine.create(graph);
    const starts=stands.slice(0,Math.min(stands.length,3));
    const ends=stands.slice(-Math.min(stands.length,3));
    for(const from of starts)for(const to of ends){
      if(from===to)continue;
      const route=instance.plan("ST"+from+" ST"+to);
      tests.push({from:"ST"+from,to:"ST"+to,connected:!!route.route,
        reason:route.error||null,
        runwayUsed:!!route.route?.edges.some(x=>x.kind==="runway")});
      if(route.route?.edges.some(x=>x.kind==="runway"))
        issues.push("Implicit runway crossing in "+from+" → "+to);
    }
    for(const id of runways){
      const runway=graph.runways[id];
      if(!runway.goalNode)continue;
      const from=starts[0];
      if(!from)break;
      const route=instance.plan("ST"+from+" RWY "+id);
      tests.push({from:"ST"+from,to:"RWY "+id,connected:!!route.route,
        reason:route.error||null,
        runwayUsed:!!route.route?.edges.some(x=>x.kind==="runway")});
      if(route.route?.edges.some(x=>x.kind==="runway"))
        issues.push("Implicit runway entry in ST"+from+" → RWY "+id);
    }
  }
  return {airport:graph.airport,cycle:graph.cycle,ready,stats,
    issues,warning,tests,
    note:"Connectivity failures can be real graph gaps. Never bridge them by proximity."};
}
if(require.main===module){
 const args=process.argv.slice(2),icao=(args[0]||"").toUpperCase(),strict=args.includes("--strict");
 if(!/^[A-Z]{4}$/.test(icao)){
   console.error("Usage: node scripts/taxi-engine/audit-airport.cjs ICAO [--strict]");
   process.exit(2);
 }
 const root=path.resolve(__dirname,"../..");
 const file=path.join(root,"web/data/taxi-networks",icao+".json");
 try{
  const report=audit(JSON.parse(fs.readFileSync(file,"utf8")),{strict});
  console.log(JSON.stringify(report,null,2));
  if(report.issues.length)process.exitCode=1;
 }catch(e){console.error(e.message);process.exitCode=1}
}
module.exports={audit};
