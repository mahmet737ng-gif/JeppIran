// Optional real-layout QA: NODE_PATH=<playwright modules> node scripts/verify_aircraft_marker_browser.cjs
// Uses production styles and production transform functions; no aircraft/georef data is modified.
const {chromium}=require('playwright');
const fs=require('node:fs');
const path=require('node:path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const src=read('web/app.js');
const fn=name=>{
  const start=src.indexOf('function '+name+'(');
  assert.ok(start>=0,name);
  return src.slice(start,src.indexOf('\n}',start)+2);
};
(async()=>{
  const browser=await chromium.launch({headless:true,...(process.env.JEPPIRAN_CHROME_BIN?{executablePath:process.env.JEPPIRAN_CHROME_BIN}:{})});
  try{
    const page=await browser.newPage({viewport:{width:900,height:600},deviceScaleFactor:2});
    await page.setContent('<div id="chartsView"><div id="pdfStage" style="width:600px;height:420px;position:relative;overflow:hidden;margin:40px"><div id="chartTransformLayer" class="chart-transform-layer" style="width:600px;height:800px"><canvas id="pdfCanvas" width="600" height="800" style="background:white"></canvas></div></div><span id="zoomValue"></span></div>');
    for(const file of ['web/styles.css','web/cdfa-locked.css','web/aircraft-marker-locked.css'])
      await page.addStyleTag({content:read(file)});
    await page.addScriptTag({content:'let chartZoom=1,chartPanX=0,chartPanY=0;const $=s=>document.querySelector(s);\n'+['aircraftMarkerMarkup','aircraftMarkerScaleForZoom','paintChartTransform'].map(fn).join('\n')});
    await page.evaluate(()=>{
      const marker=document.createElement('div');
      marker.id='aircraftMarker';marker.className='aircraft-marker visible';
      marker.innerHTML=aircraftMarkerMarkup();
      marker.style.left='300px';marker.style.top='200px';
      document.querySelector('#chartTransformLayer').appendChild(marker);
    });
    // Freeze each pulse at the same phase to compare its actual on-screen footprint.
    await page.addStyleTag({content:'.aircraft-marker .aircraft-pulse,.aircraft-marker .aircraft-halo{animation-play-state:paused!important;animation-delay:-.7s!important}'});
    let checks=0;
    for(const appearance of ['light','dark','inverted']){
      await page.evaluate(mode=>{
        document.documentElement.classList.toggle('light',mode==='light');
        document.body.classList.toggle('chart-inverted',mode==='inverted');
      },appearance);
      for(const heading of [0,27,90,183,315]){
        let baseline;
        for(const zoom of [1,1.125,1.25,1.5,1.875,2,2.625,3,3.375,4]){
          const r=await page.evaluate(({zoom,heading})=>{
            chartZoom=zoom;chartPanY=200-200*zoom;paintChartTransform();
            const marker=document.querySelector('#aircraftMarker');
            marker.style.setProperty('--aircraft-heading',heading+'deg');
            const size=sel=>{const r=document.querySelector(sel).getBoundingClientRect();return {w:r.width,h:r.height,x:r.x+r.width/2,y:r.y+r.height/2};};
            const canvas=document.querySelector('#pdfCanvas').getBoundingClientRect();
            return {marker:size('#aircraftMarker'),arrow:size('.aircraft-heading-arrow'),pulse:size('.aircraft-pulse'),fill:getComputedStyle(document.querySelector('.aircraft-arrow-black')).fill,anchor:{x:canvas.x+300*zoom,y:canvas.y+200*zoom}};
          },{zoom,heading});
          if(!baseline)baseline=r;
          for(const part of ['marker','arrow','pulse'])for(const axis of ['w','h'])
            assert.ok(Math.abs(r[part][axis]-baseline[part][axis])<.02,`${appearance} heading ${heading}, zoom ${zoom}: ${part} ${axis}`);
          for(const axis of ['x','y'])assert.ok(Math.abs(r.marker[axis]-r.anchor[axis])<.02,'chart anchor '+axis);
          assert.equal(r.fill,'rgb(239, 28, 168)');
          if(heading===0)assert.ok(Math.abs(r.marker.w-32)<.02,'32 CSS pixel box');
          checks++;
        }
      }
    }
    await page.evaluate(()=>document.querySelector('#aircraftMarker').classList.add('off-route'));
    assert.equal(await page.locator('.aircraft-arrow-black').evaluate(el=>getComputedStyle(el).fill),'rgb(249, 35, 64)');
    await page.emulateMedia({reducedMotion:'reduce'});
    assert.equal(await page.locator('.aircraft-pulse').first().evaluate(el=>getComputedStyle(el).animationName),'none');
    console.log(`PASS browser: ${checks} theme/heading/zoom combinations; fixed 32px box, fixed arrow/pulse, correct map anchor, inversion, taxi alert and reduced motion.`);
  }finally{await browser.close();}
})().catch(error=>{console.error(error);process.exitCode=1;});
