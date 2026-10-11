/* JEPPIRAN — approved ADC-inspired airport-card background (Template 2).
 * Read-only display decoration, never for actual navigation.
 * Source for runway orientations is the cycle's airport-runways.json
 * (ADC-derived, not necessarily true, some records unreviewed).
 * This draws a runway schematic, NOT invented taxiway geometry or stand data.
 * No change to chart georeferencing, aircraft positioning or taxi routing.
 * Future airports automatically inherit this style; if runway records are
 * unavailable, show a neutral navigation-grid motif until supplied.
 */
(() => {
  "use strict";
  const list = document.getElementById("airportList");
  if (!list) return;
  const artwork = new Map();
  let airportRunways = Object.create(null);
  let pending = false;

  function safeCode(v) { const s=String(v||"").trim().toUpperCase();return /^[A-Z0-9]{4}$/.test(s)?s:null; }
  function safeRunway(v) { return String(v||"").trim().toUpperCase().replace(/[^0-9LCR]/g,"").slice(0,4); }
  function h32(s) { let h=2166136261;for(const c of s){h=Math.imul(h^c.charCodeAt(0),16777619);}return h>>>0; }
  function opposite(name) {
    const m=/^(\d{1,2})([LCR]?)$/.exec(name);
    if(!m)return "";
    const n=Number(m[1]);if(n<1||n>36)return "";
    return String(((n+17)%36)+1).padStart(2,"0") + ({L:"R",R:"L",C:"C"}[m[2]]||"");
  }
  function strips(icao) {
    const raw=Array.isArray(airportRunways[icao])?airportRunways[icao]:[];
    const found=new Map();
    for(const r of raw){
      const name=safeRunway(r.name);
      const oppositeName=opposite(name);
      if(!name||!oppositeName)continue;
      const key=[name,oppositeName].sort().join("/");
      const deg=Number(r.headingAdc);
      if(!found.has(key))found.set(key,{name,oppositeName,angle:Number.isFinite(deg)&&deg>=0&&deg<=360?deg:parseInt(name,10)*10});
    }
    return Array.from(found.values()).slice(0,6);
  }
  function xml(s) {return String(s).replace(/[&<>"']/g,ch=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&apos;"}[ch]));}
  function makeSvg(icao,light) {
    const seed=h32(icao),rs=strips(icao);
    const bg=light?"#eaf7ff":"#061c31";
    const grid=light?"#88bad5":"#27759e";
    const main=light?"#178abb":"#3cc4ee";
    const label=light?"#32708f":"#8cdaf7";
    const tx=light?"#a3c7dc":"#174768";
    const centerX=608,centerY=81;
    let art="";
    for(let i=0;i<rs.length;i++){
      const r=rs[i];
      const dx=(i-(rs.length-1)/2)*Math.min(43,145/Math.max(1,rs.length-1));
      const dy=(i%2?4:-4);
      const w=rs.length>3?13:18;
      art+=`<g transform="translate(${centerX+dx} ${centerY+dy}) rotate(${r.angle.toFixed(2)})">`
        +`<rect x="${-w/2-3}" y="-74" width="${w+6}" height="148" rx="2" fill="none" stroke="${main}" stroke-width=".8" opacity=".35"/>`
        +`<rect x="${-w/2}" y="-71" width="${w}" height="142" rx="1" fill="${tx}" stroke="${main}" stroke-width="1.8" opacity=".88"/>`
        +`<path d="M0 -64V64" stroke="${light?"#f5feff":"#d4f7ff"}" stroke-width="1.2" stroke-dasharray="6 6" opacity=".88"/>`
        +`<path d="M${-w/2+2} -57h${w-4}M${-w/2+2} 57h${w-4}" stroke="${main}" stroke-width="2"/>`
        +`</g>`;
    }
    if (!rs.length) {
      const rot=seed%360;
      art=`<g transform="translate(606 80) rotate(${rot})" fill="none" stroke="${main}">`
        +`<circle r="57" opacity=".36"/><circle r="34" stroke-dasharray="6 6" opacity=".48"/>`
        +`<path d="M-72 0H72M0 -72V72" stroke-dasharray="4 6" opacity=".45"/>`
        +`<path d="M0 -42L11 12L0 5L-11 12Z" fill="${main}" fill-opacity=".13" stroke-width="1.5"/>`
        +`</g>`;
    }
    const ringX=559+(seed%39);
    const rwy=rs.length ? rs.map(r=>r.name).slice(0,3).join(" · ") : "ADC STYLE";
    return `<svg xmlns="http://www.w3.org/2000/svg" width="820" height="156" viewBox="0 0 820 156">`
      +`<rect width="820" height="156" fill="${bg}"/>`
      +`<defs><linearGradient id="fade" x1="0" x2="1"><stop stop-color="${bg}" stop-opacity="1"/><stop offset=".7" stop-color="${bg}" stop-opacity=".06"/></linearGradient></defs>`
      +`<g fill="none" stroke="${grid}" stroke-width=".8" opacity=".28">`
      +Array.from({length:25},(_,i)=>`<path d="M${i*38-20} 0V156"/>`).join("")
      +Array.from({length:6},(_,i)=>`<path d="M0 ${i*32}H820"/>`).join("")
      +`</g>`
      +`<g fill="none" stroke="${grid}" opacity=".46"><circle cx="${ringX}" cy="85" r="113"/><circle cx="${ringX}" cy="85" r="87" stroke-dasharray="3 7"/><path d="M${ringX-120} 85H${ringX+120}M${ringX} -35V205" stroke-dasharray="5 8"/></g>`
      +`<g stroke="${main}" fill="none" opacity=".44" stroke-width="1.3"><path d="M395 134L462 64L515 93L701 21L784 48" stroke-dasharray="5 8"/><circle cx="462" cy="64" r="4"/><circle cx="701" cy="21" r="4"/></g>`
      +art
      +`<g fill="${label}" font-family="Arial,sans-serif" font-size="13" font-weight="600" letter-spacing="1" opacity=".82"><text x="729" y="24">${xml(icao)}</text><text x="515" y="148" font-size="10" letter-spacing=".5">${xml(rwy)}</text></g>`
      +`<rect width="460" height="156" fill="url(#fade)"/>`
      +`</svg>`;
  }
  function cssUrl(icao,light) {
    const key=icao+(light?"-light":"-dark");
    if(!artwork.has(key))artwork.set(key,'url("data:image/svg+xml,'+encodeURIComponent(makeSvg(icao,light))+'")');
    return artwork.get(key);
  }
  function apply() {
    pending=false;
    for(const button of list.querySelectorAll("button.airport-item")){
      const icao=safeCode(button.querySelector(".airport-copy b")?.textContent);
      if(!icao||button.dataset.adcBanner===icao)continue;
      button.style.setProperty("--adc-banner-dark",cssUrl(icao,false));
      button.style.setProperty("--adc-banner-light",cssUrl(icao,true));
      button.dataset.adcBanner=icao;
    }
  }
  function schedule() {
    if(!pending){pending=true;requestAnimationFrame(apply);}
  }
  const observer=new MutationObserver(schedule);
  observer.observe(list,{childList:true,subtree:true});
  schedule();
  fetch("./data/airport-runways.json",{cache:"no-store"})
    .then(response=>{if(!response.ok)throw new Error("runway metadata unavailable");return response.json();})
    .then(data=>{
      airportRunways=(data&&data.airports&&typeof data.airports==="object")?data.airports:Object.create(null);
      artwork.clear();
      list.querySelectorAll(".airport-item[data-adc-banner]").forEach(button=>delete button.dataset.adcBanner);
      schedule();
    })
    .catch(()=>{ /* Draw neutral schematic offline; no misleading taxiway geometry. */ });
})();
