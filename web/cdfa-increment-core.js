/* JEPPIRAN CDFA next-increment selection — additive QA-only display helper.
 * No modification to computed altitudes, published constraints or VDP order.
 */
(function(root,factory){
  const api=factory();
  if(typeof module==="object"&&module.exports)module.exports=api;
  if(root)root.JEPPIRAN_CDFA_NEXT_CORE=api;
})(typeof globalThis!=="undefined"?globalThis:this,function(){
  "use strict";
  function targetIndex(rows,reading,previous=-1){
    if(!Array.isArray(rows)||!Number.isFinite(reading))return -1;
    // On an inbound approach, the next increment is the highest displayed
    // DME strictly LOWER than the present DME, including the final VDP row.
    let selected=-1;
    for(let i=0;i<rows.length;i++){
      const d=Number(rows[i].dme);
      if(Number.isFinite(d)&&d<reading-0.001){selected=i;break;}
    }
    // A small Schmitt band prevents simulator DME noise making lines jitter
    // between adjacent increments at the exact crossing.
    if(previous>=0&&selected!==previous&&previous<rows.length){
      const prior=Number(rows[previous].dme);
      const boundary=selected>previous?prior:
        selected>=0?Number(rows[selected].dme):prior;
      if(Number.isFinite(boundary)&&Math.abs(reading-boundary)<0.035)return previous;
    }
    return selected;
  }
  function validatedReading(packet,record){
    if(!packet||!record||!record.referenceDmeId)return null;
    const reading=packet.dme&&typeof packet.dme==="object"?packet.dme:null;
    const id=String(reading?.id??packet.dmeId??"").trim().toUpperCase();
    const nm=reading?.nm??packet.dmeNm;
    if(!id||id!==String(record.referenceDmeId).trim().toUpperCase()||
      typeof nm!=="number"||!Number.isFinite(nm)||nm<0||nm>300)return null;
    // A chart identity is compulsory: never select a DME merely because a
    // simulator happens to tune a transmitter with the same ident.
    if(String(packet.cdfaIcao||"").toUpperCase()!==String(record.icao||"").toUpperCase()||
       Number(packet.cdfaPage)!==Number(record.sourcePage))return null;
    return nm;
  }

  // Visual QA estimate only; site must be the CDFA chart's own DME site.
  // Never derive DME from an airport ARP, runway, or unverified chart georef.
  function degrees(dms,latitude){
    if(typeof dms!=="string")return null;
    const match=dms.match(latitude?/^(\d{2})(\d{2})(\d{2}(?:\.\d+)?)([NS])$/:/^(\d{3})(\d{2})(\d{2}(?:\.\d+)?)([EW])$/);
    if(!match)return null;
    const d=Number(match[1]),m=Number(match[2]),s=Number(match[3]);
    if(m>=60||s>=60)return null;
    const value=d+m/60+s/3600;
    if(value>(latitude?90:180))return null;
    return (/[SW]/.test(match[4])?-1:1)*value;
  }
  function estimatedReading(packet,record,stationCatalogue){
    if(!packet||!record||!stationCatalogue||!/^OI[A-Z]{2}$/.test(String(record.icao||"")))return null;
    const id=String(record.referenceDmeId||"").trim().toUpperCase();
    if(!id||id!==String(record.dmeStationCandidate||"").trim().toUpperCase())return null;
    if(record.distanceReference?.navaidColocationVerified===false)return null;
    const site=stationCatalogue[id];
    if(!site)return null;
    const latitude=degrees(site.latDms,true),longitude=degrees(site.lonDms,false);
    if(latitude===null||longitude===null)return null;
    const lat=packet.lat,lon=packet.lon;
    if(typeof lat!=="number"||typeof lon!=="number"||!Number.isFinite(lat)||!Number.isFinite(lon)||
       lat < -90||lat >90||lon < -180||lon >180)return null;
    if(String(packet.source||"").toLowerCase()==="gps"){
      if(Number.isFinite(packet.accuracy)&&packet.accuracy>250)return null;
      if(Number.isFinite(packet.timestamp)&&Math.abs(Date.now()-packet.timestamp)>6000)return null;
    }
    const rad=Math.PI/180,a=(lat-latitude)*rad,b=(lon-longitude)*rad;
    const term=Math.sin(a/2)**2+Math.cos(lat*rad)*Math.cos(latitude*rad)*Math.sin(b/2)**2;
    const groundNm=2*3440.065*Math.asin(Math.min(1,Math.sqrt(Math.max(0,term))));
    let nm=groundNm,mode="ground_estimate";
    // Slant range = sqrt(surface_range² + height_difference²).
    // Device GPS ellipsoid height may not match the AIP antenna MSL datum;
    // this can only be an approximation, never a measured DME indication.
    if(typeof packet.alt==="number"&&Number.isFinite(packet.alt)&&
       typeof site.elevationFt==="number"&&Number.isFinite(site.elevationFt)){
      const verticalNm=(packet.alt-site.elevationFt*0.3048)/1852;
      nm=Math.hypot(groundNm,verticalNm);
      mode="slant_estimate";
    }
    if(!Number.isFinite(nm)||nm>300)return null;
    return {nm,groundNm,mode,stationId:id};
  }
  return {targetIndex,validatedReading,estimatedReading};
});
