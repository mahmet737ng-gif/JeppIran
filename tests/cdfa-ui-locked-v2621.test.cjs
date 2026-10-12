const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const root=path.resolve(__dirname,'..');
const read=p=>fs.readFileSync(path.join(root,p),'utf8');
test('locked CDFA table renders next to PDF rather than over it',()=>{
 const html=read('web/index.html'),js=read('web/cdfa-chart-panel.js'),css=read('web/cdfa-locked.css');
 assert.match(html,/data-locked-ui="CDFA_SIDE_TABLE_V1"/);
 assert.match(html,/<div id="pdfStage"/);
 assert.match(html,/<aside id="jpCdfaSide"/);
 assert.match(js,/\['DME','ALT \(ft\)'\]/);
 assert.match(js,/right:'VDP'/);
 assert.doesNotMatch(js,/pdfCanvas|chartTransformLayer|createElement\('canvas'\)/);
 assert.match(css,/flex:1 1 0/);
 assert.match(css,/:root\.light #chartsView \.jp-cdfa-side\{background:#fff;color:#000/);
 assert.match(css,/:root:not\(\.light\) #chartsView \.jp-cdfa-side/);
 assert.match(css,/#chartsView \.jp-cdfa-table\{[\s\S]*?background:#000;color:#fff/);
 assert.match(css,/body\.chart-inverted #chartsView \.jp-cdfa-table/);
 const native=read('app/src/main/java/com/tareghmsr/jeppiran/CdfaQaDialog.kt');
 const viewer=read('app/src/main/java/com/tareghmsr/jeppiran/PdfViewerActivity.kt');
 assert.match(native,/val gutterBg = if \(inverted\) Color\.BLACK else Color\.WHITE/);
 assert.match(native,/val bg = if \(inverted\) Color\.WHITE else Color\.BLACK/);
 assert.match(viewer,/CdfaQaDialog\.createPanel\(this, currentChartGlobalPage\(\), currentIcao, invertChart\)/);
 assert.doesNotMatch(css,/#chartsView \.jp-cdfa-side\{background:#000;color:#fff/);
});


test('calculated VDP is the LAST row, with no DME altitudes below it',()=>{
 const vm=require('node:vm');
 const js=read('web/cdfa-chart-panel.js');
 const from=js.indexOf(' function vdpInfo(record){');
 const to=js.indexOf(' function render(){');
 assert.ok(from>=0&&to>from,'pure CDFA row functions must exist');
 const run=vm.runInNewContext('(function(){'+js.slice(from,to)+' return rowsFor;})()', {});
 const example={
   table:[{dme:2,altitudeFt:1600},{dme:10,altitudeFt:3400},
          {dme:1,altitudeFt:1400},{dme:3,altitudeFt:1840},
          {dme:0,altitudeFt:1180},{dme:4,altitudeFt:2060}],
   vdp:{status:'CALCULATED_MDA_INTERCEPT_QA_ONLY',dmeNm:2.603,
        dmeDisplay:'D2.6',published:false}
 };
 const result=Array.from(run(example),r=>[r.left,r.right]);
 assert.deepEqual(result,[
   ['10.0','3400'],['4.0','2060'],['3.0','1840'],['2.6','VDP']
 ]);
 assert.equal(result.at(-1)[1],'VDP');
 const exact={...example,vdp:{...example.vdp,dmeNm:2,dmeDisplay:'D2.0'}};
 assert.deepEqual(Array.from(run(exact),r=>r.left),['10.0','4.0','3.0','2.0']);
 assert.equal(Array.from(run(exact)).at(-1).right,'VDP');
 const absent={...example,vdp:null};
 assert.deepEqual(Array.from(run(absent),r=>r.left),
   ['10.0','4.0','3.0','2.0','1.0','0.0']);
 const native=read('app/src/main/java/com/tareghmsr/jeppiran/CdfaQaDialog.kt');
 assert.match(native,/indexOfFirst\s*\{\s*it\.isVdp\s*\}/);
 assert.match(native,/descending\.take\(vdpIndex \+ 1\)/);
});


test('CDFA is part of the PDF transform and never reserves a sidebar',()=>{
 const html=read('web/index.html'),overlay=read('web/cdfa-margin-overlay.js');
 const css=read('web/cdfa-margin-overlay.css'),controller=read('web/cdfa-chart-panel.js');
 assert.match(html,/id="chartCdfaBtn"/);
 assert.match(html,/id="fullscreenCdfaBtn"/);
 assert.match(css,/#jpCdfaWorkspace > #pdfStage\{/);
 assert.match(css,/width:100%!important;flex:1 1 auto!important/);
 assert.match(css,/#chartTransformLayer > #jpCdfaSide\.jp-cdfa-side\{/);
 assert.match(css,/position:absolute!important/);
 assert.match(overlay,/layer\.appendChild\(panel\)/);
 assert.doesNotMatch(overlay,/viewer\.appendChild\(panel\)/);
 assert.doesNotMatch(overlay,/tableZoom|updateVertical|attachGestures|MutationObserver/);
 assert.doesNotMatch(controller,/dispatchEvent\(new Event\('jeppiran-cdfa-layout-changed'\)\)/);
});
test('CDFA uses real Plan View boundary and no overlap with frame or PDF edge',()=>{
 const overlay=read('web/cdfa-margin-overlay.js');
 assert.match(overlay,/function planViewTop\(canvas,borderX\)/);
 assert.match(overlay,/const planBoundary=planViewTop\(canvas,border\)/);
 assert.match(overlay,/const borderGap=Math\.max\(10/);
 assert.match(overlay,/const edgeGap=Math\.max\(10/);
 assert.match(overlay,/paperIsBlank\(canvas,x,marginWidth,y/);
 assert.match(overlay,/if\(marginWidth<64\)return false/);
});
test('CDFA INVERT OFF = white/black; INVERT ON = black/white independent of app theme',()=>{
 const css=read('web/cdfa-margin-overlay.css'),html=read('web/index.html');
 assert.match(css,/#chartsView #chartTransformLayer > #jpCdfaSide\.jp-cdfa-side,[\s\S]*?background:#fff!important;color:#000!important/);
 assert.match(css,/body\.chart-inverted #chartsView #chartTransformLayer > #jpCdfaSide\.jp-cdfa-side,[\s\S]*?background:#000!important;color:#fff!important/);
 assert.doesNotMatch(css,/:root\.light|:root:not\(\.light\)/);
 assert.match(css,/pointer-events:none!important/);
 assert.match(html,/cdfa-margin-overlay\.js\?v=2621-cdfa-pdf-attached-invert-r2/);
});
