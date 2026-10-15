const RAW_ROOT="./data/";
// V2621 APPROACH display titles are UI-only: never mutate c.name, chart keys,
// georef chartKey, stable bookmark IDs, simulator bridges or PDF page indices.
// Source-audited V2621 ground plates must display correctly on FIRST render,
// even when offline or other optional metadata requests are delayed or unavailable.
// Original c.name, chart IDs, bookmark keys, PDFs and georeferencing are unchanged.
const REVIEWED_V2621_GROUND_TITLES=Object.freeze({
  "382": {
    "icao": "OIIE",
    "chart_number": "20-9B",
    "category": "Airport",
    "original_name": "51-08.5 51-08.6 51-08.7 51-08.8 51-08.9 51-09 51-09.1 51-09.2 51-09.3 51-09.4 51-09.5 51-09.6",
    "name": "AIRCRAFT PARKING CHART (APRON 1 / PASSENGER APRON)"
  },
  "383": {
    "icao": "OIIE",
    "chart_number": "20-9C",
    "category": "Airport",
    "original_name": "51-09.9 51-10 51-10.1 51-10.2 51-10.3 51-10.4 51-10.5 51-10.6 51-10.7 51-10.8 51-10.9 51-11 51-11.1 51-11.2 51-11.3",
    "name": "AIRCRAFT PARKING CHART (APRON 2 CARGO / APRON 3 SALAM)"
  },
  "985": {
    "icao": "ORBI",
    "chart_number": "10-9B",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "NOSE-IN PARKING PROCEDURES (AGNIS / PAPA)"
  },
  "1003": {
    "icao": "ORER",
    "chart_number": "10-9B",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "PUSHBACK / ENGINE RUN PROCEDURES"
  },
  "1004": {
    "icao": "ORER",
    "chart_number": "10-9C",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "LOW VISIBILITY TAXI ROUTES"
  },
  "1028": {
    "icao": "ORSJ",
    "chart_number": "10-9A",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "AIRCRAFT PARKING CHART (APRON 1 / CARGO APRON)"
  },
  "1051": {
    "icao": "OOMS",
    "chart_number": "10-9B",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "AIRPORT GROUND CHART (APRONS & STANDS)"
  },
  "1131": {
    "icao": "LTAC",
    "chart_number": "10-9E",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "LOW VISIBILITY PROCEDURES"
  },
  "1132": {
    "icao": "LTAC",
    "chart_number": "10-9F",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "LOW VISIBILITY PROCEDURES (CONT.)"
  },
  "1435": {
    "icao": "OMDB",
    "chart_number": "10-9L",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "VISUAL DOCKING GUIDANCE SYSTEMS (VDGS)"
  },
  "1436": {
    "icao": "OMDB",
    "chart_number": "10-9M",
    "category": "Airport",
    "original_name": "AIRPORT CHART",
    "name": "VISUAL DOCKING GUIDANCE SYSTEMS (VDGS) (CONT.)"
  }
});
let chartDisplayNamesByPage=Object.create(null);
function displayChartName(c){
  const page=String(Number(c?.page));
  const review=REVIEWED_V2621_GROUND_TITLES[page];
  if(review && manifest?.version==="V2621" &&
     c?.airport===review.icao && c?.chart_number===review.chart_number &&
     c?.category===review.category && c?.name===review.original_name){
    return review.name;
  }
  return chartDisplayNamesByPage[page] || c?.name || ("Chart "+page);
}

/* === V2621 REVERSIBLE EXPERIMENTAL GEOREF LAYER (WEB ONLY) ===
 * Stable chart-georef.json remains unchanged; every experimental model is explicitly TEST ONLY.
 */
let experimentalGeorefPages=new Set();
// Separate from approved affine models: two OICI NOT TO SCALE route-centerline QA maps.
let oiciRouteQaPages=new Set();
let oiciRouteModule=null;
let experimentalEligibleGeoModels=new Map();
let experimentalOimmPreviousModels=new Map();
const EXPERIMENTAL_OIMM_ILS_PAGES=new Set([605,606,607]);
const EXP_GEO_KEY="jeppiran-v2621-experimental-georef-enabled";
function experimentalGeorefOn(){try{return localStorage.getItem(EXP_GEO_KEY)!=="off"}catch(_){return true}}
// Reversible owner flight QA for OIGG KOBUB STARs. Source has a ~1 km
// independent graticule disagreement; this MUST remain visibly experimental.
// OIIE V2621 missing SID 376 / LOC 386 / ILS 388. Read-only, reversible
// source-PDF flight QA. Never overwrite existing chart-georef.json records.
async function loadOiiMissingSidIlsFlightQa(m){
  try{
    const response=await fetch("./data/oiie-missing-sid-ils-flightqa-v2621.json?v=oiie-376-386-388-r1",{cache:"no-store"});
    if(!response.ok)throw Error("OIIE new SID/ILS QA HTTP "+response.status);
    const data=await response.json();
    const expected=new Map([[376,"fc0a0285d01f39872f68bae9fddf39cb6703f8c8c1d1776125de2c188d873c9b"],
      [386,"17c4902191d2ee254d3c378ed23c75e973d1da66377d99b86c24742bfe81adeb"],
      [388,"4185dfa21c0adf26e52ac08439bf4507bf16fd7014d89ab8cea08d9b23d95e23"]]);
    if(data.version!==2||data.testOnly!==true||data.notForActualNavigation!==true||
       data.coordinateSystem!=="WGS84"||data.coordinateSpace!=="pdf_points"||
       data.origin!=="top_left"||data.source?.chartDataVersion!==m.version||
       data.source?.sha256!==m.source_sha256||data.source?.pageCount!==1654||
       !Array.isArray(data.charts)||data.charts.length!==3)
      throw Error("OIIE source AIRAC mismatch");
    const staged=[];
    for(const item of data.charts){
      const page=Number(item.page),c=charts.find(v=>v.airport==="OIIE"&&Number(v.page)===page);
      const key=c?[c.airport,c.category.toUpperCase(),c.chart_number,c.name.toUpperCase()].join("|"):"";
      const qa=item.validation;
      if(!expected.has(page)||staged.some(z=>z[0]===page)||georefByPage.has(page)||
         item.airport!=="OIIE"||item.sourceFingerprint!==expected.get(page)||
         item.chartKey!==key||qa?.qaTestOnly!==true||qa?.notApprovedForNavigation!==true||
         qa?.originalPdfSha256!==m.source_sha256||
         qa?.method!==(page===376?"two_navaid_source_grid_flight_qa":"crossplate_ika_grid_flight_qa")||
         !Array.isArray(qa?.sourceControlPoints)||qa.sourceControlPoints.length<4||
         !Number.isFinite(Math.max(...Object.values(qa?.independentCheckErrorsPdfPoints||{})))||
         Math.max(...Object.values(qa.independentCheckErrorsPdfPoints))>1.5||
         (page===376&&item.excludedBounds?.length!==0)||
         (page!==376&&item.excludedBounds?.length!==2))
        throw Error("OIIE flight QA metadata, source controls, NTS masking or protected map "+page);
      const model=makeGeoModel(item);
      if(!model)throw Error("OIIE invalid source-calibrated geometry "+page);
      staged.push([page,model]);
    }
    if(manifest!==m||staged.length!==3||staged.some(([page])=>georefByPage.has(page)))return;
    for(const [page,model] of staged){
      experimentalEligibleGeoModels.set(page,model);
      if(experimentalGeorefOn()){
        georefByPage.set(page,model);
        experimentalGeorefPages.add(page);
      }
    }
    showPublishedExperimentalGeorefNotice();
    if(selectedChart?.airport==="OIIE")updateAircraftMarker();
    console.info("OIIE SID 376, LOC 386, ILS 388 source-locked flight-QA overlay ready; not for actual navigation");
  }catch(e){console.warn("OIIE source-locked simulator references refused; all original models preserved:",e)}
}
async function loadOiggStarsFlightQa(m){
  try{
    const res=await fetch("./data/oigg-star-flightqa-v2621.json?v=oigg-kobub-qa-r1",{cache:"no-store"});
    if(!res.ok)throw Error("OIGG KOBUB QA file HTTP "+res.status);
    const data=await res.json();
    if(data.version!==2||data.testOnly!==true||data.notForActualNavigation!==true||
       data.source?.chartDataVersion!==m.version||data.source?.sha256!==m.source_sha256||
       data.source?.pageCount!==1654||data.coordinateSpace!=="pdf_points"||
       data.origin!=="top_left"||!Array.isArray(data.charts)||data.charts.length!==2)
      throw Error("OIGG flight QA AIRAC/source mismatch");
    const approvedIdentities=new Map([[307,"a40a3de145df915dd71dcec063477726c6eb31adb0284b12e426f1c6794a81b9"],[308,"ceb66c6a644da4d000d9d23a4121c73be70542a54f0e3e0037537b716a921b81"]]);
    const staged=[];
    for(const item of data.charts){
      const page=Number(item.page),c=charts.find(x=>x.airport==="OIGG"&&Number(x.page)===page);
      const chartKey=c?[c.airport,c.category.toUpperCase(),c.chart_number,c.name.toUpperCase()].join("|"):"";
      if(!approvedIdentities.has(page)||staged.some(([n])=>n===page)||georefByPage.has(page)||
         item.airport!=="OIGG"||item.sourceFingerprint!==approvedIdentities.get(page)||
         item.chartKey!==chartKey||item.validation?.method!=="two_vector_landmarks_simulator_qa"||
         item.validation?.qaTestOnly!==true||item.validation?.notApprovedForNavigation!==true||
         Number(item.validation.independentPrintedGridMismatchMaxMetres)<700 ||
         Number(item.validation.independentPrintedGridMismatchMaxMetres)>1100)
        throw Error("OIGG flight QA control, identity or immutable map check failed "+page);
      const model=makeGeoModel(item);
      if(!model)throw Error("OIGG two-landmark QA geometry failed "+page);
      staged.push([page,model]);
    }
    if(manifest!==m||staged.length!==2||staged.some(([n])=>georefByPage.has(n)))return;
    for(const [page,model] of staged){
      experimentalEligibleGeoModels.set(page,model);
      if(experimentalGeorefOn()){
        georefByPage.set(page,model);
        experimentalGeorefPages.add(page);
      }
    }
    showPublishedExperimentalGeorefNotice();
    if(selectedChart?.airport==="OIGG")updateAircraftMarker();
    console.warn("OIGG KOBUB STAR 307/308 installed as SIMULATOR ONLY – 700-940 m source-grid discrepancy");
  }catch(e){console.warn("OIGG STAR flight QA safely disabled; source maps unchanged",e)}
}
async function loadPublishedExperimentalGeorefs(m){
  experimentalGeorefPages=new Set();
  experimentalEligibleGeoModels=new Map();
  experimentalOimmPreviousModels=new Map();
  try{
    const r=await fetch("./data/georef-provisional-v2621.json?v=oimm-ils-prod-1",{cache:"no-store"});
    if(!r.ok)throw Error("Experimental dataset HTTP "+r.status);
    const d=await r.json();
    if(d.version!==2||d.coordinateSpace!=="pdf_points"||d.origin!=="top_left"||d.coordinateSystem!=="WGS84"||
       d.testOnly!==true||d.source?.sha256!==m.source_sha256||
       d.source?.chartDataVersion!==m.version||d.source?.pageCount!==1654)throw Error("Experiment source/cycle mismatch");
    const seen=new Set();
    for(const item of d.charts||[]){
      const page=Number(item.page);
      if(!Number.isInteger(page)||seen.has(page)||!item.validation?.qaTestOnly||!item.validation?.notApprovedForNavigation||
        [565,566,642].includes(page))continue;
      seen.add(page);
      const c=charts.find(x=>Number(x.page)===page);
      if(!c||c.airport!==item.airport||
         item.chartKey!==[c.airport,c.category.toUpperCase(),c.chart_number,c.name.toUpperCase()].join("|"))continue;
      // Never override an original georeference or a separate QA override.
      if(georefByPage.has(page)&&!EXPERIMENTAL_OIMM_ILS_PAGES.has(page))continue;
      const model=makeGeoModel(item);
      if(!model)continue;
      experimentalEligibleGeoModels.set(page,model);
      if(EXPERIMENTAL_OIMM_ILS_PAGES.has(page))experimentalOimmPreviousModels.set(page,georefByPage.get(page)||null);
      if(experimentalGeorefOn()){georefByPage.set(page,model);experimentalGeorefPages.add(page)}
    }
    console.info("JEPPIRAN experimental georefs:",experimentalGeorefPages.size,"enabled; web only; not approved for navigation.");
  }catch(error){console.warn("Experimental georeferences skipped; stable set preserved.",error)}
}
function togglePublishedExperimentalGeoref(){
  const enabled=!experimentalGeorefOn();
  try{localStorage.setItem(EXP_GEO_KEY,enabled?"on":"off")}catch(_){}
  experimentalGeorefPages.clear();
  for(const [page,model] of experimentalEligibleGeoModels){
    if(enabled){
      if(EXPERIMENTAL_OIMM_ILS_PAGES.has(page)||!georefByPage.has(page)){
        georefByPage.set(page,model);experimentalGeorefPages.add(page)
      }
    }else if(georefByPage.get(page)===model){
      const old=experimentalOimmPreviousModels.get(page);
      if(EXPERIMENTAL_OIMM_ILS_PAGES.has(page)&&old)georefByPage.set(page,old);
      else georefByPage.delete(page);
    }
  }
  showPublishedExperimentalGeorefNotice();
  updateAircraftMarker();
  refreshPositionStatus();
}
function showPublishedExperimentalGeorefNotice(){
  const stage=document.getElementById("pdfStage");
  if(!stage)return;
  stage.querySelector("#provisionalGeorefWarning")?.remove();
  const page=Number(selectedChart?.page);
  if(selectedChart?.airport==="OIII" && georefByPage.has(page))return;
  if(!experimentalEligibleGeoModels.has(page))return;
  const enabled=experimentalGeorefPages.has(page);
  const panel=document.createElement("div");
  panel.id="provisionalGeorefWarning";
  panel.style.cssText="position:absolute;top:7px;left:7px;z-index:40;background:#553210f2;color:#fff6db;border:2px solid #fcbf55;padding:7px 9px;max-width:calc(100% - 14px);border-radius:8px;display:flex;align-items:center;gap:8px;flex-wrap:wrap;font:12px/1.4 Arial,sans-serif;box-shadow:0 2px 9px #0006";
  const msg=document.createElement("strong");
  msg.textContent=[376,386,388].includes(page)?
    (enabled?"⚠ OIIE SID/ILS · SOURCE GRID & NAVAID GEO QA · SIMULATOR ONLY · NOT FOR ACTUAL NAVIGATION":"OIIE SID/ILS SIMULATOR GEOREFERENCE DISABLED"):
    [307,308].includes(page)?
    (enabled?"⚠ OIGG KOBUB STAR · GRID DISAGREES 700–940 m · SIMULATOR FLIGHT QA ONLY · NOT FOR NAVIGATION":"OIGG KOBUB STAR TEST GEOREFERENCE DISABLED"):
    (enabled?"⚠ GEOREFERENCE · INDEPENDENT AIP QA PENDING · NOT FOR NAVIGATION":"GEOREFERENCE LAYER DISABLED");
  panel.appendChild(msg);
  const btn=document.createElement("button");
  btn.type="button";btn.textContent=enabled?"Disable additional georefs":"Enable additional georefs";
  btn.style.cssText="background:#fbd28b;color:#422400;border:0;border-radius:6px;padding:5px 8px;cursor:pointer;font-weight:bold";
  btn.addEventListener("click",togglePublishedExperimentalGeoref);
  panel.appendChild(btn);
  stage.style.position="relative";stage.appendChild(panel);
}
// OTHH flight-QA simulator release: additive, source-fingerprinted, and never override base.
async function loadOthhFlightApprovedGeorefs(m){
  try{
    const r=await fetch("./data/othh-flight-qa-v2621.json?v=1",{cache:"no-store"});
    if(!r.ok)throw Error("OTHH flight QA dataset unavailable");
    const d=await r.json();
    if(d.version!==2||d.testOnly!==false||d.notForActualNavigation!==true||
       d.coordinateSpace!=="pdf_points"||d.origin!=="top_left"||
       d.coordinateSystem!=="WGS84"||d.source?.sha256!==m.source_sha256||
       d.source?.chartDataVersion!==m.version||d.source?.pageCount!==1654)
      throw Error("OTHH source/cycle validation failed");
    const expected=new Set([1536,1549]);
    if(!Array.isArray(d.charts)||d.charts.length!==2)throw Error("Unexpected OTHH chart count");
    const models=[];
    for(const item of d.charts){
      const page=Number(item.page);
      if(!expected.delete(page)||item.airport!=="OTHH"||
         !item.validation?.userReportedFlightTestPassed||
         !item.validation?.notApprovedForNavigation||
         !/^[a-f0-9]{64}$/.test(item.sourceFingerprint||""))
        throw Error("OTHH chart QA identity mismatch");
      const c=charts.find(x=>Number(x.page)===page);
      if(!c||item.chartKey!==[c.airport,c.category.toUpperCase(),
         c.chart_number,c.name.toUpperCase()].join("|"))
        throw Error("OTHH index identity mismatch");
      if(georefByPage.has(page))throw Error("Existing OTHH georeference preserved");
      const model=makeGeoModel(item);
      if(!model)throw Error("OTHH geo model rejected for page "+page);
      models.push([page,model]);
    }
    if(expected.size)throw Error("OTHH page missing");
    for(const [page,model] of models)georefByPage.set(page,model);
    console.info("JEPPIRAN: two OTHH flight-reviewed simulator georefs active (NOT FOR ACTUAL NAVIGATION)");
  }catch(error){
    console.warn("OTHH flight QA georeferences not loaded:",error);
  }
}

// Separate, additive OTHH owner flight-test accepted overlays; never replace existing data.
async function loadOthhFlightExtraGeorefs(m){
  try{
    const r=await fetch("./data/othh-flight-qa-extra-v2621.json?v=1",{cache:"no-store"});
    if(!r.ok)throw Error("OTHH additional flight QA file missing");
    const d=await r.json();
    if(d.version!==2||d.testOnly!==false||d.notForActualNavigation!==true||
       d.coordinateSpace!=="pdf_points"||d.origin!=="top_left"||d.coordinateSystem!=="WGS84"||
       d.source?.sha256!==m.source_sha256||d.source?.chartDataVersion!==m.version||d.source?.pageCount!==1654)
       throw Error("OTHH additional source mismatch");
    const expected=new Set([1538,1539,1540,1552,1553,1556,1557,1559,1560,1561]);
    if(!Array.isArray(d.charts)||d.charts.length!==10)throw Error("OTHH additional count mismatch");
    const models=[];
    for(const item of d.charts){
      const page=Number(item.page);
      if(!expected.delete(page)||item.airport!=="OTHH"||!item.validation?.userReportedFlightTestPassed||
         !item.validation?.notApprovedForNavigation||!/^[0-9a-f]{64}$/.test(item.sourceFingerprint||""))
         throw Error("OTHH additional identity mismatch "+page);
      const chart=charts.find(c=>Number(c.page)===page);
      if(!chart||item.chartKey!==[chart.airport,chart.category.toUpperCase(),
           chart.chart_number,chart.name.toUpperCase()].join("|"))
         throw Error("OTHH additional index mismatch "+page);
      if(georefByPage.has(page))throw Error("Existing georeference protected "+page);
      if(!Array.isArray(item.excludedBounds)||item.excludedBounds.length===0)
         throw Error("OTHH mask required "+page);
      const model=makeGeoModel(item);
      if(!model)throw Error("OTHH affine validation failed "+page);
      models.push([page,model]);
    }
    if(expected.size)throw Error("OTHH missing pages");
    for(const [page,model] of models)georefByPage.set(page,model);
    console.info("JEPPIRAN OTHH: 10 additional simulator-only flight accepted charts loaded.");
  }catch(error){console.warn("OTHH extra georef safely skipped:",error)}
}

/* === END EXPERIMENTAL LAYER === */

const ADC_QA_MODE = new URLSearchParams(location.search).get("adc_test")==="1";
const BIRJAND_ADC_QA_MODE = new URLSearchParams(location.search).get("adc_test")==="birjand";
const DOHA_ADC_QA_MODE = new URLSearchParams(location.search).get("adc_test")==="doha";
function showAdcQaMessage(message, payload=null){
  let wrap=document.getElementById("adcQaPanel");
  if(!wrap){
    wrap=document.createElement("aside"); wrap.id="adcQaPanel";
    wrap.style.cssText="position:fixed;right:10px;bottom:10px;z-index:99999;background:#442807;color:#fff9dc;border:2px solid #f6b74d;border-radius:10px;padding:10px;max-width:min(440px,92vw);box-shadow:0 6px 24px #0008;font:12px/1.4 system-ui,sans-serif;";
    document.body.appendChild(wrap);
  }
  wrap.replaceChildren();
  const heading=document.createElement("strong");heading.textContent="ADC EXPERIMENT · NOT FOR ACTUAL NAVIGATION";
  heading.style.cssText="display:block;margin-bottom:5px;font-size:12px;"; wrap.appendChild(heading);
  const msg=document.createElement("div");msg.textContent=message;wrap.appendChild(msg);
  if(!payload)return;
  const row=document.createElement("div");row.style.cssText="display:flex;flex-wrap:wrap;gap:5px;margin-top:8px";
  for(const item of payload.charts){
    for(const point of [...item.points,...(item.testPoints||[])].filter(p=>(p.controlType==="AIP" || p.controlType==="AIP_HELD_OUT") || /^(ARP|THR08|THR26|RWY10 physical|THR28|NDB HAM|NDB LEN|VOR\/DME HAM)$/.test(p.source))){
      const btn=document.createElement("button");btn.type="button";
      btn.textContent=item.airport+" · "+point.source;
      btn.style.cssText="color:#171717;background:#ffe1a1;border:0;border-radius:5px;padding:5px;cursor:pointer";
      btn.addEventListener("click",()=>{
        const chart=charts.find(c=>Number(c.page)===Number(item.page)&&c.airport===item.airport);
        if(!chart){showAdcQaMessage("ADC chart is missing from the active index.");return;}
        stopGps();stopBridge();
        selectAirport(item.airport);
        route("charts");
        selectChart(chart);
        activePositionSource="qa";
        updatePositionUi({lat:point.lat,lon:point.lon,alt:0,heading:0,groundspeed:0,accuracy:0},"qa");
      });
      row.appendChild(btn);
    }
  }
  wrap.appendChild(row);
}
async function enableAdcQaIfRequested(m){
  if(!ADC_QA_MODE)return;
  try{
    const response=await fetch("./data/adc-georef-v2621-qa.json?v=1",{cache:"no-store"});
    if(!response.ok)throw Error("QA calibration file missing");
    const payload=await response.json();
    if(!payload.testOnly || payload.charts?.length!==2 ||
       payload.source?.sha256!==m.source_sha256 || payload.source?.chartDataVersion!==m.version)
      throw Error("QA source/cycle does not match the active chart data");
    for(const [page,icao] of [[118,"OIBL"],[342,"OIHH"]]){
      const item=payload.charts.find(c=>Number(c.page)===page && c.airport===icao);
      const sourceChart=charts.find(c=>Number(c.page)===page && c.airport===icao && c.chart_number==="10-9");
      if(!item || !sourceChart || !item.validation?.qaTestOnly)throw Error("QA chart identity mismatch");
      const model=makeGeoModel(item);
      if(!model)throw Error("QA calibration rejected for "+icao);
      georefByPage.set(page,model);
    }
    showAdcQaMessage("OIBL and OIHH experimental positioning active. Select an airport ADC, connect a simulator, or tap a sample point below.",payload);
  }catch(error){
    showAdcQaMessage("QA DISABLED: "+error.message+". Public charts were not modified.");
  }
}


