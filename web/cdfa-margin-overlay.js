/* JEPPIRAN owner-approved CDFA annotation in original PDF paper margin.
 * The panel is a child of the SAME transformed layer as the PDF canvas.
 * No independent floating position or separate table zoom is allowed.
 * Leave chart scale, PDF geometry, toolbar, and CDFA calculations unchanged.
 */
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
  for(let i=span-1;i>=0;i--)if(hits[i]>=required)return start+i;
  return null;
 }

 // Find the FULL-WIDTH horizontal rule ending the Jeppesen briefing strip.
 // The plan view begins immediately BELOW this rule. Never estimate from the
 // viewport top; that puts CDFA beside the briefing strip instead of the map.
 function planViewTop(canvas,borderX){
  const w=canvas.width,h=canvas.height;
  const x0=Math.floor(w*.20),x1=Math.floor(borderX-9);
  if(x1-x0<Math.floor(w*.30))return null;
  const ctx=canvas.getContext('2d');if(!ctx)return null;
  const y0=Math.floor(h*.13),y1=Math.floor(h*.42);
  const yStep=Math.max(1,Math.floor(h/900));
  const xStep=Math.max(2,Math.floor((x1-x0)/75));
  let last=null;
  try{
   for(let y=y0;y<y1;y+=yStep){
    const pixels=ctx.getImageData(x0,y,x1-x0,1).data;
    let dark=0,total=0;
    for(let x=0;x<x1-x0;x+=xStep){
     const i=x*4;
     if(pixels[i]<105&&pixels[i+1]<105&&pixels[i+2]<105)dark++;
     total++;
    }
    // Only continuous chart frame rules run across >=88% of the page.
    // Diagram arrows, text, and isolated horizontal strokes cannot qualify.
    if(total&&dark/total>=.88)last=y;
   }
  }catch(_){return null}
  return last;
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


 // The CDFA is a PDF-coordinate overlay, not a screen-anchored widget.
 // The existing chartTransformLayer already implements scroll, pan and zoom,
 // so it must perform every transformation for the CDFA as well.
 function position(panel){
  const layer=document.getElementById('chartTransformLayer');
  const canvas=document.getElementById('pdfCanvas');
  if(!layer||!canvas||!canvas.width)return false;
  const w=canvas.clientWidth||parseFloat(canvas.style.width);
  const h=canvas.clientHeight||parseFloat(canvas.style.height);
  if(!w||!h)return false;
  const border=outerRightBorder(canvas);
  if(border===null)return false;
  const frameRight=border*w/canvas.width;
  // Preserve a real gap on both sides of the printed page margin.
  const borderGap=Math.max(10,Math.round(w*.008));
  const edgeGap=Math.max(10,Math.round(w*.009));
  const x=Math.ceil(frameRight+borderGap);
  const marginWidth=Math.floor(w-x-edgeGap);
  if(marginWidth<64)return false;
  const planBoundary=planViewTop(canvas,border);
  if(planBoundary===null)return false;
  const y=Math.round(planBoundary*h/canvas.height+Math.max(9,w*.007));
  if(h-y<100||!paperIsBlank(canvas,x,marginWidth,y,Math.min(h-y-18,w*.46)))return false;

  // Direct child of chartTransformLayer: when the PDF is zoomed or panned,
  // the table inherits EXACTLY the same matrix, like a chart annotation.
  panel.style.left=x+'px';
  panel.style.top=y+'px';
  panel.style.width=marginWidth+'px';
  panel.style.maxHeight=Math.max(0,h-y-16)+'px';
  const font=Math.max(8,Math.min(19,marginWidth/9.8));
  panel.style.setProperty('--jp-cdfa-margin-font',font.toFixed(1)+'px');
  if(panel.parentElement!==layer)layer.appendChild(panel);
  return true;
 }
 window.JEPPIRAN_CDFA_MARGIN={position};
})();
