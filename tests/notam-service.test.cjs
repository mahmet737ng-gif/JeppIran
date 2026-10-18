const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('NOTAM metadata controls never return after service-worker update',()=>{
 const js=fs.readFileSync('web/notam-service.js','utf8');
 const sw=fs.readFileSync('web/service-worker.js','utf8');
 const h=fs.readFileSync('web/index.html','utf8');
 assert.doesNotMatch(js,/FAA official search ↗|data-notam-refresh|FAA Search relay • |Informational only\. Verify with authorized/);
 assert.match(sw,/endsWith\("\/notam-service\.js"\)/);
 assert.match(sw,/endsWith\("\/notam-service\.css"\)/);
 assert.match(sw,/fetch\(event\.request,\{cache:"no-store"\}\)/);
 assert.match(h,/jp-notam-retired-controls/);
 assert.match(h,/notam-relay-clean-r3/);
});