async function enableBirjandAdcQaIfRequested(m){
  if(!BIRJAND_ADC_QA_MODE)return;
  try{
    const r=await fetch("./data/birjand-adc-v2621-qa.json?v=1",{cache:"no-store"});
    if(!r.ok)throw Error("Birjand test calibration file missing");
    const payload=await r.json();
    if(!payload.testOnly || payload.charts?.length!==1 ||
       payload.version!==2 || payload.source?.pageCount!==1654 ||
       payload.source?.sha256!==m.source_sha256 ||
       payload.source?.chartDataVersion!==m.version)
      throw Error("Birjand test source or AIRAC cycle mismatch");
    const item=payload.charts[0],c=charts.find(x=>Number(x.page)===561&&x.airport==="OIMB"&&x.category==="Airport"&&x.chart_number==="10-9");
    if(!c || item.page!==561 || item.airport!=="OIMB" || !item.validation?.qaTestOnly ||
       item.chartKey!==[c.airport,c.category.toUpperCase(),c.chart_number,c.name.toUpperCase()].join("|"))
      throw Error("Birjand chart index identity does not match official page 561");
    if(georefByPage.has(561))throw Error("Page 561 is already georeferenced; QA override is blocked");
    const model=makeGeoModel(item);
    if(!model)throw Error("Birjand QA calibration has not passed chart geometry checks");
    georefByPage.set(561,model);
    showAdcQaMessage("BIRJAND OIMB · ADC 10-9 · provisional 10m test active. Open Birjand or tap a surveyed AIP point. Do not use for actual navigation.",payload);
  }catch(error){
    showAdcQaMessage("BIRJAND QA DISABLED: "+error.message+". No production georeference was modified.");
  }
}


async function enableDohaAdcQaIfRequested(m){
  if(!DOHA_ADC_QA_MODE)return;
  try{
    const response=await fetch("./data/othh-adc-v2621-qa.json?v=1",{cache:"no-store"});
    if(!response.ok)throw Error("OTHH QA model missing");
    const payload=await response.json();
    if(!payload.testOnly||payload.charts?.length!==1||payload.source?.sha256!==m.source_sha256||
       payload.source?.chartDataVersion!==m.version||payload.source?.pageCount!==1654)throw Error("PDF cycle mismatch");
    const c=charts.find(x=>Number(x.page)===1536&&x.airport==="OTHH"&&x.category==="Airport"&&x.chart_number==="20-9");
    const item=payload.charts[0];
    if(!c||item.page!==1536||item.airport!=="OTHH"||!item.validation?.qaTestOnly||
       item.chartKey!==[c.airport,c.category.toUpperCase(),c.chart_number,c.name.toUpperCase()].join("|")||
       item.validation.independentAipThresholdCheckCount!==4||item.validation.maxIndependentAipThresholdErrorMeters>10)
       throw Error("OTHH model/index identity mismatch");
    if(georefByPage.has(1536))throw Error("Original georeference override blocked");
    const model=makeGeoModel(item);
    if(!model)throw Error("OTHH source graticule failed geometry checks");
    georefByPage.set(1536,model);
    showAdcQaMessage("DOHA OTHH · ADC 20-9 · four official AIP runway checks, provisional 10m. NOT FOR ACTUAL NAVIGATION.",payload);
  }catch(error){showAdcQaMessage("DOHA QA DISABLED: "+error.message+". Stable georefs unchanged.");}
}

const VERSION="V2620";
const WX_CACHE_RAW="https://raw.githubusercontent.com/mahmet737ng-gif/JeppIran/wx-cache/wx-live.json";
const WX_CACHE_API="https://api.github.com/repos/mahmet737ng-gif/JeppIran/contents/wx-live.json?ref=wx-cache";
const CATEGORY_ORDER=["Airport","STAR","SID","Approach","Other"];
const AIRPORTS={
"LTFM":["ISTANBUL AIRPORT","ISTANBUL"],"OIAA":["ABADAN AIRPORT","ABADAN"],"OIAM":["MAHSHAHR AIRPORT","MAHSHAHR"],
"OIAW":["AHWAZ AIRPORT","AHWAZ"],"OIBB":["BUSHEHR AIRPORT","BUSHEHR"],"OIBK":["KISH ISLAND","KISH ISLAND"],
"OIBP":["ASALOUYEH AIRPORT","ASALOUYEH"],"OICC":["KERMANSHAH AIRPORT","KERMANSHAH"],"OICI":["ILAM AIRPORT","ILAM"],"OICZ":["SAQEZ AIRPORT","SAQEZ"],
"OIFM":["ISFAHAN AIRPORT","ISFAHAN"],"OIGG":["RASHT AIRPORT","RASHT"],"OIHH":["HAMADAN AIRPORT","HAMADAN"],
"OIIE":["IMAM KHOMEINI INTERNATIONAL","TEHRAN"],"OIII":["MEHRABAD INTERNATIONAL","TEHRAN"],"OIIP":["KARAJ AIRPORT","KARAJ"],
"OIKK":["KERMAN AIRPORT","KERMAN"],"OIMB":["BIRJAND AIRPORT","BIRJAND"],"OIMT":["TABAS AIRPORT","TABAS"],"OIMM":["MASHHAD INTERNATIONAL","MASHHAD"],
"OIMN":["BOJNURD AIRPORT","BOJNURD"],"OIMS":["SABZEVAR AIRPORT","SABZEVAR"],"OING":["GORGAN AIRPORT","GORGAN"],
"OINZ":["SARI AIRPORT","SARI"],"OISS":["SHIRAZ INTERNATIONAL","SHIRAZ"],"OITL":["ARDABIL AIRPORT","ARDABIL"],
"OITR":["URMIA AIRPORT","URMIA"],"OITT":["TABRIZ INTERNATIONAL","TABRIZ"],"OITU":["MAKU AIRPORT","MAKU"],"OIYY":["YAZD AIRPORT","YAZD"],
"OIZC":["CHABAHAR AIRPORT","CHABAHAR"],"OIZH":["ZAHEDAN INTERNATIONAL","ZAHEDAN"],"OMDB":["DUBAI INTERNATIONAL","DUBAI"],
"OOMS":["MUSCAT INTERNATIONAL","MUSCAT"],"ORBI":["BAGHDAD INTERNATIONAL","BAGHDAD"],"ORNI":["NAJAF INTERNATIONAL","NAJAF"],
"UDYZ":["ZVARTNOTS INTERNATIONAL","YEREVAN"],"UGSB":["BATUMI INTERNATIONAL","BATUMI"],"UGTB":["TBILISI INTERNATIONAL","TBILISI"]
};

let airportMetadata={}, airportRunwayMetadata={};
let charts=[], manifest=null, enrouteValidityManifest=null, selectedAirport="", selectedChart=null, expanded=new Set();
let airportTreeExpanded=false;
let chartZoom=1, chartPanX=0, chartPanY=0;
// Dual Layer Ops marker: chart follow is a viewer-only feature; no simulator transport changes.
let aircraftFollowEnabled=false, taxiOffRouteCount=0, taxiOffRouteActive=false;
// Camera transitions never modify the live position source or simulator bridge.
let findMeAnimation=null, followTrackingFrame=0, followTrackingTime=0;
let chartMetarTimer=null, chartMetarAirport="", chartMetarValue="";
const CHART_METAR_POLL_INTERVAL=5*60*1000;
// Keep this session's displayed reports when switching charts or airports.
const chartMetarShown=new Map(), chartMetarRequests=new Map(), chartMetarCheckedAt=new Map();
let chartPointers=new Map(), pinchStartDistance=0, pinchStartZoom=1, panStart=null, swipeStart=null, lastTapAt=0, lastTapPoint=null;
let georefByPage=new Map(), githubWxCache=null, githubWxCacheAt=0;
const $=s=>document.querySelector(s);
const $$=s=>[...document.querySelectorAll(s)];
function readJsonStorage(key,fallback={}){
  try{
    const raw=localStorage.getItem(key);
    if(!raw)return fallback;
    const parsed=JSON.parse(raw);
    return parsed&&typeof parsed==="object"?parsed:fallback;
  }catch(_){
    try{localStorage.removeItem(key)}catch(__){}
    return fallback;
  }
}
window.addEventListener("error",e=>{
  const s=document.getElementById("fsxInlineStatus");
  if(s&&!window.jeppiranConnectFsx){
    s.textContent="JEPPIRAN core error: "+((e&&e.message)||"script initialization failed")+". Reload the page once.";
  }
});

function renderRoute(name){
  $$(".view").forEach(v=>v.classList.remove("active"));
  document.body.classList.remove("viewer-fullscreen");
  const el=$("#"+name+"View")||$("#homeView"); el.classList.add("active");
  const homeButton=$("#jpHomeBtn");
  if(homeButton)homeButton.hidden=el.id==="homeView"||el.id==="chartsView";
  if(name==="charts"&&selectedChart)showChartMetar(true,true);
  // When the app is being served by the FSX Local Web bridge, entering the
  // simulator page must always restore FSX as the active source instead of
  // falling back to a previously saved X-Plane selection.
  if(name==="simulator" && typeof ensureLocalFsxSession==="function"){
    setTimeout(()=>ensureLocalFsxSession(false),0);
  }
}
function route(name,replace=false){
  renderRoute(name);
  const hash="#"+name;
  if(location.hash!==hash){
    const fn=replace?"replaceState":"pushState";
    history[fn]({route:name},"",hash);
  }
}
// An explicit Home action must escape native fullscreen before changing
// views. Do not use history.back(): Android Local Assets and offline FSX may
// otherwise leave this origin. The selected airport/chart remains resumable.
async function returnToJeppiranHome(){
  try{
    if(document.body.classList.contains("viewer-fullscreen")){
      await exitViewerFullscreen(true);
    }else if(document.fullscreenElement||document.webkitFullscreenElement){
      const exit=document.exitFullscreen||document.webkitExitFullscreen;
      if(exit)await exit.call(document);
    }
  }catch(_){
    document.body.classList.remove("viewer-fullscreen");
  }finally{
    if(typeof cancelChartSwipe==="function")cancelChartSwipe();
    if(typeof setFullscreenChartDrawer==="function"&&jpChartDrawerOpen)setFullscreenChartDrawer(false);
    route("home");
  }
}
["chartsBackBtn","chartsBackMobileBtn"].forEach(id=>{const b=$("#"+id);if(b)b.addEventListener("click",()=>{void returnToJeppiranHome()})});
$$("[data-route]").forEach(b=>b.addEventListener("click",e=>{
  e.preventDefault();
  const target=b.dataset.route;
  // Keep navigation inside the current JEPPIRAN origin. In Local FSX mode,
  // history.back() can return to the public GitHub app and drop the live bridge.
  if(target==="home"){void returnToJeppiranHome();return}
  route(target);
}));
window.addEventListener("popstate",()=>renderRoute((location.hash||"#home").slice(1)));
window.JEPPIRAN_NAV_READY=true;
/* Edge-swipe page history. Keep PDF pan/zoom and horizontal lists untouched. */
(function(){
  let touchStart=null;
  document.addEventListener("touchstart",e=>{
    if(e.touches.length!==1){touchStart=null;return}
    const t=e.touches[0],target=e.target;
    if(t.clientX>45&&t.clientX<innerWidth-45){touchStart=null;return}
    if(target.closest("#pdfStage,.pdf-stage,input,textarea,select,dialog,.airport-list,.airport-inline-tree")){touchStart=null;return}
    touchStart={x:t.clientX,y:t.clientY,when:Date.now()};
  },{passive:true});
  document.addEventListener("touchend",e=>{
    if(!touchStart||!e.changedTouches.length)return;
    const x=e.changedTouches[0].clientX-touchStart.x;
    const y=e.changedTouches[0].clientY-touchStart.y;
    if(Math.abs(x)>75&&Math.abs(x)>Math.abs(y)*1.7&&Date.now()-touchStart.when<900){
      if(x>0)history.back();else history.forward();
    }
    touchStart=null;
  },{passive:true});
  document.addEventListener("touchcancel",()=>{touchStart=null},{passive:true});
})();


function dialog(title,text){
  $("#dialogTitle").textContent=title;
  $("#dialogText").textContent=text;
  const d=$("#messageDialog"); if(typeof d.showModal==="function") d.showModal(); else alert(title+"\n\n"+text);
}
$("#dialogClose").addEventListener("click",()=>$("#messageDialog").close());
// Presentation-only iOS/iPadOS install instructions; native installation is user-confirmed.
$("#installHelpBtn").addEventListener("click",()=>{
  const guide=$("#installDialog");
  if(guide&&typeof guide.showModal==="function"){
    if(!guide.open)guide.showModal();
  }else{
    dialog("Install JEPPIRAN","On iPhone or iPad: open this page in Safari, tap Share, select Add to Home Screen, then tap Add.");
  }
});
$("#installGuideClose").addEventListener("click",()=>$("#installDialog").close());
$("#installGuideDone").addEventListener("click",()=>$("#installDialog").close());
$("#installDialog").addEventListener("click",event=>{
  if(event.target===event.currentTarget)event.currentTarget.close();
});
// An installed web app should not continue to advertise installing itself.
const jeppiranStandalone=window.matchMedia&&window.matchMedia("(display-mode: standalone)");
function syncInstallGuideVisibility(){
  document.body.classList.toggle("jeppiran-installed",Boolean((jeppiranStandalone&&jeppiranStandalone.matches)||navigator.standalone===true));
}
if(jeppiranStandalone&&typeof jeppiranStandalone.addEventListener==="function"){
  jeppiranStandalone.addEventListener("change",syncInstallGuideVisibility);
}
syncInstallGuideVisibility();
$("#infoCard").addEventListener("click",()=>dialog("JEPPIRAN "+VERSION,"iPad web/PWA build. Chart PDFs and weather require internet on first load. The app shell remains available offline."));
// Appearance is an explicit Settings choice; switching themes never alters chart inversion
// or any of the four owner-locked ILS Home background images.
function applyAppearanceTheme(mode){
  const theme=mode==="light"?"light":"dark";
  document.documentElement.classList.toggle("light",theme==="light");
  try{localStorage.setItem("theme",theme)}catch(_){}
  document.querySelectorAll('input[name="appearanceTheme"]').forEach(input=>{input.checked=input.value===theme});
  $("#themeBtn").setAttribute("aria-label",theme==="light"?"Switch to Dark Mode":"Switch to Light Mode");
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content",theme==="light"?"#edf6fc":"#07121b");
}
applyAppearanceTheme(localStorage.getItem("theme")==="light"?"light":"dark");
$("#themeBtn").addEventListener("click",()=>applyAppearanceTheme(document.documentElement.classList.contains("light")?"dark":"light"));
document.querySelectorAll('input[name="appearanceTheme"]').forEach(input=>input.addEventListener("change",()=>{
  if(input.checked)applyAppearanceTheme(input.value);
}));
$("#appearanceSettingsCloseBtn").addEventListener("click",()=>$("#appearanceSettingsDialog").close());
$("#appearanceSettingsDialog").addEventListener("click",e=>{if(e.target===e.currentTarget)e.currentTarget.close()});

