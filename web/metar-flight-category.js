/* JEPPIRAN METAR flight-rule category — presentation only.
 * METAR-based aviation weather classification; NOT operational flight advice.
 * Weather color contract: VFR green, MVFR yellow, IFR blue, LIFR red.
 * Limits (US categorical convention): VFR >3000ft/>5SM;
 * MVFR 1000–3000ft or 3–5SM; IFR 500–<1000ft or 1–<3SM;
 * LIFR <500ft or <1SM. Lowest applicable category wins.
 */
((host) => {
  "use strict";
  const SM_METERS = 1609.344;
  const UNKNOWN = Object.freeze({
    code:"UNKNOWN",label:"WX —",description:"Insufficient METAR ceiling or visibility data",
    ceilingFt:null,visibilitySm:null
  });
  const allowed = ["VFR","MVFR","IFR","LIFR"];
  function visibilityInSm(tokens) {
    for (let i=0;i<tokens.length;i++) {
      const t=tokens[i];
      if (t==="CAVOK")return Infinity;
      // Prevailing metric visibility. Excludes RVR (R27/...), QNH and runway
      // directional variation; NDV indicates no directional variation.
      const metric=t.match(/^(\d{4})(?:NDV)?$/);
      if (metric)return Number(metric[1])===9999?Infinity:Number(metric[1])/SM_METERS;
      const sm=t.match(/^(M|P)?(?:(\d+)\/(\d+)|(\d+(?:\.\d+)?))SM$/);
      if (!sm)continue;
      let v=sm[2]?Number(sm[2])/Number(sm[3]):Number(sm[4]);
      if (sm[2] && i>0 && /^\d{1,2}$/.test(tokens[i-1]))v+=Number(tokens[i-1]);
      if(!Number.isFinite(v)||v<0)return null;
      if(sm[1]==="M")v=Math.max(0,v-.001);
      if(sm[1]==="P")v+=.001;
      return v;
    }
    return null;
  }
  function ceilingFeet(tokens) {
    if(tokens.includes("CAVOK"))return Infinity;
    let ceiling=Infinity, hasSky=false, unknownBase=false;
    for(const token of tokens) {
      if(/^(?:SKC|CLR|NSC|NCD)$/.test(token))hasSky=true;
      const match=token.match(/^(FEW|SCT|BKN|OVC|VV)(\d{3}|\/\/\/)(?:CB|TCU)?$/);
      if (!match)continue;
      hasSky=true;
      if(["BKN","OVC","VV"].includes(match[1])) {
        if(match[2]==="///")unknownBase=true;
        else ceiling=Math.min(ceiling, Number(match[2])*100);
      }
    }
    return !hasSky||unknownBase?null:ceiling;
  }
  function visSeverity(v) {
    if(v<1)return 3;
    if(v<3)return 2;
    if(v<=5)return 1;
    return 0;
  }
  function ceilingSeverity(v) {
    if(v<500)return 3;
    if(v<1000)return 2;
    if(v<=3000)return 1;
    return 0;
  }
  function classify(raw) {
    if(typeof raw!=="string"||!raw.trim())return UNKNOWN;
    const clean=raw.toUpperCase().replace(/\s+/g," ").trim();
    let tokens=clean.split(" ");
    // Do not consume later trend or remark periods as current observations.
    const stop=tokens.findIndex(t=>/^(?:RMK|REMARKS|TEMPO|BECMG|NOSIG|PROB\d{2}|FM\d{6})$/.test(t));
    if(stop>=0)tokens=tokens.slice(0,stop);
    // A recognizable actual METAR observation is required, not an arbitrary
    // TAF, decoded prose string, or a stale status/error message.
    if(tokens.includes("TAF") || tokens.includes("NIL") || tokens.includes("CNL") ||
       !tokens.some(t=>/^[A-Z]{4}$/.test(t)) ||
       !tokens.some(t=>/^\d{6}Z$/.test(t)))return UNKNOWN;
    const visibilitySm=visibilityInSm(tokens);
    const ceilingFt=ceilingFeet(tokens);
    if(visibilitySm===null&&ceilingFt===null)return UNKNOWN;
    const vis=visibilitySm===null?-1:visSeverity(visibilitySm);
    const ceiling=ceilingFt===null?-1:ceilingSeverity(ceilingFt);
    const worst=Math.max(vis,ceiling);
    // Even with a missing input, a definitively observed LIFR condition can
    // safely be identified. Lesser categories need both values reported.
    if(worst<0 || (worst<3 && (visibilitySm===null || ceilingFt===null)))return UNKNOWN;
    const code=allowed[worst];
    const ceilText=ceilingFt===Infinity?"no reported ceiling":ceilingFt===null?"ceiling unavailable":ceilingFt.toLocaleString("en-US")+" ft ceiling";
    const visText=visibilitySm===Infinity?"> 10 km visibility":visibilitySm===null?"visibility unavailable":(visibilitySm*SM_METERS/1000).toFixed(1)+" km visibility";
    return {code,label:code,description:"METAR: "+ceilText+" · "+visText,ceilingFt,visibilitySm};
  }
  const api=Object.freeze({classify,visibilityInSm,ceilingFeet});
  host.JEPPIRAN_FLIGHT_CATEGORY=api;
  if(typeof module!=="undefined"&&module.exports)module.exports=api;
})(typeof window!=="undefined"?window:globalThis);
