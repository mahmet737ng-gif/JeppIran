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

test('owner-approved WEB CDFA uses only existing PDF white margin',()=>{
 const html=read('web/index.html'),js=read('web/cdfa-chart-panel.js');
 const overlay=read('web/cdfa-margin-overlay.js'),css=read('web/cdfa-margin-overlay.css');
 assert.match(html,/id="chartCdfaBtn"/);
 assert.match(html,/id="fullscreenCdfaBtn"/);
 assert.match(html,/cdfa-margin-overlay\.js/);
 assert.match(overlay,/outerRightBorder\(canvas\)/);
 assert.match(overlay,/paperIsBlank\(canvas/);
 assert.match(overlay,/if\(available<64\)return false/);
 assert.match(overlay,/viewer\.appendChild\(panel\)/);
 assert.match(css,/width:100%!important;flex:1 1 auto!important/);
 assert.match(css,/position:absolute!important/);
 assert.match(css,/:root\.light #chartsView[\s\S]*?background:#fff!important;color:#000!important/);
 assert.match(css,/:root:not\(\.light\) #chartsView[\s\S]*?background:#000!important;color:#fff!important/);
 assert.doesNotMatch(js,/dispatchEvent\(new Event\('jeppiran-cdfa-layout-changed'\)\)/);
});

test('CDFA drag and zoom stay interactive and chart horizontal pan never shifts the overlay',()=>{
 const overlay=read('web/cdfa-margin-overlay.js'),css=read('web/cdfa-margin-overlay.css');
 assert.match(overlay,/viewer\.appendChild\(panel\)/);
 assert.match(overlay,/s\.dragY\+=e\.clientY-s\.dragLastY/);
 assert.match(overlay,/s\.tableZoom=clamp\(s\.pinchStart\.zoom\*current\/s\.pinchStart\.distance/);
 assert.match(overlay,/panel\.setPointerCapture\(e\.pointerId\)/);
 assert.match(overlay,/chartObserver\.observe\(layer/);
 assert.match(overlay,/stage\.addEventListener\('scroll',scheduleVertical/);
 assert.match(overlay,/chartPanX is ignored/);
 assert.match(css,/touch-action:none!important/);
 assert.match(css,/pointer-events:auto!important/);
 assert.match(css,/position:absolute!important/);
 assert.doesNotMatch(css,/pointer-events:none/);
});