async function loadLtfmGridGeorefs(m){
  try{
    const res=await fetch("./data/ltfm-grid-georef-v2621.json?v=1",{cache:"no-store"});
    if(!res.ok)throw Error("LTFM grid data HTTP "+res.status);
    const d=await res.json(),required=new Set([1291,1292,1295,1305,1306,1317,1335]);
    if(d.version!==2||d.source?.sha256!==m.source_sha256||
       d.source?.chartDataVersion!==m.version||d.source?.pageCount!==1654||
       d.notForActualNavigation!==true||!Array.isArray(d.charts)||d.charts.length!==7)
      throw Error("LTFM source mismatch");
    const newModels=[];
    for(const item of d.charts){
      const page=Number(item.page),c=charts.find(x=>x.page===page);
      if(!required.delete(page)||!c||c.airport!=="LTFM"||
         item.chartKey!==[c.airport,c.category.toUpperCase(),c.chart_number,c.name.toUpperCase()].join("|")||
         item.validation?.maxAffineFitErrorMeters>=100||
         item.validation?.maxGridIntersectionLeaveOneOutErrorMeters>=100||
         georefByPage.has(page))throw Error("LTFM page/QA mismatch "+page);
      const model=makeGeoModel(item);
      if(!model)throw Error("LTFM mapping invalid "+page);
      newModels.push([page,model]);
    }
    if(required.size)throw Error("Missing LTFM pages");
    for(const [page,model] of newModels)georefByPage.set(page,model);
    console.info("JEPPIRAN: "+newModels.length+" LTFM simulator chart models loaded");
  }catch(e){console.warn("LTFM overlays skipped; previous georefs unchanged",e)}
}
async function loadData(){
  const root=$("#airportProfile");
  if(!charts.length && root)root.innerHTML='<div class="profile-no-selection"><span>✈</span><h2>Loading airport charts…</h2><p>Loading the current airport index.</p></div>';
  try{
    // A slow/failed optional georeference, runway or weather file must NEVER
    // block the terminal chart index or the airport selector.
    const [m,c]=await Promise.all([
      fetch(RAW_ROOT+"charts-manifest.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("manifest HTTP "+r.status);return r.json()}),
      fetch(RAW_ROOT+"charts-current.json",{cache:"no-store"}).then(r=>{if(!r.ok)throw new Error("charts HTTP "+r.status);return r.json()})
    ]);
    const records=Array.isArray(c)?c:(c.charts||[]);
    if(!records.length)throw Error("Empty chart index");
    manifest=m; charts=records;
    renderAirports();
    if(!selectedAirport && charts.some(c=>c.airport==="OIII"))selectAirport("OIII");
    else if(!selectedAirport)selectAirport(charts[0].airport);
    else if(!selectedChart)renderAirportProfile(selectedAirport);
    if($("#homeCycle"))$("#homeCycle").textContent=(m.version||VERSION);
    updateTerminalValidityDisplay();
    refreshPositionStatus();
    $("#updateSubtitle").textContent=(m.version||VERSION)+" data • "+Object.keys(m.airports||{}).length+" airports";

    // Optional data is loaded AFTER the working airport/charts UI is visible.
    // This prevents one large JSON/network request from leaving Charts empty.
    Promise.resolve().then(async()=>{
      try{
        const urls=["chart-georef.json","airport-profiles.json","airport-runways.json",
          "chart-display-names-v2621.json","chart-briefing-titles-v2621.json","enroute-manifest.json"];
        const optional=await Promise.all(urls.map(name=>
          fetch(RAW_ROOT+name,{cache:"no-store"}).then(r=>r.ok?r.json():null).catch(error=>{
            console.warn("Optional airport asset unavailable:",name,error);return null;
          })
        ));
        if(manifest!==m)return;
        const [g,profiles,runways,chartNameData,briefTitleData,enrouteInfo]=optional;
        georefByPage=buildGeorefIndex(g);
        enrouteValidityManifest=enrouteInfo&&enrouteInfo.schema===1?enrouteInfo:null;
        chartDisplayNamesByPage=(chartNameData&&chartNameData.cycle==="2621"&&chartNameData.pages&&
          charts.some(c=>c.airport==="OIKR"&&Number(c.page)===541))
          ?chartNameData.pages:Object.create(null);
        // Apply reviewed V2621 airport briefing labels to the UI only.
        // Check the source chart identity before using any title override.
        if(briefTitleData?.cycle==="2621" && briefTitleData.displayOnly===true && briefTitleData.pages){
          const byPage=new Map(charts.map(c=>[String(Number(c.page)),c]));
          for(const [page,review] of Object.entries(briefTitleData.pages)){
            const c=byPage.get(page);
            if(c?.category==="Airport" && c.name.startsWith("AIRPORT BRIEFING") &&
              c.airport===review.icao && c.chart_number===review.chart_number &&
              typeof review.name==="string" && review.name.trim()){
              chartDisplayNamesByPage[page]=review.name;
            }
          }
        }
        if(selectedChart){
          const label=$("#viewerChart");
          if(label)label.textContent=(selectedChart.chart_number?selectedChart.chart_number+" • ":"")+displayChartName(selectedChart);
          if(jpChartDrawerOpen)refreshFullscreenChartDrawer();
        }
        airportMetadata=profiles&&profiles.airports&&profiles.cycle===m.version?profiles.airports:{};
        airportRunwayMetadata=runways&&runways.airports&&runways.cycle===m.version?runways.airports:{};
        renderAirports($("#airportSearch").value);
        if(selectedAirport&&!selectedChart)renderAirportProfile(selectedAirport);
        if(selectedChart)updateAircraftMarker();
        updateTerminalValidityDisplay();
        for(const [label,task] of [
          ["region",()=>loadIndependentAirportRegionGeorefs(m)],
          ["oick-v2",()=>loadPublishedOickV2Georefs(m)],
          ["adc",()=>enableAdcQaIfRequested(m)],
          ["birjand",()=>enableBirjandAdcQaIfRequested(m)],
          ["doha",()=>enableDohaAdcQaIfRequested(m)],
          ["othh-flight",()=>loadOthhFlightApprovedGeorefs(m)],
          ["othh-extra",()=>loadOthhFlightExtraGeorefs(m)],
          ["ltfm",()=>loadLtfmGridGeorefs(m)],
          ["published",()=>loadPublishedExperimentalGeorefs(m)],
          ["oigg-kobub-flightqa",()=>loadOiggStarsFlightQa(m)],
          ["oiie-missing-sid-ils-flightqa",()=>loadOiiMissingSidIlsFlightQa(m)],
          ["oici-route-flight-qa",()=>loadOiciRouteOnlyFlightQa(m)]
        ]){
          try{await task()}catch(error){console.warn("Optional georeference "+label+" failed",error)}
        }
        if(selectedChart)updateAircraftMarker();
      }catch(error){console.warn("Optional JEPPIRAN chart metadata failed without blocking Charts",error)}
    });
  }catch(error){
    console.error("JEPPIRAN chart index could not load",error);
    $("#updateSubtitle").textContent="Unable to load chart index";
    if(root){
      root.innerHTML='<div class="profile-no-selection" role="alert"><h2>Charts temporarily unavailable</h2><p>Could not load the airport index. Check the connection and retry.</p><button type="button" id="retryChartsLoad" class="profile-chip">RETRY CHARTS</button></div>';
      $("#retryChartsLoad")?.addEventListener("click",()=>loadData());
    }
  }
}
// Android is a fully local APK with its own signed native update manager.
// Never mistake the current bundled AIRAC cycle for the APK version.
let publishedChartChanges=null;
const updateBtn=$("#updateCard");
const isAndroidLocal=()=>!!document.querySelector('meta[name="jeppiran-runtime"][content="android-local-apk"]');
updateBtn.addEventListener("click",()=>{
  route("update");
  $("#updateNativeBtn").hidden=!isAndroidLocal();
  $("#updateRefreshBtn").hidden=isAndroidLocal();
  $("#updateCheckBtn").textContent=isAndroidLocal()?"CHECK ANDROID UPDATES":"CHECK LATEST DATA";
  updateText("updateAppStatus",isAndroidLocal()
    ?"This APK opens independently of the website. Use the signed Android updater to install a new app/chart package."
    :"The web version is served independently from GitHub Pages.");
  refreshWebUpdates();
});
function updateText(id,text){const node=document.getElementById(id);if(node)node.textContent=text}
async function refreshWebUpdates(){
  const installed=manifest?.version||"Unknown";
  updateText("updateCycleStatus","Installed web charts: "+installed+". Checking current published data…");
  updateText("updateCycleDates","Terminal validity comes from the published cycle.");
  updateText("updateChangesStatus","Loading published chart changes…");
  try{
    const native=isAndroidLocal();
    const [mResponse,changesResponse,enrouteResponse]=await Promise.all([
      native?Promise.resolve(null):fetch("./data/charts-manifest.json?check="+Date.now(),{cache:"no-store"}),
      fetch("./data/chart-changes.json?check="+Date.now(),{cache:native?"default":"no-store"}),
      fetch("./data/enroute-manifest.json?check="+Date.now(),{cache:native?"default":"no-store"})
    ]);
    if(!native&&!mResponse.ok)throw Error("Latest chart manifest HTTP "+mResponse.status);
    const latest=native?manifest:await mResponse.json();
    if(!latest)throw Error("Installed chart index unavailable");
    const current=latest.version||latest.cycle||"Unknown";
    const equal=current===installed;
    updateText("updateCycleStatus",native
      ?"Installed locally: "+installed+" · All airport PDF files are bundled in the APK. Check Android updates for a newer chart cycle."
      :"Installed web charts: "+installed+" · Published: "+current+
        (equal?" · UP TO DATE":" · A NEW CYCLE IS AVAILABLE"));
    updateText("updateCycleDates",
      latest.effective_from&&latest.effective_to
      ?"Validity: "+latest.effective_from+" → "+latest.effective_to
      :"Cycle date range is not provided in the source manifest. Check the validity indicator above.");
    if(enrouteResponse.ok){
      const enroute=await enrouteResponse.json();
      updateText("updateEnrouteStatus",enroute.published&&enroute.files?.length
        ?"Published Enroute cycle "+enroute.cycle+" · "+enroute.files.length+" files"
        :"Enroute data package is not yet published; no update is available.");
    }else updateText("updateEnrouteStatus","Unable to verify Enroute data.");
    if(changesResponse.ok){
      publishedChartChanges=await changesResponse.json();
      const airports=publishedChartChanges.airports||{};
      const codes=Object.keys(airports).sort();
      updateText("updateChangesStatus",codes.length+" airports in the published "+(publishedChartChanges.chartDataVersion||current)+" change record.");
      const select=$("#updateAirportSelect");
      select.innerHTML='<option value="">Select an airport</option>';
      for(const icao of codes){
        const option=document.createElement("option");
        option.value=icao;option.textContent=icao+" · "+((AIRPORTS[icao]||[])[0]||icao);
        select.appendChild(option);
      }
      select.value=codes.includes(selectedAirport)?selectedAirport:(codes[0]||"");
      renderUpdateAirportChanges();
    }else{
      updateText("updateChangesStatus","Published per-airport changes are unavailable.");
      $("#updateAirportDetails").replaceChildren();
    }
  }catch(e){
    updateText("updateCycleStatus","Unable to check for new charts. The installed cycle "+installed+" is unchanged.");
    updateText("updateCycleDates",e.message||"Network unavailable");
    updateText("updateChangesStatus","Cannot check published changes while offline. Local charts remain available.");
  }
}
function renderUpdateAirportChanges(){
  const icao=$("#updateAirportSelect").value;
  const root=$("#updateAirportDetails");root.replaceChildren();
  const rows=publishedChartChanges?.airports?.[icao]?.summary||[];
  if(!rows.length){root.textContent="No published change entries for this airport.";return}
  const head=document.createElement("div");head.className="jp-update-changes-head";
  head.textContent=icao+" · "+rows.length+" published entries";
  root.appendChild(head);
  for(const row of rows){
    const item=document.createElement("div");item.className="jp-update-change";
    const kind=document.createElement("b");kind.textContent=row.action||"CHANGE";
    const text=document.createElement("span");
    text.textContent=(row.index?row.index+" · ":"")+(row.procedure||"Unnamed chart");
    item.append(kind,text);root.appendChild(item);
  }
}
$("#updateAirportSelect").addEventListener("change",renderUpdateAirportChanges);
$("#updateNativeBtn").addEventListener("click",()=>{window.location.href="jeppiran://updates"});
$("#updateCheckBtn").addEventListener("click",()=>{if(isAndroidLocal())window.location.href="jeppiran://updates";else refreshWebUpdates()});
$("#updateRefreshBtn").addEventListener("click",async()=>{
  updateText("updateAppStatus","Checking web app files…");
  try{await navigator.serviceWorker?.getRegistration()?.then(r=>r?.update())}catch(_){}
  // Explicit user-triggered refresh only (never a forced mid-chart reload).
  const next=new URL(location.href);next.searchParams.set('app-check',String(Date.now()));next.hash='#update';
  window.location.assign(next.href);
});
// Compact airport picker for phones: one full-height scrollable profile,
// not a 24dvh picker permanently stacked on top of the chart.
const airportPickerBtn=$("#airportPickerBtn");
function closeAirportPicker(){
  $("#chartsView").classList.remove("jp-airport-picker-open");
  airportPickerBtn.setAttribute("aria-expanded","false");
  const tag=$("#airportPickerIcao");
  if(tag)tag.textContent=selectedAirport||"";
}
$("#airportPickerCloseBtn").addEventListener("click",closeAirportPicker);
airportPickerBtn.addEventListener("click",()=>{
  const open=$("#chartsView").classList.toggle("jp-airport-picker-open");
  airportPickerBtn.setAttribute("aria-expanded",String(open));
  if(open)$("#airportSearch").focus();
});



/* Approved JeppIran airport profile — display-only; live data is never faked. */
const AIRPORT_PROFILE={
  OIII:{iata:"THR",elevation:3962,lat:35.68917,lon:51.31439,runways:[],freqs:[]},
  OIIE:{iata:"IKA"},OIMM:{iata:"MHD"},OISS:{iata:"SYZ"},OIFM:{iata:"IFN"},
  OIKB:{iata:"BND"},OITT:{iata:"TBZ"},OIAW:{iata:"AWZ"},OIBK:{iata:"KIH"}
};
let airportFilterMode="all", profileTab="Overview", profileMetarRequest=0;
const AIRPORT_FAV_KEY="jeppiran-airport-favorites";
function getAirportFavorites(){return readJsonStorage(AIRPORT_FAV_KEY,[])||[]}
function setAirportFavorite(icao){const s=new Set(getAirportFavorites());s.has(icao)?s.delete(icao):s.add(icao);localStorage.setItem(AIRPORT_FAV_KEY,JSON.stringify([...s]));renderAirports($("#airportSearch").value);}
function profileEsc(v){return escapeHtml(String(v===undefined||v===null?"—":v))}
/* Display-only airport clock: ICAO/state-specific IANA zones with DST handled by Intl.
   If the ICAO is outside these verified regions, show unavailable (never device local). */
function airportLocalZone(icao){
  const code=String(icao||"").toUpperCase();
  if(code==="OOMS")return "Asia/Muscat";
  if(code.startsWith("OI"))return "Asia/Tehran";
  if(code.startsWith("LT"))return "Europe/Istanbul";
  if(code.startsWith("OM"))return "Asia/Dubai";
  if(code.startsWith("OO"))return "Asia/Muscat";
  if(code.startsWith("OP"))return "Asia/Karachi";
  if(code.startsWith("OR"))return "Asia/Baghdad";
  if(code.startsWith("OT"))return "Asia/Qatar";
  if(code.startsWith("UD"))return "Asia/Yerevan";
  if(code.startsWith("UG"))return "Asia/Tbilisi";
  return null;
}
function airportClockTime(now,icao){
  const zone=airportLocalZone(icao);
  if(!zone)return "Time zone unavailable";
  try{
    const fmt=new Intl.DateTimeFormat("en-GB",{
      timeZone:zone,hour:"2-digit",minute:"2-digit",second:"2-digit",
      hourCycle:"h23",timeZoneName:"shortOffset"
    });
    const parts=fmt.formatToParts(now);
    const time=["hour","minute","second"].map(type=>parts.find(p=>p.type===type)?.value||"--").join(":");
    const offset=(parts.find(p=>p.type==="timeZoneName")?.value||"").replace(/^GMT/,"UTC");
    return time+(offset?" "+offset:" ("+zone+")");
  }catch(_){return "Time zone unavailable";}
}
/* Terminal cycle schedule is Jeppesen Digital Terminal Charts' 2026
   bi-weekly ISSUE calendar, not an effective/expiry date for every chart.
   Cycle 2621: 09 Oct 2026; 2622: 23 Oct 2026. 2027+ requires new calendar. */
function terminalRevisionWindow(source){
  const cycle=String(source?.cycle||source?.version||"").replace(/^V/i,"");
  if(!/^26(0[1-9]|1\d|2[0-6])$/.test(cycle))return null;
  const ordinal=Number(cycle.slice(2));
  const start=Date.UTC(2026,0,2)+(ordinal-1)*14*86400000;
  return {cycle,from:new Date(start),until:new Date(start+14*86400000)};
}
function parseUtcCycleDate(value){
  if(typeof value!=="string"||!(/^\d{4}-\d{2}-\d{2}$/.test(value)))return null;
  const date=new Date(value+"T00:00:00Z");
  return Number.isFinite(date.getTime())&&date.toISOString().slice(0,10)===value?date:null;
}
function utcCycleDate(date){
  return date.toLocaleDateString("en-GB",{timeZone:"UTC",day:"2-digit",month:"short",year:"numeric"});
}
/* Compact terminal currency indicator used by Home and each airport header.
   A chart cycle issue date is not a substitute for an individual chart's effective date. */
function terminalValidityIndicator(){
  const cycle=terminalRevisionWindow(manifest);
  if(!cycle){
    const heading='<b class="terminal-validity-label">TERMINAL CHARTS</b>'+
      '<strong class="terminal-validity-status">DATES UNAVAILABLE</strong>';
    const note='<small class="terminal-validity-note">Verify the installed chart cycle</small>';
    return {state:"unknown",markup:heading+note,
      profileMarkup:heading+'<div class="terminal-validity-dates"><span class="terminal-date-start">VALID FROM <b>UNAVAILABLE</b></span><span class="terminal-date-end">VALID TO <b>UNAVAILABLE</b></span></div>'+note};
  }
  const now=Date.now();
  const expired=now>=cycle.until.getTime();
  const pending=now<cycle.from.getTime();
  const state=expired?"expired":pending?"unknown":"current";
  const label=expired?"UPDATE OVERDUE":pending?"NOT YET EFFECTIVE":"CYCLE CURRENT";
  const note=expired?"New cycle due "+utcCycleDate(cycle.until)+" — update charts":
    pending?"Scheduled issue "+utcCycleDate(cycle.from):
    "Next issue "+utcCycleDate(cycle.until);
  // Show the inclusive calendar-day range in airport profiles only.
  // The next cycle is issued at 00:00 UTC on cycle.until (end exclusive).
  const lastDay=new Date(cycle.until.getTime()-86400000);
  const period='<div class="terminal-validity-dates">'+
    '<span class="terminal-date-start">VALID FROM <b>'+profileEsc(utcCycleDate(cycle.from))+'</b></span>'+
    '<span class="terminal-date-end">VALID TO <b>'+profileEsc(utcCycleDate(lastDay))+'</b></span>'+
    '</div>';
  const heading='<b class="terminal-validity-label">TERMINAL CHARTS</b>'+
    '<strong class="terminal-validity-status">'+label+'</strong>';
  const noteMarkup='<small class="terminal-validity-note">'+profileEsc(note)+'</small>';
  return {
    state,
    markup:heading+noteMarkup,
    profileMarkup:heading+period+noteMarkup
  };
}
function updateTerminalValidityDisplay(){
  const status=terminalValidityIndicator();
  for(const id of ["homeTerminalValidity","profileTerminalValidity"]){
    const el=document.getElementById(id);
    if(!el)continue;
    if(el.dataset.state!==status.state)el.dataset.state=status.state;
    const content=id==="profileTerminalValidity"?status.profileMarkup:status.markup;
    if(el.innerHTML!==content)el.innerHTML=content;
  }
}
function profileValidityMarkup(){
  const now=Date.now(),term=terminalRevisionWindow(manifest);
  const tExpired=!!term&&now>=term.until.getTime();
  const termState=term?(tExpired?"expired":"current"):"unknown";
  const termStatus=term?(tExpired?"UPDATE OVERDUE":"CYCLE CURRENT"):"DATES UNAVAILABLE";
  const termDates=term?"Issued "+utcCycleDate(term.from)+" · Next issue "+utcCycleDate(term.until):"No verified issue schedule for this cycle";
  const termWarning=tExpired?
    '<div class="profile-validity-warning" role="alert">New terminal chart cycle due since '+profileEsc(utcCycleDate(term.until))+'. Update charts and verify individual effective dates.</div>':
    '<small class="profile-validity-footnote">Cycle issue schedule; individual chart effective dates may differ.</small>';
  const e=enrouteValidityManifest;
  const eFrom=parseUtcCycleDate(e?.effective_from),eUntil=parseUtcCycleDate(e?.effective_to);
  const filesReady=!!(e?.published&&Array.isArray(e.files)&&e.files.length);
  const enrouteExpired=!!eUntil&&now>=eUntil.getTime();
  const enrouteState=enrouteExpired?"expired":filesReady&&eUntil?"current":"unknown";
  const enrouteStatus=enrouteExpired?"UPDATE OVERDUE":filesReady&&eUntil?"CYCLE CURRENT":"NOT VERIFIED";
  const enrouteDates=eFrom&&eUntil?
    utcCycleDate(eFrom)+" – "+utcCycleDate(eUntil)+" (end exclusive)":
    "No verified Enroute cycle dates";
  const enrouteWarning=enrouteExpired?
    '<div class="profile-validity-warning" role="alert">Enroute cycle window ended '+profileEsc(utcCycleDate(eUntil))+'. '+(filesReady?'Check for a newer chart revision.':'No published Enroute chart package is installed.')+'</div>':
    !filesReady?'<small class="profile-validity-footnote">Enroute charts not published/installed; currency cannot be confirmed.</small>':
    '<small class="profile-validity-footnote">Per-chart revisions must be checked against the Jeppesen Enroute currency list.</small>';
  return '<div class="profile-validity-entry" data-validity="terminal" data-state="'+termState+'">'+
      '<div class="profile-validity-heading"><strong>TERMINAL CHARTS · '+profileEsc(term?.cycle||manifest?.cycle||"—")+'</strong><span class="profile-validity-state">'+termStatus+'</span></div>'+
      '<div class="profile-validity-dates">'+profileEsc(termDates)+'</div>'+termWarning+'</div>'+
    '<div class="profile-validity-entry" data-validity="enroute" data-state="'+enrouteState+'">'+
      '<div class="profile-validity-heading"><strong>ENROUTE · '+profileEsc(e?.cycle||"—")+'</strong><span class="profile-validity-state">'+enrouteStatus+'</span></div>'+
      '<div class="profile-validity-dates">'+profileEsc(enrouteDates)+'</div>'+enrouteWarning+'</div>';
}
let lastValidityCheckMinute=-1;
function utcDisplay(){
  const now=new Date();
  const brief=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",timeZone:"UTC",hourCycle:"h23"}).format(now);
  const full=new Intl.DateTimeFormat("en-GB",{hour:"2-digit",minute:"2-digit",second:"2-digit",timeZone:"UTC",hourCycle:"h23"}).format(now);
  const el=$("#homeUtc");if(el)el.textContent=brief+"Z UTC";
  document.querySelectorAll(".profile-utc").forEach(e=>e.textContent=brief+"Z");
  const headerClock=$("#profileUtcClock");if(headerClock)headerClock.textContent=full+" UTC";
  const airportClock=$("#profileLocalTime");if(airportClock)airportClock.textContent=airportClockTime(now,selectedAirport);
  const minute=Math.floor(now.getTime()/60000);
  if(minute!==lastValidityCheckMinute){
    lastValidityCheckMinute=minute;
    updateTerminalValidityDisplay();
  }
}
utcDisplay();setInterval(utcDisplay,1000);
if($("#enrouteHomeBtn"))$("#enrouteHomeBtn").addEventListener("click",()=>dialog("Enroute","The Enroute tile viewer is not included in this web build yet. Existing Android Enroute data is unchanged."));
if($("#settingsHomeBtn"))$("#settingsHomeBtn").addEventListener("click",()=>{
  const settings=$("#appearanceSettingsDialog");
  document.querySelectorAll('input[name="appearanceTheme"]').forEach(input=>{input.checked=input.value===(document.documentElement.classList.contains("light")?"light":"dark")});
  if(settings?.showModal)settings.showModal();
  else dialog("Settings","Use the theme button in the top bar to switch Light Mode / Dark Mode.");
});
$$("[data-airport-filter]").forEach(b=>b.addEventListener("click",()=>{
  airportFilterMode=b.dataset.airportFilter;
  $$("[data-airport-filter]").forEach(x=>x.classList.toggle("active",x===b));
  renderAirports($("#airportSearch").value);
}));
function renderAirports(filter=""){
  const list=$("#airportList");if(!list)return;
  const oldScroll=list.scrollTop;list.innerHTML="";
  const q=filter.trim().toUpperCase();
  const fav=new Set(getAirportFavorites());
  [...new Set(charts.map(c=>c.airport))].sort().filter(icao=>{
    const record=airportMetadata[icao]||{};const legacy=AIRPORTS[icao]||["",""];
    const meta=[record.name||legacy[0]||"",record.city||legacy[1]||""];
    return (!q||(icao+" "+meta.join(" ")).toUpperCase().includes(q))&&(airportFilterMode!=="favorites"||fav.has(icao));
  }).forEach(icao=>{
    const record=airportMetadata[icao]||{};const legacy=AIRPORTS[icao]||["",""];
    const meta=[record.name||legacy[0]||"AIRPORT",record.city||legacy[1]||""];
    const branch=document.createElement("div");
    branch.className="airport-branch"+(icao===selectedAirport?" selected":"");
    const b=document.createElement("button");b.type="button";
    b.className="airport-item"+(icao===selectedAirport?" selected":"");
    const isOpen=icao===selectedAirport&&airportTreeExpanded;
    b.setAttribute("aria-expanded",isOpen?"true":"false");
    b.innerHTML="<span class='airport-copy'><b>"+profileEsc(icao)+"</b><small>"+profileEsc(meta[0])+"</small><small>"+profileEsc(meta[1])+"</small></span><span class='airport-chevron'>"+(isOpen?"▾":"›")+"</span>";
    b.onclick=()=>{if(icao===selectedAirport){airportTreeExpanded=!airportTreeExpanded;expanded.clear();renderAirports($("#airportSearch").value);if(!selectedChart){renderAirportProfile(icao)}}else selectAirport(icao)};
    branch.appendChild(b);
    if(isOpen){const tree=document.createElement("div");tree.className="airport-inline-tree";renderTreeInto(tree);branch.appendChild(tree)}
    list.appendChild(branch);
  });
  requestAnimationFrame(()=>{list.scrollTop=oldScroll});
}
$("#airportSearch").addEventListener("input",e=>renderAirports(e.target.value));
function selectAirport(icao){
  selectedAirport=icao;selectedChart=null;airportTreeExpanded=true;profileTab="Overview";
  closeAirportPicker();
  window.jeppiranSelectedRunway=icao==="OIAA"?"32L":"";
  expanded=new Set();
  $("#chartsView").classList.remove("chart-open");
  renderAirports($("#airportSearch").value);
  $("#viewerAirport").textContent=icao+" • "+((AIRPORTS[icao]||[])[0]||"AIRPORT");
  $("#viewerChart").textContent="Select a chart";
  $("#pdfStage").innerHTML='<div class="empty-state"><b>Select a procedure</b></div>';
  $("#offlinePdfBtn").disabled=true;currentPdfUrl="";hideChartMetar();
  renderAirportProfile(icao);
  refreshProfileMetar(icao);
  refreshProfileTaf(icao);
}
function renderTreeInto(root){
  root.innerHTML="";if(!selectedAirport)return;
  const airportCharts=charts.filter(c=>c.airport===selectedAirport).sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
  ["STAR","SID","Airport","Approach"].forEach(cat=>{
    const items=airportCharts.filter(c=>(c.category||"Other")===cat);
    if(!items.length)return;
    const wrap=document.createElement("div");wrap.className="tree-group inline-tree-group";
    const h=document.createElement("button");h.type="button";h.className="tree-group-head";
    const catLabel=cat==="Airport"?"AIRPORT":cat==="Approach"?"APP":cat.toUpperCase();
    const groupOpen=expanded.has(cat);
    h.setAttribute("aria-expanded",groupOpen?"true":"false");h.textContent=(groupOpen?"▾ ":"▸ ")+catLabel+" ("+items.length+")";
    h.onclick=e=>{e.stopPropagation();expanded.has(cat)?expanded.delete(cat):expanded.add(cat);renderAirports($("#airportSearch").value)};
    wrap.appendChild(h);
    if(groupOpen)items.forEach(c=>{
      const item=document.createElement("button");item.type="button";
      item.className="tree-item"+(selectedChart&&Number(selectedChart.page)===Number(c.page)?" selected":"");
      item.innerHTML=profileEsc(c.chart_number?c.chart_number+" • "+displayChartName(c):displayChartName(c));
      item.onclick=e=>{e.stopPropagation();selectChart(c)};
      wrap.appendChild(item)
    });
    root.appendChild(wrap)
  });
}
function metarInfo(raw){
  const tokens=(raw||"").trim().toUpperCase().split(/\s+/);
  const txt=tokens.join(" ");
  const wind=txt.match(/\b(\d{3}|VRB)(\d{2,3})(?:G\d{2,3})?KT\b/);
  const temp=txt.match(/\b(M?\d{2})\/(M?\d{2})\b/);
  const clouds=tokens.filter(x=>/^(FEW|SCT|BKN|OVC)\d{3}(CB|TCU)?$/.test(x));
  const wx=tokens.filter(x=>/^(?:[-+]|VC)?(?:TS|SH|FZ|DZ|RA|SN|SG|PL|GR|GS|BR|FG|HZ|DU|SA|FU|SQ)+$/.test(x));
  let desc="Clear",icon="☀";
  if(wx.some(x=>x.includes("TS"))){desc="Thunderstorm";icon="⛈"}
  else if(wx.some(x=>x.includes("SN"))){desc="Snow";icon="❄"}
  else if(wx.some(x=>x.includes("RA")||x.includes("DZ"))){desc="Rain";icon="🌧"}
  else if(wx.some(x=>/FG|BR|HZ|DU|SA|FU/.test(x))){desc="Reduced visibility";icon="🌫"}
  else if(clouds.some(x=>x.startsWith("BKN")||x.startsWith("OVC"))){desc="Cloudy";icon="☁"}
  else if(clouds.length){desc="Partly cloudy";icon="🌤"}
  const tempVal=temp?(temp[1][0]==="M"?"-":"")+temp[1].replace("M","")+"°C":"—";
  const vis=txt.includes(" 9999")?"> 10 km":(txt.match(/\b\d{4}\b/)?"See METAR":"—");
  return {windDirection:wind&&wind[1]!=="VRB"?Number(wind[1]):null,windSpeed:wind?Number(wind[2]):null,
    temp:tempVal,icon,desc,clouds:clouds.join(", ")||"No reported cloud layers",visibility:vis};
}
function windComponents(raw,rwy){
  if(!rwy||!Number.isFinite(rwy.headingAdc))return null;
  const info=metarInfo(raw);
  if(info.windDirection===null||info.windSpeed===null||info.windSpeed<3)return null;
  const angle=(info.windDirection-rwy.headingAdc)*Math.PI/180;
  const head=info.windSpeed*Math.cos(angle),cross=info.windSpeed*Math.sin(angle);
  return {head:Math.abs(head).toFixed(1),headRaw:head,headName:head>=0?"Headwind":"Tailwind",cross:Math.abs(cross).toFixed(1),crossName:cross>=0?"From right":"From left",
    direction:info.windDirection,speed:info.windSpeed}
}
function profileCurrentRunway(icao){
  const defaultRunways=(AIRPORT_PROFILE[icao]||{}).runways||[];
  const runways=(airportRunwayMetadata[icao]&&airportRunwayMetadata[icao].length)
    ?airportRunwayMetadata[icao]:[];
  const desired=window.jeppiranSelectedRunway||(icao==="OIAA"?"32L":"");
  return runways.find(x=>x.name===desired)||runways[0]||null;
}
// Rotate the runway by its printed ADC heading and the wind arrow by its raw METAR direction.
function runwayCompassMarkup(rw, weather){
  const heading=rw&&Number.isFinite(rw.headingAdc)?((rw.headingAdc%360)+360)%360:null;
  if(heading===null)return '<div class="runway-bearing-unavailable">ADC runway-end heading unavailable — no heading guessed</div>';
  const runwayName=profileEsc(rw.name||"RWY");
  // Draw the inward-facing wind arrow using the direction printed in the METAR, without conversion.
  const from=weather&&Number.isFinite(weather.windDirection)&&Number.isFinite(weather.windSpeed)&&weather.windSpeed>=3
    ?((weather.windDirection%360)+360)%360:null;
  const arrow=from===null?'':'<g class="wind-direction-arrow" transform="rotate('+from+' 160 108)">'+
    '<path d="M160 12V55" stroke="#ffd26a" stroke-width="5" stroke-linecap="round"/>'+
    '<path d="M150 44L160 59L170 44" fill="none" stroke="#ffd26a" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/>'+
    '</g>';
  const windLabel=from!==null?'Wind FROM '+Math.round(from)+'° METAR · '+weather.windSpeed+' kt':
    weather&&weather.windSpeed<3?'Light/calm wind — no arrow':'Wind direction unavailable / VRB';
  return '<div class="runway-bearing-compass" role="img" aria-label="Runway '+runwayName+' ADC chart heading '+Math.round(heading)+' degrees clockwise from north; '+profileEsc(windLabel)+'">'+
    '<svg viewBox="0 0 320 214" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">'+
      '<circle cx="160" cy="108" r="82" fill="none" stroke="#286490" stroke-width="1.5"/>'+
      '<path d="M160 20V37M160 180V196M72 108H89M231 108H248" stroke="#3d9acf" stroke-width="2"/>'+
      '<text x="160" y="16" text-anchor="middle" fill="#8edbff" font-size="16" font-weight="700">N</text>'+
      '<g transform="rotate('+heading+' 160 108)">'+
        '<rect x="145" y="53" width="30" height="110" rx="2" fill="#102943" stroke="#c9eafa" stroke-width="2.5"/>'+
        '<path d="M160 62V154" stroke="#c9eafa" stroke-width="2" stroke-dasharray="10 8"/>'+
        '<path d="M160 33 L147 51 L173 51 Z" fill="#35c8ff"/>'+
      '</g>'+
      arrow+
      '<circle cx="160" cy="108" r="2.5" fill="#eefaff"/>'+
    '</svg>'+
    '<strong>RWY '+runwayName+' HDG · '+Math.round(heading)+'°</strong>'+


    '</div>';
}
function renderAirportProfile(icao){
  const root=$("#airportProfile");if(!root||icao!==selectedAirport)return;
  const community=airportMetadata[icao]||{};
  const d={...(AIRPORT_PROFILE[icao]||{}),...community};
  if(airportRunwayMetadata[icao]&&airportRunwayMetadata[icao].length)d.runways=airportRunwayMetadata[icao];
  const legacy=AIRPORTS[icao]||["",""];
  const meta=[community.name||legacy[0]||"Airport data unavailable",community.city||legacy[1]||""];
  const raw=wxCache[icao+":metar"]||"";
  const taf=wxCache[icao+":taf"]||"";
  const wx=metarInfo(raw);const rw=profileCurrentRunway(icao),comp=windComponents(raw,rw);
  const formattedCoord=Number.isFinite(d.lat)?d.lat.toFixed(4)+"° N &nbsp; "+d.lon.toFixed(4)+"° E":"Data not available";
  const fav=new Set(getAirportFavorites());
  const categories=[["STAR","STAR"],["SID","SID"],["Airport","AIRPORT"],["Approach","APP"]];
  const nameBase=(meta[0]||"Airport").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
  const name=community.name||(/airport$/i.test(nameBase)?nameBase:nameBase+" Airport");
  const country=community.country|| (icao.startsWith("OI")?"Iran":icao.startsWith("LT")?"Türkiye":icao.startsWith("OM")?"United Arab Emirates":icao.startsWith("OO")?"Oman":icao.startsWith("OR")?"Iraq":icao.startsWith("UD")?"Armenia":icao.startsWith("UG")?"Georgia":"");
  const cityName=(meta[1]||"").toLowerCase().replace(/\b\w/g,m=>m.toUpperCase());
  // Procedure titles and categories belong to the selected airport tree in
  // the left airport pane (mobile: translucent AIRPORTS drawer), not here.
  const runwayRows=d.runways&&d.runways.length?d.runways.map(x=>{
    const adcHeading=Number.isFinite(x.headingAdc)?Math.round(x.headingAdc)+"°":"—";
    const magHeading=Number.isFinite(x.headingMag)?x.headingMag.toFixed(1)+"°":"—";
    const metric=Number.isFinite(x.length)&&Number.isFinite(x.width)?x.length.toLocaleString()+" × "+x.width+" m":"—";
    const imperial=Number.isFinite(x.lengthFt)&&Number.isFinite(x.widthFt)?x.lengthFt.toLocaleString()+" × "+x.widthFt+" ft":"—";
    const surface=x.surface||"Surface unknown";
    return '<button type="button" class="rwy-row'+(rw===x?' active':'')+'" data-runway="'+profileEsc(x.name)+'">'+
      '<span><b>RWY '+profileEsc(x.name)+'</b><small>'+(x.opposite?"Opposite "+profileEsc(x.opposite):"Direction selected")+'</small></span>'+
      '<span><b>'+metric+'</b><small>'+imperial+'</small></span>'+
      '<span><b>'+profileEsc(surface)+'</b><small>ADC '+adcHeading+'</small></span></button>';
    }).join(""):'<div class="profile-empty">Runway data unavailable; consult current ADC/AIP.</div>';
  root.innerHTML='<div class="profile-shell">'+
    '<div class="profile-heading"><div><div class="profile-code-row"><strong class="profile-icao">'+profileEsc(icao)+'</strong><span class="profile-chip">'+profileEsc(d.iata||"—")+'</span><button type="button" class="profile-chip" id="profileFavBtn" aria-label="Favorite airport">'+(fav.has(icao)?"★":"☆")+'</button></div><h2>'+profileEsc(name)+'</h2><p>'+profileEsc(meta[1])+(meta[1]&&country?', ':'')+profileEsc(country)+'<span class="profile-elev-inline">Elevation '+(Number.isFinite(d.elevation)?d.elevation.toLocaleString()+' ft':'—')+'</span></p></div><div class="profile-elev"><strong id="profileUtcClock" class="profile-utc-clock" aria-live="off">--:--:-- UTC</strong><small class="profile-coordinates">⌖ '+formattedCoord+'</small><small id="profileLocalTime" class="profile-local-clock" aria-live="off">--:--:--</small><div id="profileTerminalValidity" class="terminal-validity profile-terminal-validity" data-state="unknown" role="status" aria-live="polite">'+terminalValidityIndicator().profileMarkup+'</div></div></div>'+
    '<div class="profile-cols">'+
      '<section class="profile-card" id="profileWeather"><header><span>METAR • '+profileEsc(icao)+'</span><small id="profileMetarAge">'+(raw?"Last received / cached":"Loading live METAR…")+'</small></header>'+
        '<span class="metar-raw" id="profileMetarRaw">'+profileEsc(raw||"Waiting for actual METAR…")+'</span>'+
        '<div class="weather-summary"><div class="weather-brief"><span class="weather-icon">'+wx.icon+'</span><div><strong>'+profileEsc(raw?wx.temp:"—")+'</strong><small>'+profileEsc(raw?wx.desc:"Weather unavailable")+'</small><small>'+profileEsc(raw?wx.clouds:"")+'</small></div></div>'+
        '<div class="weather-facts"><span>◉ '+profileEsc(wx.visibility)+'</span><span>➤ '+(wx.windDirection===null?"—":wx.windDirection.toString().padStart(3,"0")+"°")+' / '+(wx.windSpeed===null?"—":wx.windSpeed+" kt")+'</span><span>UTC <span class="profile-utc"></span></span></div></div></section>'+
      '<section class="profile-card" id="profileWind"><header><span>WIND COMPONENTS '+(rw?"("+profileEsc(rw.name)+")":"")+'</span></header>'+
      '<div class="wind-compact"><div class="wind-compass">'+runwayCompassMarkup(rw,wx)+'</div>'+
      '<div class="wind-data"><div><span>Runway HDG (ADC)</span><b>'+(rw?(Number.isFinite(rw.headingAdc)?Math.round(rw.headingAdc)+"°":"—"):"—")+'</b></div><div><span>METAR wind direction</span><b>'+(comp?comp.direction+"° / "+comp.speed+" kt":"—")+'</b></div><div><span class="'+(comp?(comp.headRaw>=0?"wind-status-head":Number(comp.head)>=3&&Number(comp.head)<=5?"wind-status-tail-warning":Number(comp.head)>5?"wind-status-tail-danger":"wind-status-neutral"):"wind-status-neutral")+'">↑ '+(comp?comp.headName:"Headwind")+'</span><b class="'+(comp?(comp.headRaw>=0?"wind-status-head":Number(comp.head)>=3&&Number(comp.head)<=5?"wind-status-tail-warning":Number(comp.head)>5?"wind-status-tail-danger":"wind-status-neutral"):"wind-status-neutral")+'">'+(comp?comp.head+" kt":"—")+'</b></div><div><span class="wind-cross">→ Crosswind</span><b class="wind-cross">'+(comp?comp.cross+" kt "+comp.crossName:"—")+'</b></div></div></div></section>'+
      '<section class="profile-card" id="profileRunways"><header><span>RUNWAYS</span><small>V2621 ADC runway-end numbers only</small></header>'+runwayRows+'</section>'+
      '<section class="profile-card" id="profileNotam"><header><span>NOTAM • '+profileEsc(icao)+'</span></header><details class="profile-notam-details"><summary>NOTAM status & details</summary><p>No validated NOTAM feed is connected. Current NOTAM status unknown. Check an authorized AIS/NOF source before flight.</p></details></section>'+
      '<section class="profile-card" id="profileTaf"><header><span>TAF • '+profileEsc(icao)+'</span><small>Forecast / last available</small></header><div class="profile-weather-text">'+profileEsc(taf||"TAF unavailable — request pending")+'</div></section>'+
    '</div></div>';
  updateTerminalValidityDisplay();
  root.querySelector("#profileFavBtn").onclick=()=>{setAirportFavorite(icao);renderAirportProfile(icao)};
  root.querySelectorAll("[data-runway]").forEach(b=>b.onclick=()=>{window.jeppiranSelectedRunway=b.dataset.runway;renderAirportProfile(icao)});
  utcDisplay();
}
async function refreshProfileMetar(icao){
  const token=++profileMetarRequest;
  try{
    const raw=await fetchWx("metar",icao);
    if(token!==profileMetarRequest||icao!==selectedAirport||selectedChart)return;
    wxCache[icao+":metar"]=raw;
    wxCache[icao+":time"]=Date.now();
    localStorage.setItem("wxCache",JSON.stringify(wxCache));
    renderAirportProfile(icao);
    const age=$("#profileMetarAge");if(age)age.textContent="METAR received • verify observation time";
  }catch(_){
    if(token!==profileMetarRequest||icao!==selectedAirport)return;
    const age=$("#profileMetarAge");if(age)age.textContent=wxCache[icao+":metar"]?"Cached METAR • not current":"METAR unavailable";
  }
}
async function refreshProfileTaf(icao){try{const raw=await fetchWx("taf",icao);if(icao!==selectedAirport||selectedChart)return;wxCache[icao+":taf"]=raw;localStorage.setItem("wxCache",JSON.stringify(wxCache));renderAirportProfile(icao)}catch(_){/* Keep last cached TAF. */}}
function geoNum(v){const n=Number(v);return Number.isFinite(n)?n:NaN}
function geoBoundsContains(b,x,y,t=0){
  return !!b&&Number.isFinite(x)&&Number.isFinite(y)&&
    x>=b.left-t&&x<=b.right+t&&y>=b.top-t&&y<=b.bottom+t;
}
function makeGeoModel(item){
  if(!item||!Number.isInteger(Number(item.page)))return null;
  const allowed=new Set(["paired_printed_graticule_vector_ticks","single_axis_plus_conformal_scale","aip_and_printed_grid_10m_test_only","two_vector_landmarks_simulator_qa","two_navaid_source_grid_flight_qa","crossplate_ika_grid_flight_qa"]);
  if(!allowed.has(item.validation&&item.validation.method))return null;
  const width=geoNum(item.width),height=geoNum(item.height),b=item.bounds||{};
  const bounds={left:geoNum(b.left),top:geoNum(b.top),right:geoNum(b.right),bottom:geoNum(b.bottom)};
  const points=Array.isArray(item.points)?item.points.map(p=>({x:geoNum(p.x),y:geoNum(p.y),lat:geoNum(p.lat),lon:geoNum(p.lon)})):[];
  if(points.length<4||!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0||
     !geoBoundsContains({left:0,top:0,right:width,bottom:height},bounds.left,bounds.top)||
     !geoBoundsContains({left:0,top:0,right:width,bottom:height},bounds.right,bounds.bottom)||
     bounds.left>=bounds.right||bounds.top>=bounds.bottom||
     points.some(p=>!Number.isFinite(p.x)||!Number.isFinite(p.y)||!Number.isFinite(p.lat)||!Number.isFinite(p.lon)||
       p.lat<-90||p.lat>90||p.lon<-180||p.lon>180||!geoBoundsContains(bounds,p.x,p.y)))return null;
  let excluded=(Array.isArray(item.excludedBounds)?item.excludedBounds:[]).map(x=>({
    left:geoNum(x.left),top:geoNum(x.top),right:geoNum(x.right),bottom:geoNum(x.bottom)
  })).filter(x=>Number.isFinite(x.left)&&Number.isFinite(x.top)&&Number.isFinite(x.right)&&Number.isFinite(x.bottom)&&
    x.left<x.right&&x.top<x.bottom&&geoBoundsContains(bounds,x.left,x.top)&&geoBoundsContains(bounds,x.right,x.bottom));
  excluded=excluded.filter(area=>!points.every(p=>geoBoundsContains(area,p.x,p.y)));
  const meanLon=points.reduce((a,p)=>a+p.lon,0)/points.length;
  const meanLat=points.reduce((a,p)=>a+p.lat,0)/points.length;
  const meanX=points.reduce((a,p)=>a+p.x,0)/points.length;
  const meanY=points.reduce((a,p)=>a+p.y,0)/points.length;
  let ll=0,bb=0,lb=0,lx=0,bx=0,ly=0,latY=0;
  points.forEach(p=>{
    const lon=p.lon-meanLon,lat=p.lat-meanLat;
    ll+=lon*lon;bb+=lat*lat;lb+=lon*lat;
    lx+=lon*(p.x-meanX);bx+=lat*(p.x-meanX);
    ly+=lon*(p.y-meanY);latY+=lat*(p.y-meanY);
  });
  const det=ll*bb-lb*lb;
  if(ll<=1e-16||bb<=1e-16||det<=1e-8*ll*bb)return null;
  const model={page:Number(item.page),width,height,bounds,excluded,meanLon,meanLat,meanX,meanY,
    xLon:(bb*lx-lb*bx)/det,xLat:(ll*bx-lb*lx)/det,
    yLon:(bb*ly-lb*latY)/det,yLat:(ll*latY-lb*ly)/det};
  const orientation=model.xLon*model.yLat-model.xLat*model.yLon;
  if(!Number.isFinite(orientation)||orientation>=0)return null;
  const maxResidual=Math.min(2,Math.max(0,geoNum(item.maxResidualPdfPoints)||0.75));
  for(const p of points){
    const q=projectGeoRaw(model,p.lat,p.lon);
    if(!q||Math.hypot(q.x-p.x,q.y-p.y)>maxResidual)return null;
  }
  return model;
}
function projectGeoRaw(model,lat,lon){
  if(!model||!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return null;
  const x=model.meanX+model.xLon*(lon-model.meanLon)+model.xLat*(lat-model.meanLat);
  const y=model.meanY+model.yLon*(lon-model.meanLon)+model.yLat*(lat-model.meanLat);
  return Number.isFinite(x)&&Number.isFinite(y)?{x,y}:null;
}
// A single PDF page may contain TWO independently scaled/georeferenced maps.
// Resolve in geographic space and require the projected point to fall inside
// its actual sub-chart crop; never extrapolate Cargo into Salam or vice versa.
function resolveGeoRegion(model,lat,lon){
  if(!model)return null;
  if(Array.isArray(model.regions)){
    for(const r of model.regions){
      const p=projectGeoRaw(r.model,lat,lon);
      if(p&&geoBoundsContains(r.model.bounds,p.x,p.y,0)&&
        !(r.model.excluded||[]).some(b=>geoBoundsContains(b,p.x,p.y)))
        return {model:r.model,point:p,region:r.id};
    }
    return null; // no chart region covers this position
  }
  const p=projectGeoRaw(model,lat,lon);
  return p&&geoBoundsContains(model.bounds,p.x,p.y,6)&&
    !model.excluded.some(b=>geoBoundsContains(b,p.x,p.y))?
    {model,point:p,region:null}:null;
}
function projectGeo(model,lat,lon){
  if(model?.routeOnly)return oiciRouteModule?.projectOiciRoute(model,lat,lon)||null;
  return resolveGeoRegion(model,lat,lon)?.point||null;
}
/* JEPPIRAN V2621 two independent maps printed on the same PDF page.
 * Additive overlay: never mutate/copy/rewrite the 776 protected original
 * source georeferences, in particular OIIE Cargo and OIII ADC.
 */
// OICK V2621 source-calibrated simulator georeferencing; additive, fail-closed.
async function loadPublishedOickV2Georefs(m){
  try{
    const res=await fetch("./data/oick-georef-v2621.json?v=oick-v2-20261015",{cache:"no-store"});
    if(!res.ok)throw Error("OICK V2 data HTTP "+res.status);
    const d=await res.json();
    const identities=new Map([
      [218,"905dd0af368680fd64950a907c2762c3a85593b3a99b4ed52dfca422386dbe65"],
      [219,"d7b00ce24d2af0cad929a278b99a8665952653d3d148c83b30fb7324d2de72e4"],
      [221,"62d21472672bd39956e07c4b231dddeb15979c80788cc3ff2c056a60872ecf0a"],
      [223,"b1ba40365debbabd2cc1fedc6638d5b3a669aefdaa0c4bf22a0faa003f1964f9"]
    ]);
    if(d.schemaVersion!==1||d.type!=="OICK_V2621_GEOREFERENCE_REGIONS"||
       d.cycle!=="V2621"||d.sourceSha256!==m.source_sha256||d.pdfPageCount!==1654||
       d.safeForActualNavigation!==false||!Array.isArray(d.pages)||d.pages.length!==4)
      throw Error("OICK source/cycle mismatch");
    const staged=new Map();
    for(const row of d.pages){
      const page=Number(row.page),chart=charts.find(c=>c.airport==="OICK"&&Number(c.page)===page);
      const key=chart?["OICK",String(chart.category).toUpperCase(),String(chart.chart_number).toUpperCase(),String(chart.name).toUpperCase()].join("|"):"";
      if(!identities.has(page)||staged.has(page)||georefByPage.has(page)||row.airport!=="OICK"||
         row.sourceFingerprint!==identities.get(page)||row.chartKey!==key||
         !Array.isArray(row.regions)||row.regions.length!==(page===221?2:1))
        throw Error("OICK V2 chart identity/immutability check failed "+page);
      const regional=[];
      for(const entry of row.regions){
        const item=entry?.model,validation=item?.validation;
        if(!entry.id||item?.page!==page||item?.airport!=="OICK"||
           item?.chartKey!==key||item?.sourceFingerprint!==identities.get(page)||
           validation?.v2Region!==entry.id||validation?.qaTestOnly!==true||
           validation?.notApprovedForNavigation!==true)
          throw Error("OICK V2 source region not approved for QA "+page);
        const model=makeGeoModel(item);
        if(!model)throw Error("OICK V2 bad calibration "+page+"/"+entry.id);
        regional.push({id:entry.id,model});
      }
      if(page===221&&(regional[0].id!=="parking_apron_inset"||
         !regional.some(r=>r.id==="main_adc"&&r.model.excluded.length)))
        throw Error("OICK ADC requires independently calibrated parking and masked main chart");
      staged.set(page,regional.length===1?regional[0].model:{...regional[0].model,regions:regional});
    }
    if(manifest!==m||staged.size!==4||[...staged.keys()].some(page=>georefByPage.has(page)))return;
    for(const [page,model] of staged)georefByPage.set(page,model);
    console.info("OICK V2 simulator georeferencing active (not for actual navigation)",[...staged.keys()]);
  }catch(error){console.warn("OICK V2 georefs skipped; prior maps untouched",error)}
}
async function loadIndependentAirportRegionGeorefs(m){
  // Page 383 has two independent PDF-to-WGS84 regions: Cargo and Salam.
  // OIII page 432 has a large parking plan and a separately scaled Apron 5
  // inset. These airport models MUST load independently: Cargo failing must
  // never erase OIII parking, or vice versa.
  try{
    const response=await fetch("./data/airport-region-georef-v2621.json?v=oiie-o3-multiregion-r2",{cache:"no-store"});
    if(!response.ok)throw Error("region georef HTTP "+response.status);
    const payload=await response.json();
    if(payload.schemaVersion!==1||payload.type!=="MULTI_REGION_GEOREFERENCE"||
      payload.source?.sha256!==m.source_sha256||
      String(payload.source?.cycle)!==String(m.cycle)||payload.source.pdfPageCount!==1654)
      throw Error("Region source/cycle mismatch");
    const get=(id,airport,page)=>payload.regions?.find(r=>r.id===id&&r.airport===airport&&r.page===page);
    const cargo=georefByPage.get(383);
    const salam=get("SALAM_APRON_3","OIIE",383);
    if(cargo&&cargo.excluded?.length&&cargo.page===383&&
       cargo.width===612&&cargo.height===792&&salam){
      const salModel=makeGeoModel(salam),mask=cargo.excluded[0];
      if(salModel&&geoBoundsContains(mask,salModel.bounds.left,salModel.bounds.top)&&
         geoBoundsContains(mask,salModel.bounds.right,salModel.bounds.bottom)){
        // Cargo is the existing approved model, never overwrite its source
        // transform. resolveGeoRegion chooses Cargo or Salam in geographic
        // space, then checks the region's PDF crop boundaries.
        georefByPage.set(383,{...cargo,regions:[
          {id:"CARGO_APRON_2",model:cargo},
          {id:"SALAM_APRON_3",model:salModel}
        ]});
      }else console.warn("OIIE Salam geo control points or independent crop invalid");
    }else console.warn("OIIE approved Cargo model or Salam dataset unavailable; retained existing chart georef");

    // Crucial: this is a separate gate, never dependent on OIIE being valid.
    const main=get("OIII_PARKING_MAIN","OIII",432),
      inset=get("OIII_APRON_5_INSET","OIII",432);
    if(main&&inset){
      const mainModel=makeGeoModel(main),insetModel=makeGeoModel(inset),
        existing=georefByPage.get(432);
      if(mainModel&&insetModel){
        if(existing&&!Array.isArray(existing.regions)){
          // Keep a previously approved single-page model instead of silently
          // replacing it with this additional source-grid reconstruction.
          console.info("OIII parking pre-existing georef preserved");
        }else{
          georefByPage.set(432,{...mainModel,regions:[
            {id:"OIII_APRON_5_INSET",model:insetModel},
            {id:"OIII_PARKING_MAIN",model:mainModel}
          ]});
        }
      }else console.warn("OIII parking grid points invalid; no guessed transform loaded");
    }else console.warn("OIII parking georeference region data unavailable");
  }catch(e){console.warn("Airport multi-region georefs failed; existing models preserved:",e)}
}

// Fail closed unless exact AIRAC, PDF SHA, index chart keys and schematic
// QA metadata match. NEVER overwrite any approved chart georeference.
async function loadOiciRouteOnlyFlightQa(m){
  oiciRouteQaPages.clear();
  try{
    const [response,mod]=await Promise.all([
      fetch("./data/oici-route-only-v2621.json?v=2621-oici-route-flightqa-r1",{cache:"no-store"}),
      import("./oici-route-only-v2621.mjs?v=2621-oici-route-flightqa-r1")
    ]);
    if(!response.ok)throw Error("OICI route-only flight QA HTTP "+response.status);
    const data=await response.json();
    if(!mod.validateOiciRoutes(data,m,charts))throw Error("OICI route-only dataset / cycle / chart identity mismatch");
    if(manifest!==m)return;
    const models=[];
    for(const item of data.charts){
      if(georefByPage.has(item.page))throw Error("OICI approved reference already exists: "+item.page);
      const model=mod.buildOiciRouteModel(item);
      if(!model)throw Error("OICI nonaffine model rejected: "+item.page);
      models.push([item.page,model]);
    }
    oiciRouteModule=mod;
    for(const [page,model] of models){georefByPage.set(page,model);oiciRouteQaPages.add(page)}
    console.info("JEPPIRAN OICI route-only simulator QA enabled", [...oiciRouteQaPages]);
  }catch(e){console.warn("OICI route-only georeferencing disabled:",e)}
}
function buildGeorefIndex(root){
  const map=new Map();
  if(!root||root.version!==2||root.coordinateSystem!=="WGS84"||root.coordinateSpace!=="pdf_points"||root.origin!=="top_left")return map;
  (Array.isArray(root.charts)?root.charts:[]).forEach(item=>{
    const model=makeGeoModel(item);
    if(model&&!map.has(model.page))map.set(model.page,model);
  });
  return map;
}
function hideAircraftMarker(){
  const m=$("#aircraftMarker"); if(m)m.classList.remove("visible");
  if(aircraftFollowEnabled)cancelAircraftFollow();
  else updateAircraftFollowControl();
}
function renderedGeoHeading(model,lat,heading,canvas){
  if(!Number.isFinite(heading))return 0;
  if(model?.routeOnly)return oiciRouteModule?.headingOiciRoute(model,lat,Number(lastPosition?.lon),heading,canvas.clientWidth,canvas.clientHeight)||0;
  if(Array.isArray(model?.regions)){
    const active=resolveGeoRegion(model,Number(lastPosition?.lat),Number(lastPosition?.lon));
    if(!active)return 0;
    model=active.model;
  }
  const r=Math.PI/180,cosLat=Math.cos(lat*r);
  if(Math.abs(cosLat)<1e-8)return 0;
  const east=Math.sin(heading*r)/cosLat,north=Math.cos(heading*r);
  const dx=(model.xLon*east+model.xLat*north)*canvas.clientWidth/model.width;
  const dy=(model.yLon*east+model.yLat*north)*canvas.clientHeight/model.height;
  if(!Number.isFinite(dx)||!Number.isFinite(dy)||Math.hypot(dx,dy)<1e-8)return 0;
  return Math.atan2(dx,-dy)/r;
}
function setPositionStatus(state,text,detail=""){
  const btn=$("#positionStatusBtn");
  if(!btn)return;
  if(selectedChart && oiciRouteQaPages.has(Number(selectedChart.page))){
    state="warning";text=(text||"GPS")+" · ROUTE QA";
    detail="NOT TO SCALE. Route-centerline simulator flight QA only. Not for actual navigation. "+(detail||"");
  }
  if(state==="off"||state==="waiting"||state==="error")text="POS OFF";
  if(selectedChart && selectedChart.airport!=="OIII" && experimentalGeorefPages.has(Number(selectedChart.page))){
    state="warning";text=(text||"GPS")+" · GEOREF";
    detail=selectedChart.airport==="OIIE"&&[376,386,388].includes(Number(selectedChart.page))?
      "OIIE V2621 SID/ILS SOURCE GRID & IKA/RUS GEOREFERENCE QA · SIMULATOR ONLY · NOT FOR ACTUAL NAVIGATION. "+(detail||""):
      selectedChart.airport==="OIGG"&&[307,308].includes(Number(selectedChart.page))?
      "OIGG KOBUB GEO QA · ORIGINAL GRID DISAGREEMENT APPROX 700–940 m · SIMULATOR ONLY · NOT FOR NAVIGATION. "+(detail||""):
      "GEOREFERENCE · INDEPENDENT AIP QA PENDING · NOT FOR NAVIGATION. "+(detail||"");
  }
  if(selectedChart?.airport==="OICK"&&[218,219,221,223].includes(Number(selectedChart.page))&&
     !["off","waiting","error"].includes(state)){
    state="warning";text=(text||"GPS")+" · GEO QA";
    detail="V2621 OICK SIMULATOR GEOREFERENCE QA ONLY · NOT FOR ACTUAL NAVIGATION. "+(detail||"");
  }
  btn.dataset.state=state||"off";
  btn.title=detail?(text+" · "+detail):(text||"Position status");
  btn.setAttribute("aria-label",text||"Position status");
  const label=btn.querySelector(".position-status-label");
  if(label)label.textContent=text||"GPS";
  btn.dataset.detail=detail||"";
}
function chartHasGeoref(){
  return !!(selectedChart&&georefByPage.get(Number(selectedChart.page)));
}
function refreshPositionStatus(){
  if(!activePositionSource){
    setPositionStatus("off","POS OFF","No position source selected.");
    return;
  }
  if(!lastPosition){
    setPositionStatus("waiting","POS OFF","Waiting for a live position fix.");
    return;
  }
  const model=selectedChart&&georefByPage.get(Number(selectedChart.page));
  if(!selectedChart){
    const code=activePositionSource==="gps"?"GPS":activePositionSource==="fsx"?"FSX":"XPLANE";
    setPositionStatus("live",code+" LIVE","Position is live. Open a chart to display the aircraft.");
    return;
  }
  if(!model){
    const code=activePositionSource==="gps"?"GPS":activePositionSource==="fsx"?"FSX":"XPLANE";
    setPositionStatus("warning",code+" NO GEOREF","Position is live, but this chart has no valid georeference.");
    return;
  }
  const p=projectGeo(model,Number(lastPosition.lat),Number(lastPosition.lon));
  if(!p){
    const code=activePositionSource==="gps"?"GPS":activePositionSource==="fsx"?"FSX":"XPLANE";
    setPositionStatus("outside",code+" OUTSIDE","Position is live, but it is outside the mapped area of this chart.");
    return;
  }
  const acc=Number.isFinite(lastPosition.accuracy)?(" • ±"+Math.round(lastPosition.accuracy)+" m"):"";
  const code=activePositionSource==="gps"?"GPS":activePositionSource==="fsx"?"FSX":"XPLANE";
  const region=model.regions?resolveGeoRegion(model,Number(lastPosition.lat),Number(lastPosition.lon)):null;
  if(region&&region.region!=="CARGO_APRON_2"&&selectedChart?.airport!=="OIII"){
    // Newly reconstructed V2621 printed-grid airport regions have not yet
    // received an independent AIP/flight accuracy check. Show explicit QA.
    setPositionStatus("warning",code+" GEOREF QA"+acc,
      "PDF printed-grid regional model for simulator QA only; independent positioning validation pending.");
    return;
  }
  setPositionStatus("live",code+" LIVE"+acc,"Position is live and inside this chart.");
}

// Center aircraft at 150% and follow it as live simulator/GPS positions change.
// Transform origin is 50% 0, while the PDF canvas sits centered horizontally in the stage.
// Find Me uses the current real chart projection. Never guess a position on
// charts without usable georeferencing or when the aircraft is outside the chart.
const FIND_ME_ZOOM=1.5;
function currentFindMeTarget(){
  const stage=$("#pdfStage"),layer=$("#chartTransformLayer"),canvas=$("#pdfCanvas");
  const model=selectedChart&&georefByPage.get(Number(selectedChart.page));
  if(!stage||!layer||!canvas||!model||!lastPosition||!canvas.clientWidth||!canvas.clientHeight
     ||!stage.clientWidth||!stage.clientHeight)return null;
  const p=projectGeo(model,Number(lastPosition.lat),Number(lastPosition.lon));
  if(!p)return null;
  const x=p.x/model.width*canvas.clientWidth;
  const y=p.y/model.height*canvas.clientHeight;
  return {
    panX:FIND_ME_ZOOM*(layer.offsetWidth/2-x),
    panY:stage.clientHeight/2-FIND_ME_ZOOM*y
  };
}
function updateAircraftFollowControl(){
  const btn=$("#aircraftFollowBtn");
  if(!btn)return;
  const ready=!!currentFindMeTarget();
  btn.disabled=!ready;
  btn.classList.toggle("following",aircraftFollowEnabled&&ready);
  btn.setAttribute("aria-pressed",String(aircraftFollowEnabled&&ready));
  btn.setAttribute("aria-label",aircraftFollowEnabled&&ready?
    "Find Me: following aircraft. Tap to stop":"Find Me: smoothly center aircraft at 150% and follow");
  btn.title=ready?
    (aircraftFollowEnabled?"Following aircraft · Tap to stop":"Find Me · Smooth centering at 150%"):
    "A live position inside this georeferenced chart is required";
  // The visible button name must stay Find Me in both states.
  const label=btn.querySelector(".aircraft-follow-label");
  if(label)label.textContent="Find Me";
}
function cancelFollowFrames(){
  if(findMeAnimation){
    cancelAnimationFrame(findMeAnimation.raf);
    findMeAnimation=null;
  }
  if(followTrackingFrame){
    cancelAnimationFrame(followTrackingFrame);
    followTrackingFrame=0;
  }
  followTrackingTime=0;
}
function cancelAircraftFollow(){
  cancelFollowFrames();
  if(!aircraftFollowEnabled)return;
  aircraftFollowEnabled=false;
  updateAircraftFollowControl();
}
function beginFindMeTransition(){
  if(!aircraftFollowEnabled)return;
  cancelFollowFrames();
  const target=currentFindMeTarget();
  if(!target){cancelAircraftFollow();return}
  const reduceMotion=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches;
  if(reduceMotion){
    chartZoom=FIND_ME_ZOOM;chartPanX=target.panX;chartPanY=target.panY;
    paintChartTransform();
    return;
  }
  const startZoom=chartZoom,startX=chartPanX,startY=chartPanY;
  const travel=Math.hypot(target.panX-startX,target.panY-startY);
  const duration=Math.max(680,Math.min(1380,
    720+travel*.17+Math.abs(FIND_ME_ZOOM-startZoom)*200));
  const anim={start:performance.now(),duration,raf:0};
  findMeAnimation=anim;
  const tick=(now)=>{
    if(findMeAnimation!==anim||!aircraftFollowEnabled)return;
    const destination=currentFindMeTarget();
    if(!destination){cancelAircraftFollow();return}
    const t=Math.max(0,Math.min(1,(now-anim.start)/duration));
    // Smoothstep: zero initial/final velocity. Pan and zoom share one timeline.
    const eased=t*t*(3-2*t);
    chartZoom=startZoom+(FIND_ME_ZOOM-startZoom)*eased;
    chartPanX=startX+(destination.panX-startX)*eased;
    chartPanY=startY+(destination.panY-startY)*eased;
    paintChartTransform();
    if(t<1){
      anim.raf=requestAnimationFrame(tick);
    }else{
      findMeAnimation=null;
      // Any new live GPS/simulator fix is picked up by smooth FOLLOW tracking.
      updateAircraftMarker();
    }
  };
  anim.raf=requestAnimationFrame(tick);
}
function trackAircraftFrame(now){
  followTrackingFrame=0;
  if(!aircraftFollowEnabled||findMeAnimation)return;
  const target=currentFindMeTarget();
  if(!target){cancelAircraftFollow();return}
  const dt=followTrackingTime?Math.min(80,Math.max(1,now-followTrackingTime)):16;
  followTrackingTime=now;
  // Fast-damped camera movement keeps the arrow essentially centered while
  // avoiding one-frame jumps whenever the simulator reports a new position.
  const blend=window.matchMedia?.("(prefers-reduced-motion: reduce)")?.matches?
    1:(1-Math.exp(-dt/80));
  const dx=target.panX-chartPanX,dy=target.panY-chartPanY;
  chartZoom=FIND_ME_ZOOM;
  chartPanX=Math.abs(dx)<.18?target.panX:chartPanX+dx*blend;
  chartPanY=Math.abs(dy)<.18?target.panY:chartPanY+dy*blend;
  paintChartTransform();
  if(Math.abs(target.panX-chartPanX)>.18||Math.abs(target.panY-chartPanY)>.18){
    followTrackingFrame=requestAnimationFrame(trackAircraftFrame);
  }else followTrackingTime=0;
}
function followAircraftAt(model,p,canvas){
  if(!aircraftFollowEnabled||findMeAnimation)return;
  if(!followTrackingFrame){
    followTrackingTime=0;
    followTrackingFrame=requestAnimationFrame(trackAircraftFrame);
  }
}
function ensureAircraftFollowControl(){
  const stage=$("#pdfStage");
  if(!stage)return;
  let btn=$("#aircraftFollowBtn");
  if(!btn){
    btn=document.createElement("button");
    btn.id="aircraftFollowBtn";
    btn.type="button";
    btn.className="aircraft-follow-btn";
    btn.innerHTML='<svg viewBox="0 0 24 24" width="19" height="19" aria-hidden="true"><circle cx="12" cy="12" r="7.5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 1.8v5 M12 17.2v5 M1.8 12h5 M17.2 12h5" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"/><circle cx="12" cy="12" r="2.2" fill="currentColor"/></svg><span class="aircraft-follow-label">Find Me</span>';
    for(const type of ["pointerdown","pointermove","pointerup","pointercancel"])
      btn.addEventListener(type,e=>e.stopPropagation());
    btn.addEventListener("click",e=>{
      e.preventDefault();e.stopPropagation();
      if(btn.disabled)return;
      if(aircraftFollowEnabled)cancelAircraftFollow();
      else{
        aircraftFollowEnabled=true;
        updateAircraftFollowControl();
        beginFindMeTransition();
      }
    });
    stage.appendChild(btn);
  }
  updateAircraftFollowControl();
}
function updateTaxiDeviationClass(marker,pos){
  const deviation=window.JEPPIRAN_TAXI?.routeDeviationMeters?.(pos);
  if(!Number.isFinite(deviation)){
    taxiOffRouteCount=0;taxiOffRouteActive=false;
  }else if(deviation>45){
    taxiOffRouteCount=Math.min(3,taxiOffRouteCount+1);
    if(taxiOffRouteCount>=2)taxiOffRouteActive=true;
  }else if(deviation<30){
    taxiOffRouteCount=0;taxiOffRouteActive=false;
  }
  marker.classList.toggle("off-route",taxiOffRouteActive);
  marker.title=taxiOffRouteActive?"OFF ROUTE · SIMULATOR QA ONLY":"Aircraft position";
}
// OWNER LOCK 2026-10-12: approved thin-outline magenta arrow + soft double pulse.
// Shape/appearance and screen size: docs/design/AIRCRAFT_MARKER_LOCK_V1.md.
function aircraftMarkerMarkup(){
  return '<span class="aircraft-halo"></span><span class="aircraft-pulse"></span><span class="aircraft-pulse aircraft-pulse-second"></span><svg class="aircraft-heading-arrow" viewBox="-24 -24 48 48" aria-hidden="true"><path class="aircraft-arrow-white" d="M0-21 L11 15 L0 8 L-11 15 Z"/><path class="aircraft-arrow-black" d="M0-21 L11 15 L0 8 L-11 15 Z"/></svg>';
}
function updateAircraftMarker(){
  const canvas=$("#pdfCanvas"),chart=selectedChart,pos=lastPosition;
  if(!canvas||!chart||!pos){hideAircraftMarker();refreshPositionStatus();return}
  const model=georefByPage.get(Number(chart.page));
  if(!model){hideAircraftMarker();refreshPositionStatus();return}
  const p=projectGeo(model,Number(pos.lat),Number(pos.lon));
  if(!p){hideAircraftMarker();refreshPositionStatus();return}
  const wrap=$("#chartTransformLayer")||canvas.parentElement;
  let marker=$("#aircraftMarker");
  if(!marker){
    marker=document.createElement("div");
    marker.id="aircraftMarker";
    marker.className="aircraft-marker";
    marker.innerHTML=aircraftMarkerMarkup();
    wrap.appendChild(marker);
  }else if(marker.parentElement!==wrap){
    wrap.appendChild(marker);
  }
  const x=p.x/model.width*canvas.clientWidth;
  const y=p.y/model.height*canvas.clientHeight;
  marker.style.left=x+"px";marker.style.top=y+"px";
  marker.style.setProperty("--aircraft-heading",renderedGeoHeading(model,Number(pos.lat),Number(pos.heading),canvas)+"deg");
  marker.classList.add("visible");
  updateTaxiDeviationClass(marker,pos);
  if(aircraftFollowEnabled)followAircraftAt(model,p,canvas);
  updateAircraftFollowControl();
  refreshPositionStatus();
}

let pdfRenderToken=0,currentPdfUrl="";
let chartSlideDocument=null,chartSlideDocumentUrl="",chartSlideDocumentEpoch=0;
const chartSlidePreviews=new Map();
let activeChartSlide=null;

async function pdfJs(){
  if(window.pdfjsLib)return window.pdfjsLib;
  try{
    const mod=await import("./vendor/pdf.min.mjs");
    mod.GlobalWorkerOptions.workerSrc="./vendor/pdf.worker.min.mjs";
    return mod;
  }catch(e){throw new Error("PDF renderer could not load. Connect once to initialize the web app.");}
}
function chartCacheSupported(){
  return typeof window!=="undefined" && !!window.caches && typeof window.caches.open==="function";
}
async function getPdfBytes(url,save=true){
  let cache=null,res=null;
  if(chartCacheSupported()){
    try{
      cache=await window.caches.open("jeppiran-chart-pdfs-v2621-printclean-3");
      const info=manifest?.airports?.[selectedAirport];
      if(window.JeppIranOffline?.getPdfResponse){
        res=await window.JeppIranOffline.getPdfResponse(url,info?.sha256);
      }
      // Pre-auto-sync installs may have legacy PDFs. Check their published SHA
      // before using them so an older chart is never mistaken for the new cycle.
      if(!res){
        const oldPdf=await cache.match(url);
        if(oldPdf&&info?.sha256&&window.crypto?.subtle){
          const bytes=await oldPdf.clone().arrayBuffer();
          const digest=await crypto.subtle.digest("SHA-256",bytes);
          const hex=Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,"0")).join("");
          if(hex===info.sha256.toLowerCase())res=oldPdf;
        }else if(oldPdf&&!info?.sha256){res=oldPdf;}
      }
    }catch(_){
      cache=null;
    }
  }
  if(!res){
    res=await fetch(url,{mode:"cors",cache:"no-store"});
    if(!res.ok)throw new Error("PDF HTTP "+res.status);
    if(save&&cache){
      try{await cache.put(url,res.clone())}catch(_){}
    }
  }
  return new Uint8Array(await res.arrayBuffer());
}
async function renderSelectedPdf(c){
  const token=++pdfRenderToken;
  const info=manifest&&manifest.airports&&manifest.airports[selectedAirport];
  if(!info)throw new Error("No PDF URL is available for "+selectedAirport);
  currentPdfUrl="./charts/"+encodeURIComponent(info.file||selectedAirport+".pdf");
  if(chartCacheSupported()){
    $("#offlinePdfBtn").disabled=false;
    setOfflineButtonLabel("Save Offline");
    $("#offlinePdfBtn").title="Save this airport PDF for offline use";
  }else{
    $("#offlinePdfBtn").disabled=true;
    setOfflineButtonLabel("Online");
    $("#offlinePdfBtn").title="Offline browser cache is unavailable in Local Simulator Mode";
  }
  const stage=$("#pdfStage");
  stage.innerHTML='<div class="pdf-loading">Loading chart…</div><div class="pdf-canvas-wrap"><div id="chartTransformLayer" class="chart-transform-layer"><canvas id="pdfCanvas"></canvas></div></div>';
  ensureAircraftFollowControl();
  showPublishedExperimentalGeorefNotice();
  const url=currentPdfUrl;
  let doc=chartSlideDocumentUrl===url?chartSlideDocument:null;
  if(!doc){
    const lib=await pdfJs(),bytes=await getPdfBytes(url,true);
    if(token!==pdfRenderToken)return;
    doc=await lib.getDocument({data:bytes}).promise;
    if(token!==pdfRenderToken)return;
    chartSlideDocument=doc;chartSlideDocumentUrl=url;
    chartSlideDocumentEpoch++;
    chartSlidePreviews.clear();
  }
  const pageNo=Math.max(1,Math.min(doc.numPages,Number(c.pdf_page)||1));
  const page=await doc.getPage(pageNo);
  if(token!==pdfRenderToken)return;
  const wrap=stage.querySelector(".pdf-canvas-wrap"), canvas=$("#pdfCanvas");
  const base=page.getViewport({scale:1});
  const available=Math.max(320,stage.clientWidth-4);
  const dpr=Math.min(window.devicePixelRatio||1,2.5);
  const cssScale=available/base.width;
  const viewport=page.getViewport({scale:cssScale*dpr});
  canvas.width=Math.floor(viewport.width); canvas.height=Math.floor(viewport.height);
  canvas.style.width=Math.floor(viewport.width/dpr)+"px"; canvas.style.height=Math.floor(viewport.height/dpr)+"px";
  const layer=$("#chartTransformLayer");
  layer.style.width=canvas.style.width; layer.style.height=canvas.style.height;
  chartZoom=1;chartPanX=0;chartPanY=0;stage.scrollTop=0;
  await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;
  stage.querySelector(".pdf-loading")?.remove();
  applyChartTransform();
  updateAircraftMarker();
  window.dispatchEvent(new CustomEvent("jeppiran-chart-rendered",{detail:{page:Number(c.page)}}));
  // An adjacent page is decoded before the user swipes, eliminating the
  // blank flash of a PDF loading screen during interactive transitions.
  const epoch=chartSlideDocumentEpoch;
  setTimeout(()=>{if(epoch===chartSlideDocumentEpoch&&selectedChart===c)warmAdjacentChartSlides()},60);
}
function airportChartSequence(){
  return charts.filter(c=>c.airport===selectedAirport)
    .sort((a,b)=>(a.pdf_page||0)-(b.pdf_page||0));
}
// Interactive chart paging: exactly track the finger (no synthesized
// scrolling velocity). Reversing the finger returns the CURRENT chart.
function adjacentChart(delta){
  if(!selectedChart||!selectedAirport)return null;
  const seq=airportChartSequence();
  const idx=seq.findIndex(c=>Number(c.page)===Number(selectedChart.page));
  return idx>=0?(seq[idx+delta]||null):null;
}
function chartSlideKey(c,width){
  return (c.pdf_page||c.page)+":"+Math.round(width);
}
async function createChartSlidePreview(c,doc=chartSlideDocument,epoch=chartSlideDocumentEpoch){
  const stage=$("#pdfStage");
  if(!doc||!c||!stage||epoch!==chartSlideDocumentEpoch)return null;
  const width=Math.max(1,stage.clientWidth);
  const key=chartSlideKey(c,width);
  const cached=chartSlidePreviews.get(key);
  if(cached)return cached;
  try{
    const page=await doc.getPage(Math.max(1,Number(c.pdf_page)||1));
    if(epoch!==chartSlideDocumentEpoch)return null;
    const basis=page.getViewport({scale:1});
    // PDF tiles stay legible while moving but do not consume 3x DPR memory.
    const scale=(Math.max(1,width-4)/basis.width)*Math.min(devicePixelRatio||1,1.65);
    const viewport=page.getViewport({scale});
    const canvas=document.createElement("canvas");
    canvas.width=Math.max(1,Math.ceil(viewport.width));
    canvas.height=Math.max(1,Math.ceil(viewport.height));
    canvas.style.width=(viewport.width/Math.min(devicePixelRatio||1,1.65))+"px";
    canvas.style.height=(viewport.height/Math.min(devicePixelRatio||1,1.65))+"px";
    await page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport}).promise;
    if(epoch!==chartSlideDocumentEpoch)return null;
    chartSlidePreviews.set(key,canvas);
    // Keep the current and adjacent pages only; no unbounded canvas cache.
    if(chartSlidePreviews.size>5)chartSlidePreviews.delete(chartSlidePreviews.keys().next().value);
    return canvas;
  }catch(error){console.warn("Adjacent chart preview unavailable",error);return null}
}
function warmAdjacentChartSlides(){
  if(!chartSlideDocument||!selectedChart)return;
  const doc=chartSlideDocument,epoch=chartSlideDocumentEpoch;
  for(const delta of [-1,1]){
    const c=adjacentChart(delta);
    if(c)createChartSlidePreview(c,doc,epoch).catch(()=>{});
  }
}
function chartSwipePanel(canvas,scrollOffset=0){
  const panel=document.createElement("div");
  panel.className="jp-chart-swipe-panel";
  const inner=document.createElement("div");
  inner.className="jp-chart-swipe-paper";
  const copy=document.createElement("canvas");
  copy.width=canvas.width;copy.height=canvas.height;
  copy.style.width=canvas.style.width||canvas.width+"px";
  copy.style.height=canvas.style.height||canvas.height+"px";
  const ctx=copy.getContext("2d",{alpha:false});
  if(ctx)ctx.drawImage(canvas,0,0);
  inner.style.top=(-scrollOffset)+"px";
  inner.appendChild(copy);
  panel.appendChild(inner);
  return panel;
}
function beginChartSwipe(direction){
  if(activeChartSlide||chartZoom>1.001||!selectedChart)return null;
  const target=adjacentChart(direction),stage=$("#pdfStage"),current=$("#pdfCanvas");
  if(!target||!current||!stage||!chartSlideDocument)return null;
  const width=stage.clientWidth;
  const shield=document.createElement("div");
  const bounds=stage.getBoundingClientRect();
  shield.style.left=bounds.left+"px";
  shield.style.top=bounds.top+"px";
  shield.style.width=bounds.width+"px";
  shield.style.height=bounds.height+"px";
  shield.className="jp-chart-swipe-shield";
  shield.setAttribute("aria-hidden","true");
  const track=document.createElement("div");
  track.className="jp-chart-swipe-track";
  const here=chartSwipePanel(current,stage.scrollTop);
  const there=document.createElement("div");
  there.className="jp-chart-swipe-panel jp-chart-swipe-neighbor";
  there.style.left=(direction===1?"100%":"-100%");
  const label=document.createElement("span");
  label.className="jp-chart-swipe-loading";
  label.textContent=(target.chart_number?target.chart_number+" · ":"")+displayChartName(target);
  there.appendChild(label);
  track.append(here,there);shield.appendChild(track);stage.appendChild(shield);
  const state={shield,track,there,label,stage,dir:direction,target,width,dx:0,
    ready:false,done:false,lastX:0,lastT:0,reversing:false};
  activeChartSlide=state;
  const cached=chartSlidePreviews.get(chartSlideKey(target,width));
  const show=canvas=>{
    if(!canvas||activeChartSlide!==state||state.done)return;
    const paper=chartSwipePanel(canvas,0);
    while(paper.firstChild)there.appendChild(paper.firstChild);
    label.remove();state.ready=true;
  };
  if(cached)show(cached);
  else createChartSlidePreview(target).then(show).catch(()=>{});
  return state;
}
function updateChartSwipe(state,dx,x,time){
  if(!state||state.done)return;
  // Direction is fixed for this gesture. Crossing the start position cancels.
  const clipped=Math.max(-state.width,Math.min(state.width,dx));
  state.dx=state.dir===1?Math.min(0,clipped):Math.max(0,clipped);
  if(state.lastT&&time>state.lastT){
    state.reversing=Math.abs(x-state.lastX)>2 &&
      Math.sign(x-state.lastX)===state.dir;
  }
  state.lastX=x;state.lastT=time;
  state.track.style.transform="translate3d("+state.dx+"px,0,0)";
}
function finishChartSwipe(state,canceled){
  if(!state||state.done)return;
  state.done=true;
  const advance=!canceled&&state.ready&&!state.reversing&&
    Math.abs(state.dx)>=Math.max(80,state.width*0.32);
  const destination=advance?-state.dir*state.width:0;
  const remaining=Math.abs(destination-state.dx);
  const duration=Math.max(110,Math.min(260,120+remaining*.16));
  state.track.style.transition="transform "+duration+"ms cubic-bezier(.22,.78,.17,1)";
  requestAnimationFrame(()=>{state.track.style.transform="translate3d("+destination+"px,0,0)"});
  setTimeout(()=>{
    state.shield.remove();
    if(activeChartSlide===state)activeChartSlide=null;
    if(advance&&selectedChart&&state.target.airport===selectedAirport)
      navigateChart(state.dir);
  },duration+35);
}
function cancelChartSwipe(){
  const state=activeChartSlide;
  if(!state)return;
  state.done=true;state.shield.remove();activeChartSlide=null;
}
function navigateChart(delta){
  if(activeChartSlide?.done)return;
  if(!selectedChart||!selectedAirport)return;
  const seq=airportChartSequence();
  const idx=seq.findIndex(c=>Number(c.page)===Number(selectedChart.page));
  const next=idx+delta;
  if(idx<0||next<0||next>=seq.length)return;
  selectChart(seq[next],{keepTreeClosed:true});
}
function clampChartPan(){
  const stage=$("#pdfStage"),layer=$("#chartTransformLayer");
  if(!stage||!layer)return;
  const w=layer.offsetWidth*chartZoom,h=layer.offsetHeight*chartZoom;
  if(chartZoom<=1.001){
    // At 100% the viewport uses REAL vertical scrolling. Keeping a
    // transform panY alongside scrollTop caused the apparent locked PDF.
    chartPanX=0;chartPanY=0;
    return;
  }
  const maxX=Math.max(0,(w-stage.clientWidth)/2+80);
  const maxY=Math.max(0,h-stage.clientHeight+80);
  chartPanX=Math.max(-maxX,Math.min(maxX,chartPanX));
  chartPanY=Math.max(-maxY,Math.min(80,chartPanY));
}
// OWNER LOCK: cancel the chart's scale exactly, on every animation/pinch frame.
// Position stays in chart coordinates; arrow, outlines and pulse stay screen-sized.
function aircraftMarkerScaleForZoom(zoom){
  const z=Number(zoom);
  return Number.isFinite(z)&&z>0?1/z:1;
}
function paintChartTransform(){
  const layer=$("#chartTransformLayer"),stage=$("#pdfStage");
  if(!layer)return;
  if(stage)stage.style.overflowY=chartZoom<=1.001?"auto":"hidden";
  layer.style.transform="translate3d("+chartPanX+"px,"+chartPanY+"px,0) scale("+chartZoom+")";
  layer.style.setProperty("--marker-inverse-scale",String(aircraftMarkerScaleForZoom(chartZoom)));
  const label=$("#zoomValue");if(label)label.textContent=Math.round(chartZoom*100)+"%";
}
function applyChartTransform(){
  if(!$("#chartTransformLayer"))return;
  if(!aircraftFollowEnabled)clampChartPan();
  paintChartTransform();
  updateAircraftMarker();
}
function setChartZoom(next,{resetPan=false}={}){
  cancelAircraftFollow();
  const stage=$("#pdfStage"),old=chartZoom;
  const savedScroll=stage?.scrollTop||0;
  chartZoom=Math.max(1,Math.min(4,Number(next)||1));
  if(old<=1.001&&chartZoom>1.001){chartPanY=-savedScroll;if(stage)stage.scrollTop=0;}
  if(resetPan||chartZoom<=1.001){chartPanX=0;chartPanY=0}
  applyChartTransform();
  if(stage&&old>1.001&&chartZoom<=1.001&&!resetPan)
    stage.scrollTop=Math.max(0,-savedScroll);
  if(stage&&resetPan)stage.scrollTop=0;
}
function resetChartView(){setChartZoom(1,{resetPan:true})}
function zoomAround(next,cx,cy){
  cancelAircraftFollow();
  const stage=$("#pdfStage");
  if(!stage){setChartZoom(next);return}
  const old=chartZoom;
  const z=Math.max(1,Math.min(4,next));
  if(Math.abs(z-old)<0.001)return;
  const savedScroll=old<=1.001?stage.scrollTop:0;
  if(old<=1.001&&z>1.001){chartPanY=-savedScroll;stage.scrollTop=0;}
  const r=stage.getBoundingClientRect();
  const px=cx-r.left-r.width/2,py=cy-r.top;
  const ratio=z/old;
  chartPanX=px-(px-chartPanX)*ratio;
  chartPanY=py-(py-chartPanY)*ratio;
  chartZoom=z;
  if(chartZoom<=1.001){chartPanX=0;chartPanY=0}
  applyChartTransform();
  if(old>1.001&&chartZoom<=1.001)stage.scrollTop=Math.max(0,-chartPanY);
}
$("#zoomOutBtn").addEventListener("click",()=>setChartZoom(chartZoom/1.25));
$("#zoomInBtn").addEventListener("click",()=>setChartZoom(chartZoom*1.25));
$("#zoomResetBtn").addEventListener("click",resetChartView);
$("#prevChartBtn").addEventListener("click",()=>navigateChart(-1));
$("#nextChartBtn").addEventListener("click",()=>navigateChart(1));
// Independent PDF inversion: visual filter only, never rewrite PDF pixels, GPS,
// simulator data, CDFA calculations or the locked CDFA table layout.
function setChartInverted(enabled){
  const inverted=!!enabled;
  document.body.classList.toggle("chart-inverted",inverted);
  const btn=$("#chartInvertBtn");
  btn?.setAttribute("aria-pressed",String(inverted));
  btn?.classList.toggle("chart-invert-active",inverted);
  if(btn)btn.title=inverted?"Restore normal chart colors":"Invert chart colors";
  try{localStorage.setItem("jeppiran-chart-inverted",inverted?"1":"0")}catch(_){}
}
setChartInverted(localStorage.getItem("jeppiran-chart-inverted")==="1");
$("#chartInvertBtn").addEventListener("click",()=>setChartInverted(!document.body.classList.contains("chart-inverted")));

