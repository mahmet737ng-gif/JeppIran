'use strict';
const fs=require('node:fs'),path=require('node:path');
const E=require('../web/cdfa-engine.js');
const inputPath=path.join(__dirname,'../web/data/cdfa-v2621-v16-qa.json');
const src=JSON.parse(fs.readFileSync(inputPath,'utf8'));
const original=src.charts.filter(c=>c.status==='WITHHELD_MISSING_GEOMETRY').sort((a,b)=>a.sourcePage-b.sourcePage);
if(original.length!==16)throw Error('16 original held records expected');
const chartSpecs={
 328:{angle:3.00,nav:'VOR RST 112.6',dme:'RST',frequency:112.6,anchor:[5,1200],mandatory:[10,1300],scope:[1.5,5],stopMode:true,threshold:-51,tch:50,modelLabel:'CAT C/D D10 mandatory 1300; geometric crossing must NOT replace D10.'},
 438:{angle:3.00,nav:'VOR TRN 115.3',dme:'TRN',frequency:115.3,anchor:[8,6700],minimums:[[13,7800]],scope:[1,8],gridEnd:13,threshold:3934,tch:50,modelLabel:'TRN D8 6700 published minimum; continue diagnostic DME to D13, outside published final-angle scope.'},
 541:{angle:3.04,nav:'NDB RAF 260',dme:'RAF',frequency:112.3,anchor:[5,6700],mandatory:[10,7800],scope:[1,5],stopMode:true,threshold:null,airport:5290,tch:50,modelLabel:'Mandatory 7800 at D10 on RAF DME, not at the computed geometric altitude intersection.'},
 663:{angle:3.03,nav:'VOR GGN 117.6',dme:'GGN',frequency:117.6,anchor:[15,5000],minimums:[[7,2300]],scope:[0.5,7],gridEnd:15,threshold:-59,tch:50,modelLabel:'Published D7 2300 and D15 5000; fit is QA geometry only and D7–D15 not published 3.03 path.'},
 664:{angle:3.03,nav:'VOR GGN 117.6',dme:'GGN',frequency:117.6,anchor:[15,5000],minimums:[[7,2300]],scope:[0.5,7],gridEnd:15,threshold:-59,tch:50,modelLabel:'CAT C/D different arrival; D7 2300 and D15 5000 minima retained.'},
 665:{angle:3.03,nav:'VOR GGN 117.6',dme:'GGN',frequency:117.6,anchor:[5,1600],minimums:[[10,2800]],scope:[0.5,5],gridEnd:15,threshold:-59,tch:50,modelLabel:'D5 1600, D10 2800; D11–D15 is mathematical extension only.'},
 682:{angle:3.32,nav:'NDB RSR 332',dme:'RSR',frequency:115.5,anchor:[5,1500],minimums:[[10,2600]],scope:[1.5,5],threshold:null,airport:-66,defaultTch:true,modelLabel:'TCH is NOT printed, default 50 ft QA. D5 profile used to fit 0.7 NM DME offset. D17 altitude lies outside modeled final path.'},
 683:{angle:3.32,nav:'NDB RSR 332',dme:'RSR',frequency:115.5,anchor:[5,1500],minimums:[[10,2600]],scope:[1.5,5],threshold:null,airport:-66,defaultTch:true,modelLabel:'TCH unprinted -> default 50 ft QA, station offset fitted from D5 1500, NOT independently surveyed.'},
 716:{nav:'NDB LAM 346',dme:'LAM',frequency:117.0,anchor:[5,2800],minimums:[[10,3900],[13,4800],[16,6000]],scope:[2,5],threshold:1329,defaultTch:true,modelLabel:'No published final descent angle -> ASSUMED 3.00; 50 ft TCH assumed. Exact DME offset fitted from D5, differing from rough 0.7 estimate.'},
 991:{angle:3.06,nav:'VOR BGD 112.9',dme:'BGD',frequency:112.9,anchor:[5.4,2100],minimums:[[12,3600]],scope:[0.6,5.4],threshold:113,tch:46,modelLabel:'KISPE D5.4 published 2100, FIDIX D12 3600; compute 1-NM grid out to at least D10.'},
 992:{angle:3.06,nav:'VOR BGD 112.9',dme:'BGD',frequency:112.9,anchor:[8.7,2100],minimums:[[15,3600]],scope:[3.5,8.7],threshold:null,airport:114,tch:50,modelLabel:'VINNU D8.7 2100; HIBUT D3.5 MAP; SEBIE D15 3600. 1-NM grid from valid station branch.'},
 1019:{angle:3.02,nav:'VOR BSR 112.3',dme:'BSR',frequency:112.3,anchor:[8.7,1900],minimums:[[15,3000]],scope:[3.3,8.7],gridEnd:15,threshold:null,airport:11,tch:49,modelLabel:'CEPKI D8.7 1900, HOKEM D15 3000; extrapolate published final angle past D8.7 as QA only.'},
 1020:{angle:2.83,nav:'VOR BSR 112.3',dme:'BSR',frequency:112.3,anchor:[5,1800],minimums:[[15,3000]],scope:[0.8,5],gridEnd:15,threshold:null,airport:11,tch:55,modelLabel:'CEPOK D5 1800 and METNE D15 3000, published 2.83 deg; extrapolate outer segment only as QA.'},
 1034:{angle:3.00,nav:'VOR SUL 117.0',dme:'SUL',frequency:117.0,offset:-0.7,minimums:[],scope:[0.2,11.8],gridEnd:10,threshold:2492,tch:50,modelLabel:'SUL-to-runway offset approx0.7 NM interpreted from Jeppesen profile. FS13 6500 is published at named fix, no numeric SUL DME assigned to FS13.'},
 1035:{angle:3.00,nav:'VOR SUL 117.0',dme:'SUL',frequency:117.0,offset:-0.9,minimums:[],scope:[3.5,15.2],gridEnd:10,threshold:2440,tch:50,modelLabel:'SUL-to-runway approx0.9 NM interpreted from Jeppesen profile. FS31 6500 is a named fix without independently verified DME.'}
};
const statusPrefix='QA_V17_';
const delta=(g,el,tch,d,alt)=>d-(alt-(el+tch))/g;
let promoted=0,blocked=0;const audit=[];
const updated=src.charts.map(old=>{
 const c=chartSpecs[old.sourcePage];if(!c||old.status!=='WITHHELD_MISSING_GEOMETRY')return old;
 const g=E.gradientForAngle(c.angle??3),threshold=c.threshold??c.airport;
 const tch=c.defaultTch?50:c.tch;
 const inferred=c.offset??delta(g,threshold,tch,c.anchor[0],c.anchor[1]);
 const sourceOffset=c.offset==null?'SINGLE_PUBLISHED_FIX_FITTED':'CHART_PROFILE_INTERPRETED';
 const station={id:c.dme,placement:inferred<0?'before_threshold':'after_threshold',offsetNm:Math.abs(inferred),lateralNm:0,geometryVerified:false,...(inferred<0?{branch:'before_station'}:{})};
 // For a chart-only model, lateralNm=0 is a projection assumption, NOT surveyed fact.
 let stop=!!c.stopMode;
 const publishedConstraints=[];
 if(c.anchor)publishedConstraints.push({dmeNm:c.anchor[0],altitudeFt:c.anchor[1],type:'minimum',label:'Published source-chart altitude (may be a minimum)'});
 for(const [dmeNm,altitudeFt] of c.minimums||[])publishedConstraints.push({dmeNm,altitudeFt,type:'minimum',label:'Published chart/profile altitude; treated as minimum'});
 if(c.mandatory)publishedConstraints.push({dmeNm:c.mandatory[0],altitudeFt:c.mandatory[1],type:'mandatory',label:'PUBLISHED MANDATORY CROSSING FIX — location must not change'});
 const start=Math.max(1,Math.ceil(Math.max(0,inferred)-1e-9));
 const config={chartId:old.key,chartDmeId:c.dme,procedureHeader:c.nav,
   procedureFamily:c.nav.split(' ')[0],procedureReferenceId:c.nav.split(' ')[1],
   ...(c.nav.startsWith('NDB')?{distanceAidEvidence:{type:'DME',id:c.dme,frequencyMhz:c.frequency,source:'VISUALLY_EXTRACTED_JEPPESEN_2621',navaidColocationVerified:false}}:{}),
   ...(c.threshold==null?{airportElevationFt:c.airport}:{thresholdElevationFt:c.threshold,airportElevationFt:old.sourceExtracted?.airportElevationFt??null}),
   ...(c.defaultTch?{}:{tchFt:c.tch}),...(c.angle==null?{}:{publishedAngleDeg:c.angle}),
   station,dmeReadingsNm:Array.from({length:Math.max(0,20-start)},(_,i)=>start+i),
   mdaFt:old.mdaFt,validAngleDmeRange:{from:c.scope[0],to:c.scope[1]},publishedConstraints,
   minimumThresholdCoverageNm:10,minimumDmeCoverageNm:c.gridEnd??10,coverageStepDmeNm:1,
   mandatoryStopMode:stop?'calculated_altitude_intercept':'none',autoExtendCoverage:true};
 let engine,exception=null;
 try{engine=E.buildTable(config)}catch(e){exception=String(e.message||e)}
 const base={...old,reviewVersion:'1.7.0',procedureReference:engine?.procedureReference||null,
  distanceReference:{type:'DME',id:c.dme,frequencyMhz:c.frequency,source:'VISUAL_CHART_HEADER_AND_MAP_QA',navaidColocationVerified:false},
  referenceDmeId:c.dme,sourceExtracted:{...old.sourceExtracted,rwyElevationFt:c.threshold??null,airportElevationFt:c.threshold==null?c.airport:old.sourceExtracted.airportElevationFt,tchFt:c.defaultTch?null:c.tch,elevationSource:c.threshold==null?'AIRPORT_ELEVATION_FALLBACK_QA':'RUNWAY_THRESHOLD'},
  thresholdElevationFt:threshold,tchFt:tch,tchSource:c.defaultTch?'DEFAULT_ASSUMED_50_FT_QA':'PUBLISHED_CHART_VALUE',angleDeg:c.angle??3,
  angleSource:c.angle==null?'DEFAULT_ASSUMED_3_DEG':'PUBLISHED_CHART_INPUT',gradientFtPerNm:g,
  stationOffsetNm:Math.abs(inferred),stationPlacement:station.placement,stationOffsetSource:sourceOffset,
  geometryConfidence:'GEOMETRIC_QA_ONLY_NO_INDEPENDENT_DME_SURVEY',
  qaWarnings:[c.modelLabel,'One-nautical-mile DME grid; VDP computed DME with one decimal.','Station centerline and signed offsets are inferred or fitted, not independently verified.','MODEL EXTENSION outside published angle scope does not authorize descent.'],
  vdp:engine?.vdp||null,coverage:engine?.coverage||null,modelInput:config,sourceAudit:{sourcePdfPage:old.sourcePage,sourceChart:old.title,review:'VISUAL_2621_PROFILE_AND_HEADER',stationReference:c.dme,stationFrequency:c.frequency,stationOffsetBasis:sourceOffset,
   publishedConstraints:publishedConstraints,mandatoryIsPublishedAt:c.mandatory?.[0]??null}};
 if((old.sourcePage===1034||old.sourcePage===1035) && base.vdp){
    base.vdp={...base.vdp,status:'CALCULATED_MDA_INTERCEPT_AFTER_MAP_QA_ONLY',
      note:'Derived MDA intersection lies beyond the published MAP; NOT a usable VDP.'};
    base.qaWarnings.push('Computed MDA intersection occurs past the published MAP. NO usable VDP is established.');
 }
 if(!engine||engine.status==='BLOCKED_BY_QA'){
    blocked++;
    base.status=c.stopMode?'WITHHELD_MANDATORY_FIX_CONFLICT_V17':'WITHHELD_PUBLISHED_CONSTRAINT_CONFLICT_V17';
    base.blockers=[...(engine?.issues?.map(x=>x.code)||[exception||'UNKNOWN_MODEL_ERROR'])];
    base.table=[];
    base.diagnosticTable=(engine?.rows||[]).map(r=>({dme:r.dmeNm,thresholdNm:r.thresholdDistanceNm,rawFt:r.rawAltitudeFt,altitudeFt:r.roundedAltitudeFt,
       status:r.status,reasons:r.reasons,vdpMarker:r.vdpMarker||null,published:r.published}));
    base.publishedChecks=engine?.checks||[];
    base.engineStatus=engine?.status||'ERROR';
 }else{
    promoted++;
    base.status='QA_V17_GEOMETRIC_TABLE_NOT_NAVIGATION_APPROVED';base.blockers=[];
    base.table=engine.rows.map(r=>({dme:r.dmeNm,thresholdNm:r.thresholdDistanceNm,rawFt:r.rawAltitudeFt,altitudeFt:r.roundedAltitudeFt,
       status:r.status,reasons:r.reasons,vdpMarker:r.vdpMarker||null,published:r.published}));
    base.publishedChecks=engine.checks;base.engineStatus=engine.status;
 }
 audit.push({number:original.findIndex(x=>x.key===old.key)+1,page:old.sourcePage,icao:old.icao,title:old.title,
  newStatus:base.status,issues:base.blockers,estimatedOffsetNm:inferred,angleDeg:base.angleDeg,
  vdp:base.vdp?.dmeDisplay,rows:base.table.length,diagnosticRows:base.diagnosticTable?.length||0,
  mandatory:base.coverage?.mandatoryAltitudeStop,coverage:base.coverage?.gridEndDmeNm,
  geometrySource:sourceOffset,tchSource:base.tchSource,checks:base.publishedChecks});
 console.log('ROW',audit.at(-1));
 return base;
});
if(updated.length!==164||audit.length!==15)throw Error('Not all candidates processed');
const statusCounts={};for(const x of updated)statusCounts[x.status]=(statusCounts[x.status]||0)+1;
const manifest={...src,engineVersion:'1.6.0+V17_16_review',schema:'jeppiran.cdfa.bulk-qa.v1.7',
 reviewPolicy:'GEOMETRIC SIMULATOR QA ONLY. Mandatory DME fixes never moved by computed altitude interception. TCH50 default only when unprinted. Extrapolated VDA does not authorize descent.',
 counts:statusCounts,charts:updated};
const out=path.join(__dirname,'../web/data/cdfa-v2621-v17-qa.json');fs.writeFileSync(out,JSON.stringify(manifest,null,2)+'\n');
fs.writeFileSync(path.join(__dirname,'../web/data/cdfa-v17-16-audit.json'),JSON.stringify({originalRemaining:16,processed:15,qaPromoted:promoted,held:blocked+1,heldWithinProcessed:blocked,unchangedDualReference:1,records:audit},null,2)+'\n');
console.log('FINAL',{qaPromoted:promoted,heldWithinProcessed:blocked,stillHeld:blocked+1,statusCounts});