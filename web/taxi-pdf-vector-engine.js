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
  const Broot=spine[0];
  const Bjoin=nearest(Broot,B);
  if(!Bjoin||Bjoin.distance>0.25||dist(Broot,B[0])<2)
    throw Error("Runway-facing B spur does not intersect original A centreline");
  const bounds={left:0,top:0,right:source.chart.width,bottom:source.chart.height};
  function route(tokens,globalPage){
    if(Number(globalPage)!==source.chart.globalPage)return {ok:false,error:"Other chart page"};
    if(!Array.isArray(tokens)||tokens.length!==3||tokens[1]!=="A"||tokens[2]!=="B")
      return {ok:false,error:"Named chart-vector segment not yet traced"};
    const stand=String(tokens[0]).match(/^ST([1-6])$/)?.[1];
    if(!stand)return {ok:false,error:"Stand vector lead not traced"};
    let path=[],rawIds=meta.standSourcePaths[stand];
    for(const id of rawIds){
      let seg=stroke(id);
      if(path.length&&dist(path.at(-1),seg[0])>dist(path.at(-1),seg.at(-1)))seg=seg.reverse();
      const join=path.length?dist(path.at(-1),seg[0]):0;
      if(join>(meta.maxCurveJoinGapPt||.8))
        return {ok:false,error:"PDF stand curve discontinuity at "+id+" ("+join.toFixed(2)+" pt)"};
      if(!path.length)path.push(...seg);
      else path.push(...(join<.15?seg.slice(1):seg));
    }
    const hit=nearest(path.at(-1),spine);
    if(!hit||hit.distance>(meta.maxSpineJoinGapPt||1))
      return {ok:false,error:"Stand curve misses chart A spine"};
    if(hit.distance>.1)path.push(hit.point);
    path.push(...spine.slice(0,hit.segmentIndex+1).reverse());
    path.push(B[0]);
    if(path.some(q=>!Array.isArray(q)||q.length!==2||q.some(v=>!Number.isFinite(v))||
        q[0]<bounds.left||q[0]>bounds.right||q[1]<bounds.top||q[1]>bounds.bottom))
      return {ok:false,error:"Out-of-page source-PDF vector"};
    return {ok:true,points:path,chartWidth:source.chart.width,chartHeight:source.chart.height,
      qaOnly:true,runwayAccessApproved:false,sourceSha:source.source.sha256,
      maxStandJoinGapPdfPoints:hit.distance,
      notice:"VECTOR-TRACED CHART QA ONLY. Stand connections and B are not verified hold positions; PDF points are not metres or GPS coordinates."};
  }
  return {airport:source.airport,chart:source.chart,route};
}
const api={version:"1.0.0",build};
root.JEPPIRAN_TAXI_PDF_VECTOR=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
