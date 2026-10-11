/* JEPPIRAN cycle 2621: non-operational CDFA QA overlay, isolated from PDF and simulator. */
(function(){
  'use strict';
  const button=document.getElementById('chartCdfaBtn');
  const heading=document.getElementById('viewerChart');
  if(!button||!heading)return;
  const pendingReaudit=new Map([
    [155,'D12 mandatory altitude is not reconciled with the legacy one-slope table.'],
    [705,'Published D10-D7 3.77° and D7-to-MAP 3.31° segments require a continuous piecewise model.']
  ]);
  let byPage=new Map(), exclusions=new Set(), ready=false, modal=null, tableStatus='Loading CDFA QA data…';
  function chart(){
    try{return typeof selectedChart!=='undefined'&&selectedChart?selectedChart:null;}catch(_){return null;}
  }
  function recordForCurrentChart(){
    const c=chart();if(!c)return null;
    const page=Number(c.page), r=byPage.get(page);
    return r&&r.icao===c.airport&&!exclusions.has(page)&&!pendingReaudit.has(page)&&
      !String(r.status||'').startsWith('WITHHELD')&&Array.isArray(r.table)&&r.table.length?r:null;
  }
  function sync(){
    const c=chart(),r=recordForCurrentChart();
    button.disabled=!ready||!r;
    button.title=!ready?tableStatus:(!c?'Select a chart to see CDFA QA':
      exclusions.has(Number(c.page))?'Excluded from CDFA':
      pendingReaudit.get(Number(c.page))||(!r?'No released QA CDFA table for this procedure':'CDFA • simulator engineering QA only'));
    button.setAttribute('aria-label',button.title);
    if(modal)render();
  }
  const style=document.createElement('style');
  style.textContent=[
    '.jp-cdfa-shade{position:fixed;inset:0;background:rgba(3,10,19,.77);z-index:20060;display:flex;align-items:center;justify-content:center;padding:12px}',
    '.jp-cdfa-panel{width:min(780px,100%);max-height:94dvh;overflow:auto;background:#142230;color:#e9f3fa;border:1px solid #48627b;border-radius:15px;box-shadow:0 16px 60px #000b;font:14px/1.45 system-ui,Segoe UI,sans-serif}',
    '.jp-cdfa-header{display:flex;gap:12px;justify-content:space-between;align-items:start;padding:18px 20px;border-bottom:1px solid #3b5268}',
    '.jp-cdfa-panel h2{font-size:19px;margin:0 0 4px}.jp-cdfa-panel p{margin:6px 0}',
    '.jp-cdfa-close{border:1px solid #647b94;border-radius:9px;background:#273e55;color:white;padding:8px 12px;cursor:pointer}',
    '.jp-cdfa-content{padding:16px 20px 24px}.jp-cdfa-warn{font-weight:700;color:#ffdba2}',
    '.jp-cdfa-metadata{display:grid;grid-template-columns:repeat(auto-fit,minmax(145px,1fr));gap:8px;margin:14px 0}',
    '.jp-cdfa-fact{background:#203549;border-radius:8px;padding:10px}.jp-cdfa-fact small{display:block;color:#aec7d9;font-size:11px}',
    '.jp-cdfa-vdp{border:2px solid #eb6671;border-radius:9px;background:#582c37;color:#fff0f0;font-weight:700;padding:11px;margin:12px 0}',
    '.jp-cdfa-scroll{overflow-x:auto}.jp-cdfa-table{width:100%;border-collapse:collapse;font-variant-numeric:tabular-nums;text-align:left}',
    '.jp-cdfa-table th,.jp-cdfa-table td{padding:8px 10px;border-bottom:1px solid #365066;text-align:left;white-space:normal}',
    '.jp-cdfa-table th{background:#243c52;color:#d4edff;position:sticky;top:0}',
    '.jp-cdfa-table td:nth-child(2){font-weight:650}.jp-cdfa-table .jp-cdfa-vdp-row{background:#483044}',
    '.jp-cdfa-foot{color:#afc6d5;font-size:12px;margin-top:12px}'
  ].join('\n');document.head.appendChild(style);
  function node(tag,cls,text){
    const e=document.createElement(tag);if(cls)e.className=cls;if(text!=null)e.textContent=String(text);return e;
  }
  function fact(parent,label,value){
    const e=node('div','jp-cdfa-fact');e.appendChild(node('small','',label));e.appendChild(node('strong','',value));parent.appendChild(e);
  }
  function displayNumber(n){return Number.isFinite(Number(n))?Number(n).toLocaleString('en-US',{maximumFractionDigits:1}):'—'}
  function render(){
    if(!modal)return;
    const body=modal.querySelector('.jp-cdfa-content'),title=modal.querySelector('h2');
    body.replaceChildren();
    const c=chart(),r=recordForCurrentChart();
    if(!r){title.textContent='CDFA · no released table';body.appendChild(node('p','jp-cdfa-warn',tableStatus));return;}
    title.textContent=r.icao+' · '+r.title+' · '+(r.chartNumber||'')+' · CDFA';
    body.appendChild(node('p','jp-cdfa-warn','SIMULATOR / ENGINEERING QA ONLY — DO NOT USE FOR ACTUAL NAVIGATION.'));
    body.appendChild(node('p','', 'Computed DME/altitude values are a geometric model, not Jeppesen-published approach altitudes. Validate the source chart and altitude constraints separately.'));
    const grid=node('div','jp-cdfa-metadata');
    fact(grid,'Jeppesen PDF page',r.sourcePage);
    fact(grid,'Distance reference',r.referenceDmeId||r.dmeStationCandidate||'Unconfirmed');
    fact(grid,'Descent angle',r.publishedAngleDeg!=null?r.publishedAngleDeg+'° published':'3.00° ASSUMED (QA)');
    fact(grid,'TCH',r.tchFt==null?'Not verified':r.tchFt+' ft');
    fact(grid,'Threshold / fallback MSL',(r.thresholdElevationFt==null?'—':r.thresholdElevationFt+' ft')+(r.usedAirportElevationFallback?' (airport fallback)':''));
    fact(grid,'MDA (source)',r.mdaFt==null?'Not available':r.mdaFt+' ft');
    body.appendChild(grid);
    if(r.vdp&&r.vdp.dmeDisplay&&r.vdp.status==='CALCULATED_MDA_INTERCEPT_QA_ONLY'){
      const v=node('div','jp-cdfa-vdp','VDP CALCULATED: '+r.vdp.dmeDisplay+'  •  MDA '+displayNumber(r.mdaFt)+' ft MSL  •  NOT PUBLISHED');
      body.appendChild(v);
    }
    const scroll=node('div','jp-cdfa-scroll'),table=node('table','jp-cdfa-table'),thead=node('thead'),tr=node('tr');
    ['Reference DME','Computed MSL','Published altitude / fix','QA notes'].forEach(x=>tr.appendChild(node('th','',x)));
    thead.appendChild(tr);table.appendChild(thead);
    const tb=node('tbody');
    r.table.forEach(row=>{
      const tr=node('tr',row.vdpMarker?'jp-cdfa-vdp-row':'');
      const source=(row.published||[]).map(p=>p.type.toUpperCase()+' '+displayNumber(p.altitudeFt)+' ft').join('; ')||'—';
      const note=(row.reasons||[]).map(x=>String(x).replace(/_/g,' ').toLowerCase()).join('; ')||'QA model';
      ['D'+row.dme,displayNumber(row.altitudeFt)+' ft',source,note+(row.vdpMarker?' · VDP near '+row.vdpMarker:'')].forEach(x=>tr.appendChild(node('td','',x)));
      tb.appendChild(tr);
    });
    table.appendChild(tb);scroll.appendChild(table);body.appendChild(scroll);
    body.appendChild(node('p','jp-cdfa-foot','Outside published descent-angle segments, computed values are extrapolations. An inferred station offset, airport elevation fallback or assumed 3° angle does not establish navigational validity.'));
    if(c&&Number(c.page)!==Number(r.sourcePage))body.appendChild(node('p','jp-cdfa-warn','Chart selection changed; close and reopen CDFA.'));
  }
  function close(){
    if(!modal)return;modal.remove();modal=null;document.removeEventListener('keydown',onKey);
  }
  function onKey(e){if(e.key==='Escape')close()}
  function open(){
    if(button.disabled)return;
    modal=node('div','jp-cdfa-shade');
    modal.setAttribute('role','presentation');
    const panel=node('section','jp-cdfa-panel');panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');panel.setAttribute('aria-label','CDFA engineering QA table');
    const hdr=node('div','jp-cdfa-header'),wrap=node('div');
    wrap.appendChild(node('h2','','CDFA'));wrap.appendChild(node('small','','JEPPIRAN V2621'));
    hdr.appendChild(wrap);
    const x=node('button','jp-cdfa-close','Close ✕');x.type='button';x.addEventListener('click',close);
    hdr.appendChild(x);panel.appendChild(hdr);panel.appendChild(node('div','jp-cdfa-content'));
    modal.appendChild(panel);modal.addEventListener('click',e=>{if(e.target===modal)close()});
    document.body.appendChild(modal);document.addEventListener('keydown',onKey);render();x.focus();
  }
  button.addEventListener('click',open);
  new MutationObserver(sync).observe(heading,{childList:true,subtree:true,characterData:true});
  window.addEventListener('jeppiran-chart-rendered',sync);
  async function load(){
    try{
      const [r,e]=await Promise.all([fetch('./data/cdfa-v2621-v17-qa.json'),fetch('./data/cdfa-exclusions-v2621.json')]);
      if(!r.ok||!e.ok)throw new Error('CDFA data unavailable: HTTP '+r.status+'/'+e.status);
      const data=await r.json(),ex=await e.json();
      if(data.cycle!=='2621'||!Array.isArray(data.charts)||ex.cycle!=='2621'||!Array.isArray(ex.chart_pages_1_based))
        throw new Error('CDFA cycle/schema mismatch');
      exclusions=new Set(ex.chart_pages_1_based.map(Number));
      byPage=new Map(data.charts.map(c=>[Number(c.sourcePage),c]));
      ready=true;tableStatus='No released CDFA QA table for this chart.';
    }catch(error){ready=false;tableStatus='CDFA QA data could not be loaded: '+error.message;console.warn(tableStatus)}
    sync();
  }
  sync();load();
})();
