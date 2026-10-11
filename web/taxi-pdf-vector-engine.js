/* JEPPIRAN chart-vector graph overlay.
 * Generic source-PDF path compiler: never guesses a road from text proximity.
 * It renders ADC PDF-space lines ONLY after the named ground topology is
 * independently accepted by taxi-survey-engine.js. Simulator chart QA, NOT
 * geographic positioning or operational taxi guidance.
 */
(function(root){"use strict";
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
function sample(items){
  const points=[];
  for(const it of items||[]){
    const [kind,...q]=it;
    if(kind!=="c"&&kind!=="l")throw Error("Unsupported PDF path operator");
    const segment=kind==="l"?[q[0],q[1]]:Array.from({length:13},(_,i)=>{
      const t=i/12,u=1-t;
      return [0,1].map(j=>u*u*u*q[0][j]+3*u*u*t*q[1][j]+
        3*u*t*t*q[2][j]+t*t*t*q[3][j]);
    });
    if(!points.length)points.push(...segment);
    else if(dist(points.at(-1),segment[0])<=0.2)points.push(...segment.slice(1));
    else throw Error("Discontinuous PDF stroke operator");
  }
  return points;
}
function nearest(q,poly){
  let best=null;
  for(let i=0;i<poly.length-1;i++){
    const p=poly[i],r=poly[i+1],vx=r[0]-p[0],vy=r[1]-p[1],den=vx*vx+vy*vy;
    if(den<=0)continue;
    const t=Math.max(0,Math.min(1,((q[0]-p[0])*vx+(q[1]-p[1])*vy)/den));
    const pos=[p[0]+vx*t,p[1]+vy*t],d=dist(q,pos);
    if(!best||d<best.distance)best={distance:d,segmentIndex:i,point:pos};
  }
  return best;
}
function build(source){
  if(!source||source.schemaVersion!==1||source.qaOnly!==true||
     source.notForActualNavigation!==true||source.runwayAccessApproved!==false||
     source.coordinateSystem!=="PDF_POINTS_TOP_LEFT"||
     !/^[a-f0-9]{64}$/.test(source.source?.sha256||"")||
     !Number.isInteger(source.chart?.globalPage))
    throw Error("Chart vector provenance or QA-only status invalid");
  const meta=source.vector,stroke=id=>{
    const items=meta.primitives[id];
    if(!items?.length)throw Error("Missing original PDF primitive "+id);
    return sample(items);
  };
  const spine=meta.apronSpine.flatMap((id,i)=>i?stroke(id):stroke(id));
  if(!spine.length)throw Error("Untraced apron spine");
  const B=stroke(meta.runwaySideConnector);
  const Broot=spine[0],Bjoin=nearest(Broot,B);
  if(!Bjoin||Bjoin.distance>0.25||dist(Broot,B[0])<2)
    throw Error("Taxi B spur must intersect original A centreline");
  const branchPaths={};
  for(const [label,spec] of Object.entries(meta.taxiwayBranches||{})){
    if(!["B","C","D"].includes(label)||spec.holdVerified!==false)
      throw Error("Runway gate safety/provenance mismatch");
    if(label==="B"){branchPaths.B={join:nearest(Broot,spine),points:[Broot,B[0]]};continue}
    let points=[];
    for(const id of spec.pathIds){
      let seg=stroke(id);
      if(points.length&&dist(points.at(-1),seg[0])>dist(points.at(-1),seg.at(-1)))
        seg=seg.reverse();
      const d=points.length?dist(points.at(-1),seg[0]):0;
      if(d>(meta.maxCurveJoinGapPt||.8))
        throw Error("PDF "+label+" taxiway curve gap "+d.toFixed(2)+" pt");
      points.push(...(points.length&&d<.15?seg.slice(1):seg));
    }
    const join=nearest(points[0],spine);
    if(!join||join.distance>.3)
      throw Error("Taxi "+label+" source stroke does not meet apron spine");
    branchPaths[label]={join,points};
  }
  const bounds={left:0,top:0,right:source.chart.width,bottom:source.chart.height};
  function route(tokens,globalPage){
    if(Number(globalPage)!==source.chart.globalPage)return {ok:false,error:"Other chart page"};
    const label=Array.isArray(tokens)?tokens[2]:null;
    if(!Array.isArray(tokens)||tokens.length!==3||tokens[1]!=="A"||
       !["B","C","D"].includes(label)||!branchPaths[label])
      return {ok:false,error:"Named chart-vector segment not yet traced"};
    const stand=String(tokens[0]).match(/^ST([1-6])$/)?.[1];
    if(!stand)return {ok:false,error:"Stand vector lead not traced"};
    const branch=branchPaths[label];
    let path=[],rawIds=meta.standSourcePaths[stand];
    for(const id of rawIds){
      let seg=stroke(id);
      if(path.length&&dist(path.at(-1),seg[0])>dist(path.at(-1),seg.at(-1)))seg=seg.reverse();
      const gap=path.length?dist(path.at(-1),seg[0]):0;
      if(gap>(meta.maxCurveJoinGapPt||.8))
        return {ok:false,error:"PDF stand curve discontinuity at "+id+" ("+gap.toFixed(2)+" pt)"};
      if(!path.length)path.push(...seg);
      else path.push(...(gap<.15?seg.slice(1):seg));
    }
    const entry=nearest(path.at(-1),spine),target=branch.join;
    if(!entry||entry.distance>(meta.maxSpineJoinGapPt||1))
      return {ok:false,error:"Stand curve misses chart A spine"};
    if(entry.distance>.1)path.push(entry.point);
    // Travel on the SAME vector-traced A line in the required direction,
    // preserving curve vertices and the small A lettering gap.
    const a=entry.segmentIndex,b=target.segmentIndex;
    if(a<=b)path.push(...spine.slice(a+1,b+1));
    else path.push(...spine.slice(b+1,a+1).reverse());
    if(dist(path.at(-1),target.point)>.1)path.push(target.point);
    if(dist(path.at(-1),branch.points[0])>.3)
      return {ok:false,error:"Source taxiway fork does not meet A"};
    path.push(...branch.points.slice(1));
    if(path.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v))||
        q[0]<bounds.left||q[0]>bounds.right||q[1]<bounds.top||q[1]>bounds.bottom))
      return {ok:false,error:"Out-of-page source-PDF vector"};
    const overviewRaw=source.overviewPreview?.entranceByTaxiway?.[label];
    const overview=source.overviewPreview?.status==="DIAGRAM_ONLY_NOT_STAND_SURVEY"&&
      source.overviewPreview?.chartPage===source.chart.globalPage&&
      Array.isArray(overviewRaw)&&overviewRaw.length>=2&&
      overviewRaw.every(p=>Array.isArray(p)&&p.length===2&&
        p.every(Number.isFinite)&&p[0]>=0&&p[0]<=source.chart.width&&
        p[1]>=0&&p[1]<=source.chart.height)?
      {points:overviewRaw.map(p=>p.slice()),quality:"OVERVIEW_SCHEMATIC_ONLY",
       noIndividualStandLocation:true}:null;
    return {ok:true,points:path,overview,chartWidth:source.chart.width,chartHeight:source.chart.height,
      qaOnly:true,runwayAccessApproved:false,sourceSha:source.source.sha256,
      maxStandJoinGapPdfPoints:entry.distance,
      notice:"SOURCE-PDF VECTOR-TRACED CHART QA ONLY. B/C/D and stands are not verified runway hold nodes. Coordinates are NOT WGS84 or metres."};
  }
  return {airport:source.airport,chart:source.chart,route};
}
const api={version:"1.1.0",build};
root.JEPPIRAN_TAXI_PDF_VECTOR=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