// iPad interaction lock V1: single chart tap toggles full screen; two taps zoom;
// gestures do not trigger taps. The 90ms, <=2.5px finish is NOT fling/inertia.
function setupChartGestures(){
  const stage=$("#pdfStage");
  if(!stage||stage.dataset.gestures==="1")return;
  stage.dataset.gestures="1";
  // Browser touch scrolling and manual PDF pan must not fight each other.
  // Chart follows actual finger displacement at 1:1 in both axes.
  stage.style.touchAction="none";
  let tailFrame=0, singleTapTimer=0, recentMove=null, pinched=false;
  let slideGesture=null;
  function cancelTail(){if(tailFrame)cancelAnimationFrame(tailFrame);tailFrame=0;}
  function chartHit(target){
    if(!(target instanceof Element))return false;
    if(target.closest("button,a,input,select,textarea,summary,[role='button'],.taxi-qa-panel"))return false;
    return !!target.closest(".pdf-canvas-wrap,#chartTransformLayer,#pdfCanvas");
  }
  function tinyPanStop(){
    const sample=recentMove;
    if(!sample||pinched||performance.now()-sample.time>75)return;
    if(Math.hypot(sample.dx,sample.dy)<0.25)return;
    // Movement is intentionally almost imperceptible, not a kinetic scroll.
    const dx=Math.max(-2.5,Math.min(2.5,sample.dx*0.36));
    const dy=Math.max(-2.5,Math.min(2.5,sample.dy*0.36));
    const x0=chartPanX,y0=chartPanY,scroll0=stage.scrollTop,t0=performance.now();
    function frame(now){
      const p=Math.min(1,(now-t0)/90);
      const eased=1-Math.pow(1-p,3);
      if(chartZoom>1.001){
        chartPanX=x0+dx*eased;chartPanY=y0+dy*eased;applyChartTransform();
      }else{
        stage.scrollTop=scroll0-dy*eased;
      }
      if(p<1)tailFrame=requestAnimationFrame(frame);else tailFrame=0;
    }
    tailFrame=requestAnimationFrame(frame);
  }
  stage.addEventListener("wheel",e=>{
    if(!$("#pdfCanvas"))return;
    cancelTail();
    if(e.ctrlKey||e.metaKey){
      e.preventDefault();
      zoomAround(chartZoom*(e.deltaY<0?1.12:1/1.12),e.clientX,e.clientY);
    }else if(chartZoom>1.001){
      e.preventDefault();
      cancelAircraftFollow();
      chartPanY-=e.deltaY;chartPanX-=e.deltaX;applyChartTransform();
    }else cancelAircraftFollow();
  },{passive:false});
  stage.addEventListener("pointerdown",e=>{
    if(!$("#pdfCanvas")||!chartHit(e.target))return;
    cancelTail();
    cancelAircraftFollow();
    try{stage.setPointerCapture(e.pointerId)}catch(_){}
    chartPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(chartPointers.size===1){
      pinched=false;
      recentMove={x:e.clientX,y:e.clientY,dx:0,dy:0,time:performance.now()};
      panStart={x:e.clientX,y:e.clientY,panX:chartPanX,panY:chartPanY,scrollTop:stage.scrollTop};
      swipeStart={x:e.clientX,y:e.clientY,time:Date.now()};
    }else if(chartPointers.size===2){
      if(slideGesture){finishChartSwipe(slideGesture,true);slideGesture=null}
      pinched=true;
      clearTimeout(singleTapTimer);singleTapTimer=0;lastTapAt=0;
      const pts=[...chartPointers.values()];
      pinchStartDistance=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      pinchStartZoom=chartZoom;
      panStart=null;swipeStart=null;
    }
  });
  stage.addEventListener("pointermove",e=>{
    if(!chartPointers.has(e.pointerId))return;
    chartPointers.set(e.pointerId,{x:e.clientX,y:e.clientY});
    if(chartPointers.size===2){
      pinched=true;
      const pts=[...chartPointers.values()];
      const dist=Math.hypot(pts[0].x-pts[1].x,pts[0].y-pts[1].y);
      const cx=(pts[0].x+pts[1].x)/2,cy=(pts[0].y+pts[1].y)/2;
      if(pinchStartDistance>0)zoomAround(pinchStartZoom*(dist/pinchStartDistance),cx,cy);
      return;
    }
    if(chartPointers.size===1&&panStart){
      const dx=e.clientX-panStart.x,dy=e.clientY-panStart.y;
      // Exactly follow current displacement; fast swipes move fast, and
      // reversing the finger visibly reverses the two-page preview.
      if(chartZoom<=1.001&&swipeStart&&!pinched){
        if(!slideGesture&&Math.abs(dx)>14&&Math.abs(dx)>Math.abs(dy)*1.3){
          slideGesture=beginChartSwipe(dx<0?1:-1);
          if(slideGesture){clearTimeout(singleTapTimer);singleTapTimer=0;lastTapAt=0;}
        }
        if(slideGesture){
          updateChartSwipe(slideGesture,dx,e.clientX,performance.now());
          return;
        }
      }
      const stageEl=$("#pdfStage"),layerEl=$("#chartTransformLayer");
      const canVerticalPan=!!(stageEl&&layerEl&&layerEl.offsetHeight*chartZoom>stageEl.clientHeight+1);
      recentMove={x:e.clientX,y:e.clientY,dx:e.clientX-(recentMove?.x??e.clientX),dy:e.clientY-(recentMove?.y??e.clientY),time:performance.now()};
      if(chartZoom>1.001){
        chartPanX=panStart.panX+dx;chartPanY=panStart.panY+dy;applyChartTransform();
      }else if(canVerticalPan&&Math.abs(dy)>Math.abs(dx)*0.65){
        stageEl.scrollTop=panStart.scrollTop-dy;
      }
    }
  });
  const finishPointer=e=>{
    if(!chartPointers.has(e.pointerId))return;
    const start=swipeStart;
    chartPointers.delete(e.pointerId);
    const canceled=e.type==="pointercancel";
    if(chartPointers.size===0){
      const dx=start?e.clientX-start.x:0,dy=start?e.clientY-start.y:0;
      const travel=Math.hypot(dx,dy),dt=start?Date.now()-start.time:Infinity;
      if(slideGesture){
        // The NEXT chart is committed only on release. Returning the finger
        // to the origin (or moving inward) animates back to THIS chart.
        finishChartSwipe(slideGesture,canceled);
        slideGesture=null;
        panStart=null;swipeStart=null;pinchStartDistance=0;
        recentMove=null;pinched=false;
        return;
      }
      if(!canceled&&!pinched&&start&&dt<380&&travel<12){
        const now=Date.now();
        if(now-lastTapAt<315&&lastTapPoint&&Math.hypot(lastTapPoint.x-e.clientX,lastTapPoint.y-e.clientY)<36){
          clearTimeout(singleTapTimer);singleTapTimer=0;lastTapAt=0;lastTapPoint=null;
          zoomAround(chartZoom>1.2?1:2,e.clientX,e.clientY);
        }else{
          clearTimeout(singleTapTimer);
          lastTapAt=now;lastTapPoint={x:e.clientX,y:e.clientY};
          if(!document.body.classList.contains("viewer-fullscreen")){
            // Enter full screen on the actual first tap, no 315ms delay.
            enterViewerFullscreen();
            singleTapTimer=setTimeout(()=>{singleTapTimer=0;lastTapAt=0;lastTapPoint=null},315);
          }else{
            singleTapTimer=setTimeout(()=>{
              singleTapTimer=0;lastTapAt=0;lastTapPoint=null;
              if(!$("#chartsView").classList.contains("chart-open")||!selectedChart)return;
              exitViewerFullscreen();
            },315);
          }
        }
      }else if(!canceled&&start&&travel>=12&&!pinched){
        // No delayed scrolling/fling after finger release.
        cancelTail();
      }
      panStart=null;swipeStart=null;pinchStartDistance=0;
      recentMove=null;pinched=false;
    }else if(chartPointers.size===1&&chartZoom>1.001){
      // A completed pinch cannot become a one-finger tap or swipe.
      const p=[...chartPointers.values()][0];
      panStart={x:p.x,y:p.y,panX:chartPanX,panY:chartPanY};
      swipeStart=null;
    }
  };
  stage.addEventListener("pointerup",finishPointer);
  stage.addEventListener("pointercancel",finishPointer);
}
setupChartGestures();

