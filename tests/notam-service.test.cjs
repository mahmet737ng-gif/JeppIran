const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('NOTAM UI fails closed when feed missing or stale',()=>{
const js=fs.readFileSync('web/notam-service.js','utf8');
assert.match(js,/MAX_AGE=45\*60000/);
assert.match(js,/status!=="available"/);
assert.match(js,/FAA official search/);
assert.match(js,/notam-cache\/notams-current\.json/);
});