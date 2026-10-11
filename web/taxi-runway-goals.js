/* OIMM runway designators → source-bound chart ACCESS targets.
 * RWY 13L is represented only by H's mapped far endpoint (ADC p601).
 * The actual RWY 13L threshold and H hold-short are NOT measured.
 * RWY 31R has no approved graph connection: never fabricate one.
 * Public API used by both typed sequences and destination-only routes.
 */
(function(root){
"use strict";
const VALID=new Set(["13R","31L","13L","31R"]);
const canon=s=>String(s||"").trim().toUpperCase()
  .replace(/^RUNWAY\s*/,"").replace(/^RWY\s*/,"");
function recognize(s){return VALID.has(canon(s))}
function goal(g,token){
 const id=canon(token);
 if(!VALID.has(id))return {error:"Unrecognized runway: "+token};
 if(!g||g.airport!=="OIMM"||g.cycle!=="2621"||!g.simulatorTestOnly)
   return {error:"Matching OIMM V2621 chart ground graph unavailable."};
 if(id==="13R"||id==="31L"){
   const access=id==="13R"?"J":"A",node=g.taxiways?.[access]?.exitNode;
   if(!node||!g.nodes?.[node]||!g.holdNodes?.[node])
     return {error:"RWY "+id+" has no matching chart-labelled holding node."};
   return {name:"RWY "+id,runway:id,kind:"runway-hold",
     node,approachTaxiway:access,warning:"HOLD SHORT AT "+access+
     ". No threshold or runway-entry centreline is mapped."};
 }
 if(id==="13L"){
   // The opposite side of H is the end of the chart-digitized paved connector.
   // It is NOT proof of a RWY 13L threshold, holding line or runway entry.
   const node=g.taxiways?.H?.nodes?.at(-1);
   if(!node||!g.nodes?.[node])
     return {error:"RWY 13L: far endpoint of TWY H is not mapped."};
   return {name:"RWY 13L (H ACCESS QA)",runway:id,kind:"runway-access-qa",
     node,approachTaxiway:"H",
     warning:"END OF MAPPED TWY H TOWARD RWY 13L · NOT A SURVEYED HOLD, THRESHOLD OR RUNWAY ENTRY"};
 }
 return {error:"RWY 31R recognized, but no independently mapped threshold/holding connector is available for it. No fictitious route."};
}
const api={recognize,canon,goal,knownRunways:[...VALID]};
root.JEPPIRAN_OIMM_RUNWAY_GOALS=api;
if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
