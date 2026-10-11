/* JEPPIRAN taxi diagram-inset preview renderer data guard (SIM QA ONLY).
 * Never computes position, invents a taxi link or marks a source as verified.
 * A segment without a screenshot-registered chart polyline remains invisible.
 * Browser: JEPPIRAN_TAXI_INSET; Node: require('taxi-inset-preview.js').
 */
(function(root){"use strict";
const finite=p=>p&&Number.isFinite(p.x)&&Number.isFinite(p.y);
const dist=(a,b)=>Math.hypot(a.x-b.x,a.y-b.y);
function route(graph,path,page){
  const bounds=graph?.previewChartInsetBounds;
  const known=graph?.previewChartPixelPoints,segments=graph?.previewChartEdgePaths;
  if(graph?.qaPreviewOnly!==true||graph?.verified!==false||graph?.enabled!==false||
     !bounds||!known||!segments||Number(page)!==Number(bounds.chartPage))
    return {ok:false,error:"No authorized QA inset for this chart"};
  if(!Number.isFinite(bounds.left)||!Number.isFinite(bounds.right)||
     !Number.isFinite(bounds.top)||!Number.isFinite(bounds.bottom)||
     bounds.left>=bounds.right||bounds.top>=bounds.bottom)
    return {ok:false,error:"Invalid inset bounds"};
  if(!Array.isArray(path)||path.length<2)
    return {ok:false,error:"No centerline nodes"};
  const output=[];
  for(let i=1;i<path.length;i++){
    const a=path[i-1],b=path[i];
    const fwd=segments[a+">"+b],back=segments[b+">"+a];
    const pts=Array.isArray(fwd)?fwd:(Array.isArray(back)?back.slice().reverse():null);
    if(!pts||pts.length<2)
      return {ok:false,error:"Unreviewed inset centerline "+a+" → "+b};
    if(!finite(known[a])||!finite(known[b])||
       pts.some(p=>!finite(p)||p.x<bounds.left||p.x>bounds.right||p.y<bounds.top||p.y>bounds.bottom)||
       dist(pts[0],known[a])>.75||dist(pts.at(-1),known[b])>.75)
      return {ok:false,error:"Out-of-inset or disconnected QA polyline "+a+" → "+b};
    if(i===1)output.push(...pts.map(p=>({x:p.x,y:p.y})));
    else{
      if(dist(output.at(-1),pts[0])>.75)
        return {ok:false,error:"Schematic join gap between edges"};
      output.push(...pts.slice(1).map(p=>({x:p.x,y:p.y})));
    }
  }
  return {ok:true,points:output,bounds:{left:bounds.left,right:bounds.right,top:bounds.top,bottom:bounds.bottom},
    qaOnly:true,dashed:true,source:"SOURCE SCREENSHOT QA, NOT SURVEYED"};
}
const api={version:"1.0.0",route};
root.JEPPIRAN_TAXI_INSET=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
