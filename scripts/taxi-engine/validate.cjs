/* Local/CI gate for the generic airport network — data, never guessing. */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const engine=require("../../web/taxi-engine.js");
const files=process.argv.slice(2);
if(!files.length){
  console.error("Usage: node scripts/taxi-engine/validate.cjs path/to/AIRPORT.json [...]");
  process.exit(2);
}
let failed=false;
for(const filename of files){
  try{
    const config=JSON.parse(fs.readFileSync(path.resolve(filename),"utf8"));
    const checked=engine.validate(config);
    if(!checked.ok)throw Error(checked.errors.join("\n  - "));
    const instance=engine.create(config),d=instance.destinations();
    if(config.enabled!==true)throw Error("Graph valid but enabled is not true: keep disabled until QA signed off");
    if(config.source.reviewStatus!=="SIM_QA_REVIEWED")
      throw Error("Source must be explicitly marked SIM_QA_REVIEWED after source review");
    console.log("PASS "+config.airport+" "+config.cycle+" nodes="+
      Object.keys(config.nodes).length+" edges="+config.edges.length+
      " stands="+d.stands.length+" runway designators="+d.runways.length);
  }catch(error){
    console.error("FAIL "+filename+": "+error.message);
    failed=true;
  }
}
if(failed)process.exit(1);