function selectChart(c,options={}){
  cancelChartSwipe();
  cancelAircraftFollow();
  taxiOffRouteCount=0;taxiOffRouteActive=false;
  selectedChart=c;
  $("#chartsView").classList.add("chart-open");
  if(jpChartDrawerOpen)refreshFullscreenChartDrawer();
  expanded.add(c.category||"Other");
  renderAirports($("#airportSearch").value);
  refreshPositionStatus();
  $("#viewerChart").textContent=(c.chart_number?c.chart_number+" • ":"")+displayChartName(c);
  showChartMetar(true,true);
  // On phones, choosing a procedure opens the chart immediately, rather
  // than leaving a tiny chart next to a permanent procedure column.
  if(window.matchMedia("(max-width: 749px)").matches &&
     !document.body.classList.contains("viewer-fullscreen")){
    enterViewerFullscreen();
  }
  renderSelectedPdf(c).catch(e=>{
    $("#pdfStage").innerHTML='<div class="empty-state"><img src="./app-icon.png" alt=""><b>Chart unavailable</b><span>'+escapeHtml(e.message)+'</span></div>';
  });
}
function hideChartMetar(){
  if(chartMetarTimer){clearTimeout(chartMetarTimer);chartMetarTimer=null}
  const banner=$("#chartMetarBanner");
  if(banner)banner.classList.remove("visible");
}
function scheduleChartMetarHide(){
  if(chartMetarTimer)clearTimeout(chartMetarTimer);
  chartMetarTimer=setTimeout(hideChartMetar,30000);
}
function metarReportKey(raw){
  return String(raw||"").trim().toUpperCase().replace(/\s+/g," ").replace(/^METAR /,"").replace(/\s*=\s*$/,"");
}
function chartMetarViewActive(icao){
  return icao===selectedAirport&&!!selectedChart&&!!$("#chartsView")?.classList.contains("active");
}
function presentChartMetar(icao,raw,autoHide=true,manual=false){
  if(!chartMetarViewActive(icao))return;
  const key=metarReportKey(raw),banner=$("#chartMetarBanner"),text=$("#chartMetarText");
  if(!key||!banner||!text)return;
  if(!manual&&chartMetarShown.get(icao)===key){
    if(chartMetarAirport===icao&&banner.classList.contains("visible"))text.textContent=raw;
    return;
  }
  chartMetarAirport=icao;
  chartMetarValue=raw;
  chartMetarShown.set(icao,key);
  text.textContent=raw;
  banner.classList.add("visible");
  if(autoHide)scheduleChartMetarHide();
}
function fetchChartMetar(icao){
  if(chartMetarRequests.has(icao))return chartMetarRequests.get(icao);
  chartMetarCheckedAt.set(icao,Date.now());
  const request=Promise.resolve().then(()=>fetchWx("metar",icao)).then(raw=>{
    if(!metarReportKey(raw))throw new Error("No METAR returned");
    wxCache[icao+":metar"]=raw;
    wxCache[icao+":time"]=Date.now();
    localStorage.setItem("wxCache",JSON.stringify(wxCache));
    return raw;
  }).finally(()=>chartMetarRequests.delete(icao));
  chartMetarRequests.set(icao,request);
  return request;
}
async function showChartMetar(autoHide=true,automatic=false,forceRefresh=false){
  const icao=selectedAirport;
  if(!chartMetarViewActive(icao))return;
  const banner=$("#chartMetarBanner"),text=$("#chartMetarText");
  if(!banner||!text)return;
  const cached=wxCache[icao+":metar"]||"";
  if(cached)presentChartMetar(icao,cached,autoHide,!automatic);
  else if(!automatic){
    chartMetarAirport=icao;
    text.textContent="METAR "+icao+" • loading…";
    banner.classList.add("visible");
    if(autoHide)scheduleChartMetarHide();
  }
  if(automatic&&!forceRefresh&&cached&&chartMetarCheckedAt.has(icao)&&Date.now()-chartMetarCheckedAt.get(icao)<CHART_METAR_POLL_INTERVAL)return;
  try{
    const raw=await fetchChartMetar(icao);
    // An unchanged response must not reopen a banner the user has dismissed.
    presentChartMetar(icao,raw,autoHide);
  }catch(_){
    if(!automatic&&!cached&&chartMetarViewActive(icao)&&banner.classList.contains("visible"))text.textContent="METAR "+icao+" unavailable";
  }
}
setInterval(()=>showChartMetar(true,true,true),CHART_METAR_POLL_INTERVAL);
$("#positionStatusBtn").addEventListener("click",()=>{
  const picker=$("#positionSourceDialog");
  if(!picker.open)picker.showModal();
});
$("#positionSourceCancelBtn").addEventListener("click",()=>$("#positionSourceDialog").close());
$("#selectDevicePositionBtn").addEventListener("click",()=>{
  $("#positionSourceDialog").close();
  startDeviceGps();
});
$("#selectSimulatorPositionBtn").addEventListener("click",()=>{
  $("#positionSourceDialog").close();
  const connected=(relaySocket&&relaySocket.readyState===WebSocket.OPEN)||(bridgeSocket&&bridgeSocket.readyState===WebSocket.OPEN);
  if((activePositionSource==="fsx"||activePositionSource==="xplane")&&connected){
    refreshPositionStatus();
    return;
  }
  if(activePositionSource==="gps")disconnectPosition("Select a simulator connection.");
  route("simulator");
  $("#fsxPcIp")?.focus();
});

