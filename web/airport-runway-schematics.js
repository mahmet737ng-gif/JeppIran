/* Five-airport V2621 runway schematic prototype. Display only. */
(() => {
  "use strict";
  const root=document.getElementById("airportProfile");
  if(!root)return;
  const layouts=Object.freeze({
    OTHH:[["16L","34R",156,4850,-22],["16R","34L",156,4250,22]],
    OIII:[["11L","29R",105,3876,-20],["11R","29L",105,4035,20]],
    OIIE:[["11L","29R",104,4198,-20],["11R","29L",104,4092,20]],
    OITL:[["15","33",145,3298,0],["07","25",70,2500,0]],
    UDYZ:[["08","26",83,3850,0]]
  });
  const esc=s=>String(s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const fmt=n=>Number(n).toLocaleString("en-US");
  let data={},queued=false,current="";
  fetch("./data/airport-runways.json",{cache:"no-store"})
    .then(r=>r.ok?r.json():Promise.reject())
    .then(json=>{data=json.airports||{};queue()})
    .catch(()=>queue());
  function record(icao,name){return(data[icao]||[]).find(r=>r.name===name)||{}}
  function runway(icao,r,max){
    const [a,b,bearing,metres,offset]=r;
    const details=record(icao,a);
    const len=70+(metres/max)*42;
    const width=(details.width||45)>=60?13:11;
    const dash=Array.from({length:7},(_,i)=>{
      const y=-len/2+17+i*(len-34)/6;
      return '<line x1="0" y1="'+y+'" x2="0" y2="'+(y+5)+'"/>';
    }).join("");
    const label=a+" / "+b+" · "+fmt(metres)+" × "+(details.width||"—")+" m · "+(details.surface||"");
    return '<g class="jp-rwy-schematic-lane" role="button" tabindex="0" data-runway="'+esc(a)+'" aria-label="Runway '+esc(label)+'" transform="translate('+(120+offset)+',88) rotate('+bearing+')">'+
      '<title>'+esc(label)+'</title><rect class="jp-rwy-pavement" x="'+(-width/2)+'" y="'+(-len/2)+'" width="'+width+'" height="'+len+'" rx="1.8"/>'+
      '<g class="jp-rwy-centerline">'+dash+'</g>'+
      '<line class="jp-rwy-threshold" x1="'+(-width/2+1)+'" y1="'+(-len/2+11)+'" x2="'+(width/2-1)+'" y2="'+(-len/2+11)+'"/>'+
      '<line class="jp-rwy-threshold" x1="'+(-width/2+1)+'" y1="'+(len/2-11)+'" x2="'+(width/2-1)+'" y2="'+(len/2-11)+'"/>'+
      '<text class="jp-rwy-end" x="0" y="'+(-len/2+8)+'" transform="rotate('+(-bearing)+' 0 '+(-len/2+8)+')">'+esc(a)+'</text>'+
      '<text class="jp-rwy-end" x="0" y="'+(len/2-3)+'" transform="rotate('+(-bearing)+' 0 '+(len/2-3)+')">'+esc(b)+'</text></g>';
  }
  function markup(icao){
    const items=layouts[icao],max=Math.max(...items.map(r=>r[3]));
    const dims=items.map(r=>r[0]+"/"+r[1]+" "+fmt(r[3])+"×"+(record(icao,r[0]).width||"—")+"m").join(" · ");
    return '<section class="jp-runway-schematic" aria-label="'+icao+' runway schematic" data-icao="'+icao+'">'+
      '<header><span>RUNWAY SCHEMATIC</span><strong>'+icao+'</strong></header>'+
      '<svg viewBox="0 0 240 176" role="img" aria-label="Runway arrangement for '+icao+'">'+
      '<defs><radialGradient id="jp-rwy-glow-'+icao+'"><stop offset="0" stop-color="#1fc7ff" stop-opacity=".16"/><stop offset="1" stop-color="#1fc7ff" stop-opacity="0"/></radialGradient></defs>'+
      '<circle cx="120" cy="88" r="82" fill="url(#jp-rwy-glow-'+icao+')"/>'+
      '<path class="jp-rwy-grid" d="M20 88H220M120 12V164M50 28L190 148M190 28L50 148"/>'+
      '<g class="jp-rwy-north"><path d="M21 31L27 15l6 16-6-4z"/><text x="27" y="11">N</text></g>'+
      items.map(r=>runway(icao,r,max)).join("")+'</svg>'+
      '<footer><span>'+esc(dims)+'</span><small>V2621 · DISPLAY ONLY</small></footer></section>';
  }
  function code(){const el=root.querySelector(".profile-icao");return el?el.textContent.trim().toUpperCase():""}
  function apply(){
    queued=false;
    const icao=code(),old=root.querySelector(":scope > .jp-runway-schematic");
    if(!layouts[icao]){old?.remove();root.classList.remove("jp-has-runway-schematic");current="";return}
    if(current===icao&&old)return;
    old?.remove();root.insertAdjacentHTML("beforeend",markup(icao));
    root.classList.add("jp-has-runway-schematic");current=icao;
  }
  function queue(){if(!queued){queued=true;requestAnimationFrame(apply)}}
  root.addEventListener("click",e=>{
    const lane=e.target.closest(".jp-rwy-schematic-lane");if(!lane)return;
    [...root.querySelectorAll(".rwy-row")].find(row=>row.textContent.includes(lane.dataset.runway))?.click();
  });
  root.addEventListener("keydown",e=>{
    if(e.key!=="Enter"&&e.key!==" ")return;
    const lane=e.target.closest(".jp-rwy-schematic-lane");if(!lane)return;
    e.preventDefault();lane.click();
  });
  new MutationObserver(queue).observe(root,{childList:true,subtree:true});
  queue();
  window.JEPPIRAN_RUNWAY_SCHEMATICS=Object.freeze({cycle:"V2621",airports:Object.keys(layouts),illustrativeOnly:true});
})();
