/* node scripts/taxi-engine/new-airport.cjs OIXX 2621
 * Creates ONLY a blank, DISABLED data template. No geometric inference.
 */
"use strict";
const fs=require("node:fs"),path=require("node:path");
const [icao,cycle]=process.argv.slice(2).map(x=>String(x||"").trim().toUpperCase());
if(!/^[A-Z]{4}$/.test(icao||"")||!/^\d{4}$/.test(cycle||"")){
  console.error("Usage: node scripts/taxi-engine/new-airport.cjs ICAO CYCLE (e.g., OISS 2621)");
  process.exit(2);
}
const root=path.resolve(__dirname,"../..");
const file=path.join(root,"web","data","taxi-networks",icao+".json");
if(fs.existsSync(file)){
  console.error("Refusing overwrite of existing network: "+file);
  process.exit(3);
}
const data={
  engineVersion:1,airport:icao,cycle,coordinateSystem:"WGS84",
  simulatorTestOnly:true,verified:false,enabled:false,
  source:{provider:"SOURCE REQUIRED",document:"AIP/Jeppesen chart and revision REQUIRED",
    pages:[],reviewStatus:"NOT REVIEWED"},
  nodes:{},edges:[],stands:{},taxiways:{},runways:{},
  qa:{digitizedBy:"",sourceCharts:[],standConnectionsReviewed:false,
    namedTaxiwayIntersectionsReviewed:false,runwayAxesReviewed:false,
    allowAutomaticRunwayEntry:false}
};
fs.writeFileSync(file,JSON.stringify(data,null,2)+"\n",{flag:"wx"});
console.log("CREATED: "+path.relative(root,file));
console.log("INACTIVE: enter authoritative source, exact individual graph nodes, physical");
console.log("taxiway/stand and BOTH runways, hold nodes + their source. Do not invent");
console.log("connectors. Run node scripts/taxi-engine/validate.cjs "+path.relative(root,file));
