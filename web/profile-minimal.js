/* JEPPIRAN approved minimal airport profile. No decorative posters or fabricated reports. */
(function(){
"use strict";
const categories=[["Airport","AIRPORT"],["SID","SID"],["STAR","STAR"],["Approach","APPROACH"]];
const openGroups=new Map();
const documents=new Map();
const escape=s=>String(s==null?"":s).replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const clean=s=>escape(s||"Unavailable");
/* Preserve original TAF tokens; put each forecast change group on its own line. */
function displayTaf(raw){
 const report=String(raw||"TAF unavailable").replace(/\r\n?/g,"\n").trim();
 // Presentation-only breaks: preserve all original MET forecast tokens.
 // A single-line provider TAF must be readable on portrait phones too.
 const groups=report.replace(/[ \t]+(?=(?:FM\d{6}|BECMG|TEMPO|PROB\d{2}|INTER)\b)/g,"\n");
 return groups.split("\n").map(group=>{
   const words=group.trim().split(/\s+/).filter(Boolean);
   const lines=[];
   let line="";
   for(const word of words){
     if(line && line.length+word.length+1>36){lines.push(line);line=word;}
     else line+=(line?" ":"")+word;
   }
   if(line)lines.push(line);
   return lines.join("\n");
 }).filter(Boolean).join("\n");
}
function sourceIdentity(chart,manifest){
 const info=manifest&&manifest.airports&&manifest.airports[chart.airport];
 return info && Number(info.global_pages&&info.global_pages[Number(chart.pdf_page)-1])===Number(chart.page)?info:null;
}
async function preview(canvas,chart,ctx){
 if(!canvas.isConnected)return;
 const info=sourceIdentity(chart,ctx.manifest);
 if(!info){canvas.replaceWith(document.createTextNode("Preview unavailable"));return;}
 const key=chart.airport+"|"+info.file;
 const url="./charts/"+encodeURIComponent(info.file||chart.airport+".pdf");
 try{
   if(!documents.has(key)){
     const task=(async()=>{
       const lib=await ctx.pdfJs();
       const bytes=await ctx.getPdfBytes(url,false);
       return await lib.getDocument({data:bytes}).promise;
     })();
     documents.set(key,task);
     task.catch(()=>{if(documents.get(key)===task)documents.delete(key)});
     // Avoid accumulating every airport PDF in memory across profile visits.
     if(documents.size>2)documents.delete(documents.keys().next().value);
   }
   const doc=await documents.get(key);
   if(!canvas.isConnected)return;
   const page=await doc.getPage(Number(chart.pdf_page));
   if(!canvas.isConnected)return;
   const view=page.getViewport({scale:1});
   const scale=Math.min(2,Math.max(.25,220/view.width));
   const viewport=page.getViewport({scale});
   canvas.width=Math.ceil(viewport.width);
   canvas.height=Math.ceil(viewport.height);
   const task=page.render({canvasContext:canvas.getContext("2d",{alpha:false}),viewport});
   await task.promise;
   canvas.classList.add("jp-mp-thumb-ready");
 }catch(_){
   if(canvas.isConnected){
     const fallback=document.createElement("span");
     fallback.className="jp-mp-thumb-missing";
     fallback.textContent="Preview unavailable";
     canvas.replaceWith(fallback);
   }
 }
}
function render(ctx){
 const {root,icao,name,city,country,iata,elevation,raw,taf,flight,favorite,charts}=ctx;
 const list=charts.slice().sort((a,b)=>Number(a.page)-Number(b.page));
 const prior=openGroups.get(icao)||new Set(["Airport"]);
 root.classList.add("jp-minimal-profile");
 root.classList.remove("jp-airport-poster-loaded","jp-o3-topbar-experiment","jp-o3-details-open");
 const subtitle=[city,name].filter(Boolean).join(" / ");
 const obsStatus=raw?"Last available report • verify observation time":"No report available";
 const tafStatus=taf?"Last available forecast • verify validity":"No forecast available";
 const flightCode=raw&&/^(VFR|MVFR|IFR|LIFR)$/.test(flight.code)?flight.code:"";
 let html='<div class="jp-mp-shell">'+
   '<div class="jp-mp-heading"><div class="jp-mp-identity"><div class="jp-mp-code-line">'+
   '<h1><span class="profile-icao">'+escape(icao)+'</span> / '+escape(iata||"—")+'</h1>'+
   '<button type="button" id="profileFavBtn" class="jp-mp-favorite" aria-label="Toggle favorite airport" aria-pressed="'+Boolean(favorite)+'">'+(favorite?"★":"☆")+'</button></div>'+
   '<p class="jp-mp-airport-name">'+escape(subtitle||name||icao)+'</p>'+
   '<p class="jp-mp-elevation">Elevation '+(Number.isFinite(elevation)?Number(elevation).toLocaleString()+" ft":"unavailable")+'</p></div>'+
   '<div class="jp-mp-clock"><strong id="profileUtcClock">--:--:-- UTC</strong><small id="profileLocalTime"></small></div></div>'+
   '<div class="jp-mp-weather" aria-label="Airport weather">'+
   '<section class="jp-mp-weather-card jp-mp-metar-card" id="jpMinimalMetarCard"><div class="jp-mp-card-heading"><h2>METAR</h2>'+
   (flightCode?'<span class="jp-mp-flight jp-mp-'+escape(flightCode.toLowerCase())+'">'+escape(flightCode)+'</span>':'')+
   '</div><pre id="profileMetarRaw">'+escape(raw||"METAR unavailable")+'</pre>'+
   '<small id="profileMetarAge">'+escape(obsStatus)+'</small></section>'+
   '<section class="jp-mp-weather-card jp-mp-taf-card" id="jpMinimalTafCard" style="display:flex!important;visibility:visible!important"><div class="jp-mp-card-heading"><h2>TAF</h2></div>'+
   '<pre class="jp-mp-taf-text" style="display:block!important;visibility:visible!important">'+escape(displayTaf(taf))+'</pre><small>'+escape(tafStatus)+'</small></section></div>'+
   '<button type="button" id="jpMinimalNotamToggle" class="jp-mp-notam-button" aria-expanded="false" aria-controls="jpMinimalNotamReader">'+
   '<span>NOTAM</span><span class="jp-mp-expand-indicator" aria-hidden="true">⌄</span></button>'+
   '<div id="jpMinimalNotamReader" class="jp-mp-notam-reader" hidden>'+
   '<section class="profile-card" id="profileNotam"><header><span>NOTAM • '+escape(icao)+'</span></header></section></div>'+
   '<section class="jp-mp-charts" aria-label="Airport charts"><div class="jp-mp-chart-title"><h2>CHARTS</h2><small>V2621 · Select a chart to open</small></div>';
 for(const [cat,label] of categories){
   const items=list.filter(c=>(c.category||"Other")===cat);
   if(!items.length)continue;
   const isOpen=prior.has(cat);
   html+='<details class="jp-mp-category" data-category="'+escape(cat)+'"'+(isOpen?' open':'')+'>'+
      '<summary><span>'+label+'</span><span class="jp-mp-category-count">('+items.length+')</span><span class="jp-mp-chevron" aria-hidden="true"></span></summary>'+
      '<div class="jp-mp-chart-list">';
   for(const c of items){
     const chartNo=ctx.displayChartNumber(c);
     const title=ctx.displayChartName(c);
     const originalIndex=charts.indexOf(c);
     html+='<button type="button" class="jp-mp-chart-row" data-chart-index="'+originalIndex+'" title="'+escape([chartNo,title].filter(Boolean).join(" · "))+'">'+
       '<span class="jp-mp-thumb-wrap"><canvas class="jp-mp-thumb" data-chart-index="'+originalIndex+'" aria-hidden="true"></canvas></span>'+
       '<span class="jp-mp-chart-copy"><strong>'+escape(title)+'</strong>'+
       (chartNo?'<small>'+escape(chartNo)+'</small>':'')+'</span>'+
       '<span class="jp-mp-chart-arrow" aria-hidden="true">›</span></button>';
   }
   html+='</div></details>';
 }
 html+='</section><div id="profileTerminalValidity" class="terminal-validity jp-mp-validity" data-state="unknown" role="status" aria-live="polite"></div></div>';
 root.innerHTML=html;
 root.querySelector("#profileFavBtn").addEventListener("click",ctx.toggleFavorite);
 const notam=root.querySelector("#jpMinimalNotamToggle");
 const reader=root.querySelector("#jpMinimalNotamReader");
 notam.addEventListener("click",()=>{
   reader.hidden=!reader.hidden;
   notam.setAttribute("aria-expanded",String(!reader.hidden));
   if(!reader.hidden)reader.querySelector("details")?.setAttribute("open","");
 });
 root.querySelectorAll(".jp-mp-chart-row").forEach(button=>button.addEventListener("click",()=>{
   const chart=charts[Number(button.dataset.chartIndex)];
   if(chart)ctx.selectChart(chart);
 }));
 root.querySelectorAll(".jp-mp-category").forEach(details=>{
   details.addEventListener("toggle",()=>{
     const state=openGroups.get(icao)||new Set(["Airport"]);
     if(details.open)state.add(details.dataset.category);else state.delete(details.dataset.category);
     openGroups.set(icao,state);
     if(details.open)queuePreviews(details,ctx,charts);
   });
   if(details.open)queuePreviews(details,ctx,charts);
 });
}
function queuePreviews(details,ctx,charts){
 const canvases=[...details.querySelectorAll("canvas.jp-mp-thumb:not([data-queued])")];
 const io=typeof IntersectionObserver!=="undefined"?new IntersectionObserver((entries,observer)=>{
   entries.forEach(entry=>{
     if(!entry.isIntersecting)return;
     observer.unobserve(entry.target);
     const chart=charts[Number(entry.target.dataset.chartIndex)];
     if(chart)void preview(entry.target,chart,ctx);
   });
 },{root:document.getElementById("airportProfile"),rootMargin:"120px"}):null;
 for(const canvas of canvases){
   canvas.dataset.queued="1";
   if(io)io.observe(canvas);
   else{const chart=charts[Number(canvas.dataset.chartIndex)];if(chart)void preview(canvas,chart,ctx)}
 }
}
window.JEPPIRAN_MINIMAL_PROFILE={render};
})();