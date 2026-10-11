'use strict';
// JEPPIRAN v1.6: 42 chart visually inspected, chart-header procedure reference
// separated from map-labelled DME; all results remain NON-NAVIGATION QA.
const fs=require('fs'), path=require('path'), e=require('../web/cdfa-engine.js');
const base=path.resolve(__dirname,'../web');
const data=JSON.parse(fs.readFileSync(path.join(base,'data/cdfa-v2621-v15-qa.json'),'utf8'));
const pending=data.charts.filter(c=>c.status==='WITHHELD_MISSING_GEOMETRY');
if(pending.length!==42)throw Error('Expected 42 withheld; got '+pending.length);
const C={};
function add(p,o){if(C[p])throw Error('Duplicate '+p); C[p]=o;}
// Each configuration was checked against the source Jeppesen PDF at physical page p.
// Field `off` means CHART-INTERPRETED or single-anchor FIT, NOT independently surveyed.
add(75,{header:'VOR BUZ 117.45',aid:'BUZ',freq:117.45,el:8,tch:50,anchor:[5,1500],angle:3.10,scope:[0.1,5],bounds:[[10,3000]],note:'RWY 13L elevation 8 ft is explicitly published (not airport elevation 72 ft); 13R requires its own chart/runway elevation; 3.10 only final segment.'});
add(78,{header:'VOR BUZ 117.45',aid:'BUZ',freq:117.45,el:72,tch:50,off:1.8,anchor:[5,1000],angle:3,scope:[3,5],bounds:[[10,2000]],note:'RWY31L TCH50 printed, RWY31R TCH52. Airport Elev 72 used as fallback pending ADC threshold; offset 1.8 chart profile inference.'});
add(202,{header:'NDB KMS 382',aid:'KMS',freq:114.6,el:4307,tch:46,anchor:[3,5400],angle:3.61,scope:[1,3],bounds:[[7,6500],[12,8000],[18,10500]],note:'Inner controlling D3 5400 chosen as final-slope anchor; DO NOT fit FAF D7 6500 and extend 3.61 through D3.'});
add(243,{header:'NDB HSA 230',aid:'HSA',freq:113.45,el:5227,tch:50,off:.8,anchor:[7,7100],angle:3,scope:[1.7,7],note:'Distance D7 to D1.7=5.3 NM and D1.7 to threshold approximately 0.9 NM on profile. DME HSA113.45 is separate transmitter.'});
add(280,{header:'NDB IFN 337',aid:'ISN',freq:113.2,el:5058,tch:50,anchor:[3,6200],angle:3,scope:[.5,3],bounds:[[8,7500]],note:'ISN VOR/DME 113.2 separate from IFN NDB 337; fitted transmitter BEFORE threshold, bridge uses inbound before-station branch.'});
add(281,{header:'NDB IFN 337',aid:'ISN',freq:113.2,el:5058,tch:50,anchor:[3,6200],angle:3,scope:[.5,3],bounds:[[8,7500]],note:'NDB DME 1&3 RWY07R; ISN DME 113.2 separate from IFN NDB337; fitted transmitter BEFORE threshold.'});
add(330,{header:'VOR RST 112.6',aid:'RST',freq:112.6,el:-37,tch:58,off:.3,anchor:[5,1200],angle:3,scope:[1,5],bounds:[[10,1900],[13,3000]],note:'NEGATIVE field elevation is real; D1 to threshold approximately 0.7 NM on chart; DME-threshold offset about0.3 NM.'});
add(346,{header:'NDB HAM 317',aid:'HAM',freq:117.9,el:5703,tch:50,anchor:[6,7500],angle:3,scope:[1,6],bounds:[[11,8500]],note:'HAM NDB317 is procedure reference; HAM VOR/DME117.9 defines numeric DME.'});
add(481,{header:'NDB PIM 306',aid:'PIM',freq:117.5,el:4170,tch:50,off:1.5,anchor:[6,5300],angle:3,scope:[3,6],bounds:[[11,6500],[15,8500]],note:'PIM NDB306 procedure reference and PIM VOR/DME117.5 separate; 1.5NM QA offset keeps published D15 8500 minimum.'});
add(482,{header:'NDB PIM 306',aid:'PIM',freq:117.5,el:4170,tch:50,anchor:[3,5500],angle:3.51,scope:[.1,3],bounds:[[8,6200]],note:'Negative fitted offset: station BEFORE threshold on inbound branch; original geometry not surveyed.'});
add(527,{header:'NDB KHM 335',aid:'KHM',freq:117.1,el:14,tch:50,anchor:[7,1400],angle:3,scope:[2.5,7],bounds:[[12,2000],[15,3000]],note:'KHM VOR/DME117.1 (distinct identifier) supplies DME; KHM NDB335 supplies lateral procedure reference.'});
add(530,{header:'NDB KHM 335',aid:'KHM',freq:117.1,el:45,tch:50,anchor:[4,1200],angle:3.41,scope:[1.5,4],bounds:[[10,1800],[13,3000]],note:'KHM VOR/DME117.1 distinct identifier; RWY23 airport45 fallback.'});
add(540,{header:'NDB RAF 260',aid:'RAF',freq:112.3,el:5252,tch:50,anchor:[5,6800],angle:3.48,scope:[2,5],bounds:[[8,7400],[10,8000]],note:'Rafsanjan RAF NDB260 is separate from RAF VOR/DME112.3; do not transfer navaid positions.'});
add(684,{header:'NDB RSR 332',aid:'RSR',freq:115.5,el:-66,tch:50,anchor:[5,1600],angle:3.16,scope:[1.5,5],bounds:[[10,2600],[17,5500]],note:'Ramsar airport elevation -66 below mean sea level, NOT missing. TCH50 on this RWY31 profile; p682/683 TCH is not present.'});
add(695,{header:'VOR DNZ 113.1',aid:'DNZ',freq:113.1,el:5,tch:50,anchor:[6,1900],angle:3.10,scope:[1,6],bounds:[[11,3000]],note:'VOR/DME DNZ113.1 explicitly charted; one-point fitted geometry remains QA-only.'});
add(708,{header:'NDB LAR 224',aid:'LAR',freq:117.9,el:2643,tch:50,anchor:[18,8000],angle:3,scope:[3,8],bounds:[[8,4500],[13,5700]],note:'LAR NDB224 and LAR VOR/DME117.9 distinct instruments; outer D18 8000 anchor chosen to avoid going below published altitude when modeled through D8 and D13; final slope only in final segment.'});
add(803,{header:'NDB ARB 355',aid:'ARB',freq:115.7,el:4296,tch:56,off:1.6,anchor:[5,5300],angle:3,scope:[2.5,5],bounds:[[10,6900]],note:'RWY15 profile D2.5 to threshold approx0.9 NM; 3.00deg only D5 to D2.5. Supporting ARB DME 115.7.'});
add(804,{header:'NDB ARB 355',aid:'ARB',freq:115.7,el:4303,tch:62,off:.1,anchor:[3,5300],angle:3.07,scope:[.8,3],bounds:[[8,6800]],note:'RWY33 profile D0.8 approximately0.7 NM from runway threshold; supporting ARB DME115.7.'});
add(943,{header:'VOR ZDN 116.0',aid:'ZDN',freq:116.0,el:4520,tch:59,off:1.7,anchor:[8,6900],angle:3.49,scope:[2,8],bounds:[[12,8100],[15,9000]],note:'TCH DISPLACED THRESHOLD RWY35L=59ft; RWY35R=50ft. RWY35L airport 4520ft used fallback.'});
add(944,{header:'VOR ZDN 116.0',aid:'ZDN',freq:116.0,el:4520,tch:59,off:1.7,anchor:[8,6900],angle:3.49,scope:[2,8],bounds:[[12,8100],[15,9000]],note:'Second VOR RWY35L Y variant; TCH displaced RWY35L=59ft; same DME source ZDN116.0.'});
add(955,{header:'NDB ISR 309',aid:'ISR',freq:117.0,el:1983,tch:50,anchor:[6,3800],angle:3.13,scope:[2,6],bounds:[[11,5000]],note:'ISR NDB309 and ISR VOR/DME117.0 physically distinct until surveyed.'});
add(956,{header:'NDB ISR 309',aid:'ISR',freq:117.0,el:1926,tch:50,anchor:[6,3900],angle:3.30,scope:[2,6],note:'ISR NDB309 vs ISR VOR/DME117.0; runway35 threshold1926.'});
add(1153,{header:'VOR NBG 114.85',aid:'NBG',freq:114.85,el:3088,tch:50,anchor:[5,4070],angle:3.49,scope:[4.5,6],bounds:[[6,4440]],note:'NBG chart profile D5 4070 and D6 4440; anchor D5 chosen so raw D6 does not fall below chart altitude.'});
add(1154,{header:'VOR NBG 114.85',aid:'NBG',freq:114.85,el:3158,tch:59,anchor:[2,4140],angle:3.49,scope:[1.4,5.5],bounds:[[3,4510],[4,4880],[5,5250],[5.5,5430]],note:'NBG DME altitude profile D2..D5.5 printed; inferred transmitter BEFORE threshold, before-station inbound branch.'});
add(1160,{header:'NDB ANK 356',aid:'ESB',freq:112.1,el:3104,tch:50,anchor:[6,4370],angle:3,scope:[3.5,6.3],bounds:[[5,4050],[6.3,4450]],note:'NDB ANK356 is procedure reference; D6.3 ESB belongs ESB DME112.1, D8.1 ANK MUST NOT be mixed into ESB table.'});
add(1161,{header:'NDB ANK 356',aid:'ESB',freq:112.1,el:3099,tch:51,anchor:[5,4020],angle:3.14,scope:[3,6.3],bounds:[[6,4350],[6.3,4450]],note:'NDB ANK356 procedure source, ESB DME112.1 governs final distance; D8.1 ANK is distinct source.'});
// Airport Elevation may be used only when runway-threshold elevation is missing.
// Store explicit provenance in the model, never mislabel airport as threshold.
const airportOnlyPages=new Set([78,202,280,281,330,481,482,530,684,708,943,944,955,1154]);
// No NDB frequency or DME coordinates are invented; unresolved cases remain withheld.
const processed=[], failed=[];
for(const old of pending){
 const p=old.sourcePage,s=C[p];if(!s)continue;
 try {
   const nav=e.identifyProcedureReference(s.header),g=e.gradientForAngle(s.angle),h0=s.el+s.tch;
   let offset=s.off;
   if(offset===undefined)offset=s.anchor[0]-(s.anchor[1]-h0)/g;
   const before=offset < -1e-6, absOff=Math.abs(offset);
   // If fitted model would require an implausibly distant DME instrument, do not promote.
   if(absOff>4.5||absOff<1e-4)throw Error('UNREASONABLE_FITTED_STATION_OFFSET '+offset);
   const cs=[{dmeNm:s.anchor[0],altitudeFt:s.anchor[1],type:'minimum',label:'Published segment altitude; unrounded altitude checked'},...(s.bounds||[]).map(([dmeNm,altitudeFt])=>({dmeNm,altitudeFt,type:'minimum',label:'Additional published minimum/profile altitude'}))];
   const chartDmeId=s.aid;
   const input={chartId:old.key,chartDmeId,procedureHeader:s.header,procedureFamily:nav.type,procedureReferenceId:nav.id,
     distanceAidEvidence:{type:'DME',id:chartDmeId,frequencyMhz:s.freq,source:'VISUALLY_READ_FROM_SOURCE_PDF_2621',navaidColocationVerified:false},
     thresholdElevationFt:airportOnlyPages.has(p)?undefined:s.el,airportElevationFt:airportOnlyPages.has(p)?s.el:(old.sourceExtracted?.airportElevationFt??null),tchFt:s.tch,publishedAngleDeg:s.angle,
     station:{id:chartDmeId,placement:before?'before_threshold':'after_threshold',offsetNm:absOff,lateralNm:0,geometryVerified:false,...(before?{branch:'before_station'}:{})},
     dmeReadingsNm:Array.from({length:18-Math.max(1,Math.ceil(before?1:absOff-1e-8))+1},(_,i)=>i+Math.max(1,Math.ceil(before?1:absOff-1e-8))),mdaFt:old.mdaFt,
     validAngleDmeRange:{from:s.scope[0],to:s.scope[1]},
     publishedConstraints:cs,minimumThresholdCoverageNm:10,minimumDmeCoverageNm:10,autoExtendCoverage:true,coverageStepDmeNm:1};
   const result=e.buildTable(input);
   if(result.status==='BLOCKED_BY_QA'||result.issues.length)throw Error('ENGINE_BLOCKED '+result.issues.map(x=>x.code+':'+(x.dmeNm??'')).join(','));
   const record={...old,sourceExtracted:{...old.sourceExtracted,rwyElevationFt:airportOnlyPages.has(p)?null:s.el,airportElevationFt:airportOnlyPages.has(p)?s.el:(old.sourceExtracted?.airportElevationFt??null),tchFt:s.tch,elevationSource:result.parameters.elevationSource},navReferenceType:nav.type,procedureReference:result.procedureReference,
    distanceReference:result.distanceMeasurementReference,
    geometryConfidence:'SOURCE_CHART_INTERPRETED_NOT_SURVEY_VERIFIED',
    status:'QA_HEADER_REFERENCE_GEOMETRY_MODEL_V16',blockers:[],
    qaWarnings:[s.note,'NAVIGATION QA ONLY; 10 NM coverage beyond published angle is geometrical EXTRAPOLATION, NOT permission for flight.',
      'Station offset is chart interpreted or fitted to a published minimum and is NOT independent surveyed geodetic DME geometry.'],
    sourceAudit:{sourcePdfPage:p,procedureHeader:s.header,procedureHeaderSource:'VISUAL_PDF_2621',aidId:chartDmeId,aidFrequencyMHz:s.freq,
      referenceSeparation:nav.id+' '+nav.type+' is the procedure reference; '+chartDmeId+' DME provides numeric range (not the NDB transmitter, even with a shared ident)',
      anchorDme:s.anchor[0],anchorAltitudeFt:s.anchor[1],offsetBasis:s.off===undefined?'SINGLE_PUBLISHED_ALTITUDE_FIT_QA':'CHART_PROFILE_DISTANCE_INTERPRETATION_QA',
      mandatoryConstraintsScanned:true,notes:s.note},
    modelInput:input,engineStatus:result.status,angleDeg:s.angle,gradientFtPerNm:g,
    thresholdElevationFt:result.parameters.thresholdElevationFt,tchFt:s.tch,
    elevationSource:result.parameters.elevationSource,
    usedAirportElevationFallback:result.parameters.usedAirportElevationFallback,
    referenceDmeId:chartDmeId,stationPlacement:input.station.placement,stationOffsetNm:absOff,
    table:result.rows.map(r=>({dme:r.dmeNm,thresholdNm:r.thresholdDistanceNm,rawFt:r.rawAltitudeFt,altitudeFt:r.roundedAltitudeFt,
      status:r.status,reasons:r.reasons,published:r.published,vdpMarker:r.vdpMarker||null})),
    vdp:result.vdp,coverage:result.coverage,publishedChecks:result.checks};
   processed.push(record);
   console.log('PASS',p,old.icao,old.title,'proc='+nav.type+' '+nav.id,'DME='+chartDmeId,'offset='+offset.toFixed(3),'VDP='+result.vdp.dmeDisplay,'rows='+record.table.length);
 }catch(error){failed.push({page:p,icao:old.icao,title:old.title,error:String(error.message||error)});console.log('FAIL',p,old.icao,error.message)}
}
// Keep entire original 164 chart registry unchanged except for truly passing cases.
const complete={...data,schema:'jeppiran.cdfa.bulk-qa.v1.6',engineVersion:'1.5.0+audited_42',
 reviewPolicy:'VISUAL PASS over 42 withheld; header reference separated from supporting DME; provisional geometric QA only. No real-world navigation release.',
 charts:data.charts.map(c=>processed.find(x=>x.key===c.key)||c)};
