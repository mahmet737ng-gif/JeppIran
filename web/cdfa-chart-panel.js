/* JEPPIRAN CDFA_SIDE_TABLE_V1 / V2621: owner-approved immutable presentation.
 * Two columns outside the PDF stage, no chart drawings/markers.
 * Data remain engineering/simulator QA only, not approved navigation minima.
 */
(function(){
 'use strict';
 const button=document.getElementById('chartCdfaBtn');
 const fullscreenButton=document.getElementById('fullscreenCdfaBtn');
 const heading=document.getElementById('viewerChart');
 const panel=document.getElementById('jpCdfaSide');
 const workspace=document.getElementById('jpCdfaWorkspace');
 if(!button||!heading||!panel||!workspace)return;
 const pendingReaudit=new Set([155,705]);
 let records=new Map(),excluded=new Set(),ready=false,open=false;
 function activeChart(){
   try{return typeof selectedChart!=='undefined'?selectedChart:null}catch(_){return null}
 }
 function currentRecord(){
   const c=activeChart();if(!c)return null;
   const page=Number(c.page),r=records.get(page);
   if(!r||r.icao!==c.airport||pendingReaudit.has(page)||excluded.has(page)||
      String(r.status).startsWith('WITHHELD')||!Array.isArray(r.table)||!r.table.length)return null;
   return r;
 }
 function mountInPaperMargin(){
   return !!window.JEPPIRAN_CDFA_MARGIN?.position(panel);
 }
 function setVisible(value){
   if(open===value)return;
   // If the PDF has no verified blank margin, never overlay chart content.
   if(value&&!mountInPaperMargin())return;
   open=value;
   panel.hidden=!value;
   workspace.classList.toggle('jp-cdfa-open',value);
   button.setAttribute('aria-pressed',value?'true':'false');
   if(fullscreenButton)fullscreenButton.setAttribute('aria-pressed',value?'true':'false');
   // No layout change, chart rescale, or PDF re-render is permitted here.
 }
 function element(name,text,cls){
   const e=document.createElement(name);
   if(cls)e.className=cls;
   if(text!==undefined)e.textContent=String(text);
   return e;
 }
 function vdpInfo(record){
   const v=record.vdp;
   if(!v||v.status!=='CALCULATED_MDA_INTERCEPT_QA_ONLY'||v.published===true)return null;
   const n=Number(v.dmeNm);
   return Number.isFinite(n)&&n>=0&&v.dmeDisplay?{dme:n,text:String(v.dmeDisplay).replace(/^D/i,'')}:null;
 }
 function rowsFor(record){
   const rows=record.table.map(row=>({dme:Number(row.dme),left:Number(row.dme).toFixed(1),
      right:String(row.altitudeFt),vdp:false}));
   const vdp=vdpInfo(record);
   if(vdp)rows.push({dme:vdp.dme,left:vdp.text,right:'VDP',vdp:true});
   rows.sort((a,b)=>b.dme-a.dme||(a.vdp?-1:1));
   // Owner-locked rule: the calculated VDP is the FINAL table row.
   // No lower-DME altitude row (or any other row) may follow it.
   const vdpPosition=rows.findIndex(row=>row.vdp);
   return vdpPosition<0?rows:rows.slice(0,vdpPosition+1);
 }
 function render(){
   panel.replaceChildren();
   const record=currentRecord();if(!record)return;
   const table=element('table',undefined,'jp-cdfa-table');
   table.setAttribute('aria-label','CDFA DME and computed altitude, simulator QA only');
   const thead=element('thead');
   const titleRow=element('tr'),title=element('th','CDFA DATA');
   title.colSpan=2;titleRow.appendChild(title);thead.appendChild(titleRow);
   const labels=element('tr');
   ['DME','ALT (ft)'].forEach(label=>labels.appendChild(element('th',label)));
   thead.appendChild(labels);table.appendChild(thead);
   const tbody=element('tbody');
   rowsFor(record).forEach(row=>{
     const tr=element('tr',undefined,row.vdp?'jp-cdfa-vdp-row':'');
     tr.appendChild(element('td',row.left));
     tr.appendChild(element('td',row.right));
     tbody.appendChild(tr);
   });
   table.appendChild(tbody);panel.appendChild(table);
   panel.appendChild(element('div','SIMULATOR QA ONLY · NOT FOR ACTUAL NAVIGATION','jp-cdfa-qa-note'));
 }
 function sync(){
   const record=ready?currentRecord():null;
   button.disabled=!record;
    if(fullscreenButton){fullscreenButton.hidden=!record;fullscreenButton.disabled=!record;fullscreenButton.setAttribute('aria-pressed',open?'true':'false')}
   button.title=record?'Toggle CDFA data in the chart white margin · QA only':'No validated CDFA QA table for this chart';
   if(!record&&open)setVisible(false);
   if(open){
     render();
     // Re-attach to the newly rendered chart layer after changing charts/fullscreen.
     if(!mountInPaperMargin())setVisible(false);
   }
 }
 button.addEventListener('click',()=>{
   if(!currentRecord())return;
   if(open){setVisible(false);return}
   render();setVisible(true);
 });
 if(fullscreenButton)fullscreenButton.addEventListener('click',()=>{if(currentRecord())button.click()});
  new MutationObserver(sync).observe(heading,{childList:true,subtree:true,characterData:true});
 window.addEventListener('jeppiran-chart-rendered',sync);
 document.addEventListener('keydown',e=>{if(e.key==='Escape'&&open)setVisible(false)});
 async function load(){
   try{
     const [r,e]=await Promise.all([
       fetch('./data/cdfa-v2621-v17-qa.json'),
       fetch('./data/cdfa-exclusions-v2621.json')]);
     if(!r.ok||!e.ok)throw new Error('QA catalogue unavailable');
     const data=await r.json(),ex=await e.json();
     if(data.cycle!=='2621'||ex.cycle!=='2621'||!Array.isArray(data.charts))
       throw new Error('QA cycle mismatch');
     records=new Map(data.charts.map(x=>[Number(x.sourcePage),x]));
     excluded=new Set(ex.chart_pages_1_based.map(Number));
     ready=true;
   }catch(error){console.warn('CDFA unavailable',error);ready=false}
   sync();
 }
 sync();load();
})();
