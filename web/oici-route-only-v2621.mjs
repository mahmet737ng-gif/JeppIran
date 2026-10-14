// JEPPIRAN OICI flight QA: NOT TO SCALE charts, route-centerline ONLY.
// Never use as an affine whole-chart georeference or for actual navigation.
const RAD=Math.PI/180;
const SHA="d86b5b5e262a775f8e91d28a403f4b163992dbdd1733ca28e1ba6";
export function validateOiciRoutes(data,manifest,charts){
  if(data?.schemaVersion!==1||data.type!=="ROUTE_ONLY_NON_AFFINE_GEOREFERENCE"||
     data.cycle!=="V2621"||data.safeForActualNavigation!==false||
     data.source?.sha256!==SHA||data.source?.pageCount!==1654||
     manifest?.version!=="V2621"||manifest?.source_sha256!==SHA||
     !Array.isArray(data.charts)||data.charts.length!==2)return false;
  const pages=new Set();
  for(const c of data.charts){
    const chart=charts.find(x=>Number(x.page)===c.page);
    if(![207,209].includes(c.page)||pages.has(c.page)||c.airport!=="OICI"||
       c.nonAffine!==true||c.validation?.notToScale!==true||
       c.validation?.fullPageGeoreferencingPermitted!==false||
       c.pdfSize?.width!==612||c.pdfSize?.height!==792||
       !Number.isFinite(c.crossTrackRenderGateNm)||c.crossTrackRenderGateNm<=0||
       c.crossTrackRenderGateNm>0.5||!(/^[0-9a-f]{64}$/).test(c.sourceFingerprint)||
       !chart||chart.airport!==c.airport||
       c.chartKey!==[chart.airport,chart.category.toUpperCase(),chart.chart_number,chart.name.toUpperCase()].join("|"))return false;
    if(!Array.isArray(c.waypoints)||c.waypoints.length!==(c.page===207?3:2)||
       c.waypoints[0].id!=="ILM"||c.waypoints.at(-1).id!=="ALTET"||
       (c.page===207&&c.waypoints[1].id!=="D18.0_ILM"))return false;
    for(let i=0;i<c.waypoints.length;i++){
      const p=c.waypoints[i];
      if(![p.pdfX,p.pdfY,p.lat,p.lon,p.nmFromILM].every(Number.isFinite)||
         p.pdfX<0||p.pdfX>612||p.pdfY<0||p.pdfY>792||
         p.lat<33||p.lat>34||p.lon<46||p.lon>48||
         (i>0&&p.nmFromILM<=c.waypoints[i-1].nmFromILM))return false;
    }
    if(c.waypoints[0].nmFromILM!==0||Math.abs(c.waypoints.at(-1).nmFromILM-30.0783829)>0.001)return false;
    pages.add(c.page);
  }
  return pages.size===2;
}
export function buildOiciRouteModel(c){
  const a=c.waypoints[0],b=c.waypoints.at(-1),lonScale=60*Math.cos(((a.lat+b.lat)/2)*RAD);
  const dx=(b.lon-a.lon)*lonScale,dy=(b.lat-a.lat)*60,norm2=dx*dx+dy*dy;
  if(!Number.isFinite(norm2)||norm2<100)return null;
  return {page:c.page,routeOnly:true,qaOnly:true,width:612,height:792,
    anchors:c.waypoints,gate:c.crossTrackRenderGateNm,a,b,dx,dy,norm2,
    lonScale,total:b.nmFromILM};
}
export function projectOiciRoute(m,lat,lon){
  if(!m?.routeOnly||!Number.isFinite(lat)||!Number.isFinite(lon)||
     lat<-90||lat>90||lon<-180||lon>180)return null;
  const east=(lon-m.a.lon)*m.lonScale,north=(lat-m.a.lat)*60;
  const fraction=(east*m.dx+north*m.dy)/m.norm2;
  const cross=Math.abs(east*m.dy-north*m.dx)/Math.sqrt(m.norm2);
  if(fraction < -0.00001||fraction>1.00001||cross>m.gate)return null;
  const distance=Math.max(0,Math.min(1,fraction))*m.total;
  let idx=m.anchors.length-2;
  for(let i=0;i<m.anchors.length-1;i++)
    if(distance<=m.anchors[i+1].nmFromILM+1e-6){idx=i;break;}
  const a=m.anchors[idx],b=m.anchors[idx+1];
  const f=Math.max(0,Math.min(1,(distance-a.nmFromILM)/(b.nmFromILM-a.nmFromILM)));
  return {x:a.pdfX+(b.pdfX-a.pdfX)*f,y:a.pdfY+(b.pdfY-a.pdfY)*f,segment:idx};
}
export function headingOiciRoute(m,lat,lon,heading,width,height){
  const p=projectOiciRoute(m,lat,lon);
  if(!p||!Number.isFinite(heading))return 0;
  const a=m.anchors[p.segment],b=m.anchors[p.segment+1];
  const dx=(b.pdfX-a.pdfX)*width/m.width,dy=(b.pdfY-a.pdfY)*height/m.height;
  const chartCourse=Math.atan2(dx,-dy)/RAD;
  const trueCourse=Math.atan2(m.dx,m.dy)/RAD;
  return ((chartCourse+heading-trueCourse+540)%360)-180;
}