function openTaxiDiagram(){
  if(!selectedAirport)return;
  const airport=selectedAirport;
  const airportCharts=charts.filter(c=>c.airport===selectedAirport&&c.category==="Airport");
  const diagram=airportCharts.find(c=>/\b(?:AIRPORT|AERODROME)\s+(?:DIAGRAM|LAYOUT)\b|\bADC\b/i.test(c.name||""))
    ||airportCharts.find(c=>/^10-0?9$/i.test((c.chart_number||"").trim()));
  if(!diagram){
    dialog("TAXI","Airport diagram not available for "+selectedAirport+".");
    return;
  }
  // The TAXI button toggles the docked second toolbar. Never change an
  // already open Parking/Docking chart just to show or hide this toolbar.
  if(!selectedChart)selectChart(diagram);
  if(window.JEPPIRAN_TAXI?.open)window.JEPPIRAN_TAXI.open();
  else document.querySelector('script[src*="taxi-mode.js"]')?.addEventListener("load",()=>{
    if(selectedAirport===airport)window.JEPPIRAN_TAXI?.open?.();
  },{once:true});
}
$("#chartTaxiBtn").addEventListener("click",openTaxiDiagram);

$("#chartMetarBtn").addEventListener("click",()=>{
  const banner=$("#chartMetarBanner");
  if(banner&&banner.classList.contains("visible"))hideChartMetar();
  else showChartMetar(true);
});
$("#chartMetarClose").addEventListener("click",e=>{e.stopPropagation();hideChartMetar()});
$("#chartMetarBanner").addEventListener("click",e=>{if(e.target.id!=="chartMetarClose")hideChartMetar()});

