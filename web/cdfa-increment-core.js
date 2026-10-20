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
  return {targetIndex,validatedReading};
});
