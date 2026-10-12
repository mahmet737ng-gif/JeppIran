/* Owner-approved PDF blank-margin CDFA placement; no geometry/chart changes. */
(function(){
 'use strict';
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
  // Rightmost persistent DARK VERTICAL rule is the printed chart frame.
  // Scattered labels inside the diagram do not persist at the same X.
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
 function position(panel){
  const layer=document.getElementById('chartTransformLayer');
  const canvas=document.getElementById('pdfCanvas');
  if(!layer||!canvas||!canvas.width)return false;
  const w=canvas.clientWidth||parseFloat(canvas.style.width);
  const h=canvas.clientHeight||parseFloat(canvas.style.height);
  if(!w||!h)return false;
  const border=outerRightBorder(canvas);
  if(border===null)return false;
  const edge=border*w/canvas.width;
  const gap=Math.max(10,Math.round(w*.008));
  const rightPad=Math.max(10,Math.round(w*.009));
  const x=Math.ceil(edge+gap),available=Math.floor(w-x-rightPad);
  if(available<64)return false; // No extra column and no shrinking of the PDF.
  const top=Math.round(Math.max(28,w*.086)),remaining=h-top-18;
  if(remaining<100||!paperIsBlank(canvas,x,available,top,Math.min(remaining,w*.46)))return false;
  panel.style.left=x+'px';
  panel.style.top=top+'px';
  panel.style.width=available+'px';
  panel.style.maxHeight=remaining+'px';
  panel.style.setProperty('--jp-cdfa-margin-font',Math.max(8,Math.min(19,available/9.8)).toFixed(1)+'px');
  if(panel.parentElement!==layer)layer.appendChild(panel);
  return true;
 }
 window.JEPPIRAN_CDFA_MARGIN={position};
})();