complete.counts={...data.counts,WITHHELD_MISSING_GEOMETRY:data.counts.WITHHELD_MISSING_GEOMETRY-processed.length,
 QA_HEADER_REFERENCE_GEOMETRY_MODEL_V16:processed.length};
if(Object.values(complete.counts).reduce((a,b)=>a+b,0)!==164)throw Error('Counts invariant');
const report={cycle:'2621',source:'original Jeppesen 2621.pdf',engineVersion:'1.5',beforeWithheld:42,
 promotedQA:processed.length,remainingWithheld:42-processed.length,
 successful:processed.map(x=>({page:x.sourcePage,icao:x.icao,title:x.title,chart:x.chartNumber,nav:x.procedureReference,
 dme:x.distanceReference?.id,angle:x.angleDeg,offset:x.stationOffsetNm,placement:x.stationPlacement,
 vdp:x.vdp?.dmeDisplay,coverage:x.coverage?.maxModeledThresholdDistanceNm,
 note:x.sourceAudit.notes})),failed,
 unresolved:pending.filter(c=>!processed.some(x=>x.key===c.key)).map(c=>({page:c.sourcePage,icao:c.icao,title:c.title,oldBlockers:c.blockers,
 extraReview:failed.find(f=>f.page===c.sourcePage)?.error || 'HEADER_IDENTIFIED_BUT_GEOMETRY_CONSTRAINTS_NEED_MANUAL_PIECEWISE_RECONCILIATION',
 note:'Still withheld; no table constructed for user display'}))};
fs.writeFileSync(path.join(base,'data/cdfa-v2621-v16-qa.json'),JSON.stringify(complete,null,2)+'\n');
fs.writeFileSync(path.join(base,'data/cdfa-v2621-v16-remaining42-audit.json'),JSON.stringify(report,null,2)+'\n');
console.log('COUNTS',complete.counts,'PASS',processed.length,'REMAINING',report.remainingWithheld);