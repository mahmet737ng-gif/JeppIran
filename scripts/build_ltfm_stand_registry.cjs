#!/usr/bin/env node
/* Build LTFM stand INDEX: 263 printed parking labels + 349 pushback
 * names + 201 group INS references. This is a lookup inventory, NOT
 * stand-to-taxi centerline paths. Source cycle 2621, simulator QA only.
 */
"use strict";
const fs=require("node:fs");
const path=require("node:path");
const root=path.resolve(__dirname,"..");
function json(p){return JSON.parse(fs.readFileSync(path.join(root,p),"utf8"))}
const positions=json("web/data/taxi-stand-positions/LTFM.json"),
 push=json("web/data/taxi-stand-pushback/LTFM.json"),
 nearby=json("web/data/taxi-stand-candidates/LTFM.json"),
 ins=json("web/data/taxi-stands/LTFM-ins-groups.json"),
 graph=json("web/data/taxi-networks/LTFM.json");
for(const x of [positions,push,nearby,ins,graph])
 if(x.airport!=="LTFM"||String(x.cycle)!=="2621")
 throw Error("Mixed airport or cycle in stand inventory");
const numberOrder={L:0,"":1,R:2};
function parsed(s){
 const m=/^([A-Z]?)(\d{1,3})([LR]?)$/.exec(s);
 return m?{prefix:m[1],num:+m[2],suffix:m[3]}:null;
}
const found=new Map(positions.stands.map(x=>[x.id,x]));
const names=new Set([...found.keys(),...Object.keys(push.standRows)]);
const byName=new Map();
function pushGroup(id,group){
 if(!byName.has(id))byName.set(id,[]);
 byName.get(id).push(group);
}
for(const group of ins.groups){
 const text=String(group.group).toUpperCase();
 const foundNames=new Set();
 const range=/\b([A-Z]?)(\d{1,3})([LR]?)\s+THRU\s+([A-Z]?)(\d{1,3})([LR]?)\b/g;
 for(const m of text.matchAll(range)){
  const prefix=m[1],start=+m[2],startSuffix=m[3],endPrefix=m[4],
    end=+m[5],endSuffix=m[6];
  if(prefix!==endPrefix||end<start||end-start>80)continue;
  for(const id of names){
   const s=parsed(id);
   if(!s||s.prefix!==prefix||s.num<start||s.num>end)continue;
   if(s.num===start&&numberOrder[s.suffix]<numberOrder[startSuffix])continue;
   if(s.num===end&&numberOrder[s.suffix]>numberOrder[endSuffix])continue;
   foundNames.add(id);
  }
 }
 const others=text.replace(range," ");
 for(const m of others.matchAll(/\b([A-Z]?\d{1,3}[LR]?)\b/g))
  if(names.has(m[1]))foundNames.add(m[1]);
 for(const id of foundNames)pushGroup(id,group);
}
const namedWays=new Set(graph.edges.map(e=>e.taxiway).filter(Boolean));
const output={schemaVersion:1,airport:"LTFM",cycle:"2621",
 kind:"stand-pushback-association-registry",simulationOnly:true,
 verifiedForNavigation:false,routingApproved:false,
 warnings:[
  "PRINTED LABEL COORDINATES ARE NOT stand nosewheel positions or traced pushback paths.",
  "INS fallback coordinates are shared 0.1-minute groups, NOT individual stand positions.",
  "A published pushback taxiway name does not imply a geometrically verified stand connection.",
  "No runway crossing, stand clearance or taxiway connector is automatically enabled."
 ],stands:{},stats:{}};
const sorted=[...names].sort((a,b)=>a.localeCompare(b,undefined,{numeric:true}));
let matched=0,printed=0,coarse=0,charted=0,missingGeometry=0;
for(const id of sorted){
 const p=found.get(id),group=(byName.get(id)||[]),c=nearby.stands[id],
   printedRef=push.standRows[id]||[],
   published=printedRef.map(i=>push.rows[i]),
   taxis=[...new Set(published.flatMap(r=>r.publishedTaxiwaysMentioned))],
   chartMatches=(c?.candidates||[]).filter(x=>x.chartNamedTaxiwayMatch).map(x=>x.taxiway);
 if(!p&&!group.length)throw Error("Published stand "+id+" missing all chart location references");
 const gps=p?{lat:p.lat,lon:p.lon}:
   group.length?{lat:group[0].lat,lon:group[0].lon}:null;
 const data={
  id,locationType:p?"PRINTED_LABEL_ANCHOR":"ROUNDED_INS_STAND_GROUP_ONLY",
  position:gps,coordinatePrecision:p?"CHART_LABEL_UNSURVEYED":"0.1_ARC_MINUTE_SHARED_GROUP",
  sourceChartPages:p?[p.chartPage]:[],
  officialInsGroups:group.map(g=>({group:g.group,page:g.page,lat:g.lat,lon:g.lon})),
  hasIndividualStandPosition:!!p,
  publishedPushbackTaxiways:taxis,
  sourcePushbackCharts:[...new Set(published.map(x=>x.sourceChart))],
  nearestEdges:(c?.candidates||[]).map(x=>({
    taxiway:x.taxiway,distanceMeters:x.distanceMeters,edgeFrom:x.edgeFrom,edgeTo:x.edgeTo,
    chartNameMatches:x.chartNamedTaxiwayMatch||false,connectorVerified:false,
    routingApproved:false
  })),
  namedTaxiwaysWithCenterline:taxis.filter(name=>namedWays.has(name)),
  namedTaxiwaysWithoutCenterline:taxis.filter(name=>!namedWays.has(name)),
  corroboratedNearTaxiways:[...new Set(chartMatches)],
  physicalStandConnectorVerified:false,routingApproved:false
 };
 if(p)printed++;else coarse++;
 if(published.length)charted++;
 if(chartMatches.length)matched++;
 if(data.namedTaxiwaysWithoutCenterline.length)missingGeometry++;
 output.stands[id]=data;
}
output.stats={standNames:sorted.length,individuallyPrinted:printed,
 roundedGroupOnly:coarse,publishedPushbackStands:charted,
 publishedNameAndNearestEdgeAgreements:matched,
 publishedNamesWithMissingOSMCenterlines:missingGeometry,
 allStandNamesHaveChartLocation:sorted.every(id=>output.stands[id].position!==null),
 verifiedStandConnectors:0};
if(printed<263||coarse<100||charted<349||matched<200)
 throw Error("Unexpected dataset regression "+JSON.stringify(output.stats));
const dest=path.join(root,"web/data/taxi-stand-registry/LTFM.json");
fs.mkdirSync(path.dirname(dest),{recursive:true});
fs.writeFileSync(dest,JSON.stringify(output,null,2)+"\n");
console.log(output.stats);