// Keep the raster artwork intact when the offline-save status changes.
function setOfflineButtonLabel(text){
  $("#offlinePdfBtn .toolbar-label").textContent=text;
}
$("#offlinePdfBtn").addEventListener("click",async()=>{
  if(!currentPdfUrl||!chartCacheSupported())return;
  $("#offlinePdfBtn").disabled=true; setOfflineButtonLabel("Saving…");
  try{await getPdfBytes(currentPdfUrl,true);setOfflineButtonLabel("Saved Offline")}
  catch(e){setOfflineButtonLabel("Save Offline");dialog("Offline chart","Could not save this airport PDF: "+e.message)}
  finally{setTimeout(()=>{$("#offlinePdfBtn").disabled=false;if($("#offlinePdfBtn .toolbar-label").textContent==="Saved Offline")setOfflineButtonLabel("Save Offline")},1800)}
});
async function refitSelectedChartForLayout(){
  if(!selectedChart)return;
  chartPointers.clear();
  panStart=null;swipeStart=null;pinchStartDistance=0;
  const oldZoom=chartZoom,oldPanX=chartPanX,oldPanY=chartPanY;
  const oldScroll=$("#pdfStage")?.scrollTop||0;
  try{
    await renderSelectedPdf(selectedChart);
    // Preserve double-tap/pinch and chart offset during fullscreen transition.
    chartZoom=oldZoom;
    chartPanX=oldPanX;
    chartPanY=oldPanY;
    applyChartTransform();
    if(oldZoom<=1.001)$("#pdfStage").scrollTop=oldScroll;
  }catch(e){
    $("#pdfStage").innerHTML='<div class="empty-state"><img src="./app-icon.png" alt=""><b>Chart unavailable</b><span>'+escapeHtml(e.message)+'</span></div>';
  }
}


// Full-screen airport procedure drawer. Created outside #pdfStage so its
// touches never become chart taps or interfere with the locked drawing layer.
let jpChartDrawerOpen=false;
function ensureFullscreenChartDrawer(){
  if(document.getElementById("jpChartMenuBtn"))return;
  const menu=document.createElement("button");
  menu.id="jpChartMenuBtn";
  menu.type="button";
  menu.textContent="☰";
  menu.setAttribute("aria-label","Browse charts at this airport");
  menu.setAttribute("aria-controls","jpChartDrawer");
  menu.setAttribute("aria-expanded","false");
  const backdrop=document.createElement("button");
  backdrop.id="jpChartDrawerBackdrop";
  backdrop.type="button";
  backdrop.setAttribute("aria-label","Close chart list");
  const drawer=document.createElement("aside");
  drawer.id="jpChartDrawer";
  drawer.setAttribute("aria-label","Airport charts");
  drawer.innerHTML='<div class="jp-chart-drawer-heading"><b id="jpChartDrawerAirport"></b><button type="button" id="jpChartDrawerClose" aria-label="Close chart list">×</button></div><div id="jpChartDrawerList" class="jp-chart-drawer-list"></div>';
  document.body.append(backdrop,drawer,menu);
  const close=()=>setFullscreenChartDrawer(false);
  menu.addEventListener("click",()=>setFullscreenChartDrawer(!jpChartDrawerOpen));
  backdrop.addEventListener("click",close);
  drawer.querySelector("#jpChartDrawerClose").addEventListener("click",close);
  drawer.addEventListener("keydown",e=>{if(e.key==="Escape"){e.stopPropagation();close();menu.focus()}});
}
function refreshFullscreenChartDrawer(){
  const host=document.getElementById("jpChartDrawerList");
  if(!host)return;
  const heading=document.getElementById("jpChartDrawerAirport");
  if(heading)heading.textContent=(selectedAirport||"—")+" · CHARTS";
  host.replaceChildren();
  if(!selectedAirport)return;
  const seq=airportChartSequence();
  for(const [category,label] of [["STAR","STAR"],["SID","SID"],["Airport","AIRPORT"],["Approach","APP"]]){
    const items=seq.filter(c=>(c.category||"Other")===category);
    if(!items.length)continue;
    const title=document.createElement("div");
    title.className="jp-drawer-category";
    title.textContent=label+" ("+items.length+")";
    host.appendChild(title);
    for(const c of items){
      const row=document.createElement("button");
      row.type="button";
      row.className="jp-drawer-chart"+(selectedChart&&Number(c.page)===Number(selectedChart.page)?" is-current":"");
      row.textContent=(c.chart_number?c.chart_number+" · ":"")+displayChartName(c);
      row.setAttribute("aria-current",row.classList.contains("is-current")?"page":"false");
      row.onclick=()=>{
        setFullscreenChartDrawer(false);
        if(!selectedChart||Number(selectedChart.page)!==Number(c.page))selectChart(c,{keepTreeClosed:true});
      };
      host.appendChild(row);
    }
  }
}
function setFullscreenChartDrawer(open){
  ensureFullscreenChartDrawer();
  jpChartDrawerOpen=!!open&&document.body.classList.contains("viewer-fullscreen")&&!!selectedChart;
  document.body.classList.toggle("jp-chart-drawer-open",jpChartDrawerOpen);
  const menu=document.getElementById("jpChartMenuBtn");
  menu.setAttribute("aria-expanded",String(jpChartDrawerOpen));
  if(jpChartDrawerOpen){
    refreshFullscreenChartDrawer();
    document.getElementById("jpChartDrawerList").scrollTop=0;
  }
}
ensureFullscreenChartDrawer();
let jpFullscreenRefitTimer=0;
function scheduleFullscreenRefit(delay=240){
  clearTimeout(jpFullscreenRefitTimer);
  jpFullscreenRefitTimer=setTimeout(()=>{jpFullscreenRefitTimer=0;refitSelectedChartForLayout()},delay);
}

async function enterViewerFullscreen(){
  document.body.classList.add("viewer-fullscreen");
  const root=document.documentElement;
  const request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(request){try{await request.call(root)}catch(e){}}
  // A short deferred refit leaves the double-tap window uninterrupted.
  scheduleFullscreenRefit(400);
}
async function exitViewerFullscreen(exitNative=true){
  setFullscreenChartDrawer(false);
  document.body.classList.remove("viewer-fullscreen");
  if(exitNative){
    const active=document.fullscreenElement||document.webkitFullscreenElement;
    const exit=document.exitFullscreen||document.webkitExitFullscreen;
    if(active&&exit){try{await exit.call(document)}catch(e){}}
  }
  scheduleFullscreenRefit(240);
}
$("#fullscreenBtn").addEventListener("click",enterViewerFullscreen);
$("#fullscreenExitBtn").addEventListener("click",()=>exitViewerFullscreen(true));
["fullscreenchange","webkitfullscreenchange"].forEach(name=>document.addEventListener(name,()=>{
  const active=document.fullscreenElement||document.webkitFullscreenElement;
  if(!active&&document.body.classList.contains("viewer-fullscreen"))exitViewerFullscreen(false);
}));
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&document.body.classList.contains("viewer-fullscreen"))exitViewerFullscreen(true)});

const wxCache=readJsonStorage("wxCache",{});
$("#getWxBtn").addEventListener("click",getWx);
async function getWx(){
  const icao=$("#icaoInput").value.trim().toUpperCase();
  $("#icaoInput").value=icao;
  const rawMetar=$("#metarCheck").checked, rawTaf=$("#tafCheck").checked, decoded=$("#decodedCheck").checked;
  if(!/^[A-Z]{4}$/.test(icao)){setWxStatus("Insert a valid four-letter ICAO code.");return}
  if(!rawMetar&&!rawTaf&&!decoded){setWxStatus("Select METAR, TAF, DECODED, or a combination.");return}
  const needMetar=rawMetar||decoded, needTaf=rawTaf||decoded;
  $("#getWxBtn").disabled=true; setWxStatus(icao+" • getting data…");
  let metar="",taf="",metarOk=!needMetar,tafOk=!needTaf;
  try{
    const jobs=[];
    if(needMetar) jobs.push(fetchWx("metar",icao).then(v=>{metar=v;metarOk=true}).catch(()=>{}));
    if(needTaf) jobs.push(fetchWx("taf",icao).then(v=>{taf=v;tafOk=true}).catch(()=>{}));
    await Promise.all(jobs);
    const anyRequestedOk=(needMetar&&metarOk)||(needTaf&&tafOk);
    if(!anyRequestedOk){
      showCachedWx(icao,rawMetar,rawTaf,decoded);
      setWxStatus(icao+" • unable to update • cached data shown");
      return;
    }
    if(needMetar&&metarOk) wxCache[icao+":metar"]=metar;
    if(needTaf&&tafOk) wxCache[icao+":taf"]=taf;
    wxCache[icao+":time"]=Date.now(); localStorage.setItem("wxCache",JSON.stringify(wxCache));
    const m=metarOk?metar:(wxCache[icao+":metar"]||"No cached METAR.");
    const t=tafOk?taf:(wxCache[icao+":taf"]||"No cached TAF.");
    showWx(rawMetar,rawTaf,decoded,m,t);
    const requestedOk=(!needMetar||metarOk)&&(!needTaf||tafOk);
    setWxStatus(icao+(requestedOk?" • updated":" • partial update"));
  }finally{$("#getWxBtn").disabled=false}
}
function extractWxRaw(data,type){
  if(!data)return "";
  if(typeof data==="string")return data.trim();
  if(Array.isArray(data)){
    for(const row of data){const v=extractWxRaw(row,type);if(v)return v}
    return "";
  }
  if(type==="metar"){
    const v=data.raw||data.rawText||data.rawOb||data.raw_text;
    if(typeof v==="string"&&v.trim())return v.trim();
  }else{
    const direct=data.rawTAF||data.rawTaf||data.raw_text||data.rawText;
    if(typeof direct==="string"&&direct.trim())return direct.trim();
    if(data.taf){
      if(typeof data.taf==="string"&&data.taf.trim())return data.taf.trim();
      const nested=extractWxRaw(data.taf,"taf"); if(nested)return nested;
    }
  }
  for(const k of ["data","results","reports","items"]){
    if(data[k]){const v=extractWxRaw(data[k],type);if(v)return v}
  }
  return "";
}
async function loadGithubWxCache(){
  if(githubWxCache&&Date.now()-githubWxCacheAt<60000)return githubWxCache;
  const bust=Math.floor(Date.now()/300000);
  try{
    const r=await fetch(WX_CACHE_RAW+"?v="+bust,{cache:"no-store",mode:"cors"});
    if(!r.ok)throw new Error("GitHub raw "+r.status);
    githubWxCache=await r.json();githubWxCacheAt=Date.now();return githubWxCache;
  }catch(rawError){
    const r=await fetch(WX_CACHE_API+"&v="+bust,{cache:"no-store",mode:"cors",headers:{Accept:"application/vnd.github+json"}});
    if(!r.ok)throw rawError;
    const data=await r.json(),encoded=String(data.content||"").replace(/\s+/g,"");
    githubWxCache=JSON.parse(atob(encoded));githubWxCacheAt=Date.now();return githubWxCache;
  }
}
async function fetchWxGithubCache(type,icao){
  const data=await loadGithubWxCache(),row=data&&data.stations&&data.stations[icao];
  const raw=row&&row[type];
  if(typeof raw==="string"&&raw.trim())return raw.trim();
  throw new Error("No cached "+type.toUpperCase()+" for "+icao);
}
async function fetchWx(type,icao){
  try{return await fetchWxGithubCache(type,icao)}catch(_){}
  const code=encodeURIComponent(icao);
  const providers=[
    {
      url:"https://rotatepilot.com/api/v1/metar?icao="+code+"&taf=1",
      pick:data=>type==="metar"?(data&&data.raw):(data&&data.taf&&(data.taf.raw||data.taf.rawText))
    },
    {
      url:type==="metar"?"https://metars.eu/api/metars/"+code:"https://metars.eu/api/tafs/"+code,
      pick:data=>extractWxRaw(data,type)
    }
  ];
  let last=null;
  for(const p of providers){
    try{
      const r=await fetch(p.url,{mode:"cors",cache:"no-store",headers:{Accept:"application/json"}});
      if(!r.ok)throw new Error("HTTP "+r.status);
      const data=await r.json();
      const raw=(p.pick(data)||"").toString().trim();
      if(raw)return raw;
      throw new Error("No "+type.toUpperCase()+" returned");
    }catch(e){last=e}
  }
  throw last||new Error("Weather service unavailable");
}
function showCachedWx(icao,m,t,d){
  showWx(m,t,d,wxCache[icao+":metar"]||"No cached METAR.",wxCache[icao+":taf"]||"No cached TAF.");
}
function showWx(showM,showT,showD,m,t){
  toggle("#metarBlock",showM); toggle("#tafBlock",showT); toggle("#decodedBlock",showD);
  $("#metarText").textContent=m||"No METAR available.";
  $("#tafText").textContent=t||"No TAF available.";
  $("#decodedText").innerHTML="";
  if(showD){
    const pre=document.createElement("pre");
    pre.textContent="METAR\n"+decodeMetar(m)+"\n\nTAF\n"+decodeTaf(t);
    $("#decodedText").appendChild(pre);
  }
}
function decodeMetar(raw){
  if(!raw||raw.startsWith("No cached"))return raw||"No METAR available.";
  const r=raw.split(/\n/).find(Boolean)||raw, tok=r.trim().split(/\s+/), out=[];
  const st=tok.find(x=>/^[A-Z]{4}$/.test(x)); if(st)out.push("Station: "+st);
  const time=tok.find(x=>/^\d{6}Z$/.test(x)); if(time)out.push("Observation: day "+time.slice(0,2)+" at "+time.slice(2,4)+":"+time.slice(4,6)+" UTC");
  const wind=tok.find(x=>/^(VRB|\d{3})\d{2,3}(G\d{2,3})?KT$/.test(x)); if(wind)out.push("Wind: "+wind);
  const vis=tok.find(x=>x==="CAVOK"||/^\d{4}$/.test(x)); if(vis)out.push("Visibility: "+(vis==="CAVOK"?"CAVOK":vis+" m"));
  const clouds=tok.filter(x=>/^(FEW|SCT|BKN|OVC|VV)\d{3}(CB|TCU)?$/.test(x)); if(clouds.length)out.push("Clouds: "+clouds.join(" • "));
  const td=tok.find(x=>/^M?\d{2}\/M?\d{2}$/.test(x)); if(td)out.push("Temperature / Dew point: "+td.replace(/M/g,"-")+" °C");
  const q=tok.find(x=>/^Q\d{4}$/.test(x)); if(q)out.push("QNH: "+q.slice(1)+" hPa");
  return out.length?out.join("\n"):r;
}
function decodeTaf(raw){
  if(!raw||raw.startsWith("No cached"))return raw||"No TAF available.";
  const clean=raw.replace(/\s+/g," ").trim();
  return clean.replace(/\b(VRB|\d{3})(\d{2,3})(G(\d{2,3}))?KT\b/g,(m,d,s,g,gnum)=>{
    return "wind "+(d==="VRB"?"variable":d+"°")+" "+s+" kt"+(gnum?" gust "+gnum+" kt":"");
  }).replace(/\bCAVOK\b/g,"visibility CAVOK");
}
function setWxStatus(t){$("#wxStatus").textContent=t}
function toggle(sel,on){$(sel).classList.toggle("hidden",!on)}
function escapeHtml(s){return String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]))}


/* ===== Position sources: iOS GPS + simulator WebSocket bridges ===== */
let activePositionSource=localStorage.getItem("positionSource")||"";
let gpsWatchId=null, bridgeSocket=null, relaySocket=null, relayPingTimer=null, relayReconnectTimer=null, relayAwaitPositionTimer=null, relayHost="", relayTopic="", lastPosition=null, lastGpsFix=null;

