/* JEPPIRAN OIII Mehrabad native-chart survey layers.
 * Real source-PDF runway black polygons + printed native label positions.
 * No invented connections from text proximity and NEVER a taxi clearance.
 */
(function(root){"use strict";
function compose(data,page,selected=""){
  if(data?.schemaVersion!==2||data?.airport!=="OIII"||
     data.approval!=="SOURCE_VISUAL_INVENTORY_ONLY"||
     data.readiness?.networkConnectivityValidated!==false||
     data.readiness?.allTaxiwayCenterlinesTraced!==false||
     data.source?.coordinateSpace!=="PDF_POINTS_TOP_LEFT")
    return {ok:false,error:"OIII source inventory not validated"};
  page=Number(page);
  if(page!==430&&page!==432)return {ok:false,error:"Not a Mehrabad ADC or parking chart"};
  const width=data.source.pdfSize[0],height=data.source.pdfSize[1];
  const runway=page===430?data.runwayPolygons.map(r=>({
    id:r.physicalId,pdfDrawingId:r.sourcePdfDrawingId,
    outline:r.polygonPdfPoints,axis:r.axisPdfPoints,
    publishedLengthM:r.publishedLengthM,
    category:"ORIGINAL_CHART_BLACK_RUNWAY_POLYGON",
    navigationApproved:false
  })):[];
  const stands=page===432?data.stands.map(s=>({
    id:s.id,x:s.source.x,y:s.source.y,apron:s.apron,
    selected:selected===("ST"+s.id),
    category:"PUBLISHED_STAND_LABEL_NOT_NOSE_COORDINATE",
    leadGeometryVerified:false
  })):[];
  const taxiLabels=data.taxiways.flatMap(t=>t.sourceLabelPositions.filter(p=>p.page===page)
    .map(p=>({id:t.id,x:p.x,y:p.y,selected:selected===t.id,
      centerlineKnown:false,category:"PUBLISHED_TAXIWAY_NAME_NOT_ENDPOINT"})));
  return {ok:true,airport:"OIII",page,width,height,runways:runway,stands,taxiLabels,
    qaOnly:true,noRouteDrawn:true};
}
const api={version:"1.0.0",compose};
root.JEPPIRAN_TAXI_OIII_LAYER=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
