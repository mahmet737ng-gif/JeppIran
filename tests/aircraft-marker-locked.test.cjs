const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const {createHash}=require('node:crypto');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
const source=read('web/app.js');
function productionFunction(name){
  const start=source.indexOf('function '+name+'(');
  assert.ok(start>=0,'Missing production function '+name);
  return source.slice(start,source.indexOf('\n}',start)+2);
}

test('approved thin-outline arrow and pulse stylesheet cannot drift silently',()=>{
  const css=read('web/aircraft-marker-locked.css');
  assert.equal(createHash('sha256').update(css).digest('hex'),
    '63539b89276dbe29abb59aea06ff2ca8d553f7bc22f0c9809dcdba494e6fa16c',
    'Owner approval and a documented design revision are required to change the marker');
  const context={};
  vm.runInNewContext(productionFunction('aircraftMarkerMarkup'),context);
  assert.equal(context.aircraftMarkerMarkup(),'<span class="aircraft-halo"></span><span class="aircraft-pulse"></span><span class="aircraft-pulse aircraft-pulse-second"></span><svg class="aircraft-heading-arrow" viewBox="-24 -24 48 48" aria-hidden="true"><path class="aircraft-arrow-white" d="M0-21 L11 15 L0 8 L-11 15 Z"/><path class="aircraft-arrow-black" d="M0-21 L11 15 L0 8 L-11 15 Z"/></svg>');
  assert.match(productionFunction('updateAircraftMarker'),/marker\.innerHTML=aircraftMarkerMarkup\(\)/);
});

test('the real paint path keeps the marker and halo screen-sized throughout zoom',()=>{
  const layer={style:{setProperty(name,value){this[name]=value;}}};
  const stage={style:{}},label={};
  const context={chartZoom:1,chartPanX:18,chartPanY:-31,
    $:selector=>({'#chartTransformLayer':layer,'#pdfStage':stage,'#zoomValue':label}[selector])};
  vm.runInNewContext(productionFunction('aircraftMarkerScaleForZoom')+'\n'+productionFunction('paintChartTransform'),context);
  // Include fractional pinch/Find Me frames, zoom-out and future larger ranges.
  const zooms=[.25,.5,.75,1,1.25,1.5,2,3,4,8];
  for(let i=0;i<=181;i++)zooms.push(1+3*i/181);
  for(const zoom of zooms){
    context.chartZoom=zoom;
    context.paintChartTransform();
    const scale=Number(layer.style['--marker-inverse-scale']);
    assert.ok(Math.abs(32*zoom*scale-32)<1e-10,'32px marker at zoom '+zoom);
    assert.ok(Math.abs(17.33*2.7*zoom*scale-46.791)<1e-10,'fixed pulse footprint at zoom '+zoom);
    assert.equal(layer.style.transform,'translate3d(18px,-31px,0) scale('+zoom+')');
    assert.equal(label.textContent,Math.round(zoom*100)+'%');
  }
  for(const invalid of [undefined,NaN,0,-1,Infinity])
    assert.equal(context.aircraftMarkerScaleForZoom(invalid),1);
});

test('CSS inherits the chart scale and the locked layer loads after legacy styles',()=>{
  const css=read('web/aircraft-marker-locked.css'),legacy=read('web/styles.css'),html=read('web/index.html');
  assert.match(css,/--marker-inverse-scale:inherit;/);
  assert.doesNotMatch(legacy,/--marker-inverse-scale\s*:\s*1\s*;/);
  assert.ok(html.indexOf('aircraft-marker-locked.css')>html.indexOf('styles.css'));
  assert.ok(html.indexOf('aircraft-marker-locked.css')>html.indexOf('cdfa-locked.css'));
  assert.match(read('web/service-worker.js'),/\.\/aircraft-marker-locked\.css\?v=2621-aircraft-marker-locked-r1/);
});

test('all zoom controls and animated following use the compensated paint path',()=>{
  for(const name of ['beginFindMeTransition','trackAircraftFrame','applyChartTransform'])
    assert.match(productionFunction(name),/paintChartTransform\(\)/,name);
  for(const name of ['setChartZoom','zoomAround'])
    assert.match(productionFunction(name),/applyChartTransform\(\)/,name);
});