function positionNumber(v,d=5){return Number.isFinite(v)?Number(v).toFixed(d):"—"}
function updatePositionUi(p,source){
  lastPosition=p;
  const sourceLabel=source==="gps"?"DEVICE GPS":source==="xplane"?"X-PLANE 11.5":source==="fsx"?"FSX":"POSITION";
  $("#positionSource").textContent=sourceLabel;
  $("#positionDot").classList.add("live");
  $("#posLat").textContent=positionNumber(p.lat,6);
  $("#posLon").textContent=positionNumber(p.lon,6);
  $("#posAlt").textContent=Number.isFinite(p.alt)?Math.round(p.alt)+" m":"—";
  $("#posHdg").textContent=Number.isFinite(p.heading)?Math.round((p.heading+360)%360)+"°":"—";
  $("#posGs").textContent=Number.isFinite(p.groundspeed)?Math.round(p.groundspeed*1.943844)+" kt":"—";
  $("#posAcc").textContent=Number.isFinite(p.accuracy)?Math.round(p.accuracy)+" m":source==="gps"?"—":"SIM";
  $("#simStatus").textContent=sourceLabel+" • live";
  if(source==="fsx"){
    const inline=$("#fsxInlineStatus");if(inline)inline.textContent="SIMULATOR LIVE • position received.";
    const btn=$("#connectFsxBtn");if(btn){btn.disabled=false;btn.textContent="SIMULATOR CONNECTED"}
  }
  const badge=$("#viewerPositionBadge");
  if(badge){badge.textContent=sourceLabel+" LIVE";badge.classList.add("live")}
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  if(source==="gps") $("#useGpsBtn").classList.add("active");
  if(source==="xplane") $("#useXpBtn").classList.add("active");
  if(source==="fsx") $("#useFsxBtn").classList.add("active");
  updateAircraftMarker();
  window.dispatchEvent(new CustomEvent("jeppiran-position",{detail:p}));
}
function clearPositionUi(message="Disconnected"){
  lastPosition=null;
  $("#positionSource").textContent="No source selected";
  $("#positionDot").classList.remove("live");
  ["#posLat","#posLon","#posAlt","#posHdg","#posGs","#posAcc"].forEach(s=>$(s).textContent="—");
  $("#simStatus").textContent=message;
  const badge=$("#viewerPositionBadge"); if(badge){badge.textContent="";badge.classList.remove("live")}
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  hideAircraftMarker();
  if(!/permission|unavailable|timed out|error/i.test(message))setPositionStatus("off","POS OFF",message);
}
function stopGps(){
  if(gpsWatchId!==null && navigator.geolocation){navigator.geolocation.clearWatch(gpsWatchId)}
  gpsWatchId=null; lastGpsFix=null;
}
function stopBridge(){
  if(bridgeSocket){try{bridgeSocket.onclose=null;bridgeSocket.close()}catch(e){}}
  bridgeSocket=null;
  if(relayReconnectTimer){clearTimeout(relayReconnectTimer);relayReconnectTimer=null}
  if(relayAwaitPositionTimer){clearTimeout(relayAwaitPositionTimer);relayAwaitPositionTimer=null}
  if(relayPingTimer){clearInterval(relayPingTimer);relayPingTimer=null}
  if(relaySocket){try{relaySocket.onclose=null;relaySocket.close()}catch(e){}}
  relaySocket=null;relayHost="";relayTopic="";
}
function disconnectPosition(message="Disconnected"){
  stopGps(); stopBridge(); activePositionSource=""; localStorage.removeItem("positionSource"); clearPositionUi(message);
}
function bearingBetween(a,b){
  const r=Math.PI/180, p1=a.lat*r, p2=b.lat*r, dl=(b.lon-a.lon)*r;
  const y=Math.sin(dl)*Math.cos(p2), x=Math.cos(p1)*Math.sin(p2)-Math.sin(p1)*Math.cos(p2)*Math.cos(dl);
  return (Math.atan2(y,x)/r+360)%360;
}
function startDeviceGps(){
  stopBridge();
  clearPositionUi("Requesting device position…");
  if(!navigator.geolocation){clearPositionUi("Geolocation is not supported by this browser.");return}
  $("#simStatus").textContent="Requesting iOS location permission…";
  activePositionSource="gps"; localStorage.setItem("positionSource","gps");
  setPositionStatus("waiting","POS OFF","Requesting browser location permission and waiting for a fix.");
  if(gpsWatchId!==null) stopGps();
  gpsWatchId=navigator.geolocation.watchPosition(pos=>{
    const c=pos.coords;
    let heading=Number.isFinite(c.heading)?c.heading:null;
    const fix={lat:c.latitude,lon:c.longitude,alt:Number.isFinite(c.altitude)?c.altitude:null,
      heading,groundspeed:Number.isFinite(c.speed)?c.speed:null,accuracy:c.accuracy,timestamp:pos.timestamp};
    if(!Number.isFinite(fix.heading) && lastGpsFix){
      const moved=Math.hypot((fix.lat-lastGpsFix.lat)*111000,(fix.lon-lastGpsFix.lon)*111000*Math.cos(fix.lat*Math.PI/180));
      if(moved>4) fix.heading=bearingBetween(lastGpsFix,fix);
    }
    lastGpsFix=fix; updatePositionUi(fix,"gps");
  },err=>{
    const reasons={1:"Location permission denied.",2:"Location unavailable.",3:"Location request timed out."};
    const msg=reasons[err.code]||("GPS error: "+err.message);
    setPositionStatus("error","POS OFF",msg);
    clearPositionUi(msg);
  },{enableHighAccuracy:true,maximumAge:1000,timeout:12000});
}
const LOCAL_SIM_WEB=location.protocol==="http:"&&location.port==="8080";
let bridgeTargetSource=LOCAL_SIM_WEB?"fsx":(localStorage.getItem("bridgeTargetSource")||(activePositionSource==="fsx"?"fsx":"xplane"));
const bridgeMeta={
  xplane:{label:"X-PLANE 11.5",title:"X-PLANE 11.5 BRIDGE",port:8765,securePort:8766,
    help:"Run the standalone JEPPIRAN X-Plane Bridge on the simulator PC, then connect using the WebSocket address printed by the bridge."},
  fsx:{label:"FSX",title:"FSX SIMCONNECT BRIDGE",port:8775,localWebPort:8080,
    help:"Run JEPPIRAN FSX Bridge v1.4 on the FSX PC. Enter any IPv4 address printed by the bridge and tap CONNECT FSX. JEPPIRAN stays on its main HTTPS address and keeps the FSX link alive while you move between Home, Charts and WX."}
};
function normalizeBridgeHost(value){
  let v=String(value||"").trim();
  v=v.replace(/^https?:\/\//i,"").replace(/^wss?:\/\//i,"");
  v=v.split(/[\/?#]/)[0];
  if(/^\[[^\]]+\]:\d+$/.test(v))v=v.replace(/:\d+$/,"");
  else if(/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(v))v=v.replace(/:\d+$/,"");
  return v;
}
function setBridgeTarget(source){
  bridgeTargetSource=bridgeMeta[source]?source:"xplane";
  localStorage.setItem("bridgeTargetSource",bridgeTargetSource);
  const xInput=$("#bridgeUrl"),fInput=$("#fsxPcIp");
  if(xInput){
    const saved=localStorage.getItem("bridgeUrl:xplane")||localStorage.getItem("bridgeUrl")||"";
    if(!xInput.value||bridgeTargetSource==="xplane")xInput.value=saved||("ws://192.168.1.50:"+bridgeMeta.xplane.port);
  }
  if(fInput){
    const savedFsx=localStorage.getItem("fsxPcHost")||"";
    if(LOCAL_SIM_WEB)fInput.value=location.hostname;
    else if(!fInput.value)fInput.value=savedFsx;
  }
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  if(bridgeTargetSource==="xplane")$("#useXpBtn").classList.add("active");
  if(bridgeTargetSource==="fsx")$("#useFsxBtn").classList.add("active");
}
function ensureLocalFsxSession(autoConnect=true){
  if(!LOCAL_SIM_WEB)return;
  if(bridgeTargetSource!=="fsx" || activePositionSource!=="fsx"){
    setBridgeTarget("fsx");
    activePositionSource="fsx";
    localStorage.setItem("positionSource","fsx");
  }else{
    // Repaint the FSX controls in case stale UI state survived navigation.
    setBridgeTarget("fsx");
  }
  const expected="ws://"+location.hostname+":"+bridgeMeta.fsx.port;
  if($("#fsxPcIp")&&$("#fsxPcIp").value!==location.hostname) $("#fsxPcIp").value=location.hostname;
  if(autoConnect && (!bridgeSocket || bridgeSocket.readyState>1)){
    $("#simStatus").textContent="JEPPIRAN • local FSX bridge • connecting automatically…";
    setTimeout(connectSimulatorBridge,250);
  }
}


function mqttConcat(parts){
  let total=0;parts.forEach(p=>total+=p.length);
  const out=new Uint8Array(total);let o=0;
  parts.forEach(p=>{out.set(p,o);o+=p.length});return out;
}
function mqttRemainingLength(n){
  const out=[];do{let d=n%128;n=Math.floor(n/128);if(n>0)d|=128;out.push(d)}while(n>0);return new Uint8Array(out);
}
function mqttUtf8(s){
  const b=new TextEncoder().encode(s),out=new Uint8Array(2+b.length);
  out[0]=(b.length>>8)&255;out[1]=b.length&255;out.set(b,2);return out;
}
function mqttConnectPacket(clientId,username="demo"){
  const flags=username?0x82:0x02; // clean session + optional username
  const vh=mqttConcat([mqttUtf8("MQTT"),new Uint8Array([4,flags,0,30])]);
  const parts=[mqttUtf8(clientId)];
  if(username)parts.push(mqttUtf8(username));
  const pl=mqttConcat(parts),body=mqttConcat([vh,pl]);
  return mqttConcat([new Uint8Array([0x10]),mqttRemainingLength(body.length),body]);
}
function mqttSubscribePacket(topic,packetId=1){
  const body=mqttConcat([new Uint8Array([(packetId>>8)&255,packetId&255]),mqttUtf8(topic),new Uint8Array([0])]);
  return mqttConcat([new Uint8Array([0x82]),mqttRemainingLength(body.length),body]);
}
function mqttPackets(data){
  const a=new Uint8Array(data),out=[];let i=0;
  while(i<a.length){
    const start=i,header=a[i++];let mul=1,len=0,b=0;
    do{if(i>=a.length)return out;b=a[i++];len+=(b&127)*mul;mul*=128}while(b&128);
    if(i+len>a.length)return out;
    out.push({header,body:a.slice(i,i+len)});i+=len;
    if(i===start)break;
  }
  return out;
}
async function fsxRelayTopicFor(host){
  if(!(window.crypto&&crypto.subtle))throw new Error("Secure crypto is unavailable in this browser.");
  const bytes=new TextEncoder().encode("JEPPIRAN-FSX-RELAY-V1|"+host);
  const digest=new Uint8Array(await crypto.subtle.digest("SHA-256",bytes));
  return "jeppiran/fsx/v1/"+[...digest.slice(0,16)].map(x=>x.toString(16).padStart(2,"0")).join("");
}
function markFsxWaiting(message){
  lastPosition=null;
  const inline=$("#fsxInlineStatus");if(inline)inline.textContent=message;
  $("#positionSource").textContent="FSX";
  $("#positionDot").classList.remove("live");
  ["#posLat","#posLon","#posAlt","#posHdg","#posGs","#posAcc"].forEach(s=>$(s).textContent="—");
  $("#simStatus").textContent=message;
  document.querySelectorAll(".source-card").forEach(x=>x.classList.remove("active"));
  $("#useFsxBtn").classList.add("active");
  hideAircraftMarker();
  setPositionStatus("waiting","POS OFF",message);
}
async function connectFsxRelay(host,{reconnect=false}={}){
  relayHost=host;
  relayTopic=await fsxRelayTopicFor(host);
  if(relayReconnectTimer){clearTimeout(relayReconnectTimer);relayReconnectTimer=null}
  if(relayAwaitPositionTimer){clearTimeout(relayAwaitPositionTimer);relayAwaitPositionTimer=null}
  if(relayPingTimer){clearInterval(relayPingTimer);relayPingTimer=null}
  if(relaySocket){try{relaySocket.onclose=null;relaySocket.close()}catch(_){}relaySocket=null}
  if(!reconnect)markFsxWaiting("Connecting securely to FSX Bridge v1.4 for "+host+" …");
  const clientId="jeppiran_web_"+Math.random().toString(16).slice(2)+Date.now().toString(16);
  let ws;
  try{ws=new WebSocket("wss://demo.tbmq.io/mqtt",["mqtt"])}catch(e){markFsxWaiting("FSX secure relay could not start: "+e.message);return}
  relaySocket=ws;ws.binaryType="arraybuffer";
  let relaySubscribed=false;
  const connectTimeout=setTimeout(()=>{
    if(relaySocket===ws&&!relaySubscribed){
      markFsxWaiting("FSX broker handshake timed out. Check Internet and WSS port 443, then retry.");
      try{ws.close()}catch(_){}
    }
  },12000);
  ws.onopen=()=>{
    if(ws!==relaySocket)return;
    ws.send(mqttConnectPacket(clientId,"demo"));
    markFsxWaiting("Secure relay connected • subscribing to FSX "+host+" …");
    relayPingTimer=setInterval(()=>{if(relaySocket===ws&&ws.readyState===1){try{ws.send(new Uint8Array([0xC0,0x00]))}catch(_){}}},15000);
  };
  ws.onmessage=async e=>{
    if(ws!==relaySocket)return;
    let buf=e.data;
    if(buf instanceof Blob)buf=await buf.arrayBuffer();
    for(const pkt of mqttPackets(buf)){
      const type=pkt.header>>4;
      if(type===2){
        if(pkt.body.length<2||pkt.body[1]!==0){markFsxWaiting("FSX relay broker rejected the connection.");continue}
        try{ws.send(mqttSubscribePacket(relayTopic,1));}catch(_){}
      }else if(type===9){
        relaySubscribed=true;
        clearTimeout(connectTimeout);
        markFsxWaiting("Relay ONLINE • subscribed • waiting for FSX Bridge v1.4 at "+host+" …");
        if(relayAwaitPositionTimer)clearTimeout(relayAwaitPositionTimer);
        relayAwaitPositionTimer=setTimeout(()=>{
          if(ws===relaySocket&&activePositionSource==="fsx"&&!lastPosition){
            markFsxWaiting("Relay ONLINE but NO FSX POSITION after 15s. Verify FSX is running, Bridge v1.4 shows Secure relay: CONNECTED, and the IPv4 matches "+host+".");
          }
        },15000);
      }else if(type===3){
        const b=pkt.body;if(b.length<2)continue;
        const tl=(b[0]<<8)|b[1];if(2+tl>b.length)continue;
        const topic=new TextDecoder().decode(b.slice(2,2+tl));if(topic!==relayTopic)continue;
        let pos=2+tl;
        const qos=(pkt.header>>1)&3;if(qos>0)pos+=2;
        try{
          const d=JSON.parse(new TextDecoder().decode(b.slice(pos))),lat=Number(d.lat),lon=Number(d.lon);
          if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)continue;
          if(relayAwaitPositionTimer){clearTimeout(relayAwaitPositionTimer);relayAwaitPositionTimer=null}
          updatePositionUi({lat,lon,alt:d.alt==null?null:Number(d.alt),heading:d.heading==null?null:Number(d.heading),
            groundspeed:(d.groundspeed??d.groundSpeedMps)==null?null:Number(d.groundspeed??d.groundSpeedMps),
            pitch:d.pitch==null?null:Number(d.pitch),roll:d.roll==null?null:Number(d.roll),accuracy:null,timestamp:Date.now()},"fsx");
          // The universal bridge shares the proven FSX relay transport but reports its detected simulator.
          const detected=String(d.source||"").trim();
          if(detected && detected!=="FSX"){
            const label="SIMULATOR • "+detected;
            const sourceEl=$("#positionSource");if(sourceEl)sourceEl.textContent=label;
            const statusEl=$("#simStatus");if(statusEl)statusEl.textContent=label+" • live";
            const inlineEl=$("#fsxInlineStatus");if(inlineEl)inlineEl.textContent=detected+" LIVE • position received.";
          }
        }catch(_){}
      }
    }
  };
  ws.onerror=()=>{
    clearTimeout(connectTimeout);
    if(ws===relaySocket){
      const msg="FSX secure relay error. Use Bridge v1.4 and check that it shows Secure relay: CONNECTED via TBMQ.";
      markFsxWaiting(msg);
    }
  };
  ws.onclose=()=>{
    if(ws!==relaySocket)return;
    relaySocket=null;
    clearTimeout(connectTimeout);
    if(relayAwaitPositionTimer){clearTimeout(relayAwaitPositionTimer);relayAwaitPositionTimer=null}
    if(relayPingTimer){clearInterval(relayPingTimer);relayPingTimer=null}
    if(activePositionSource==="fsx"&&relayHost){
      markFsxWaiting("FSX relay disconnected • reconnecting…");
      relayReconnectTimer=setTimeout(()=>connectFsxRelay(relayHost,{reconnect:true}).catch(()=>{}),2500);
    }
  };
}

function connectSimulatorBridge(){
  stopGps(); stopBridge();
  const source=bridgeTargetSource,meta=bridgeMeta[source]||bridgeMeta.xplane;
  let url="";
  if(source==="fsx"){
    const host=normalizeBridgeHost(($("#fsxPcIp")&&$("#fsxPcIp").value)||"");
    if(!host){clearPositionUi("Enter the FSX PC IPv4 address.");return}
    localStorage.setItem("fsxPcHost",host);
    activePositionSource=source;localStorage.setItem("positionSource",source);
    if(!LOCAL_SIM_WEB){
      connectFsxRelay(host).catch(e=>markFsxWaiting("FSX relay error: "+e.message));
      return;
    }
    url="ws://"+location.hostname+":"+meta.port;
  }else{
    url=$("#bridgeUrl").value.trim();
    if(!/^wss?:\/\//i.test(url)){clearPositionUi("Bridge URL must start with ws:// or wss://");return}
    localStorage.setItem("bridgeUrl:"+source,url);
    localStorage.setItem("bridgeUrl",url);
    activePositionSource=source;localStorage.setItem("positionSource",source);
  }
  $("#simStatus").textContent="Connecting to "+url+" …";
  try{bridgeSocket=new WebSocket(url)}catch(e){clearPositionUi("Could not open WebSocket: "+e.message);return}
  bridgeSocket.onopen=()=>{$("#simStatus").textContent="Bridge connected • waiting for "+meta.label+" position…"};
  bridgeSocket.onmessage=e=>{
    try{
      const d=JSON.parse(e.data),lat=Number(d.lat),lon=Number(d.lon);
      if(!Number.isFinite(lat)||!Number.isFinite(lon)||lat<-90||lat>90||lon<-180||lon>180)return;
      const packetSource=String(d.source||"").toUpperCase();
      const resolvedSource=packetSource==="FSX"||packetSource.includes("FLIGHT SIMULATOR X")?"fsx":source;
      if(resolvedSource!==activePositionSource){activePositionSource=resolvedSource;localStorage.setItem("positionSource",resolvedSource)}
      updatePositionUi({lat,lon,alt:d.alt==null?null:Number(d.alt),heading:d.heading==null?null:Number(d.heading),
        groundspeed:(d.groundspeed??d.groundSpeedMps)==null?null:Number(d.groundspeed??d.groundSpeedMps),pitch:d.pitch==null?null:Number(d.pitch),roll:d.roll==null?null:Number(d.roll),
        accuracy:null,timestamp:Date.now()},resolvedSource);
    }catch(_){}
  };
  bridgeSocket.onerror=()=>{$("#simStatus").textContent="Bridge connection error. Check the local bridge, PC firewall and network address."};
  bridgeSocket.onclose=()=>{bridgeSocket=null;if(activePositionSource===source)clearPositionUi(meta.label+" bridge disconnected.")};
}
$("#useGpsBtn").addEventListener("click",startDeviceGps);
$("#startGpsBtn").addEventListener("click",startDeviceGps);
$("#useXpBtn").addEventListener("click",()=>{setBridgeTarget("xplane");$("#bridgeUrl").focus()});
$("#useFsxBtn").addEventListener("click",()=>{setBridgeTarget("fsx");$("#fsxPcIp")?.focus()});
$("#connectBridgeBtn").addEventListener("click",()=>{setBridgeTarget("xplane");connectSimulatorBridge()});
window.JEPPIRAN_FsxConnectorReady=true;
window.jeppiranConnectFsx=()=>{
  const btn=$("#connectFsxBtn"),inline=$("#fsxInlineStatus");
  const host=normalizeBridgeHost(($("#fsxPcIp")&&$("#fsxPcIp").value)||"");
  if(!host){
    const msg="Enter the simulator PC IPv4 address first.";
    markFsxWaiting(msg);
    if(inline)inline.textContent=msg;
    $("#fsxPcIp")?.focus();
    if(btn){btn.disabled=false;btn.textContent="CONNECT SIMULATOR"}
    return;
  }
  const msg="SIMULATOR CONNECT • starting secure relay for "+host+" …";
  $("#simStatus").textContent=msg;
  if(inline)inline.textContent=msg;
  try{
    setBridgeTarget("fsx");
    connectSimulatorBridge();
  }catch(e){
    const err="Simulator connection error: "+(e&&e.message?e.message:String(e));
    markFsxWaiting(err);
    if(inline)inline.textContent=err;
    if(btn){btn.disabled=false;btn.textContent="CONNECT SIMULATOR"}
  }
};
$("#disconnectPositionBtn").addEventListener("click",()=>disconnectPosition());
setBridgeTarget(bridgeTargetSource);
if(LOCAL_SIM_WEB){
  ensureLocalFsxSession(true);
}else if(activePositionSource==="gps"){
  setTimeout(startDeviceGps,500);
}else if(activePositionSource==="fsx"&&localStorage.getItem("fsxPcHost")){
  setBridgeTarget("fsx");
  setTimeout(()=>connectFsxRelay(localStorage.getItem("fsxPcHost")).catch(()=>{}),500);
}
/* ===== End position sources ===== */

window.addEventListener("jeppiran-taxi-route-updated",()=>updateAircraftMarker());
window.addEventListener("resize",()=>requestAnimationFrame(()=>{applyChartTransform();updateAircraftMarker()}));
window.addEventListener("orientationchange",()=>setTimeout(()=>{window.dispatchEvent(new Event("resize"));refitSelectedChartForLayout()},180));
window.addEventListener("jeppiran-cdfa-layout-changed",()=>{
  // CDFA occupies its own fixed column, never overlapping the PDF or its gestures.
  if(selectedChart)requestAnimationFrame(()=>refitSelectedChartForLayout());
});
if(new URLSearchParams(location.search).get("platform")!=="android-phone"&&
   "serviceWorker" in navigator&&(location.protocol==="https:"||location.hostname==="localhost")){
  // Never force a mid-session reload when a PWA worker is updated.
  // Let the browser activate waiting updates at the next natural reopen.
  navigator.serviceWorker.register("./service-worker.js",{updateViaCache:"none"}).catch(()=>{});
}
// Called by the Android system Back *gesture*; no floating Back button.
// Prefer moving up one in-app level rather than leaving the offline APK.
window.jeppiranAndroidBack=function(){
  const chartsView=$("#chartsView");
  if(chartsView?.classList.contains("active")){
    if(jpChartDrawerOpen){setFullscreenChartDrawer(false);return true}
    if(chartsView.classList.contains("jp-airport-picker-open")){closeAirportPicker();return true}
    if(selectedChart){
      cancelChartSwipe();
      if(document.body.classList.contains("viewer-fullscreen"))exitViewerFullscreen(true);
      selectAirport(selectedAirport);
      return true;
    }
    route("home");
    return true;
  }
  if(!$("#homeView").classList.contains("active")){route("home");return true}
  return false;
};
loadData();
const start=(location.hash||"#home").slice(1); const initial=["home","charts","wx","simulator","update"].includes(start)?start:"home"; renderRoute(initial); if(!location.hash)history.replaceState({route:initial},"","#"+initial);
if(initial==="update")refreshWebUpdates();
