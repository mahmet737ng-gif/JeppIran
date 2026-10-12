/* JEPPIRAN owner-approved CDFA blank-margin placement + independent gestures.
 * The PDF geometry, toolbar button, and CDFA calculations are NEVER changed.
 * Anchor X to the viewer (not to chartPanX). Follow chart vertical scrolling/pan,
 * while a vertical finger drag moves the table independently. Pinch/wheel zoom
 * changes only table typography, never PDF scale or chart viewport width.
 */
(function(){
 'use strict';
 const state={panel:null,viewer:null,stage:null,canvas:null,layer:null,
  anchorLeft:0,paperTop:0,dragY:0,tableZoom:1,baseFont:13,
  active:new Map(),dragLastY:null,pinchStart:null,
  chartObserver:null,scrollStage:null,raf:0};
 const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

 function outerRightBorder(canvas){
  const w=canvas.width,h=canvas.height;
  if(w<100||h<100)return null;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const start=Math.floor(w*.67),end=Math.floor(w*.965),span=end-start;
  const samples=[.19,.22,.25,.28,.31,.34,.37,.40,.43,.46,.49,.53,.57];
  const hits=new Uint8Array(span);
  try{
   for(const ratio of samples){
    const y=Math.min(h-1,Math.floor(h*ratio));
    const bytes=ctx.getImageData(start,y,span,1).data;
    for(let i=0;i<span;i++){
     const n=i*4;
     if(bytes[n]<95&&bytes[n+1]<95&&bytes[n+2]<95)hits[i]++;
    }
   }
  }catch(_){return null}
  const required=Math.ceil(samples.length*.61);
  for(let i=span-1;i>=0;i--)if(hits[i]>=required)return start+i;
  return null;
 }

 function paperIsBlank(canvas,xCss,wCss,yCss,hCss){
  const cssW=canvas.clientWidth||parseFloat(canvas.style.width)||0;
  const cssH=canvas.clientHeight||parseFloat(canvas.style.height)||0;
  if(!cssW||!cssH)return false;
  const ctx=canvas.getContext('2d');if(!ctx)return false;
  let colored=0,total=0;
  try{
   for(let yi=0;yi<10;yi++)for(let xi=0;xi<7;xi++){
    const x=Math.min(canvas.width-1,Math.floor((xCss+(xi+.5)*wCss/7)*canvas.width/cssW));
    const y=Math.min(canvas.height-1,Math.floor((yCss+(yi+.5)*hCss/10)*canvas.height/cssH));
    const p=ctx.getImageData(x,y,1,1).data;
    if(p[0]<230||p[1]<230||p[2]<230)colored++;
    total++;
   }
  }catch(_){return false}
  return colored<=Math.floor(total*.07);
 }

 function chartScale(){
  if(!state.canvas)return 1;
  const naturalWidth=state.canvas.clientWidth||parseFloat(state.canvas.style.width)||1;
  return Math.max(.5,state.canvas.getBoundingClientRect().width/naturalWidth);
 }
 function updateFont(){
  const p=state.panel;
  if(!p)return;
  const available=parseFloat(p.style.width)||120;
  const zoom=clamp(chartScale(),1,1.65)*state.tableZoom;
  const size=clamp(state.baseFont*zoom,7.5,Math.max(7.5,available/6.7));
  p.style.setProperty('--jp-cdfa-margin-font',size.toFixed(1)+'px');
 }
 function updateVertical(){
  const s=state;
  if(!s.panel||s.panel.hidden||!s.canvas||!s.viewer||!s.stage)return;
  const paper=s.canvas.getBoundingClientRect();
  const area=s.stage.getBoundingClientRect();
  const view=s.viewer.getBoundingClientRect();
  if(!paper.height||!area.height)return;
  // The table follows only VERTICAL chart scrolling/pan; chartPanX is ignored.
  const intended=paper.top + s.paperTop*chartScale() + s.dragY;
  const h=Math.min(s.panel.offsetHeight||area.height,area.height-12);
  const low=area.top+6,high=Math.max(low,area.bottom-h-6);
  const top=clamp(intended,low,high);
  s.panel.style.top=Math.round(top-view.top)+'px';
  updateFont();
 }
 function scheduleVertical(){
  if(state.raf)return;
  state.raf=requestAnimationFrame(()=>{state.raf=0;updateVertical()});
 }
 function observeChart(layer,stage){
  const s=state;
  if(s.layer!==layer){
   if(s.chartObserver)s.chartObserver.disconnect();
   s.layer=layer;
   s.chartObserver=new MutationObserver(scheduleVertical);
   s.chartObserver.observe(layer,{attributes:true,attributeFilter:['style']});
  }
  if(s.scrollStage!==stage){
   if(s.scrollStage)s.scrollStage.removeEventListener('scroll',scheduleVertical);
   s.scrollStage=stage;
   stage.addEventListener('scroll',scheduleVertical,{passive:true});
  }
 }
 function distance(points){
  const a=points[0],b=points[1];
  return Math.hypot(a.x-b.x,a.y-b.y);
 }
 function attachGestures(panel){
  if(panel.dataset.cdfaGestures==='1')return;
  panel.dataset.cdfaGestures='1';
  const s=state;
  const stop=e=>{e.stopPropagation()};
  panel.addEventListener('pointerdown',e=>{
   if(e.button!==undefined&&e.button!==0)return;
   e.preventDefault();stop(e);
   s.active.set(e.pointerId,{x:e.clientX,y:e.clientY});
   try{panel.setPointerCapture(e.pointerId)}catch(_){}
   if(s.active.size===1){s.dragLastY=e.clientY;s.pinchStart=null}
   else if(s.active.size===2){
    s.dragLastY=null;
    s.pinchStart={distance:distance([...s.active.values()]),zoom:s.tableZoom};
   }
  });
  panel.addEventListener('pointermove',e=>{
   if(!s.active.has(e.pointerId))return;
   e.preventDefault();stop(e);
   s.active.set(e.pointerId,{x:e.clientX,y:e.clientY});
   if(s.active.size>=2&&s.pinchStart){
    const current=distance([...s.active.values()]);
    if(s.pinchStart.distance>3)
     s.tableZoom=clamp(s.pinchStart.zoom*current/s.pinchStart.distance,.7,2.8);
    updateFont();scheduleVertical();
   }else if(s.active.size===1){
    if(s.dragLastY!==null)s.dragY+=e.clientY-s.dragLastY;
    s.dragLastY=e.clientY;
    scheduleVertical();
   }
  });
  const release=e=>{
   if(!s.active.has(e.pointerId))return;
   stop(e);
   s.active.delete(e.pointerId);
   try{panel.releasePointerCapture(e.pointerId)}catch(_){}
   s.pinchStart=null;
   s.dragLastY=s.active.size===1?[...s.active.values()][0].y:null;
  };
  panel.addEventListener('pointerup',release);
  panel.addEventListener('pointercancel',release);
  panel.addEventListener('lostpointercapture',e=>{
   s.active.delete(e.pointerId);
   s.pinchStart=null;
   s.dragLastY=s.active.size===1?[...s.active.values()][0].y:null;
  });
  panel.addEventListener('wheel',e=>{
   e.preventDefault();stop(e);
   if(e.ctrlKey||e.metaKey){
    s.tableZoom=clamp(s.tableZoom*(e.deltaY<0?1.12:1/1.12),.7,2.8);
   }else{
    s.dragY-=e.deltaY;
   }
   scheduleVertical();
  },{passive:false});
  for(const type of ['click','dblclick','touchstart','touchmove','touchend'])
   panel.addEventListener(type,stop,{passive:true});
 }
 function position(panel){
  const layer=document.getElementById('chartTransformLayer');
  const canvas=document.getElementById('pdfCanvas');
  const stage=document.getElementById('pdfStage');
  const viewer=document.querySelector('#chartsView .viewer-pane');
  if(!layer||!canvas||!canvas.width||!stage||!viewer)return false;
  const w=canvas.clientWidth||parseFloat(canvas.style.width);
  const h=canvas.clientHeight||parseFloat(canvas.style.height);
  if(!w||!h)return false;
  const border=outerRightBorder(canvas);
  if(border===null)return false;
  const edge=border*w/canvas.width;
  const gap=Math.max(10,Math.round(w*.008));
  const rightPad=Math.max(10,Math.round(w*.009));
  const start=Math.ceil(edge+gap);
  const marginWidth=Math.floor(w-start-rightPad);
  if(marginWidth<64)return false;
  const paperTop=Math.round(Math.max(28,w*.086));
  if(h-paperTop<100||!paperIsBlank(canvas,start,marginWidth,paperTop,Math.min(h-paperTop-18,w*.46)))return false;
  const canvasRect=canvas.getBoundingClientRect();
  const stageRect=stage.getBoundingClientRect();
  const viewerRect=viewer.getBoundingClientRect();
  const z=chartScale();
  // Horizontal anchor computed ONCE for this rendered PDF. Never respond to panX.
  const x=canvasRect.left+start*z;
  const width=Math.min(marginWidth*z,stageRect.right-rightPad-x);
  if(width<64)return false;
  const left=Math.round(x-viewerRect.left);
  state.panel=panel;state.viewer=viewer;state.stage=stage;state.canvas=canvas;
  state.anchorLeft=left;state.paperTop=paperTop;
  state.baseFont=Math.max(8,Math.min(19,width/9.8));
  panel.style.left=left+'px';
  panel.style.width=Math.floor(width)+'px';
  panel.style.maxHeight=Math.max(92,Math.floor(stageRect.height-12))+'px';
  // Move OUT of zoom/pan chart layer: otherwise the whole table follows panX.
  // Position absolute in viewer-pane does not reserve a pixel of PDF width.
  if(panel.parentElement!==viewer)viewer.appendChild(panel);
  attachGestures(panel);
  observeChart(layer,stage);
  scheduleVertical();
  return true;
 }
 window.JEPPIRAN_CDFA_MARGIN={position};
})();
