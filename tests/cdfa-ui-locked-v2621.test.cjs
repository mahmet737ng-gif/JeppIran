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
 assert.match(css,/:root\.light .*jp-cdfa-side/);
 assert.match(css,/:root:not\(\.light\) .*jp-cdfa-side/);
});
