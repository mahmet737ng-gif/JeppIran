/* JEPPIRAN airport-agnostic network compiler. Requires traced chart geometry. */
(function(root){"use strict";
const upper=s=>String(s||"").trim().toUpperCase(),M=111195;
const valid=p=>p&&Number.isFinite(p.lat)&&Number.isFinite(p.lon)&&Math.abs(p.lat)<=90&&Math.abs(p.lon)<=180;
const distance=(a,b)=>Math.hypot((a.lat-b.lat)*M,(a.lon-b.lon)*M*Math.cos((a.lat+b.lat)*Math.PI/360));
function runway(x){x=upper(x).replace(/^RWY\s*/,"");if(!/^(0[1-9]|[12][0-9]|3[0-6])[LRC]?$/.test(x))throw Error("Invalid runway: "+x);return x}
function reciprocal(x){x=runway(x);return String(((Number(x.slice(0,2))+17)%36)+1).padStart(2,"0")+({L:"R",R:"L",C:"C"}[x.slice(2)]||"")}
function compile(spec){
 if(!/^[A-Z]{4}$/.test(upper(spec?.airport)))throw Error("ICAO airport required");
 if(!spec.source?.provider||!spec.source?.document)throw Error("Named ADC/parking chart source required");
 const nodes={},edges=[],stands={},taxiways={},runways={},issues=[],named=new Map();
 let seq=0;
 function node(p,id){if(!valid(p))throw Error("Bad coordinate");id=upper(id);if(!id)throw Error("Explicit junction ID required");
 if(named.has(id)){const key=named.get(id);if(distance(nodes[key],p)>2)throw Error("Conflicting junction "+id);return key}
 const key="G"+(++seq);nodes[key]={lat:p.lat,lon:p.lon,source:spec.source};named.set(id,key);return key}
 function add(a,b,label,kind,more={}){if(a===b)throw Error("Zero-length edge");
 edges.push({from:a,to:b,label,kind,quality:"mapped",source:spec.source,...more})}
 function trace(points,label,kind,more){if(!Array.isArray(points)||points.length<2)throw Error("At least two points needed: "+label);
 const ids=points.map(p=>node(p,p.id));for(let i=1;i<ids.length;i++)add(ids[i-1],ids[i],label,kind,more);return ids}
 for(const t of spec.taxiways||[]){const name=upper(t.name),ids=trace(t.points,name,"taxiway",{bidirectional:t.oneWay!==true});taxiways[name]={terminalNode:ids.at(-1)}}
 for(const s of spec.stands||[]){const name=upper(s.name).replace(/^ST/,"");if(!name||stands[name])throw Error("Duplicate stand "+name);
 const origin=node(s.position,"STAND_"+name);stands[name]={node:origin};let prev=origin;
 if(!s.leadOut?.length)issues.push({code:"STAND_UNCONNECTED",stand:name});
 for(const p of s.leadOut||[]){const next=node(p,p.id);add(prev,next,"STAND","stand",{bidirectional:true});prev=next}}
 for(const r of spec.physicalRunways||[]){
 const a=runway(r.ends?.[0]?.name),b=runway(r.ends?.[1]?.name),id=upper(r.id||a+"_"+b);
 if(reciprocal(a)!==b)throw Error("Runway ends are not reciprocal: "+a+"/"+b);
 if(upper(r.chartMarking)!=="DARK_RUNWAY_STRIP")throw Error("Use the black runway strip, not white separation");
 if(!Number.isFinite(r.publishedLengthM)||r.publishedLengthM<=100)throw Error("Published runway length required");
 if(upper(r.axis?.[0]?.id)!==upper(r.ends[0].axisPointId)||upper(r.axis?.at(-1)?.id)!==upper(r.ends[1].axisPointId))throw Error("Threshold labels do not match traced axis");
 const path=trace(r.axis,"BT"+a,"runway",{physicalRunway:id,bidirectional:false});
 for(let i=path.length-1;i>0;i--)add(path[i],path[i-1],"BT"+b,"runway",{physicalRunway:id,bidirectional:false});
 const length=r.axis.reduce((sum,p,i)=>i?sum+distance(p,r.axis[i-1]):0,0);
 if(Math.abs(length-r.publishedLengthM)>Math.max(80,r.publishedLengthM*.05))issues.push({code:"RUNWAY_LENGTH_MISMATCH",physicalId:id,publishedM:r.publishedLengthM,geometryM:Math.round(length)});
 const axis=r.axis.map(p=>({lat:p.lat,lon:p.lon}));
 runways[a]={physicalId:id,goalNode:path[0],goalKind:"threshold",axis,axisSource:spec.source,publishedLengthM:r.publishedLengthM,reciprocal:b};
 runways[b]={physicalId:id,goalNode:path.at(-1),goalKind:"threshold",axis:axis.slice().reverse(),axisSource:spec.source,publishedLengthM:r.publishedLengthM,reciprocal:a};
 }
 for(const g of spec.runwayEntries||[]){
 const r=runways[runway(g.runway)],from=named.get(upper(g.fromJunction)),to=named.get(upper(g.runwayAxisJunction));
 if(!r||!from||!to)throw Error("Runway gate needs mapped junctions");
 if(!edges.some(e=>e.physicalRunway===r.physicalId&&(e.from===to||e.to===to)))throw Error("Gate does not meet runway axis");
 add(from,to,upper(g.taxiway),"connector",{quality:g.surveyed===true?"mapped":"projected",runwayGate:true,requiresClearance:true,bidirectional:true});
 }
 const used=new Set();for(const e of edges){used.add(e.from);used.add(e.to)}
 for(const [s,v] of Object.entries(stands))if(!used.has(v.node))issues.push({code:"DISCONNECTED_STAND",stand:s});
 const network={engineVersion:1,airport:upper(spec.airport),cycle:String(spec.cycle),simulatorTestOnly:true,verified:false,coordinateSystem:"WGS84",source:spec.source,nodes,edges,stands,taxiways,runways};
 return {network,issues,summary:{airport:network.airport,stands:Object.keys(stands).length,taxiways:Object.keys(taxiways).length,physicalRunways:(spec.physicalRunways||[]).length,nodes:Object.keys(nodes).length,edges:edges.length}};
}
const api={version:"1.0.0",compile,reciprocal,distance};
root.JEPPIRAN_TAXI_NETWORK_COMPILER=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
