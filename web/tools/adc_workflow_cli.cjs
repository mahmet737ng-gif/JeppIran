#!/usr/bin/env node
/* JEPPIRAN ADC Workflow CLI — source inventory + reviewed edits.
 * Usage: node web/tools/adc_workflow_cli.cjs --survey SURVEY.json
 *        --candidates PAGE430.json,PAGE432.json --review REVIEW.json
 *        --out OUTPUT_FOLDER
 * A candidate is NEVER silently approved, even with a matching line name.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const engine=require("../taxi-adc-workflow.js");
function args(argv){
  const a={};
  for(let i=0;i<argv.length;i++){
    if(!argv[i].startsWith("--"))throw Error("Unknown argument "+argv[i]);
    const key=argv[i++].slice(2),value=argv[i];
    if(!value||value.startsWith("--"))throw Error("Missing value for --"+key);
    a[key]=value;
  }return a;
}
function read(p){return JSON.parse(fs.readFileSync(p,"utf8"))}
function main(){
  const a=args(process.argv.slice(2));
  if(!a.survey||!a.out)throw Error("Usage: --survey OIII.json --out DIR [--candidates files,files] [--review curated.json]");
  const survey=read(a.survey),input=engine.fromSurvey(survey),found=[];
  for(const name of (a.candidates||"").split(",").filter(Boolean)){
    const candidate=read(name);
    if(candidate.airport!==input.airport||String(candidate.cycle)!==input.cycle||
       candidate.sourceSha256!==input.source.sha256)
      throw Error("Source fingerprint/airport/cycle mismatch: "+name);
    for(const trace of candidate.traces||[]){
      if(trace.reviewed!==false)throw Error("Unreviewed scanner unexpectedly returned an approved trace");
      found.push({...trace,reviewed:false});
    }
    // Proximity intersections are suggestions. NEVER insert into reviewed graph.
  }
  if(a.review){
    const review=read(a.review);
    if(review.airport!==input.airport||review.sourceSha256!==input.source.sha256||
       review.cycle!==input.cycle)throw Error("Reviewed edits must target EXACT PDF and cycle");
    if(found.length&&Array.isArray(review.traces)){
      const observed=new Set(found.flatMap(x=>(x.sourceDrawingIds||[])
        .map(id=>x.page+"|"+id)));
      for(const t of review.traces){
        if(!t.reviewed)continue;
        if(!t.sourceDrawingIds?.length||
          t.sourceDrawingIds.some(id=>!observed.has(t.page+"|"+id)))
          throw Error("Review trace "+t.id+" refers to an unextracted drawing id; rescan PDF or reject it");
      }
    }
    for(const key of ["traces","junctions","runwayGates","pageLinks"]){
      if(review[key])input[key]=review[key];
    }
    input.releaseReviewed=review.releaseReviewed===true;
  }else input.traces=found;
  const result=engine.compile(input),root=path.resolve(a.out);
  fs.mkdirSync(root,{recursive:true});
  fs.writeFileSync(path.join(root,"workflow_report.json"),JSON.stringify(result,null,2)+"\n");
  const awaiting=result.jobs.filter(j=>j.blocking);
  const lines=[
    "# "+input.airport+" ADC → Routable Workflow",
    "Source: "+input.source.sha256+" · cycle "+input.cycle,
    "Status: **"+result.releaseStatus+"**",
    "Geometry coordinate system: PDF page-local (NOT WGS84).",
    "",
    "## Machine-selected next action",
    awaiting[0]?.title||"All source-graph QA stages complete",
    "",
    "## Review queue",
    ...awaiting.map(j=>"- [ ] "+j.id+" — "+j.title),
    "",
    "## Summary",
    ...Object.entries(result.summary).map(([k,v])=>"- "+k+": "+v),
    "",
    "## Safety",
    "No auto-SNAP of stands, no page-coordinate mixing, and no auto runway crossings.",
    "All candidate lines/contact points are UNAPPROVED until verified on original PDF.",
  ];
  fs.writeFileSync(path.join(root,"NEXT_ACTIONS.md"),lines.join("\n")+"\n");
  if(result.summary.routeable){
    fs.writeFileSync(path.join(root,"approved-chart-graph.json"),
      JSON.stringify({airport:result.airport,cycle:result.cycle,
        sourceSha256:result.sourceSha256,coordinateSystem:result.coordinateSystem,
        simulatorChartQAOnly:true,nodes:result.nodes,edges:result.edges},null,2)+"\n");
  }
  console.log(input.airport,result.releaseStatus,
    "NEXT:",awaiting[0]?.id||"DONE",
    "reviewed edges:",result.summary.reviewedGraphEdges,
    "candidate strokes:",found.length);
}
try{main()}catch(error){console.error("ADC workflow failed:",error.message);process.exitCode=1}
