"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),crypto=require("node:crypto"),test=require("node:test");
const root=path.resolve(__dirname,"../..");
test("twenty approved original WebP images are present, unmodified, and reviewable in groups of 10",()=>{
 const dir=path.join(root,"web/airport-profile-posters-new20");
 const manifest=JSON.parse(fs.readFileSync(path.join(dir,"manifest.json"),"utf8"));
 assert.equal(manifest.schema,1);
 assert.equal(manifest.count,20);
 assert.equal(manifest.status,"published_review_gallery");
 assert.equal(manifest.assets.length,20);
 const actual=fs.readdirSync(dir).filter(x=>/^new20_\d\d\.webp$/.test(x)).sort();
 const expected=Array.from({length:20},(_,i)=>"new20_"+String(i+1).padStart(2,"0")+".webp");
 assert.deepEqual(actual,expected);
 for(let i=0;i<20;i++){
  const a=manifest.assets[i],file=expected[i],buffer=fs.readFileSync(path.join(dir,file));
  assert.equal(a.id,file.slice(0,-5));
  assert.equal(a.lower_right_city_symbol,true);
  assert.equal(a.flight_navigation_eligible,false);
  assert.equal(buffer.toString("ascii",0,4),"RIFF");
  assert.equal(buffer.toString("ascii",8,12),"WEBP");
  assert.equal(crypto.createHash("sha256").update(buffer).digest("hex"),a.sha256_webp,file);
 }
 const gallery=fs.readFileSync(path.join(dir,"index.html"),"utf8");
 assert.match(gallery,/const perPage=10/);
 assert.match(gallery,/for\(let n=first;n<=last;n\+\+\)/);
 assert.match(gallery,/\?batch=1/);
 assert.match(gallery,/\?batch=2/);
 assert.match(gallery,/new20_/);
 assert.match(gallery,/No airport code is assigned until correct mapping is confirmed/);
});
test("all fifty owner-locked original airport images remain untouched",()=>{
 const m=JSON.parse(fs.readFileSync(path.join(root,"web/airport-profile-posters/manifest.json"),"utf8"));
 assert.equal(m.expectedCount,50);
 for(const [icao,entry] of Object.entries(m.files)){
  const bytes=fs.readFileSync(path.join(root,"web/airport-profile-posters",icao+".webp"));
  assert.equal(crypto.createHash("sha256").update(bytes).digest("hex"),entry.sha256,icao);
 }
});
