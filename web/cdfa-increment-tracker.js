/* JEPPIRAN CDFA next-increment tracker: VISUAL-ONLY additive overlay.
 * Owner-locked CDFA rows, geometry, vector metrics and native apps untouched.
 * Live mode requires explicitly identified, chart-bound DME; GPS lat/lon
 * alone can never be substituted for a valid DME reference.
 * QA simulation requires the explicit ?cdfa_increment_qa=1 query parameter.
 */
(()=>{
  "use strict";
  const core=window.JEPPIRAN_CDFA_NEXT_CORE;
  if(!core)return;
  const panel=document.getElementById("jpCdfaSide");
  if(!panel)return;
  const qa=new URLSearchParams(location.search).get("cdfa_increment_qa")==="1";
  const clock=()=>performance.now();
  let catalogue=new Map(),activePage=null,svg=null,marker=null,rows=[],target=-1;
  let liveNm=null,liveAt=0,simNm=null,playing=false,playTimer=0,qaBox=null;
  const MAX_STALENESS_MS=3500;
  function chart(){
    try{return typeof selectedChart!=="undefined"?selectedChart:null}catch(_){return null}
  }
  function record(){
    const c=chart();if(!c)return null;
    const r=catalogue.get(Number(c.page));
    if(!r||r.icao!==c.airport||String(r.status).startsWith("WITHHELD")||
       !Array.isArray(r.table)||!r.table.length)return null;
    return r;
  }
  function stopPlay(){
    playing=false;
    if(playTimer){clearInterval(playTimer);playTimer=0;}
    if(qaBox)qaBox.querySelector(".jp-inc-play").textContent="▶ PLAY";
  }
  function hideMarker(){
    if(marker)marker.style.opacity="0";
    target=-1;
  }
  function readRows(){
    const table=panel.querySelector(".jp-cdfa-table");
    if(!table)return [];
    return [...table.querySelectorAll("tbody tr")].map(tr=>{
      const columns=tr.querySelectorAll("td"),dme=Number(columns[0]?.textContent?.trim());
      return {dme,alt:columns[1]?.textContent?.trim()||"",vdp:tr.classList.contains("jp-cdfa-vdp-row")};
    }).filter(row=>Number.isFinite(row.dme));
  }
  function addSvgLine(group,kind,halo){
    const line=document.createElementNS("http://www.w3.org/2000/svg","line");
    line.setAttribute("class","jp-inc-line"+(halo?" jp-inc-halo":""));
    line.setAttribute("data-boundary",kind);
    line.setAttribute("x1","3");line.setAttribute("x2",String(Math.max(6,Number(svg.getAttribute("width"))-3)));
    line.setAttribute("y1","0");line.setAttribute("y2","0");
    group.appendChild(line);
    return line;
  }
  function ensureMarker(){
    const found=panel.querySelector(".jp-cdfa-vector");
    if(!found||!found.isConnected||panel.hidden)return false;
    if(found===svg&&marker)return true;
    svg=found;rows=readRows();target=-1;
    if(!rows.length)return false;
    marker=document.createElementNS("http://www.w3.org/2000/svg","g");
    marker.setAttribute("class","jp-cdfa-next-increment jp-inc-no-motion");
    marker.setAttribute("role","presentation");
    // Keep the existing vector table as a protected source. No DOM rows
    // or SVG labels are edited: four lines are appended in a separate group.
    addSvgLine(marker,"top",true);
    addSvgLine(marker,"bottom",true);
    addSvgLine(marker,"top",false);
    addSvgLine(marker,"bottom",false);
    marker.style.opacity="0";
    svg.appendChild(marker);
    requestAnimationFrame(()=>marker?.classList.remove("jp-inc-no-motion"));
    return true;
  }
  function bounds(index){
    // Layout is derived from existing lock-protected vector strokes, not
    // duplicated or recalculated table metrics.
    const rules=[...svg.querySelectorAll("line.jp-cdfa-rule")].filter(line=>
      Number(line.getAttribute("x1"))===0 &&
      Math.abs(Number(line.getAttribute("y1"))-Number(line.getAttribute("y2")))<.01);
    const top=Number(rules[index+1]?.getAttribute("y1"));
    const bottom=index+2<rules.length
      ?Number(rules[index+2].getAttribute("y1"))
      :Number(svg.querySelector("rect.jp-cdfa-fill")?.getAttribute("height"));
    if(!Number.isFinite(top)||!Number.isFinite(bottom)||bottom<=top)return null;
    return {top,height:bottom-top};
  }
  function moveTo(index){
    if(!ensureMarker())return;
    if(index<0||index>=rows.length){hideMarker();return;}
    if(index===target)return;
    const b=bounds(index);
    if(!b){hideMarker();return;}
    marker.querySelectorAll("line.jp-inc-line").forEach(line=>{
      const yy=line.getAttribute("data-boundary")==="bottom"?b.height:0;
      line.setAttribute("y1",String(yy));line.setAttribute("y2",String(yy));
    });
    if(target<0)marker.classList.add("jp-inc-no-motion");
    marker.style.transform="translateY("+b.top+"px)";
    marker.style.opacity="1";
    marker.dataset.dme=String(rows[index].dme);
    marker.dataset.alt=rows[index].alt;
    target=index;
    if(marker.classList.contains("jp-inc-no-motion"))
      requestAnimationFrame(()=>marker?.classList.remove("jp-inc-no-motion"));
  }
  function ensureQa(){
    if(!qa)return;
    if(!qaBox){
      qaBox=document.createElement("aside");
      qaBox.className="jp-cdfa-increment-qa";
      qaBox.setAttribute("aria-label","CDFA simulated next-increment preview");
      qaBox.innerHTML='<div class="jp-inc-qa-header"><b>CDFA · INCREMENT QA</b><span>SIMULATION ONLY</span></div><div class="jp-inc-qa-value">DME <strong class="jp-inc-qa-number">—</strong> <small class="jp-inc-next-label">NEXT —</small></div><input class="jp-inc-slider" type="range" min="0" max="15" step=".01" aria-label="Simulated current DME"><div class="jp-inc-qa-actions"><button class="jp-inc-play" type="button">▶ PLAY</button><button class="jp-inc-reset" type="button">↺ RESET</button></div>';
      document.body.appendChild(qaBox);
      qaBox.querySelector(".jp-inc-slider").addEventListener("input",event=>{
        stopPlay();simNm=Number(event.target.value);draw();
      });
      qaBox.querySelector(".jp-inc-play").addEventListener("click",()=>{
        if(playing){stopPlay();return;}
        if(!rows.length)return;
        if(simNm==null||simNm<=rows[rows.length-1].dme+.08)
          simNm=rows[0].dme+.8;
        playing=true;
        qaBox.querySelector(".jp-inc-play").textContent="Ⅱ PAUSE";
        playTimer=setInterval(()=>{
          if(!svg?.isConnected||panel.hidden){stopPlay();return;}
          simNm=Math.max(0,simNm-.085);
          draw();
          if(simNm<=rows[rows.length-1].dme-.15)stopPlay();
        },110);
      });
      qaBox.querySelector(".jp-inc-reset").addEventListener("click",()=>{
        stopPlay();simNm=rows.length?rows[0].dme+.8:null;target=-1;draw();
      });
    }
    qaBox.hidden=!svg?.isConnected||panel.hidden;
    if(qaBox.hidden)return;
    const slider=qaBox.querySelector(".jp-inc-slider");
    slider.min=String(Math.max(0,rows[rows.length-1].dme-.5));
    slider.max=String(rows[0].dme+1.2);
  }
  function draw(){
    if(!ensureMarker())return;
    if(qa&&simNm===null)simNm=rows[0].dme+.8;
    const n=qa?simNm:(clock()-liveAt<=MAX_STALENESS_MS?liveNm:null);
    if(!Number.isFinite(n)){hideMarker();ensureQa();return;}
    const next=core.targetIndex(rows,n,target);
    moveTo(next);
    ensureQa();
    if(qaBox&&!qaBox.hidden){
      qaBox.querySelector(".jp-inc-qa-number").textContent=n.toFixed(2);
      qaBox.querySelector(".jp-inc-next-label").textContent=
        next>=0?"NEXT D"+rows[next].dme.toFixed(1)+" · "+rows[next].alt:"NEXT —";
      const slider=qaBox.querySelector(".jp-inc-slider");
      slider.value=String(n);
    }
  }
  function refresh(){
    if(!panel.querySelector(".jp-cdfa-vector")||panel.hidden){
      svg=null;marker=null;rows=[];hideMarker();stopPlay();ensureQa();return;
    }
    if(!record()){hideMarker();stopPlay();ensureQa();return;}
    if(!ensureMarker())return;
    const page=Number(chart()?.page);
    if(page!==activePage){
      activePage=page;liveNm=null;liveAt=0;simNm=null;target=-1;stopPlay();
    }
    draw();
  }
  // The published DOM table and vector SVG belong to the existing locked UI.
  // Observe only structural changes; the marker's own insertion is idempotent.
  new MutationObserver(()=>requestAnimationFrame(refresh))
    .observe(panel,{childList:true,subtree:true});
  window.addEventListener("jeppiran-chart-rendered",()=>requestAnimationFrame(refresh));
  window.addEventListener("jeppiran-chart-selected",()=>{
    liveNm=null;liveAt=0;simNm=null;target=-1;stopPlay();hideMarker();
  });
  window.addEventListener("jeppiran-position",event=>{
    if(qa)return;
    // Bind the simulator's identified DME to the OPEN chart here. Bridge
    // packets are chart-agnostic: they must supply the real station ID and NM,
    // while page/ICAO come from the viewer, never from a guessed coordinate.
    const current=chart();
    const packet={...(event.detail||{}),cdfaIcao:current?.airport,
      cdfaPage:current?.page};
    const sample=core.validatedReading(packet,record());
    if(sample===null){liveNm=null;liveAt=0;hideMarker();return;}
    liveNm=sample;liveAt=clock();draw();
  });
  // If simulator data cease, suppress any stale highlight.
  setInterval(()=>{if(!qa&&liveNm!==null&&clock()-liveAt>MAX_STALENESS_MS){
    liveNm=null;hideMarker();
  }},850);
  Promise.all([
    fetch("./data/cdfa-v2621-v17-qa.json").then(r=>r.ok?r.json():null),
    fetch("./data/cdfa-exclusions-v2621.json").then(r=>r.ok?r.json():null)
  ]).then(([data,ex])=>{
    if(data?.cycle!=="2621"||ex?.cycle!=="2621")return;
    const held=new Set([155,705,...(ex.chart_pages_1_based||[])].map(Number));
    catalogue=new Map((data.charts||[]).filter(r=>!held.has(Number(r.sourcePage)))
      .map(r=>[Number(r.sourcePage),r]));
    refresh();
  }).catch(error=>console.warn("CDFA increment tracker unavailable",error));
})();
