#!/usr/bin/env node
'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const os=require('node:os');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const dir=fs.mkdtempSync(path.join(os.tmpdir(),'jeppiran-stands-'));
try{
 const network=path.join(dir,'network.json'),input=path.join(dir,'stands.json'),output=path.join(dir,'out.json');
 fs.writeFileSync(network,JSON.stringify({airport:'TEST',cycle:'2621',nodes:{A:{lat:41,lon:28},B:{lat:41.0001,lon:28},C:{lat:41.001,lon:28}},edges:[{from:'A',to:'B',taxiway:'A'},{from:'B',to:'C',taxiway:'B'}]}));
 fs.writeFileSync(input,JSON.stringify({airport:'TEST',stands:[{id:'ST101',lat:41.00005,lon:28.0001,source:'synthetic test'}, {id:'ST102',lat:41.0006,lon:28.0001}, {id:'ST101',lat:41,lon:28}]}));
 const child=spawnSync(process.execPath,[path.join(__dirname,'import_taxi_stands.cjs'),network,input,output],{encoding:'utf8'});
 assert.equal(child.status,1,'duplicate should produce a nonzero exit status');
 const data=JSON.parse(fs.readFileSync(output,'utf8'));
 assert.equal(data.stats.valid,2);assert.equal(data.stats.rejected,1);
 assert.ok(data.stands.ST101.candidates.some(c=>c.taxiway==='A'));
 assert.ok(data.stands.ST102.candidates.some(c=>c.taxiway==='B'));
 assert.equal(data.routingApproved,false);
 assert.ok(data.stands.ST101.candidates.every(c=>c.routingApproved===false));
 console.log('PASS: multiple stands, alternate taxiways, duplicate detection and no automatic routing approvals');
}finally{fs.rmSync(dir,{recursive:true,force:true})}
