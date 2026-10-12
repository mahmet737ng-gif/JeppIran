/* JEPPIRAN vector CDFA in the existing PDF margin.
 * SVG glyphs remain crisp at every chart zoom. No PDF refit, rasterized table,
 * new layout column or CDFA data/VDP computation changes.
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



 // Detect the line separating Plan View from the lower approach profile.
 // A fallback fraction is used only if no continuous horizontal rule exists.
 function planViewBottom(canvas,borderX,topPixel){
  const w=canvas.width,h=canvas.height,ctx=canvas.getContext('2d');
  const x0=Math.floor(w*.20),x1=Math.floor(borderX-9);
  const begin=Math.max(Math.floor(h*.51),Math.floor(topPixel+h*.23));
  const finish=Math.floor(h*.86);
  const stepY=Math.max(1,Math.floor(h/1300));
  const stepX=Math.max(2,Math.floor((x1-x0)/85));
  if(!ctx||x1<=x0||finish<=begin)return Math.min(h*.76,h-1);
  try{
   for(let y=begin;y<finish;y+=stepY){
    const pixels=ctx.getImageData(x0,y,x1-x0,1).data;
    let dark=0,total=0;
    for(let x=0;x<x1-x0;x+=stepX){
     const i=x*4;
     if(pixels[i]<105&&pixels[i+1]<105&&pixels[i+2]<105)dark++;
     total++;
    }
    if(total&&dark/total>=.89)return y;
   }
  }catch(_){}
  return Math.min(h*.76,h-1);
 }

 const SVG_NS='http://www.w3.org/2000/svg';
 // iPad Safari may render large SVG fonts differently from Chromium.
 // Fit each label to its ACTUAL half-column, never the full table width.
 function fittedSvgFont(ctx,value,preferred,maxWidth,bold){
  const text=String(value);
  const room=Math.max(1,maxWidth);
  const size=Math.max(1,preferred);
  if(ctx){
   ctx.font=String(bold)+' '+size+'px Arial';
   const measured=ctx.measureText(text).width;
   if(Number.isFinite(measured)&&measured>0)
    return Math.min(size,size*room/(measured*1.065));
  }
  // Conservative fallback if canvas text measurement is unavailable.
  return Math.min(size,room/(Math.max(1,text.length)*.72));
 }
 function ensureSvgColumnFit(svg){
  if(!svg||!svg.isConnected)return;
  for(const t of svg.querySelectorAll('text[data-cdfa-max-width]')){
   const allowed=Number(t.getAttribute('data-cdfa-max-width'));
   if(!allowed||typeof t.getComputedTextLength!=='function')continue;
   try{
    const measured=t.getComputedTextLength();
    if(Number.isFinite(measured)&&measured>allowed){
     const current=Number(t.getAttribute('font-size'));
     t.setAttribute('font-size',(current*allowed/measured*.97).toFixed(2));
     // iOS Safari text inflation safeguard (font-size correction first).
     const finalLength=t.getComputedTextLength();
     if(Number.isFinite(finalLength)&&finalLength>allowed){
      t.setAttribute('textLength',allowed.toFixed(2));
      t.setAttribute('lengthAdjust','spacingAndGlyphs');
     }
    }
   }catch(_){}
  }
 }
 function svgNode(tag,attrs={},value){
  const node=document.createElementNS(SVG_NS,tag);
  for(const [name,attribute] of Object.entries(attrs))node.setAttribute(name,String(attribute));
  if(value!==undefined)node.textContent=String(value);
  return node;
 }
 // Increase the intrinsic VECTOR glyph size; do not zoom the HTML viewport.
 // Available Plan View height limits row height, while numbers remain large.
 function tableMetrics(width,planHeight,count){
  const preferredRowH=Math.max(50,Math.min(72,Math.round(width*.34)));
  const fittingRowH=Math.floor((planHeight-28)/(count+2.95));
  const rowH=Math.max(34,Math.min(preferredRowH,fittingRowH));
  const titleH=Math.round(rowH*1.16);
  const headingH=Math.round(rowH*1.05);
  const footerH=Math.max(26,Math.round(rowH*.64));
  const tableH=titleH+headingH+count*rowH;
  const fullH=tableH+footerH;
  const textSize=Math.max(23,Math.min(34,width/5.25,rowH*.84));
  return {rowH,titleH,headingH,footerH,tableH,fullH,textSize};
 }
 function drawVectorTable(panel,width,planHeight){
  // The protected controller remains the single source of displayed DME,
  // altitude and VDP labels. This is presentation ONLY; no new calculations.
  const existing=panel.querySelector('.jp-cdfa-table');
  if(!existing)return null;
  const rows=[...existing.querySelectorAll('tbody tr')].map(tr=>
   [...tr.querySelectorAll('td')].map(cell=>cell.textContent.trim()));
  if(!rows.length||rows.some(row=>row.length!==2))return null;

  const {rowH,titleH,headingH,footerH,tableH,fullH,textSize}=
   tableMetrics(width,planHeight,rows.length);
  const svg=svgNode('svg',{
   class:'jp-cdfa-vector',xmlns:SVG_NS,
   width:width,height:fullH,viewBox:`0 0 ${width} ${fullH}`,
   role:'img','aria-label':'CDFA data displayed as vector text'
  });
  // Keep SVG crisp; prefit with canvas metrics, then check real SVG length
  // after the panel becomes visible (essential for iPad WebKit).
  const mctx=document.createElement('canvas').getContext('2d');
  const halfCell=Math.max(1,width/2-10);
  const fullCell=Math.max(1,width-12);
  const lineY=(y)=>svg.appendChild(svgNode('line',{x1:0,y1:y,x2:width,y2:y,class:'jp-cdfa-rule'}));
  const label=(value,cx,cy,size,bold=800,maxWidth=halfCell)=>{
   const safeFont=fittedSvgFont(mctx,value,size,maxWidth,bold);
   const node=svgNode('text',{
    x:cx,y:cy,class:'jp-cdfa-vector-text',
    'font-size':safeFont.toFixed(2),'font-weight':bold,
    'text-anchor':'middle','dominant-baseline':'middle',
    'data-cdfa-max-width':maxWidth.toFixed(2)
   },value);
   svg.appendChild(node);
   return node;
  };
  svg.appendChild(svgNode('rect',{x:0,y:0,width,height:tableH,class:'jp-cdfa-fill'}));
  const frame=svgNode('rect',{x:.7,y:.7,width:width-1.4,height:tableH-1.4,class:'jp-cdfa-frame'});
  svg.appendChild(frame);
  lineY(titleH);lineY(titleH+headingH);
  svg.appendChild(svgNode('line',{x1:width*.5,y1:titleH,x2:width*.5,y2:tableH,class:'jp-cdfa-rule'}));
  label('CDFA DATA',width*.5,titleH*.51,Math.min(textSize*1.04,width/6.05),900,fullCell);
  label('DME',width*.25,titleH+headingH*.51,textSize*.76,850);
  label('ALT (ft)',width*.75,titleH+headingH*.51,textSize*.72,850);
  rows.forEach((row,i)=>{
   const y=titleH+headingH+i*rowH;
   if(i)lineY(y);
   label(row[0],width*.25,y+rowH*.53,textSize,850);
   label(row[1],width*.75,y+rowH*.53,textSize,850);
  });
  const warningSize=Math.max(6,Math.min(9.5,width/18));
  label('SIMULATOR QA ONLY',width*.5,tableH+footerH*.37,warningSize,700,fullCell);
  label('NOT FOR ACTUAL NAVIGATION',width*.5,tableH+footerH*.73,warningSize*.84,700,fullCell);
  // Preserve the original, accessible owner-locked table in the DOM.
  existing.hidden=true;
  const qaNote=panel.querySelector('.jp-cdfa-qa-note');
  if(qaNote)qaNote.hidden=true;
  panel.querySelector('.jp-cdfa-vector')?.remove();
  panel.appendChild(svg);
  // Panel can be hidden during creation. Measure rendered SVG once it becomes
  // visible, and repeat after font layout has settled in Mobile Safari.
  requestAnimationFrame(()=>ensureSvgColumnFit(svg));
  return fullH;
 }

 // The SVG is in the SAME PDF transform layer. At 100/200/400% zoom,
 // SVG glyphs and grid lines remain vector shapes, not scaled bitmaps.
 function position(panel){
  const layer=document.getElementById('chartTransformLayer');
  const canvas=document.getElementById('pdfCanvas');
  if(!layer||!canvas||!canvas.width)return false;
  const w=canvas.clientWidth||parseFloat(canvas.style.width);
  const h=canvas.clientHeight||parseFloat(canvas.style.height);
  if(!w||!h)return false;
  const border=outerRightBorder(canvas);
  if(border===null)return false;
  const borderGap=Math.max(8,Math.round(w*.006));
  const edgeGap=Math.max(8,Math.round(w*.006));
  const x=Math.ceil(border*w/canvas.width+borderGap);
  const marginWidth=Math.floor(w-x-edgeGap);
  if(marginWidth<64)return false;
  const planBoundary=planViewTop(canvas,border);
  if(planBoundary===null)return false;
  const planEnd=planViewBottom(canvas,border,planBoundary);
  const planTop=planBoundary*h/canvas.height+Math.max(8,w*.006);
  const planBottom=planEnd*h/canvas.height-Math.max(8,w*.006);
  if(planBottom<=planTop+100)return false;

  const tableHeight=drawVectorTable(panel,marginWidth,planBottom-planTop);
  if(!tableHeight)return false;
  // Center the complete table vertically in the PLAN VIEW, never the toolbar
  // or current viewport. Keep its bottom within the printed Plan View.
  const y=Math.round(Math.max(planTop,planTop+(planBottom-planTop-tableHeight)/2));
  if(y+tableHeight>h-12||!paperIsBlank(canvas,x,marginWidth,y,Math.min(tableHeight,h-y-12)))return false;
  panel.style.left=x+'px';
  panel.style.top=y+'px';
  panel.style.width=marginWidth+'px';
  panel.style.maxHeight='none';
  if(panel.parentElement!==layer)layer.appendChild(panel);
  return true;
 }
 window.JEPPIRAN_CDFA_MARGIN={position};
})();
